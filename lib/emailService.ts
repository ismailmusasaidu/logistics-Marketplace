import { supabase } from '@/lib/supabase';

export type EmailTemplate =
  | 'wallet_funding_initiated'
  | 'wallet_funded_card'
  | 'wallet_funded_transfer'
  | 'wallet_funding_failed'
  | 'wallet_debited'
  | 'wallet_refunded'
  | 'wallet_admin_credit'
  | 'withdrawal_requested'
  | 'withdrawal_completed'
  | 'withdrawal_failed'
  | 'marketplace_order_placed'
  | 'marketplace_order_confirmed'
  | 'marketplace_out_for_delivery'
  | 'marketplace_order_delivered'
  | 'marketplace_order_cancelled'
  | 'marketplace_payment_received'
  | 'logistics_order_placed'
  | 'logistics_order_confirmed'
  | 'logistics_out_for_delivery'
  | 'logistics_order_delivered'
  | 'logistics_order_cancelled';

export interface EmailData {
  customerName?: string;
  amount?: number;
  reference?: string;
  orderNumber?: string;
  newBalance?: string;
  vendorName?: string;
  deliveryAddress?: string;
  bankName?: string;
  accountName?: string;
  accountNumber?: string;
  fee?: number;
  netAmount?: number;
  failureReason?: string;
  description?: string;
  itemCount?: number;
  totalAmount?: number;
  orderDate?: string;
  pickupAddress?: string;
  recipientName?: string;
}

export async function sendTransactionalEmail(
  template: EmailTemplate,
  to: string,
  data: EmailData
): Promise<boolean> {
  try {
    const response = await fetch(
      `${process.env.EXPO_PUBLIC_SUPABASE_URL}/functions/v1/send-email`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY}`,
        },
        body: JSON.stringify({ template, to, data }),
      }
    );

    if (!response.ok) {
      console.error('Failed to send email:', await response.text());
      return false;
    }

    return true;
  } catch (error) {
    console.error('Email service error:', error);
    return false;
  }
}

export async function sendMarketplaceOrderPlacedEmail(order: {
  orderNumber: string;
  customerEmail: string;
  customerName: string;
  vendorName?: string;
  totalAmount: number;
  itemCount: number;
  deliveryAddress?: string;
}) {
  return sendTransactionalEmail('marketplace_order_placed', order.customerEmail, {
    customerName: order.customerName,
    orderNumber: order.orderNumber,
    totalAmount: order.totalAmount,
    itemCount: order.itemCount,
    vendorName: order.vendorName,
    deliveryAddress: order.deliveryAddress || 'Pickup',
  });
}

export async function sendMarketplaceOrderStatusEmail(
  status: 'confirmed' | 'out_for_delivery' | 'delivered' | 'cancelled',
  order: {
    orderNumber: string;
    customerEmail: string;
    customerName: string;
    totalAmount?: number;
    deliveryAddress?: string;
  }
) {
  const templateMap: Record<string, EmailTemplate> = {
    confirmed: 'marketplace_order_confirmed',
    out_for_delivery: 'marketplace_out_for_delivery',
    delivered: 'marketplace_order_delivered',
    cancelled: 'marketplace_order_cancelled',
  };

  return sendTransactionalEmail(templateMap[status], order.customerEmail, {
    customerName: order.customerName,
    orderNumber: order.orderNumber,
    totalAmount: order.totalAmount,
    deliveryAddress: order.deliveryAddress,
  });
}

export async function sendMarketplacePaymentReceivedEmail(order: {
  orderNumber: string;
  customerEmail: string;
  customerName: string;
  totalAmount: number;
}) {
  return sendTransactionalEmail('marketplace_payment_received', order.customerEmail, {
    customerName: order.customerName,
    orderNumber: order.orderNumber,
    totalAmount: order.totalAmount,
  });
}

export async function sendLogisticsOrderPlacedEmail(order: {
  orderNumber: string;
  customerEmail: string;
  customerName: string;
  totalAmount?: number;
  pickupAddress?: string;
  deliveryAddress?: string;
  recipientName?: string;
}) {
  return sendTransactionalEmail('logistics_order_placed', order.customerEmail, {
    customerName: order.customerName,
    orderNumber: order.orderNumber,
    totalAmount: order.totalAmount,
    pickupAddress: order.pickupAddress,
    deliveryAddress: order.deliveryAddress,
    recipientName: order.recipientName,
  });
}

export async function sendLogisticsOrderStatusEmail(
  status: 'confirmed' | 'out_for_delivery' | 'delivered' | 'cancelled',
  order: {
    orderNumber: string;
    customerEmail: string;
    customerName: string;
    totalAmount?: number;
    pickupAddress?: string;
    deliveryAddress?: string;
    recipientName?: string;
  }
) {
  const templateMap: Record<string, EmailTemplate> = {
    confirmed: 'logistics_order_confirmed',
    out_for_delivery: 'logistics_out_for_delivery',
    delivered: 'logistics_order_delivered',
    cancelled: 'logistics_order_cancelled',
  };

  return sendTransactionalEmail(templateMap[status], order.customerEmail, {
    customerName: order.customerName,
    orderNumber: order.orderNumber,
    totalAmount: order.totalAmount,
    pickupAddress: order.pickupAddress,
    deliveryAddress: order.deliveryAddress,
    recipientName: order.recipientName,
  });
}
