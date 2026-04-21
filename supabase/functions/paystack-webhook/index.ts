import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.58.0";
import { createHmac } from "node:crypto";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, X-Paystack-Signature",
};

async function sendEmailNotification(template: string, to: string, data: Record<string, any>) {
  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const response = await fetch(`${supabaseUrl}/functions/v1/send-email`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ template, to, data }),
    });
    if (!response.ok) {
      console.error("Failed to send email:", await response.text());
    }
  } catch (error) {
    console.error("Email notification error:", error);
  }
}

interface PaystackChargeEvent {
  event: string;
  data: {
    id: number;
    domain: string;
    status: string;
    reference: string;
    amount: number;
    message: string | null;
    gateway_response: string;
    paid_at: string;
    created_at: string;
    channel: string;
    currency: string;
    ip_address: string;
    metadata: any;
    fees: number;
    customer: {
      id: number;
      first_name: string;
      last_name: string;
      email: string;
      customer_code: string;
      phone: string | null;
      metadata: any;
      risk_action: string;
    };
    authorization: any;
    plan: any;
  };
}

async function handleOrderPayment(
  supabase: any,
  reference: string,
  amountInNaira: number,
  paidAt: string,
) {
  // Look up the pending order for this reference
  const { data: pendingOrder, error: lookupError } = await supabase
    .from("pending_orders")
    .select("*")
    .eq("paystack_reference", reference)
    .eq("status", "pending")
    .maybeSingle();

  if (lookupError) {
    console.error("Error looking up pending order:", lookupError);
    throw lookupError;
  }

  if (!pendingOrder) {
    console.log("No pending order found for reference:", reference);
    return { handled: false };
  }

  // Check idempotency — mark as completed first to prevent double-processing
  const { error: updateError } = await supabase
    .from("pending_orders")
    .update({ status: "completed" })
    .eq("id", pendingOrder.id)
    .eq("status", "pending"); // only update if still pending

  if (updateError) {
    console.error("Error marking pending order as completed:", updateError);
    throw updateError;
  }

  const orderData = pendingOrder.order_data;
  const source = pendingOrder.source;

  if (source === "logistics") {
    await createLogisticsOrder(supabase, orderData, reference, paidAt);
  } else if (source === "marketplace") {
    await createMarketplaceOrders(supabase, orderData, reference, paidAt);
  }

  return { handled: true, source };
}

async function createLogisticsOrder(
  supabase: any,
  orderData: any,
  reference: string,
  paidAt: string,
) {
  const { data: orderResult, error: orderError } = await supabase
    .from("orders")
    .insert({
      customer_id: orderData.customer_id,
      order_number: orderData.order_number,
      pickup_address: orderData.pickup_address,
      pickup_instructions: orderData.pickup_instructions || null,
      delivery_address: orderData.delivery_address,
      delivery_instructions: orderData.delivery_instructions || null,
      recipient_name: orderData.recipient_name,
      recipient_phone: orderData.recipient_phone,
      package_description: orderData.package_description,
      order_size: orderData.order_size,
      order_types: orderData.order_types || [],
      delivery_fee: orderData.delivery_fee,
      payment_method: "online",
      payment_status: "completed",
      status: "pending",
      notes: orderData.notes || null,
      order_source: "logistics",
      scheduled_delivery_time: orderData.scheduled_delivery_time || null,
    })
    .select()
    .single();

  if (orderError) {
    // If it's a duplicate (order already created by manual verify), that's fine
    if (orderError.code === "23505") {
      console.log("Logistics order already exists for reference:", reference);
      return;
    }
    console.error("Error creating logistics order:", orderError);
    throw orderError;
  }

  console.log("Logistics order created by webhook:", orderResult.order_number);

  // Increment promo usage if applicable
  if (orderData.promo_code) {
    await supabase.rpc("increment_promo_usage", { promo_code_input: orderData.promo_code }).catch(
      (e: any) => console.error("Failed to increment promo usage:", e),
    );
  }

  // Trigger rider assignment
  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    await fetch(`${supabaseUrl}/functions/v1/assign-rider`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ order_id: orderResult.id }),
    });
  } catch (e) {
    console.error("Rider assignment error (non-fatal):", e);
  }

  // Send order confirmation email
  if (orderData.customer_email) {
    sendEmailNotification("logistics_order_placed", orderData.customer_email, {
      orderNumber: orderResult.order_number,
      customerName: orderData.customer_name || "Customer",
      totalAmount: orderData.delivery_fee,
      pickupAddress: orderData.pickup_address,
      deliveryAddress: orderData.delivery_address,
      recipientName: orderData.recipient_name,
    });
  }
}

