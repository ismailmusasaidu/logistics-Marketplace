import { View, Text, StyleSheet, Modal, TouchableOpacity, ScrollView, Platform, Dimensions, Alert } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { X, Download, Package, MapPin, CreditCard, Calendar, CheckCircle, Share2, Printer } from 'lucide-react-native';
import { Order, OrderItem, Product } from '@/types/database';
import { Fonts } from '@/constants/fonts';
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

interface OrderItemWithProduct extends OrderItem {
  products: Product;
}

interface OrderReceiptProps {
  visible: boolean;
  order: Order | null;
  orderItems: OrderItemWithProduct[];
  onClose: () => void;
}

export default function OrderReceipt({
  visible,
  order,
  orderItems,
  onClose,
}: OrderReceiptProps) {
  const insets = useSafeAreaInsets();

  console.log('OrderReceipt - order:', order);
  console.log('OrderReceipt - orderItems:', orderItems);

  if (!order) return null;

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      month: 'long',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const getStatusLabel = (status: string) => {
    return status.replace(/_/g, ' ').replace(/\b\w/g, (l) => l.toUpperCase());
  };

  const getPaymentMethodLabel = (method: string) => {
    switch (method) {
      case 'cash_on_delivery':
        return 'Cash on Delivery';
      case 'wallet':
        return 'Wallet Payment';
      case 'online':
        return 'Online Payment';
      case 'transfer':
        return 'Bank Transfer';
      default:
        return method;
    }
  };

  const generateHTML = () => {
    return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <style>
    * {
      margin: 0;
      padding: 0;
      box-sizing: border-box;
    }
    html, body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Arial, sans-serif;
      padding: 0;
      margin: 0;
      color: #1f2937;
      font-size: 14px;
      line-height: 1.6;
      width: 400px;
      overflow: hidden;
    }
    .receipt {
      width: 400px;
      margin: 0;
      padding: 0;
      background: white;
    }
    .receipt-inner {
      padding: 24px 0 0 0;
    }
    .header {
      text-align: center;
      padding: 0 20px 20px 20px;
      border-bottom: 2px dashed #d1d5db;
      margin-bottom: 20px;
    }
    .brand-name {
      font-size: 26px;
      font-weight: bold;
      color: #ff8c00;
      letter-spacing: 1px;
      margin-bottom: 6px;
    }
    .brand-tagline {
      font-size: 13px;
      color: #6b7280;
      margin-top: 4px;
      font-weight: 600;
      text-transform: uppercase;
      letter-spacing: 0.5px;
    }
    .divider {
      border-top: 1px dashed #d1d5db;
      margin: 18px 20px;
    }
    .section {
      margin-bottom: 16px;
      padding: 0 20px;
    }
    .section-title {
      font-size: 13px;
      font-weight: bold;
      margin-bottom: 10px;
      text-transform: uppercase;
      color: #374151;
      letter-spacing: 0.5px;
    }
    .row {
      display: flex;
      justify-content: space-between;
      margin-bottom: 8px;
      font-size: 13px;
      line-height: 1.6;
    }
    .label {
      color: #6b7280;
      font-weight: 500;
    }
    .value {
      font-weight: 600;
      text-align: right;
      color: #1f2937;
    }
    .item {
      margin-bottom: 14px;
      padding-bottom: 12px;
      border-bottom: 1px dotted #e5e7eb;
    }
    .item:last-child {
      border-bottom: none;
    }
    .item-name {
      font-weight: 600;
      font-size: 14px;
      margin-bottom: 6px;
      color: #1f2937;
      line-height: 1.5;
    }
    .item-detail {
      display: flex;
      justify-content: space-between;
      font-size: 13px;
      color: #6b7280;
    }
    .item-detail span:last-child {
      font-weight: 600;
      color: #ff8c00;
    }
    .summary {
      margin-top: 16px;
      padding-top: 16px;
      border-top: 1px solid #d1d5db;
    }
    .summary-row {
      display: flex;
      justify-content: space-between;
      margin-bottom: 8px;
      font-size: 13px;
    }
    .summary-row span:first-child {
      color: #6b7280;
    }
    .summary-row span:last-child {
      font-weight: 600;
      color: #1f2937;
    }
    .total {
      margin-top: 12px;
      padding-top: 12px;
      border-top: 2px solid #1f2937;
      display: flex;
      justify-content: space-between;
      font-weight: bold;
      font-size: 18px;
    }
    .total span:first-child {
      color: #1f2937;
    }
    .total span:last-child {
      color: #ff8c00;
    }
    .footer {
      text-align: center;
      margin: 20px 20px 0 20px;
      padding-top: 16px;
      border-top: 2px dashed #d1d5db;
      font-size: 12px;
      color: #6b7280;
      line-height: 1.6;
    }
    .footer-title {
      font-weight: bold;
      color: #1f2937;
      font-size: 13px;
      margin-bottom: 4px;
    }
    .address {
      font-size: 13px;
      color: #4b5563;
      line-height: 1.6;
      margin-top: 8px;
      padding: 12px;
      background: #f9fafb;
      border-radius: 6px;
    }
    .delivery-type {
      display: inline-block;
      background: #fff7ed;
      color: #ff8c00;
      padding: 6px 12px;
      border-radius: 6px;
      font-size: 12px;
      font-weight: 600;
      margin-bottom: 8px;
    }
    .payment-status {
      display: inline-block;
      padding: 4px 10px;
      border-radius: 6px;
      font-size: 12px;
      font-weight: 600;
    }
    .payment-status.paid {
      background: #dcfce7;
      color: #059669;
    }
    .payment-status.pending {
      background: #fef3c7;
      color: #d97706;
    }
    @page {
      margin: 0;
      padding: 0;
    }
    @media print {
      html, body {
        margin: 0 !important;
        padding: 0 !important;
      }
      .receipt {
        margin: 0 !important;
        padding: 0 !important;
      }
      .receipt-inner {
        padding: 24px 0 0 0 !important;
      }
    }
  </style>
</head>
<body>
  <div class="receipt">
    <div class="receipt-inner">
      <div class="header">
        <div class="brand-name">MARKETPLACE</div>
        <div class="brand-tagline">Order Receipt</div>
      </div>

      <div class="section">
        <div class="row">
          <span class="label">Order Number:</span>
          <span class="value">${order.order_number}</span>
        </div>
        <div class="row">
          <span class="label">Date:</span>
          <span class="value">${new Date(order.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit' })}</span>
        </div>
        <div class="row">
          <span class="label">Status:</span>
          <span class="value">${getStatusLabel(order.status)}</span>
        </div>
      </div>

      <div class="divider"></div>

      <div class="section">
        <div class="section-title">Delivery Information</div>
        ${order.delivery_type ? `<div class="delivery-type">${order.delivery_type === 'home_delivery' ? 'Home Delivery' : 'Self Pickup'}</div>` : ''}
        <div class="address">${order.delivery_address}</div>
      </div>

      <div class="divider"></div>

      <div class="section">
        <div class="section-title">Order Items (${orderItems.length})</div>
        ${orderItems.map(item => `
          <div class="item">
            <div class="item-name">${item.products.name}</div>
            <div class="item-detail">
              <span>₦${item.unit_price.toFixed(2)} × ${item.quantity}</span>
              <span>₦${(item.unit_price * item.quantity).toFixed(2)}</span>
            </div>
          </div>
        `).join('')}
      </div>

      <div class="summary">
        <div class="summary-row">
          <span>Subtotal:</span>
          <span>₦${order.subtotal.toFixed(2)}</span>
        </div>
        <div class="summary-row">
          <span>Delivery Fee:</span>
          <span>₦${order.delivery_fee.toFixed(2)}</span>
        </div>
        <div class="summary-row">
          <span>Tax:</span>
          <span>₦${order.tax.toFixed(2)}</span>
        </div>
        <div class="total">
          <span>TOTAL</span>
          <span>₦${order.total.toFixed(2)}</span>
        </div>
      </div>

      <div class="divider"></div>

      <div class="section">
        <div class="section-title">Payment Information</div>
        <div class="row">
          <span class="label">Method:</span>
          <span class="value">${getPaymentMethodLabel(order.payment_method)}</span>
        </div>
        <div class="row">
          <span class="label">Status:</span>
          <span class="payment-status ${order.payment_status === 'completed' ? 'paid' : 'pending'}">${order.payment_status === 'completed' ? 'PAID' : 'PENDING'}</span>
        </div>
      </div>

      <div class="footer">
        <div class="footer-title">THANK YOU FOR YOUR ORDER!</div>
        Questions? Contact support
      </div>
    </div>
  </div>
</body>
</html>
    `;
  };

  const handlePrint = async () => {
    try {
      const html = generateHTML();

      if (Platform.OS === 'web') {
        // Create a blob URL for the HTML content
        const blob = new Blob([html], { type: 'text/html;charset=utf-8' });
        const blobUrl = URL.createObjectURL(blob);

        // Open the blob URL in a new window
        const printWindow = window.open(blobUrl, '_blank');

        if (printWindow) {
          // Wait for the content to load, then print
          printWindow.onload = () => {
            setTimeout(() => {
              printWindow.focus();
              printWindow.print();

              // Clean up blob URL after printing
              setTimeout(() => {
                URL.revokeObjectURL(blobUrl);
              }, 1000);
            }, 500);
          };
        }
      } else {
        // Use expo-print on mobile
        await Print.printAsync({ html });
      }
    } catch (error) {
      console.error('Print error:', error);
      if (Platform.OS !== 'web') {
        Alert.alert('Error', 'Failed to print receipt');
      }
    }
  };

  const handleDownload = async () => {
    try {
      const html = generateHTML();

      if (Platform.OS === 'web') {
        // For web, use html2pdf.js to generate and download PDF
        const html2pdf = (await import('html2pdf.js')).default;
        const fileName = `Receipt_${order.order_number}.pdf`;

        // Create a temporary div element to hold the HTML
        const tempContainer = document.createElement('div');
        tempContainer.style.position = 'absolute';
        tempContainer.style.left = '-9999px';
        tempContainer.style.top = '0';
        tempContainer.style.width = '400px';
        tempContainer.innerHTML = html;
        document.body.appendChild(tempContainer);

        // Get the receipt element immediately
        const receiptElement = tempContainer.querySelector('.receipt');

        if (receiptElement) {
          // Get actual content height
          const contentHeight = receiptElement.scrollHeight || 900;

          // Configure html2pdf options optimized for speed
          const options = {
            margin: 0,
            filename: fileName,
            image: { type: 'jpeg', quality: 0.85 },
            html2canvas: {
              scale: 2,
              useCORS: true,
              logging: false,
              width: 400,
              height: contentHeight,
              scrollY: 0,
              scrollX: 0,
              allowTaint: true,
              removeContainer: true
            },
            jsPDF: {
              unit: 'px',
              format: [400, contentHeight],
              orientation: 'portrait',
              compress: true
            },
            pagebreak: { mode: 'avoid-all' }
          };

          // Generate and download PDF from the receipt element
          await html2pdf().set(options).from(receiptElement).save();
        }

        // Clean up
        document.body.removeChild(tempContainer);
      } else {
        // Use expo-print on mobile
        console.log('Starting PDF generation...');
        const { uri } = await Print.printToFileAsync({
          html,
          base64: false
        });

        console.log('PDF generated at:', uri);

        const fileName = `Receipt_${order.order_number}.pdf`;

        // Check if sharing is available
        const isAvailable = await Sharing.isAvailableAsync();

        if (isAvailable) {
          await Sharing.shareAsync(uri, {
            mimeType: 'application/pdf',
            dialogTitle: `Download ${fileName}`,
            UTI: 'com.adobe.pdf'
          });
        } else {
          Alert.alert('Error', 'Sharing is not available on this device');
        }
      }
    } catch (error: any) {
      console.error('Error generating PDF:', error);
      if (Platform.OS !== 'web') {
        Alert.alert('Error', `Failed to generate PDF: ${error.message || 'Unknown error'}`);
      }
    }
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent={true}
      onRequestClose={onClose}
      statusBarTranslucent={Platform.OS !== 'web'}
    >
      <View style={styles.overlay}>
        <View style={styles.container}>
          <View style={[styles.header, Platform.OS !== 'web' && { paddingTop: insets.top + 20 }]}>
            <Text style={styles.headerTitle}>Order Receipt</Text>
            <View style={styles.headerActions}>
              {Platform.OS === 'web' ? (
                <>
                  <TouchableOpacity
                    style={styles.printButton}
                    onPress={handlePrint}
                    activeOpacity={0.7}
                  >
                    <Printer size={18} color="#6b7280" />
                    <Text style={styles.printButtonText}>Print</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={styles.downloadButton}
                    onPress={handleDownload}
                    activeOpacity={0.7}
                  >
                    <Download size={18} color="#ff8c00" />
                    <Text style={styles.downloadText}>Save PDF</Text>
                  </TouchableOpacity>
                </>
              ) : (
                <TouchableOpacity
                  style={styles.downloadButton}
                  onPress={handleDownload}
                  activeOpacity={0.7}
                >
                  <Download size={20} color="#ff8c00" />
                  <Text style={styles.downloadText}>Download PDF</Text>
                </TouchableOpacity>
              )}
              <TouchableOpacity
                style={styles.closeButton}
                onPress={onClose}
                activeOpacity={0.7}
              >
                <X size={24} color="#6b7280" />
              </TouchableOpacity>
            </View>
          </View>

          <ScrollView
            style={styles.content}
            contentContainerStyle={styles.contentContainer}
            showsVerticalScrollIndicator={false}
          >
            <View style={styles.receiptCard}>
              {Platform.OS !== 'web' && (
                <View style={{ padding: 12, backgroundColor: '#fef3c7', borderRadius: 8, marginBottom: 12 }}>
                  <Text style={{ fontSize: 12, color: '#92400e', fontFamily: Fonts.semiBold }}>
                    Debug: {orderItems.length} items loaded
                  </Text>
                  <Text style={{ fontSize: 10, color: '#92400e', marginTop: 4 }}>
                    Order ID: {order.id.substring(0, 8)}...
                  </Text>
                </View>
              )}
              {orderItems.length === 0 && (
                <View style={{ padding: 20, alignItems: 'center' }}>
                  <Text style={{ fontSize: 16, color: '#ef4444' }}>
                    No items found for this order
                  </Text>
                </View>
              )}
              <View style={styles.brandSection}>
                <Package size={48} color="#ff8c00" />
                <Text style={styles.brandName}>Marketplace</Text>
                <Text style={styles.brandTagline}>Order Receipt</Text>
              </View>

              <View style={styles.divider} />

              <View style={styles.orderInfoSection}>
                <View style={styles.infoRow}>
                  <Text style={styles.infoLabel}>Order Number</Text>
                  <Text style={styles.infoValue}>#{order.order_number}</Text>
                </View>
                <View style={styles.infoRow}>
                  <Text style={styles.infoLabel}>Order Date</Text>
                  <Text style={styles.infoValue}>{formatDate(order.created_at)}</Text>
                </View>
                <View style={styles.infoRow}>
                  <Text style={styles.infoLabel}>Status</Text>
                  <View style={styles.statusBadge}>
                    <Text style={styles.statusText}>{getStatusLabel(order.status)}</Text>
                  </View>
                </View>
                {order.delivered_at && (
                  <View style={styles.infoRow}>
                    <Text style={styles.infoLabel}>Delivered On</Text>
                    <Text style={styles.infoValue}>{formatDate(order.delivered_at)}</Text>
                  </View>
                )}
              </View>

              <View style={styles.divider} />

              <View style={styles.section}>
                <View style={styles.sectionHeader}>
                  <MapPin size={18} color="#ff8c00" />
                  <Text style={styles.sectionTitle}>Delivery Information</Text>
                </View>
                {order.delivery_type && (
                  <View style={styles.deliveryTypeBadge}>
                    <Text style={styles.deliveryTypeText}>
                      {order.delivery_type === 'home_delivery' ? 'Home Delivery' : 'Self Pickup'}
                    </Text>
                  </View>
                )}
                <Text style={styles.addressText}>{order.delivery_address}</Text>
              </View>

              <View style={styles.divider} />

              <View style={styles.section}>
                <View style={styles.sectionHeader}>
                  <Package size={18} color="#ff8c00" />
                  <Text style={styles.sectionTitle}>Order Items ({orderItems.length})</Text>
                </View>
                <View style={styles.itemsContainer}>
                  {orderItems.length > 0 ? (
                    orderItems.map((item, index) => {
                      console.log('Rendering item:', item);
                      return (
                        <View key={item.id} style={styles.itemRow}>
                          <View style={styles.itemInfo}>
                            <Text style={styles.itemName}>{item.products.name}</Text>
                            <Text style={styles.itemDetails}>
                              ₦{item.unit_price.toFixed(2)} × {item.quantity}
                            </Text>
                          </View>
                          <Text style={styles.itemTotal}>
                            ₦{(item.unit_price * item.quantity).toFixed(2)}
                          </Text>
                        </View>
                      );
                    })
                  ) : (
                    <Text style={{ color: '#ef4444', padding: 12 }}>No items in this order</Text>
                  )}
                </View>
              </View>

              <View style={styles.divider} />

              <View style={styles.section}>
                <View style={styles.summaryRow}>
                  <Text style={styles.summaryLabel}>Subtotal</Text>
                  <Text style={styles.summaryValue}>₦{order.subtotal.toFixed(2)}</Text>
                </View>
                <View style={styles.summaryRow}>
                  <Text style={styles.summaryLabel}>Delivery Fee</Text>
                  <Text style={styles.summaryValue}>₦{order.delivery_fee.toFixed(2)}</Text>
                </View>
                <View style={styles.summaryRow}>
                  <Text style={styles.summaryLabel}>Tax</Text>
                  <Text style={styles.summaryValue}>₦{order.tax.toFixed(2)}</Text>
                </View>
                <View style={[styles.summaryRow, styles.totalRow]}>
                  <Text style={styles.totalLabel}>Total Amount</Text>
                  <Text style={styles.totalValue}>₦{order.total.toFixed(2)}</Text>
                </View>
              </View>

              <View style={styles.divider} />

              <View style={styles.section}>
                <View style={styles.sectionHeader}>
                  <CreditCard size={18} color="#ff8c00" />
                  <Text style={styles.sectionTitle}>Payment Information</Text>
                </View>
                <View style={styles.paymentInfo}>
                  <View style={styles.infoRow}>
                    <Text style={styles.infoLabel}>Payment Method</Text>
                    <Text style={styles.paymentMethod}>
                      {getPaymentMethodLabel(order.payment_method)}
                    </Text>
                  </View>
                  <View style={styles.infoRow}>
                    <Text style={styles.infoLabel}>Payment Status</Text>
                    <View style={[
                      styles.paymentStatusBadge,
                      order.payment_status === 'completed' && styles.paymentStatusCompleted
                    ]}>
                      {order.payment_status === 'completed' && (
                        <CheckCircle size={14} color="#059669" />
                      )}
                      <Text style={[
                        styles.paymentStatusText,
                        order.payment_status === 'completed' && styles.paymentStatusTextCompleted
                      ]}>
                        {order.payment_status === 'completed' ? 'Paid' : 'Pending'}
                      </Text>
                    </View>
                  </View>
                </View>
              </View>

              <View style={styles.footer}>
                <Text style={styles.footerText}>Thank you for your order!</Text>
                <Text style={styles.footerSubtext}>
                  For any questions or concerns, please contact support.
                </Text>
              </View>
            </View>
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: Platform.OS === 'web' ? 'center' : 'flex-end',
    alignItems: 'center',
    padding: Platform.OS === 'web' ? 20 : 0,
  },
  container: {
    width: '100%',
    maxWidth: Platform.OS === 'web' ? 700 : SCREEN_WIDTH,
    ...(Platform.OS === 'web' ? { maxHeight: '90%' } : { flex: 1 }),
    backgroundColor: '#ffffff',
    borderRadius: Platform.OS === 'web' ? 20 : 0,
    borderTopLeftRadius: Platform.OS !== 'web' ? 20 : 20,
    borderTopRightRadius: Platform.OS !== 'web' ? 20 : 20,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.3,
    shadowRadius: 20,
    elevation: 10,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 24,
    paddingVertical: 20,
    backgroundColor: '#f8fafc',
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
  },
  headerTitle: {
    fontSize: 20,
    fontFamily: Fonts.headingBold,
    color: '#111827',
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  downloadButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff7ed',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 10,
    gap: 8,
  },
  downloadText: {
    fontSize: 14,
    fontFamily: Fonts.semiBold,
    color: '#ff8c00',
  },
  printButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f3f4f6',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 10,
    gap: 8,
  },
  printButtonText: {
    fontSize: 14,
    fontFamily: Fonts.semiBold,
    color: '#6b7280',
  },
  shareButton: {
    backgroundColor: '#fff7ed',
    padding: 12,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  closeButton: {
    backgroundColor: '#f3f4f6',
    padding: 10,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  content: {
    flex: 1,
  },
  contentContainer: {
    flexGrow: 1,
    paddingBottom: Platform.OS !== 'web' ? 20 : 0,
  },
  receiptCard: {
    padding: 24,
  },
  brandSection: {
    alignItems: 'center',
    paddingVertical: 24,
  },
  brandName: {
    fontSize: 28,
    fontFamily: Fonts.headingBold,
    color: '#ff8c00',
    marginTop: 12,
  },
  brandTagline: {
    fontSize: 14,
    fontFamily: Fonts.regular,
    color: '#6b7280',
    marginTop: 4,
  },
  divider: {
    height: 1,
    backgroundColor: '#e5e7eb',
    marginVertical: 24,
  },
  orderInfoSection: {
    gap: 12,
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  infoLabel: {
    fontSize: 14,
    fontFamily: Fonts.medium,
    color: '#6b7280',
  },
  infoValue: {
    fontSize: 14,
    fontFamily: Fonts.semiBold,
    color: '#111827',
  },
  statusBadge: {
    backgroundColor: '#dcfce7',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
  },
  statusText: {
    fontSize: 12,
    fontFamily: Fonts.bold,
    color: '#059669',
  },
  section: {
    gap: 12,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 4,
  },
  sectionTitle: {
    fontSize: 16,
    fontFamily: Fonts.bold,
    color: '#111827',
  },
  addressText: {
    fontSize: 15,
    fontFamily: Fonts.regular,
    color: '#4b5563',
    lineHeight: 22,
    backgroundColor: '#f9fafb',
    padding: 16,
    borderRadius: 12,
  },
  deliveryTypeBadge: {
    alignSelf: 'flex-start',
    backgroundColor: '#fff7ed',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    marginTop: 8,
  },
  deliveryTypeText: {
    fontSize: 12,
    fontFamily: Fonts.semiBold,
    color: '#ff8c00',
  },
  itemsContainer: {
    gap: 12,
  },
  itemRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    paddingVertical: 12,
    paddingHorizontal: 16,
    backgroundColor: '#f9fafb',
    borderRadius: 12,
  },
  itemInfo: {
    flex: 1,
    gap: 4,
  },
  itemName: {
    fontSize: 15,
    fontFamily: Fonts.semiBold,
    color: '#111827',
  },
  itemDetails: {
    fontSize: 13,
    fontFamily: Fonts.regular,
    color: '#6b7280',
  },
  itemTotal: {
    fontSize: 15,
    fontFamily: Fonts.bold,
    color: '#ff8c00',
    marginLeft: 12,
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
  },
  summaryLabel: {
    fontSize: 15,
    fontFamily: Fonts.regular,
    color: '#6b7280',
  },
  summaryValue: {
    fontSize: 15,
    fontFamily: Fonts.semiBold,
    color: '#111827',
  },
  totalRow: {
    paddingTop: 16,
    marginTop: 8,
    borderTopWidth: 2,
    borderTopColor: '#e5e7eb',
  },
  totalLabel: {
    fontSize: 18,
    fontFamily: Fonts.bold,
    color: '#111827',
  },
  totalValue: {
    fontSize: 24,
    fontFamily: Fonts.headingBold,
    color: '#ff8c00',
  },
  paymentInfo: {
    gap: 12,
  },
  paymentMethod: {
    fontSize: 14,
    fontFamily: Fonts.semiBold,
    color: '#ff8c00',
  },
  paymentStatusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fef3c7',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    gap: 4,
  },
  paymentStatusCompleted: {
    backgroundColor: '#dcfce7',
  },
  paymentStatusText: {
    fontSize: 12,
    fontFamily: Fonts.bold,
    color: '#d97706',
  },
  paymentStatusTextCompleted: {
    color: '#059669',
  },
  footer: {
    marginTop: 32,
    alignItems: 'center',
    paddingTop: 24,
    borderTopWidth: 1,
    borderTopColor: '#e5e7eb',
  },
  footerText: {
    fontSize: 16,
    fontFamily: Fonts.bold,
    color: '#111827',
    marginBottom: 8,
  },
  footerSubtext: {
    fontSize: 13,
    fontFamily: Fonts.regular,
    color: '#6b7280',
    textAlign: 'center',
  },
});
