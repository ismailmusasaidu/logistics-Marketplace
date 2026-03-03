import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

type EmailTemplate =
  | "wallet_funding_initiated"
  | "wallet_funded_card"
  | "wallet_funded_transfer"
  | "wallet_funding_failed"
  | "wallet_debited"
  | "wallet_refunded"
  | "wallet_admin_credit"
  | "withdrawal_requested"
  | "withdrawal_completed"
  | "withdrawal_failed"
  | "marketplace_order_placed"
  | "marketplace_order_confirmed"
  | "marketplace_out_for_delivery"
  | "marketplace_order_delivered"
  | "marketplace_order_cancelled"
  | "marketplace_payment_received"
  | "logistics_order_confirmed"
  | "logistics_out_for_delivery"
  | "logistics_order_delivered"
  | "logistics_order_cancelled";

interface EmailData {
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

interface EmailRequest {
  template: EmailTemplate;
  to: string;
  data: EmailData;
}

function formatCurrency(amount: number | undefined): string {
  if (amount === undefined || isNaN(amount)) return "₦0.00";
  return `₦${amount.toLocaleString("en-NG", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function generateEmailHtml(template: EmailTemplate, data: EmailData): { subject: string; html: string } {
  const baseStyle = `
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, sans-serif; line-height: 1.6; color: #1f2937; margin: 0; padding: 0; background-color: #f3f4f6; }
    .container { max-width: 600px; margin: 0 auto; padding: 40px 20px; }
    .card { background-color: #ffffff; border-radius: 16px; padding: 32px; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1); }
    .header { text-align: center; margin-bottom: 32px; }
    .logo { font-size: 24px; font-weight: 700; color: #f97316; margin-bottom: 8px; }
    h1 { font-size: 22px; font-weight: 700; color: #111827; margin: 0 0 16px 0; }
    .content { font-size: 15px; color: #4b5563; }
    .highlight { background-color: #fff7ed; border-radius: 12px; padding: 20px; margin: 24px 0; }
    .highlight-success { background-color: #ecfdf5; }
    .highlight-error { background-color: #fef2f2; }
    .amount { font-size: 28px; font-weight: 700; color: #f97316; }
    .amount-success { color: #059669; }
    .amount-error { color: #dc2626; }
    .detail-row { display: flex; justify-content: space-between; padding: 12px 0; border-bottom: 1px solid #f3f4f6; }
    .detail-label { color: #6b7280; font-size: 14px; }
    .detail-value { color: #111827; font-weight: 600; font-size: 14px; }
    .footer { text-align: center; margin-top: 32px; padding-top: 24px; border-top: 1px solid #f3f4f6; color: #9ca3af; font-size: 13px; }
    .button { display: inline-block; background-color: #f97316; color: #ffffff; padding: 14px 28px; border-radius: 10px; text-decoration: none; font-weight: 600; margin-top: 16px; }
    .status-badge { display: inline-block; padding: 6px 14px; border-radius: 20px; font-weight: 600; font-size: 13px; }
    .status-success { background-color: #d1fae5; color: #065f46; }
    .status-pending { background-color: #fef3c7; color: #92400e; }
    .status-failed { background-color: #fee2e2; color: #991b1b; }
  `;

  const wrapper = (content: string, subject: string) => ({
    subject,
    html: `<!DOCTYPE html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><style>${baseStyle}</style></head><body><div class="container"><div class="card">${content}</div><div class="footer"><p>This is an automated message. Please do not reply to this email.</p><p>If you have questions, contact our support team.</p></div></div></body></html>`,
  });

  switch (template) {
    case "wallet_funding_initiated":
      return wrapper(`
        <div class="header"><div class="logo">Wallet</div></div>
        <h1>Funding Initiated</h1>
        <p class="content">Hi ${data.customerName || "Customer"},</p>
        <p class="content">Your wallet funding request has been initiated. Please complete the payment to add funds to your wallet.</p>
        <div class="highlight">
          <p style="margin:0 0 8px 0;color:#6b7280;font-size:13px;">Amount to Fund</p>
          <p class="amount" style="margin:0;">${formatCurrency(data.amount)}</p>
        </div>
        <table width="100%" style="margin-top:24px;">
          <tr><td class="detail-label">Reference</td><td class="detail-value" style="text-align:right;">${data.reference || "N/A"}</td></tr>
        </table>
        <p class="content" style="margin-top:24px;">Complete your payment to receive the funds in your wallet instantly.</p>
      `, `Wallet Funding Initiated - ${formatCurrency(data.amount)}`);

    case "wallet_funded_card":
      return wrapper(`
        <div class="header"><div class="logo">Wallet</div></div>
        <h1>Wallet Funded Successfully!</h1>
        <p class="content">Hi ${data.customerName || "Customer"},</p>
        <p class="content">Your wallet has been funded successfully via card payment.</p>
        <div class="highlight highlight-success">
          <p style="margin:0 0 8px 0;color:#065f46;font-size:13px;">Amount Added</p>
          <p class="amount amount-success" style="margin:0;">${formatCurrency(data.amount)}</p>
        </div>
        <table width="100%" style="margin-top:24px;">
          <tr><td class="detail-label">Reference</td><td class="detail-value" style="text-align:right;">${data.reference || "N/A"}</td></tr>
          <tr><td class="detail-label">New Balance</td><td class="detail-value" style="text-align:right;">${data.newBalance || "N/A"}</td></tr>
          <tr><td class="detail-label">Payment Method</td><td class="detail-value" style="text-align:right;">Card</td></tr>
        </table>
        <p class="content" style="margin-top:24px;">You can now use your wallet balance for orders and services.</p>
      `, `Wallet Funded - ${formatCurrency(data.amount)}`);

    case "wallet_funded_transfer":
      return wrapper(`
        <div class="header"><div class="logo">Wallet</div></div>
        <h1>Wallet Funded via Bank Transfer!</h1>
        <p class="content">Hi ${data.customerName || "Customer"},</p>
        <p class="content">We've received your bank transfer and your wallet has been credited.</p>
        <div class="highlight highlight-success">
          <p style="margin:0 0 8px 0;color:#065f46;font-size:13px;">Amount Added</p>
          <p class="amount amount-success" style="margin:0;">${formatCurrency(data.amount)}</p>
        </div>
        <table width="100%" style="margin-top:24px;">
          <tr><td class="detail-label">Reference</td><td class="detail-value" style="text-align:right;">${data.reference || "N/A"}</td></tr>
          <tr><td class="detail-label">New Balance</td><td class="detail-value" style="text-align:right;">${data.newBalance || "N/A"}</td></tr>
          <tr><td class="detail-label">Payment Method</td><td class="detail-value" style="text-align:right;">Bank Transfer</td></tr>
        </table>
      `, `Wallet Funded via Transfer - ${formatCurrency(data.amount)}`);

    case "wallet_funding_failed":
      return wrapper(`
        <div class="header"><div class="logo">Wallet</div></div>
        <h1>Funding Failed</h1>
        <p class="content">Hi ${data.customerName || "Customer"},</p>
        <p class="content">Unfortunately, your wallet funding attempt was unsuccessful.</p>
        <div class="highlight highlight-error">
          <p style="margin:0 0 8px 0;color:#991b1b;font-size:13px;">Amount Attempted</p>
          <p class="amount amount-error" style="margin:0;">${formatCurrency(data.amount)}</p>
        </div>
        <table width="100%" style="margin-top:24px;">
          <tr><td class="detail-label">Reference</td><td class="detail-value" style="text-align:right;">${data.reference || "N/A"}</td></tr>
          ${data.failureReason ? `<tr><td class="detail-label">Reason</td><td class="detail-value" style="text-align:right;">${data.failureReason}</td></tr>` : ""}
        </table>
        <p class="content" style="margin-top:24px;">Please try again or use a different payment method. If this issue persists, contact support.</p>
      `, `Wallet Funding Failed - ${formatCurrency(data.amount)}`);

    case "wallet_debited":
      return wrapper(`
        <div class="header"><div class="logo">Wallet</div></div>
        <h1>Wallet Debited</h1>
        <p class="content">Hi ${data.customerName || "Customer"},</p>
        <p class="content">Your wallet has been debited for an order payment.</p>
        <div class="highlight">
          <p style="margin:0 0 8px 0;color:#6b7280;font-size:13px;">Amount Debited</p>
          <p class="amount" style="margin:0;">${formatCurrency(data.amount)}</p>
        </div>
        <table width="100%" style="margin-top:24px;">
          <tr><td class="detail-label">Description</td><td class="detail-value" style="text-align:right;">${data.description || "Order Payment"}</td></tr>
          <tr><td class="detail-label">Reference</td><td class="detail-value" style="text-align:right;">${data.reference || "N/A"}</td></tr>
          <tr><td class="detail-label">New Balance</td><td class="detail-value" style="text-align:right;">${data.newBalance || "N/A"}</td></tr>
        </table>
      `, `Wallet Debited - ${formatCurrency(data.amount)}`);

    case "wallet_refunded":
      return wrapper(`
        <div class="header"><div class="logo">Wallet</div></div>
        <h1>Refund Processed</h1>
        <p class="content">Hi ${data.customerName || "Customer"},</p>
        <p class="content">A refund has been processed and credited to your wallet.</p>
        <div class="highlight highlight-success">
          <p style="margin:0 0 8px 0;color:#065f46;font-size:13px;">Refund Amount</p>
          <p class="amount amount-success" style="margin:0;">${formatCurrency(data.amount)}</p>
        </div>
        <table width="100%" style="margin-top:24px;">
          <tr><td class="detail-label">Description</td><td class="detail-value" style="text-align:right;">${data.description || "Refund"}</td></tr>
          <tr><td class="detail-label">Reference</td><td class="detail-value" style="text-align:right;">${data.reference || "N/A"}</td></tr>
          <tr><td class="detail-label">New Balance</td><td class="detail-value" style="text-align:right;">${data.newBalance || "N/A"}</td></tr>
        </table>
      `, `Wallet Refund Processed - ${formatCurrency(data.amount)}`);

    case "wallet_admin_credit":
      return wrapper(`
        <div class="header"><div class="logo">Wallet</div></div>
        <h1>Wallet Credited by Admin</h1>
        <p class="content">Hi ${data.customerName || "Customer"},</p>
        <p class="content">Your wallet has been credited by an administrator.</p>
        <div class="highlight highlight-success">
          <p style="margin:0 0 8px 0;color:#065f46;font-size:13px;">Amount Credited</p>
          <p class="amount amount-success" style="margin:0;">${formatCurrency(data.amount)}</p>
        </div>
        <table width="100%" style="margin-top:24px;">
          <tr><td class="detail-label">Description</td><td class="detail-value" style="text-align:right;">${data.description || "Admin Credit"}</td></tr>
          <tr><td class="detail-label">New Balance</td><td class="detail-value" style="text-align:right;">${data.newBalance || "N/A"}</td></tr>
        </table>
      `, `Wallet Credited - ${formatCurrency(data.amount)}`);

    case "withdrawal_requested":
      return wrapper(`
        <div class="header"><div class="logo">Wallet</div></div>
        <h1>Withdrawal Request Received</h1>
        <p class="content">Hi ${data.customerName || "Customer"},</p>
        <p class="content">Your withdrawal request has been received and is being processed.</p>
        <div class="highlight">
          <p style="margin:0 0 8px 0;color:#6b7280;font-size:13px;">Withdrawal Amount</p>
          <p class="amount" style="margin:0;">${formatCurrency(data.amount)}</p>
        </div>
        <table width="100%" style="margin-top:24px;">
          <tr><td class="detail-label">Bank</td><td class="detail-value" style="text-align:right;">${data.bankName || "N/A"}</td></tr>
          <tr><td class="detail-label">Account Name</td><td class="detail-value" style="text-align:right;">${data.accountName || "N/A"}</td></tr>
          <tr><td class="detail-label">Account Number</td><td class="detail-value" style="text-align:right;">${data.accountNumber || "N/A"}</td></tr>
          <tr><td class="detail-label">Fee</td><td class="detail-value" style="text-align:right;">${formatCurrency(data.fee)}</td></tr>
          <tr><td class="detail-label">Net Amount</td><td class="detail-value" style="text-align:right;color:#059669;font-weight:700;">${formatCurrency(data.netAmount)}</td></tr>
          <tr><td class="detail-label">Reference</td><td class="detail-value" style="text-align:right;">${data.reference || "N/A"}</td></tr>
        </table>
        <p class="content" style="margin-top:24px;">Your withdrawal is typically processed within 24 hours.</p>
      `, `Withdrawal Request - ${formatCurrency(data.amount)}`);

    case "withdrawal_completed":
      return wrapper(`
        <div class="header"><div class="logo">Wallet</div></div>
        <h1>Withdrawal Completed!</h1>
        <p class="content">Hi ${data.customerName || "Customer"},</p>
        <p class="content">Your withdrawal has been processed and sent to your bank account.</p>
        <div class="highlight highlight-success">
          <p style="margin:0 0 8px 0;color:#065f46;font-size:13px;">Amount Sent</p>
          <p class="amount amount-success" style="margin:0;">${formatCurrency(data.netAmount)}</p>
        </div>
        <table width="100%" style="margin-top:24px;">
          <tr><td class="detail-label">Bank</td><td class="detail-value" style="text-align:right;">${data.bankName || "N/A"}</td></tr>
          <tr><td class="detail-label">Account</td><td class="detail-value" style="text-align:right;">${data.accountName || "N/A"} (${data.accountNumber || "N/A"})</td></tr>
          <tr><td class="detail-label">Reference</td><td class="detail-value" style="text-align:right;">${data.reference || "N/A"}</td></tr>
        </table>
        <p class="content" style="margin-top:24px;">The funds should reflect in your bank account shortly.</p>
      `, `Withdrawal Completed - ${formatCurrency(data.netAmount)}`);

    case "withdrawal_failed":
      return wrapper(`
        <div class="header"><div class="logo">Wallet</div></div>
        <h1>Withdrawal Failed - Refunded</h1>
        <p class="content">Hi ${data.customerName || "Customer"},</p>
        <p class="content">Unfortunately, your withdrawal could not be processed. The full amount has been refunded to your wallet.</p>
        <div class="highlight highlight-error">
          <p style="margin:0 0 8px 0;color:#991b1b;font-size:13px;">Amount Refunded</p>
          <p class="amount amount-error" style="margin:0;">${formatCurrency(data.amount)}</p>
        </div>
        <table width="100%" style="margin-top:24px;">
          <tr><td class="detail-label">Reference</td><td class="detail-value" style="text-align:right;">${data.reference || "N/A"}</td></tr>
          ${data.failureReason ? `<tr><td class="detail-label">Reason</td><td class="detail-value" style="text-align:right;">${data.failureReason}</td></tr>` : ""}
        </table>
        <p class="content" style="margin-top:24px;">Please verify your bank details and try again, or contact support for assistance.</p>
      `, `Withdrawal Failed - Refunded ${formatCurrency(data.amount)}`);

    case "marketplace_order_placed":
      return wrapper(`
        <div class="header"><div class="logo">Marketplace</div></div>
        <h1>Order Placed Successfully!</h1>
        <p class="content">Hi ${data.customerName || "Customer"},</p>
        <p class="content">Thank you for your order! We've received your order and it's being processed.</p>
        <div class="highlight highlight-success">
          <p style="margin:0 0 8px 0;color:#065f46;font-size:13px;">Order Total</p>
          <p class="amount amount-success" style="margin:0;">${formatCurrency(data.totalAmount)}</p>
        </div>
        <table width="100%" style="margin-top:24px;">
          <tr><td class="detail-label">Order Number</td><td class="detail-value" style="text-align:right;">${data.orderNumber || "N/A"}</td></tr>
          <tr><td class="detail-label">Items</td><td class="detail-value" style="text-align:right;">${data.itemCount || 0} item(s)</td></tr>
          <tr><td class="detail-label">Vendor</td><td class="detail-value" style="text-align:right;">${data.vendorName || "N/A"}</td></tr>
          <tr><td class="detail-label">Delivery Address</td><td class="detail-value" style="text-align:right;">${data.deliveryAddress || "Pickup"}</td></tr>
        </table>
        <p class="content" style="margin-top:24px;">You'll receive an email notification when your order status is updated.</p>
      `, `Order Placed - #${data.orderNumber}`);

    case "marketplace_order_confirmed":
      return wrapper(`
        <div class="header"><div class="logo">Marketplace</div></div>
        <h1>Order Confirmed!</h1>
        <p class="content">Hi ${data.customerName || "Customer"},</p>
        <p class="content">Great news! Your order has been confirmed and is being prepared.</p>
        <div class="highlight highlight-success">
          <span class="status-badge status-success">Confirmed</span>
        </div>
        <table width="100%" style="margin-top:24px;">
          <tr><td class="detail-label">Order Number</td><td class="detail-value" style="text-align:right;">${data.orderNumber || "N/A"}</td></tr>
          <tr><td class="detail-label">Total</td><td class="detail-value" style="text-align:right;">${formatCurrency(data.totalAmount)}</td></tr>
        </table>
        <p class="content" style="margin-top:24px;">We'll notify you once your order is ready for delivery.</p>
      `, `Order Confirmed - #${data.orderNumber}`);

    case "marketplace_out_for_delivery":
      return wrapper(`
        <div class="header"><div class="logo">Marketplace</div></div>
        <h1>Order Out for Delivery!</h1>
        <p class="content">Hi ${data.customerName || "Customer"},</p>
        <p class="content">Your order is now on its way! Get ready to receive your package.</p>
        <div class="highlight">
          <span class="status-badge status-pending">Out for Delivery</span>
        </div>
        <table width="100%" style="margin-top:24px;">
          <tr><td class="detail-label">Order Number</td><td class="detail-value" style="text-align:right;">${data.orderNumber || "N/A"}</td></tr>
          <tr><td class="detail-label">Delivery Address</td><td class="detail-value" style="text-align:right;">${data.deliveryAddress || "N/A"}</td></tr>
        </table>
        <p class="content" style="margin-top:24px;">Please ensure someone is available to receive the delivery.</p>
      `, `Out for Delivery - #${data.orderNumber}`);

    case "marketplace_order_delivered":
      return wrapper(`
        <div class="header"><div class="logo">Marketplace</div></div>
        <h1>Order Delivered!</h1>
        <p class="content">Hi ${data.customerName || "Customer"},</p>
        <p class="content">Your order has been delivered successfully. We hope you enjoy your purchase!</p>
        <div class="highlight highlight-success">
          <span class="status-badge status-success">Delivered</span>
        </div>
        <table width="100%" style="margin-top:24px;">
          <tr><td class="detail-label">Order Number</td><td class="detail-value" style="text-align:right;">${data.orderNumber || "N/A"}</td></tr>
          <tr><td class="detail-label">Total</td><td class="detail-value" style="text-align:right;">${formatCurrency(data.totalAmount)}</td></tr>
        </table>
        <p class="content" style="margin-top:24px;">We'd love to hear your feedback! Please consider leaving a review for the products you purchased.</p>
      `, `Order Delivered - #${data.orderNumber}`);

    case "marketplace_order_cancelled":
      return wrapper(`
        <div class="header"><div class="logo">Marketplace</div></div>
        <h1>Order Cancelled</h1>
        <p class="content">Hi ${data.customerName || "Customer"},</p>
        <p class="content">Your order has been cancelled. If you paid via wallet, the amount has been refunded.</p>
        <div class="highlight highlight-error">
          <span class="status-badge status-failed">Cancelled</span>
        </div>
        <table width="100%" style="margin-top:24px;">
          <tr><td class="detail-label">Order Number</td><td class="detail-value" style="text-align:right;">${data.orderNumber || "N/A"}</td></tr>
          <tr><td class="detail-label">Original Total</td><td class="detail-value" style="text-align:right;">${formatCurrency(data.totalAmount)}</td></tr>
        </table>
        <p class="content" style="margin-top:24px;">If you have any questions about this cancellation, please contact our support team.</p>
      `, `Order Cancelled - #${data.orderNumber}`);

    case "marketplace_payment_received":
      return wrapper(`
        <div class="header"><div class="logo">Marketplace</div></div>
        <h1>Payment Confirmed</h1>
        <p class="content">Hi ${data.customerName || "Customer"},</p>
        <p class="content">Your payment has been received and confirmed. Your order is now being processed.</p>
        <div class="highlight highlight-success">
          <p style="margin:0 0 8px 0;color:#065f46;font-size:13px;">Payment Received</p>
          <p class="amount amount-success" style="margin:0;">${formatCurrency(data.totalAmount)}</p>
        </div>
        <table width="100%" style="margin-top:24px;">
          <tr><td class="detail-label">Order Number</td><td class="detail-value" style="text-align:right;">${data.orderNumber || "N/A"}</td></tr>
        </table>
      `, `Payment Confirmed - #${data.orderNumber}`);

    case "logistics_order_confirmed":
      return wrapper(`
        <div class="header"><div class="logo">Logistics</div></div>
        <h1>Delivery Order Confirmed!</h1>
        <p class="content">Hi ${data.customerName || "Customer"},</p>
        <p class="content">Your delivery order has been confirmed and a rider will pick it up soon.</p>
        <div class="highlight highlight-success">
          <span class="status-badge status-success">Confirmed</span>
        </div>
        <table width="100%" style="margin-top:24px;">
          <tr><td class="detail-label">Order Number</td><td class="detail-value" style="text-align:right;">${data.orderNumber || "N/A"}</td></tr>
          ${data.pickupAddress ? `<tr><td class="detail-label">Pickup</td><td class="detail-value" style="text-align:right;">${data.pickupAddress}</td></tr>` : ""}
          ${data.deliveryAddress ? `<tr><td class="detail-label">Delivery</td><td class="detail-value" style="text-align:right;">${data.deliveryAddress}</td></tr>` : ""}
          <tr><td class="detail-label">Total</td><td class="detail-value" style="text-align:right;">${formatCurrency(data.totalAmount)}</td></tr>
        </table>
      `, `Delivery Confirmed - #${data.orderNumber}`);

    case "logistics_out_for_delivery":
      return wrapper(`
        <div class="header"><div class="logo">Logistics</div></div>
        <h1>Package Out for Delivery!</h1>
        <p class="content">Hi ${data.customerName || "Customer"},</p>
        <p class="content">Your package is on its way! The rider has picked up your package and is heading to the delivery address.</p>
        <div class="highlight">
          <span class="status-badge status-pending">Out for Delivery</span>
        </div>
        <table width="100%" style="margin-top:24px;">
          <tr><td class="detail-label">Order Number</td><td class="detail-value" style="text-align:right;">${data.orderNumber || "N/A"}</td></tr>
          ${data.recipientName ? `<tr><td class="detail-label">Recipient</td><td class="detail-value" style="text-align:right;">${data.recipientName}</td></tr>` : ""}
          ${data.deliveryAddress ? `<tr><td class="detail-label">Delivery Address</td><td class="detail-value" style="text-align:right;">${data.deliveryAddress}</td></tr>` : ""}
        </table>
      `, `Out for Delivery - #${data.orderNumber}`);

    case "logistics_order_delivered":
      return wrapper(`
        <div class="header"><div class="logo">Logistics</div></div>
        <h1>Package Delivered!</h1>
        <p class="content">Hi ${data.customerName || "Customer"},</p>
        <p class="content">Your package has been delivered successfully. Thank you for using our delivery service!</p>
        <div class="highlight highlight-success">
          <span class="status-badge status-success">Delivered</span>
        </div>
        <table width="100%" style="margin-top:24px;">
          <tr><td class="detail-label">Order Number</td><td class="detail-value" style="text-align:right;">${data.orderNumber || "N/A"}</td></tr>
          <tr><td class="detail-label">Total</td><td class="detail-value" style="text-align:right;">${formatCurrency(data.totalAmount)}</td></tr>
        </table>
        <p class="content" style="margin-top:24px;">We'd love to hear your feedback on our delivery service!</p>
      `, `Delivery Completed - #${data.orderNumber}`);

    case "logistics_order_cancelled":
      return wrapper(`
        <div class="header"><div class="logo">Logistics</div></div>
        <h1>Delivery Order Cancelled</h1>
        <p class="content">Hi ${data.customerName || "Customer"},</p>
        <p class="content">Your delivery order has been cancelled. If you paid via wallet, the amount has been refunded.</p>
        <div class="highlight highlight-error">
          <span class="status-badge status-failed">Cancelled</span>
        </div>
        <table width="100%" style="margin-top:24px;">
          <tr><td class="detail-label">Order Number</td><td class="detail-value" style="text-align:right;">${data.orderNumber || "N/A"}</td></tr>
        </table>
        <p class="content" style="margin-top:24px;">If you have any questions, please contact our support team.</p>
      `, `Delivery Cancelled - #${data.orderNumber}`);

    default:
      return wrapper(`
        <h1>Notification</h1>
        <p class="content">You have a new notification from our platform.</p>
      `, "Notification");
  }
}

async function sendEmail(to: string, subject: string, html: string): Promise<{ success: boolean; error?: string }> {
  const resendApiKey = Deno.env.get("RESEND_API_KEY");
  if (!resendApiKey) {
    console.error("RESEND_API_KEY not configured");
    return { success: false, error: "RESEND_API_KEY not configured" };
  }

  const fromAddress = Deno.env.get("EMAIL_FROM_ADDRESS") || "noreply@danhausalogistics.com";

  try {
    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${resendApiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: fromAddress,
        to: [to],
        subject,
        html,
      }),
    });

    const responseData = await response.json();

    if (!response.ok) {
      console.error("Resend API error:", JSON.stringify(responseData));
      return { success: false, error: `Resend error ${response.status}: ${JSON.stringify(responseData)}` };
    }

    console.log("Email sent successfully to:", to, "id:", responseData.id);
    return { success: true };
  } catch (error: any) {
    console.error("Email sending error:", error);
    return { success: false, error: error.message };
  }
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const { template, to, data }: EmailRequest = await req.json();

    if (!template || !to) {
      return new Response(
        JSON.stringify({ success: false, error: "Missing required fields: template and to" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const { subject, html } = generateEmailHtml(template, data || {});
    const result = await sendEmail(to, subject, html);

    if (!result.success) {
      return new Response(
        JSON.stringify({ success: false, error: result.error || "Failed to send email" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(
      JSON.stringify({ success: true, message: "Email sent successfully" }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: any) {
    console.error("Send email error:", error);
    return new Response(
      JSON.stringify({ success: false, error: error.message || "Internal server error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