async function createMarketplaceOrders(
  supabase: any,
  orderData: any,
  reference: string,
  paidAt: string,
) {
  const {
    customer_id,
    vendor_groups,
    delivery_type,
    delivery_address,
    delivery_speed,
    delivery_speed_cost,
    weight_surcharge_amount,
    weight_surcharge_label,
    promo_code,
    promo_id,
    promo_usage_count,
    batch_timestamp,
    customer_email,
    customer_name,
  } = orderData;

  const vendorIds = Object.keys(vendor_groups);
  const vendorCount = vendorIds.length;
  const createdOrderNumbers: string[] = [];

  for (let i = 0; i < vendorIds.length; i++) {
    const vendorId = vendorIds[i];
    const group = vendor_groups[vendorId];
    const vendorOrderNumber = vendorCount > 1
      ? `ORD-${batch_timestamp}-${i + 1}`
      : `ORD-${batch_timestamp}`;

    const { data: orderResult, error: orderError } = await supabase
      .from("orders")
      .insert({
        customer_id,
        vendor_id: vendorId,
        order_number: vendorOrderNumber,
        subtotal: group.subtotal,
        delivery_fee: group.delivery_fee,
        discount_amount: group.discount_amount,
        promo_code: promo_code || null,
        promo_id: promo_id || null,
        total: group.total,
        delivery_type,
        delivery_address,
        delivery_speed: delivery_speed || null,
        delivery_speed_cost: group.delivery_speed_cost || 0,
        weight_surcharge_amount: group.weight_surcharge_amount || 0,
        weight_surcharge_label: weight_surcharge_label || null,
        status: "pending",
        payment_method: "online",
        payment_status: "completed",
        order_source: "marketplace",
      })
      .select()
      .single();

    if (orderError) {
      if (orderError.code === "23505") {
        console.log("Marketplace order already exists:", vendorOrderNumber);
        continue;
      }
      console.error("Error creating marketplace order:", orderError);
      throw orderError;
    }

    console.log("Marketplace order created by webhook:", orderResult.order_number);

    // Insert order items
    if (group.items && group.items.length > 0) {
      const orderItems = group.items.map((item: any) => ({
        order_id: orderResult.id,
        product_id: item.product_id,
        quantity: item.quantity,
        unit_price: item.unit_price,
        subtotal: item.subtotal,
        selected_size: item.selected_size || null,
        selected_color: item.selected_color || null,
      }));

      const { error: itemsError } = await supabase.from("order_items").insert(orderItems);
      if (itemsError) {
        console.error("Error inserting order items:", itemsError);
        throw itemsError;
      }
    }

    createdOrderNumbers.push(vendorOrderNumber);
  }

  // Clear cart
  await supabase
    .from("carts")
    .delete()
    .eq("user_id", customer_id)
    .catch((e: any) => console.error("Failed to clear cart:", e));

  // Increment promo usage
  if (promo_id) {
    await supabase
      .from("promotions")
      .update({ usage_count: (promo_usage_count || 0) + 1 })
      .eq("id", promo_id)
      .catch((e: any) => console.error("Failed to update promo usage:", e));
  }

  // Send confirmation email
  if (customer_email && createdOrderNumbers.length > 0) {
    sendEmailNotification("marketplace_order_placed", customer_email, {
      orderNumber: createdOrderNumbers[0],
      customerName: customer_name || "Customer",
      totalAmount: orderData.total,
      itemCount: orderData.total_item_count || 0,
      deliveryAddress: delivery_type === "delivery" ? delivery_address : "Pickup",
    });
  }
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const paystackSecretKey = Deno.env.get("PAYSTACK_SECRET_KEY");

    if (!paystackSecretKey) {
      throw new Error("PAYSTACK_SECRET_KEY not configured");
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const signature = req.headers.get("x-paystack-signature");
    const body = await req.text();

    // Verify webhook signature
    if (signature) {
      const hash = createHmac("sha512", paystackSecretKey)
        .update(body)
        .digest("hex");

      if (hash !== signature) {
        return new Response(
          JSON.stringify({ error: "Invalid signature" }),
          { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }
    }

    const event: PaystackChargeEvent = JSON.parse(body);
    console.log("Webhook event received:", event.event, event.data?.reference);

    if (event.event === "charge.success" && event.data.status === "success") {
      const { data } = event;
      const reference = data.reference;
      const amountInKobo = data.amount;
      const amountInNaira = amountInKobo / 100;
      const metadataType = data.metadata?.type;

      console.log("Processing charge.success, type:", metadataType, "reference:", reference);

      // Route to order creation if this is an order payment
      if (metadataType === "order") {
        const { handled, source } = await handleOrderPayment(supabase, reference, amountInNaira, data.paid_at);
        if (handled) {
          return new Response(
            JSON.stringify({ success: true, message: `${source} order created successfully` }),
            { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
          );
        }
        // No pending_order found — may have already been handled by manual verify, just acknowledge
        return new Response(
          JSON.stringify({ success: true, message: "Payment acknowledged, order already processed" }),
          { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }

      // Existing logic: wallet recharge via virtual account transfer
      const customerCode = data.customer.customer_code;

      const { data: virtualAccount, error: accountError } = await supabase
        .from("virtual_accounts")
        .select("user_id")
        .eq("provider_reference", customerCode)
        .maybeSingle();

      if (accountError || !virtualAccount) {
        console.error("Virtual account not found for customer:", customerCode);
        return new Response(
          JSON.stringify({ error: "Virtual account not found" }),
          { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }

      const { data: existingRecharge } = await supabase
        .from("wallet_recharges")
        .select("id")
        .eq("payment_reference", reference)
        .maybeSingle();

      if (existingRecharge) {
        console.log("Transaction already processed, skipping:", reference);
        return new Response(
          JSON.stringify({ message: "Transaction already processed" }),
          { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }

      const { data: wallet, error: walletError } = await supabase
        .from("wallets")
        .select("balance")
        .eq("user_id", virtualAccount.user_id)
        .maybeSingle();

      if (walletError) {
        console.error("Error fetching wallet:", walletError);
        throw walletError;
      }

      const currentBalance = wallet?.balance || 0;
      const newBalance = currentBalance + amountInNaira;

      const { error: updateError } = await supabase
        .from("wallets")
        .upsert({
          user_id: virtualAccount.user_id,
          balance: newBalance,
          updated_at: new Date().toISOString(),
        }, { onConflict: "user_id" });

      if (updateError) {
        console.error("Error updating wallet:", updateError);
        throw updateError;
      }

      const { error: rechargeError } = await supabase
        .from("wallet_recharges")
        .insert({
          user_id: virtualAccount.user_id,
          amount: amountInNaira,
          payment_method: "transfer",
          payment_reference: reference,
          status: "completed",
          completed_at: data.paid_at,
        });

      if (rechargeError) {
        console.error("Error recording recharge:", rechargeError);
        throw rechargeError;
      }

      console.log("Wallet credited for reference:", reference);

      const { data: userProfile } = await supabase
        .from("profiles")
        .select("email, full_name")
        .eq("id", virtualAccount.user_id)
        .maybeSingle();

      if (userProfile?.email) {
        sendEmailNotification("wallet_funded_transfer", userProfile.email, {
          customerName: userProfile.full_name,
          amount: amountInNaira,
          reference,
          newBalance: `₦${newBalance.toLocaleString()}`,
        });
      }

      return new Response(
        JSON.stringify({ success: true, message: "Wallet credited successfully", amount: amountInNaira }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    if (event.event === "dedicatedaccount.assign.success") {
      console.log("Virtual account assigned successfully");
      return new Response(
        JSON.stringify({ message: "Event received" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    return new Response(
      JSON.stringify({ message: "Event received but not processed" }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (error) {
    console.error("Webhook error:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Internal server error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
