import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  TextInput,
  Modal,
  ScrollView,
} from 'react-native';
import { RotateCcw, RefreshCw, Clock, CheckCircle, XCircle, Search, ChevronDown } from 'lucide-react-native';
import { supabase } from '@/lib/marketplace/supabase';
import { useTheme } from '@/contexts/ThemeContext';
import { Fonts } from '@/constants/fonts';
import EmptyState from '@/components/EmptyState';

interface ReturnRequest {
  id: string;
  order_id: string;
  customer_id: string;
  reason: string;
  return_type: 'refund' | 'exchange';
  status: 'pending' | 'approved' | 'rejected' | 'completed';
  admin_notes: string | null;
  refund_amount: number;
  created_at: string;
  orders?: { order_number: string; total: number };
  profiles?: { full_name: string; email: string };
}

const STATUS_CONFIG = {
  pending: { color: '#f59e0b', icon: Clock, label: 'Pending' },
  approved: { color: '#059669', icon: CheckCircle, label: 'Approved' },
  rejected: { color: '#ef4444', icon: XCircle, label: 'Rejected' },
  completed: { color: '#3b82f6', icon: CheckCircle, label: 'Completed' },
};

export default function ReturnManagement() {
  const { colors } = useTheme();
  const [returns, setReturns] = useState<ReturnRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [selected, setSelected] = useState<ReturnRequest | null>(null);
  const [adminNotes, setAdminNotes] = useState('');
  const [updating, setUpdating] = useState(false);

  useEffect(() => { fetchReturns(); }, [filterStatus]);

  const fetchReturns = async () => {
    setLoading(true);
    try {
      let query = supabase
        .from('order_returns')
        .select(`*, orders(order_number, total), profiles(full_name, email)`)
        .order('created_at', { ascending: false });
      if (filterStatus !== 'all') query = query.eq('status', filterStatus);
      const { data } = await query;
      setReturns(data || []);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const updateStatus = async (id: string, status: string) => {
    setUpdating(true);
    try {
      await supabase.from('order_returns').update({ status, admin_notes: adminNotes || null }).eq('id', id);
      if (status === 'approved' && selected?.return_type === 'refund' && selected.refund_amount > 0) {
        await supabase.rpc('credit_wallet', {
          p_user_id: selected.customer_id,
          p_amount: selected.refund_amount,
          p_description: `Refund for return request #${id.slice(0, 8)}`,
          p_reference_type: 'refund',
          p_reference_id: id,
        }).throwOnError();
      }
      setSelected(null);
      fetchReturns();
    } catch (e) {
      console.error(e);
    } finally {
      setUpdating(false);
    }
  };

  const filtered = returns.filter(r => {
    const q = searchQuery.toLowerCase();
    return !q || r.profiles?.full_name?.toLowerCase().includes(q) || r.orders?.order_number?.toLowerCase().includes(q);
  });

  const renderItem = ({ item }: { item: ReturnRequest }) => {
    const config = STATUS_CONFIG[item.status];
    const Icon = config.icon;
    return (
      <TouchableOpacity
        style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}
        onPress={() => { setSelected(item); setAdminNotes(item.admin_notes || ''); }}
        activeOpacity={0.8}
      >
        <View style={styles.cardTop}>
          <View style={styles.cardLeft}>
            <View style={[styles.typeTag, { backgroundColor: item.return_type === 'refund' ? colors.primary + '18' : '#3b82f618' }]}>
              {item.return_type === 'refund'
                ? <RotateCcw size={12} color={item.return_type === 'refund' ? colors.primary : '#3b82f6'} />
                : <RefreshCw size={12} color="#3b82f6" />
              }
              <Text style={[styles.typeText, { color: item.return_type === 'refund' ? colors.primary : '#3b82f6' }]}>
                {item.return_type}
              </Text>
            </View>
            <Text style={[styles.customerName, { color: colors.text }]}>{item.profiles?.full_name || 'Unknown'}</Text>
            <Text style={[styles.orderRef, { color: colors.textMuted }]}>Order #{item.orders?.order_number}</Text>
          </View>
          <View style={styles.cardRight}>
            <View style={[styles.statusBadge, { backgroundColor: config.color + '18' }]}>
              <Icon size={12} color={config.color} />
              <Text style={[styles.statusText, { color: config.color }]}>{config.label}</Text>
            </View>
            {item.return_type === 'refund' && (
              <Text style={[styles.amount, { color: colors.text }]}>₦{item.refund_amount.toLocaleString()}</Text>
            )}
          </View>
        </View>
        <Text style={[styles.reason, { color: colors.textSecondary }]} numberOfLines={2}>{item.reason}</Text>
        <Text style={[styles.date, { color: colors.textMuted }]}>{new Date(item.created_at).toLocaleDateString()}</Text>
      </TouchableOpacity>
    );
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={[styles.topBar, { backgroundColor: colors.surface, borderBottomColor: colors.border }]}>
        <View style={[styles.searchRow, { backgroundColor: colors.inputBackground, borderColor: colors.inputBorder }]}>
          <Search size={16} color={colors.textMuted} />
          <TextInput
            style={[styles.searchInput, { color: colors.text }]}
            value={searchQuery}
            onChangeText={setSearchQuery}
            placeholder="Search by customer or order..."
            placeholderTextColor={colors.textMuted}
          />
        </View>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.filterScroll}>
          {['all', 'pending', 'approved', 'rejected', 'completed'].map(s => (
            <TouchableOpacity
              key={s}
              style={[styles.filterBtn, { borderColor: filterStatus === s ? colors.primary : colors.border, backgroundColor: filterStatus === s ? colors.primary : colors.surface }]}
              onPress={() => setFilterStatus(s)}
            >
              <Text style={[styles.filterText, { color: filterStatus === s ? '#fff' : colors.textSecondary }]}>
                {s.charAt(0).toUpperCase() + s.slice(1)}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>

      {loading ? (
        <View style={styles.centered}><ActivityIndicator color={colors.primary} /></View>
      ) : filtered.length === 0 ? (
        <View style={styles.centered}>
          <EmptyState variant="orders" title="No return requests" subtitle="Return and exchange requests from customers will appear here." />
        </View>
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={i => i.id}
          renderItem={renderItem}
          contentContainerStyle={styles.list}
          showsVerticalScrollIndicator={false}
        />
      )}

      <Modal visible={!!selected} animationType="slide" transparent onRequestClose={() => setSelected(null)}>
        <View style={styles.modalOverlay}>
          <View style={[styles.modalSheet, { backgroundColor: colors.surface }]}>
            <Text style={[styles.modalTitle, { color: colors.text }]}>Review Return Request</Text>
            {selected && (
              <ScrollView>
                <View style={[styles.infoBlock, { backgroundColor: colors.surfaceSecondary }]}>
                  <Text style={[styles.infoLabel, { color: colors.textMuted }]}>Customer</Text>
                  <Text style={[styles.infoValue, { color: colors.text }]}>{selected.profiles?.full_name}</Text>
                  <Text style={[styles.infoLabel, { color: colors.textMuted }]}>Order</Text>
                  <Text style={[styles.infoValue, { color: colors.text }]}>#{selected.orders?.order_number}</Text>
                  <Text style={[styles.infoLabel, { color: colors.textMuted }]}>Type</Text>
                  <Text style={[styles.infoValue, { color: colors.text, textTransform: 'capitalize' }]}>{selected.return_type}</Text>
                  <Text style={[styles.infoLabel, { color: colors.textMuted }]}>Reason</Text>
                  <Text style={[styles.infoValue, { color: colors.text }]}>{selected.reason}</Text>
                  {selected.return_type === 'refund' && (
                    <>
                      <Text style={[styles.infoLabel, { color: colors.textMuted }]}>Refund Amount</Text>
                      <Text style={[styles.infoValue, { color: colors.success }]}>₦{selected.refund_amount.toLocaleString()}</Text>
                    </>
                  )}
                </View>
                <Text style={[styles.notesLabel, { color: colors.textSecondary }]}>Admin Notes (optional)</Text>
                <TextInput
                  style={[styles.notesInput, { borderColor: colors.border, backgroundColor: colors.inputBackground, color: colors.text }]}
                  value={adminNotes}
                  onChangeText={setAdminNotes}
                  placeholder="Add internal notes..."
                  placeholderTextColor={colors.textMuted}
                  multiline
                  numberOfLines={3}
                />
                <View style={styles.actionRow}>
                  <TouchableOpacity
                    style={[styles.actionBtn, { backgroundColor: '#ef444420', borderColor: '#ef4444' }]}
                    onPress={() => updateStatus(selected.id, 'rejected')}
                    disabled={updating}
                  >
                    <XCircle size={16} color="#ef4444" />
                    <Text style={[styles.actionText, { color: '#ef4444' }]}>Reject</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.actionBtn, { backgroundColor: '#05966920', borderColor: '#059669' }]}
                    onPress={() => updateStatus(selected.id, 'approved')}
                    disabled={updating}
                  >
                    {updating ? <ActivityIndicator size="small" color="#059669" /> : <CheckCircle size={16} color="#059669" />}
                    <Text style={[styles.actionText, { color: '#059669' }]}>Approve</Text>
                  </TouchableOpacity>
                </View>
                <TouchableOpacity
                  style={[styles.closeModalBtn, { borderColor: colors.border }]}
                  onPress={() => setSelected(null)}
                >
                  <Text style={[styles.closeModalText, { color: colors.textSecondary }]}>Close</Text>
                </TouchableOpacity>
              </ScrollView>
            )}
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  topBar: { padding: 12, borderBottomWidth: 1, gap: 10 },
  searchRow: { flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderRadius: 10, paddingHorizontal: 10, paddingVertical: 8, gap: 8 },
  searchInput: { flex: 1, fontSize: 14, fontFamily: Fonts.spaceRegular },
  filterScroll: { flexGrow: 0 },
  filterBtn: { borderWidth: 1, borderRadius: 20, paddingHorizontal: 12, paddingVertical: 6, marginRight: 6 },
  filterText: { fontSize: 12, fontFamily: Fonts.spaceSemiBold },
  list: { padding: 12, gap: 10 },
  card: { borderWidth: 1, borderRadius: 14, padding: 14, gap: 6 },
  cardTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  cardLeft: { flex: 1, gap: 3 },
  cardRight: { alignItems: 'flex-end', gap: 6 },
  typeTag: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6, alignSelf: 'flex-start', marginBottom: 4 },
  typeText: { fontSize: 11, fontFamily: Fonts.spaceSemiBold, textTransform: 'capitalize' },
  customerName: { fontSize: 14, fontFamily: Fonts.spaceSemiBold },
  orderRef: { fontSize: 12, fontFamily: Fonts.spaceRegular },
  statusBadge: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8 },
  statusText: { fontSize: 11, fontFamily: Fonts.spaceSemiBold },
  amount: { fontSize: 14, fontFamily: Fonts.spaceBold },
  reason: { fontSize: 13, fontFamily: Fonts.spaceRegular, lineHeight: 18 },
  date: { fontSize: 11, fontFamily: Fonts.spaceRegular },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  modalSheet: { borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 24, maxHeight: '80%' },
  modalTitle: { fontSize: 18, fontFamily: Fonts.spaceBold, marginBottom: 16 },
  infoBlock: { borderRadius: 12, padding: 14, marginBottom: 16, gap: 4 },
  infoLabel: { fontSize: 11, fontFamily: Fonts.spaceSemiBold, textTransform: 'uppercase', letterSpacing: 0.4, marginTop: 6 },
  infoValue: { fontSize: 14, fontFamily: Fonts.spaceMedium },
  notesLabel: { fontSize: 13, fontFamily: Fonts.spaceSemiBold, marginBottom: 8 },
  notesInput: { borderWidth: 1, borderRadius: 10, padding: 12, fontSize: 14, fontFamily: Fonts.spaceRegular, textAlignVertical: 'top', minHeight: 72, marginBottom: 16 },
  actionRow: { flexDirection: 'row', gap: 10, marginBottom: 12 },
  actionBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, borderWidth: 1, borderRadius: 12, paddingVertical: 12 },
  actionText: { fontSize: 14, fontFamily: Fonts.spaceSemiBold },
  closeModalBtn: { borderWidth: 1, borderRadius: 12, paddingVertical: 12, alignItems: 'center', marginBottom: 8 },
  closeModalText: { fontSize: 14, fontFamily: Fonts.spaceSemiBold },
});
