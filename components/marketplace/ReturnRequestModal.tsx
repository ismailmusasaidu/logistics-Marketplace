import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  TextInput,
  ScrollView,
  ActivityIndicator,
  Platform,
} from 'react-native';
import { X, RotateCcw, RefreshCw, ChevronDown } from 'lucide-react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { supabase } from '@/lib/marketplace/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { useTheme } from '@/contexts/ThemeContext';
import { Fonts } from '@/constants/fonts';

interface OrderItem {
  id: string;
  product_id: string;
  quantity: number;
  unit_price: number;
  product?: { name: string };
}

interface ReturnRequestModalProps {
  visible: boolean;
  onClose: () => void;
  orderId: string;
  orderNumber: string;
  orderTotal: number;
  items: OrderItem[];
  onSuccess: () => void;
}

const REASONS = [
  'Item arrived damaged',
  'Wrong item received',
  'Item not as described',
  'Changed my mind',
  'Quality not satisfactory',
  'Missing parts or accessories',
  'Other',
];

export default function ReturnRequestModal({
  visible,
  onClose,
  orderId,
  orderNumber,
  orderTotal,
  items,
  onSuccess,
}: ReturnRequestModalProps) {
  const insets = useSafeAreaInsets();
  const { profile } = useAuth();
  const { colors } = useTheme();
  const [returnType, setReturnType] = useState<'refund' | 'exchange'>('refund');
  const [selectedReason, setSelectedReason] = useState('');
  const [customReason, setCustomReason] = useState('');
  const [selectedItems, setSelectedItems] = useState<string[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [showReasonPicker, setShowReasonPicker] = useState(false);
  const [error, setError] = useState('');

  const toggleItem = (id: string) => {
    setSelectedItems(prev =>
      prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]
    );
  };

  const handleSubmit = async () => {
    setError('');
    const reason = selectedReason === 'Other' ? customReason.trim() : selectedReason;
    if (!reason) { setError('Please select or enter a reason.'); return; }

    setSubmitting(true);
    try {
      const { error: err } = await supabase.from('order_returns').insert({
        order_id: orderId,
        customer_id: profile!.id,
        item_ids: selectedItems.length > 0 ? selectedItems : items.map(i => i.id),
        reason,
        return_type: returnType,
        refund_amount: returnType === 'refund' ? orderTotal : 0,
        status: 'pending',
      });
      if (err) throw err;
      onSuccess();
      onClose();
    } catch {
      setError('Failed to submit request. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={styles.overlay}>
        <View style={[styles.sheet, { backgroundColor: colors.surface, paddingBottom: insets.bottom }]}>
          <View style={[styles.header, { borderBottomColor: colors.border }]}>
            <Text style={[styles.title, { color: colors.text }]}>Return / Exchange</Text>
            <Text style={[styles.orderNum, { color: colors.textMuted }]}>Order #{orderNumber}</Text>
            <TouchableOpacity style={styles.closeBtn} onPress={onClose}>
              <X size={20} color={colors.textSecondary} />
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.body} showsVerticalScrollIndicator={false}>
            <Text style={[styles.sectionLabel, { color: colors.textSecondary }]}>Request Type</Text>
            <View style={styles.typeRow}>
              <TouchableOpacity
                style={[styles.typeBtn, { borderColor: returnType === 'refund' ? colors.primary : colors.border, backgroundColor: returnType === 'refund' ? colors.primary + '15' : colors.surfaceSecondary }]}
                onPress={() => setReturnType('refund')}
              >
                <RotateCcw size={16} color={returnType === 'refund' ? colors.primary : colors.textSecondary} />
                <Text style={[styles.typeBtnText, { color: returnType === 'refund' ? colors.primary : colors.textSecondary }]}>Refund</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.typeBtn, { borderColor: returnType === 'exchange' ? colors.primary : colors.border, backgroundColor: returnType === 'exchange' ? colors.primary + '15' : colors.surfaceSecondary }]}
                onPress={() => setReturnType('exchange')}
              >
                <RefreshCw size={16} color={returnType === 'exchange' ? colors.primary : colors.textSecondary} />
                <Text style={[styles.typeBtnText, { color: returnType === 'exchange' ? colors.primary : colors.textSecondary }]}>Exchange</Text>
              </TouchableOpacity>
            </View>

            {items.length > 1 && (
              <>
                <Text style={[styles.sectionLabel, { color: colors.textSecondary }]}>Items (leave all selected to return entire order)</Text>
                {items.map(item => (
                  <TouchableOpacity
                    key={item.id}
                    style={[styles.itemRow, { borderColor: selectedItems.includes(item.id) ? colors.primary : colors.border, backgroundColor: selectedItems.includes(item.id) ? colors.primary + '08' : colors.surface }]}
                    onPress={() => toggleItem(item.id)}
                  >
                    <View style={[styles.checkbox, { borderColor: selectedItems.includes(item.id) ? colors.primary : colors.border, backgroundColor: selectedItems.includes(item.id) ? colors.primary : 'transparent' }]}>
                      {selectedItems.includes(item.id) && <Text style={styles.checkmark}>✓</Text>}
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={[styles.itemName, { color: colors.text }]} numberOfLines={1}>{item.product?.name || 'Product'}</Text>
                      <Text style={[styles.itemMeta, { color: colors.textMuted }]}>Qty: {item.quantity} · ₦{item.unit_price.toLocaleString()}</Text>
                    </View>
                  </TouchableOpacity>
                ))}
              </>
            )}

            <Text style={[styles.sectionLabel, { color: colors.textSecondary }]}>Reason</Text>
            <TouchableOpacity
              style={[styles.picker, { borderColor: colors.border, backgroundColor: colors.inputBackground }]}
              onPress={() => setShowReasonPicker(!showReasonPicker)}
            >
              <Text style={[styles.pickerText, { color: selectedReason ? colors.text : colors.textMuted }]}>
                {selectedReason || 'Select a reason...'}
              </Text>
              <ChevronDown size={16} color={colors.textMuted} />
            </TouchableOpacity>

            {showReasonPicker && (
              <View style={[styles.reasonList, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                {REASONS.map(r => (
                  <TouchableOpacity
                    key={r}
                    style={[styles.reasonItem, { borderBottomColor: colors.borderLight }]}
                    onPress={() => { setSelectedReason(r); setShowReasonPicker(false); }}
                  >
                    <Text style={[styles.reasonText, { color: colors.text }]}>{r}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            )}

            {selectedReason === 'Other' && (
              <TextInput
                style={[styles.textArea, { borderColor: colors.border, backgroundColor: colors.inputBackground, color: colors.text }]}
                value={customReason}
                onChangeText={setCustomReason}
                placeholder="Please describe the issue..."
                placeholderTextColor={colors.textMuted}
                multiline
                numberOfLines={3}
              />
            )}

            {returnType === 'refund' && (
              <View style={[styles.refundInfo, { backgroundColor: colors.successLight }]}>
                <Text style={[styles.refundText, { color: colors.success }]}>
                  If approved, ₦{orderTotal.toLocaleString()} will be credited to your wallet.
                </Text>
              </View>
            )}

            {error ? <Text style={[styles.error, { color: colors.error }]}>{error}</Text> : null}
          </ScrollView>

          <View style={[styles.footer, { borderTopColor: colors.border }]}>
            <TouchableOpacity style={[styles.cancelBtn, { borderColor: colors.border }]} onPress={onClose}>
              <Text style={[styles.cancelText, { color: colors.textSecondary }]}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.submitBtn, { backgroundColor: colors.primary, opacity: submitting ? 0.7 : 1 }]}
              onPress={handleSubmit}
              disabled={submitting}
            >
              {submitting ? <ActivityIndicator size="small" color="#fff" /> : <Text style={styles.submitText}>Submit Request</Text>}
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  sheet: { borderTopLeftRadius: 24, borderTopRightRadius: 24, maxHeight: '90%' },
  header: { flexDirection: 'row', alignItems: 'flex-start', padding: 20, paddingBottom: 16, borderBottomWidth: 1 },
  title: { fontSize: 18, fontFamily: Fonts.spaceBold, flex: 1 },
  orderNum: { fontSize: 13, fontFamily: Fonts.spaceRegular, marginTop: 2, marginRight: 32 },
  closeBtn: { position: 'absolute', top: 20, right: 20, padding: 4 },
  body: { padding: 20 },
  sectionLabel: { fontSize: 12, fontFamily: Fonts.spaceSemiBold, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 10, marginTop: 4 },
  typeRow: { flexDirection: 'row', gap: 10, marginBottom: 20 },
  typeBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, borderWidth: 1.5, borderRadius: 12, paddingVertical: 12 },
  typeBtnText: { fontSize: 14, fontFamily: Fonts.spaceSemiBold },
  itemRow: { flexDirection: 'row', alignItems: 'center', gap: 10, borderWidth: 1.5, borderRadius: 12, padding: 12, marginBottom: 8 },
  checkbox: { width: 20, height: 20, borderRadius: 6, borderWidth: 1.5, alignItems: 'center', justifyContent: 'center' },
  checkmark: { color: '#fff', fontSize: 12, lineHeight: 16 },
  itemName: { fontSize: 14, fontFamily: Fonts.spaceMedium },
  itemMeta: { fontSize: 12, fontFamily: Fonts.spaceRegular, marginTop: 2 },
  picker: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderWidth: 1, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 12, marginBottom: 4 },
  pickerText: { fontSize: 14, fontFamily: Fonts.spaceRegular },
  reasonList: { borderWidth: 1, borderRadius: 12, overflow: 'hidden', marginBottom: 12 },
  reasonItem: { paddingHorizontal: 14, paddingVertical: 12, borderBottomWidth: 1 },
  reasonText: { fontSize: 14, fontFamily: Fonts.spaceRegular },
  textArea: { borderWidth: 1, borderRadius: 12, padding: 12, fontSize: 14, fontFamily: Fonts.spaceRegular, textAlignVertical: 'top', marginTop: 10, minHeight: 80 },
  refundInfo: { borderRadius: 10, padding: 12, marginTop: 12 },
  refundText: { fontSize: 13, fontFamily: Fonts.spaceMedium, lineHeight: 18 },
  error: { fontSize: 13, fontFamily: Fonts.spaceRegular, marginTop: 10 },
  footer: { flexDirection: 'row', gap: 12, padding: 20, paddingTop: 16, borderTopWidth: 1 },
  cancelBtn: { flex: 1, borderWidth: 1, borderRadius: 12, paddingVertical: 13, alignItems: 'center' },
  cancelText: { fontSize: 14, fontFamily: Fonts.spaceSemiBold },
  submitBtn: { flex: 2, borderRadius: 12, paddingVertical: 13, alignItems: 'center' },
  submitText: { color: '#fff', fontSize: 14, fontFamily: Fonts.spaceSemiBold },
});
