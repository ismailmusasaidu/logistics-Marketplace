import { useState, useEffect, useCallback } from 'react';
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
  RefreshControl,
} from 'react-native';
import { ArrowLeft, Search, X, CircleCheck as CheckCircle, Circle as XCircle, Clock, DollarSign, Building2, CreditCard, User, ChevronDown, ListFilter as Filter, CircleAlert as AlertCircle, Banknote, RotateCcw, CircleCheck } from 'lucide-react-native';
import { supabase } from '@/lib/marketplace/supabase';
import { Fonts } from '@/constants/fonts';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

interface VendorPayoutsProps {
  onBack?: () => void;
}

interface Payout {
  id: string;
  vendor_id: string | null;
  vendor_user_id: string | null;
  amount: number;
  status: 'pending' | 'approved' | 'processing' | 'completed' | 'rejected';
  bank_name: string | null;
  account_number: string | null;
  account_name: string | null;
  note: string | null;
  admin_note: string | null;
  processed_by: string | null;
  processed_at: string | null;
  created_at: string;
  vendor_name?: string;
  vendor_email?: string;
  vendor_business?: string;
}

interface PayoutStats {
  totalPending: number;
  totalApproved: number;
  totalCompleted: number;
  pendingAmount: number;
  completedAmount: number;
}

const STATUS_CONFIG: Record<string, { color: string; bg: string; icon: any; label: string }> = {
  pending:    { color: '#f59e0b', bg: '#fffbeb',  icon: Clock,        label: 'Pending' },
  approved:   { color: '#3b82f6', bg: '#eff6ff',  icon: CircleCheck,  label: 'Approved' },
  processing: { color: '#8b5cf6', bg: '#f5f3ff',  icon: RotateCcw,    label: 'Processing' },
  completed:  { color: '#059669', bg: '#ecfdf5',  icon: CheckCircle,  label: 'Completed' },
  rejected:   { color: '#ef4444', bg: '#fef2f2',  icon: XCircle,      label: 'Rejected' },
};

const FILTER_TABS = [
  { key: 'all',        label: 'All' },
  { key: 'pending',    label: 'Pending' },
  { key: 'approved',   label: 'Approved' },
  { key: 'processing', label: 'Processing' },
  { key: 'completed',  label: 'Completed' },
  { key: 'rejected',   label: 'Rejected' },
];

const STATUS_ACTIONS: Record<string, { next: string[]; labels: string[] }> = {
  pending:    { next: ['approved', 'rejected'],           labels: ['Approve', 'Reject'] },
  approved:   { next: ['processing', 'rejected'],         labels: ['Mark Processing', 'Reject'] },
  processing: { next: ['completed', 'rejected'],          labels: ['Mark Completed', 'Reject'] },
  completed:  { next: [],                                 labels: [] },
  rejected:   { next: ['pending'],                        labels: ['Reset to Pending'] },
};

export default function VendorPayouts({ onBack }: VendorPayoutsProps) {
  const insets = useSafeAreaInsets();
  const [payouts, setPayouts] = useState<Payout[]>([]);
  const [filtered, setFiltered] = useState<Payout[]>([]);
  const [stats, setStats] = useState<PayoutStats>({ totalPending: 0, totalApproved: 0, totalCompleted: 0, pendingAmount: 0, completedAmount: 0 });
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeFilter, setActiveFilter] = useState('all');
  const [selectedPayout, setSelectedPayout] = useState<Payout | null>(null);
  const [showModal, setShowModal] = useState(false);
  const [adminNote, setAdminNote] = useState('');
  const [processing, setProcessing] = useState(false);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [createForm, setCreateForm] = useState({
    vendorSearch: '',
    selectedVendorId: '',
    selectedVendorUserId: '',
    selectedVendorName: '',
    amount: '',
    bankName: '',
    accountNumber: '',
    accountName: '',
    note: '',
  });
  const [vendorResults, setVendorResults] = useState<any[]>([]);
  const [searchingVendors, setSearchingVendors] = useState(false);
  const [createError, setCreateError] = useState('');
  const [creating, setCreating] = useState(false);

  useEffect(() => { fetchPayouts(); }, []);

  useEffect(() => {
    let list = payouts;
    if (activeFilter !== 'all') list = list.filter(p => p.status === activeFilter);
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      list = list.filter(p =>
        p.vendor_name?.toLowerCase().includes(q) ||
        p.vendor_email?.toLowerCase().includes(q) ||
        p.vendor_business?.toLowerCase().includes(q) ||
        p.account_name?.toLowerCase().includes(q) ||
        p.account_number?.includes(q)
      );
    }
    setFiltered(list);
  }, [payouts, activeFilter, searchQuery]);

  const fetchPayouts = async (silent = false) => {
    try {
      if (!silent) setLoading(true);
      const { data, error } = await supabase
        .from('vendor_payouts')
        .select(`
          id, vendor_id, vendor_user_id, amount, status,
          bank_name, account_number, account_name,
          note, admin_note, processed_by, processed_at, created_at,
          profiles!vendor_user_id(full_name, email, business_name)
        `)
        .order('created_at', { ascending: false });

      if (error) throw error;

      const enriched: Payout[] = (data || []).map((p: any) => ({
        ...p,
        vendor_name: p.profiles?.full_name || 'Unknown',
        vendor_email: p.profiles?.email || '',
        vendor_business: p.profiles?.business_name || '',
      }));

      setPayouts(enriched);

      const pendingList  = enriched.filter(p => p.status === 'pending');
      const approvedList = enriched.filter(p => p.status === 'approved');
      const completedList = enriched.filter(p => p.status === 'completed');
      setStats({
        totalPending:    pendingList.length,
        totalApproved:   approvedList.length,
        totalCompleted:  completedList.length,
        pendingAmount:   pendingList.reduce((s, p) => s + p.amount, 0),
        completedAmount: completedList.reduce((s, p) => s + p.amount, 0),
      });
    } catch (err) {
      console.error('Error fetching payouts:', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const onRefresh = () => {
    setRefreshing(true);
    fetchPayouts(true);
  };

  const handleUpdateStatus = async (newStatus: string) => {
    if (!selectedPayout) return;
    try {
      setProcessing(true);
      const { error } = await supabase
        .from('vendor_payouts')
        .update({
          status: newStatus,
          admin_note: adminNote.trim() || null,
          processed_at: ['completed', 'rejected'].includes(newStatus) ? new Date().toISOString() : selectedPayout.processed_at,
          updated_at: new Date().toISOString(),
        })
        .eq('id', selectedPayout.id);

      if (error) throw error;

      setShowModal(false);
      setSelectedPayout(null);
      setAdminNote('');
      fetchPayouts(true);
    } catch (err) {
      console.error('Error updating payout:', err);
    } finally {
      setProcessing(false);
    }
  };

  const searchVendors = async (query: string) => {
    if (!query.trim()) { setVendorResults([]); return; }
    setSearchingVendors(true);
    try {
      const { data } = await supabase
        .from('profiles')
        .select('id, full_name, email, business_name')
        .eq('role', 'vendor')
        .eq('vendor_status', 'approved')
        .or(`full_name.ilike.%${query}%,email.ilike.%${query}%,business_name.ilike.%${query}%`)
        .limit(8);
      setVendorResults(data || []);
    } finally {
      setSearchingVendors(false);
    }
  };

  const handleCreatePayout = async () => {
    setCreateError('');
    if (!createForm.selectedVendorUserId) { setCreateError('Please select a vendor'); return; }
    if (!createForm.amount || isNaN(Number(createForm.amount)) || Number(createForm.amount) <= 0) {
      setCreateError('Enter a valid amount'); return;
    }
    if (!createForm.bankName || !createForm.accountNumber || !createForm.accountName) {
      setCreateError('Enter full bank details'); return;
    }

    try {
      setCreating(true);
      const { data: vendorRow } = await supabase
        .from('vendors')
        .select('id')
        .eq('user_id', createForm.selectedVendorUserId)
        .maybeSingle();

      const { error } = await supabase.from('vendor_payouts').insert({
        vendor_id: vendorRow?.id || null,
        vendor_user_id: createForm.selectedVendorUserId,
        amount: Number(createForm.amount),
        status: 'pending',
        bank_name: createForm.bankName,
        account_number: createForm.accountNumber,
        account_name: createForm.accountName,
        note: createForm.note.trim() || null,
      });

      if (error) throw error;

      setShowCreateModal(false);
      setCreateForm({ vendorSearch: '', selectedVendorId: '', selectedVendorUserId: '', selectedVendorName: '', amount: '', bankName: '', accountNumber: '', accountName: '', note: '' });
      setVendorResults([]);
      fetchPayouts(true);
    } catch (err: any) {
      setCreateError(err.message || 'Failed to create payout');
    } finally {
      setCreating(false);
    }
  };

  const fmt = (n: number) => `\u20A6${n.toLocaleString('en-NG', { minimumFractionDigits: 2 })}`;

  const renderPayout = ({ item }: { item: Payout }) => {
    const cfg = STATUS_CONFIG[item.status] || STATUS_CONFIG.pending;
    const StatusIcon = cfg.icon;
    return (
      <TouchableOpacity
        style={styles.card}
        onPress={() => { setSelectedPayout(item); setAdminNote(item.admin_note || ''); setShowModal(true); }}
        activeOpacity={0.7}
      >
        <View style={styles.cardTop}>
          <View style={styles.cardAvatarWrap}>
            <User size={18} color="#ff8c00" />
          </View>
          <View style={styles.cardMeta}>
            <Text style={styles.cardName}>{item.vendor_business || item.vendor_name}</Text>
            <Text style={styles.cardSub}>{item.vendor_email}</Text>
          </View>
          <View style={[styles.cardBadge, { backgroundColor: cfg.bg }]}>
            <StatusIcon size={11} color={cfg.color} />
            <Text style={[styles.cardBadgeText, { color: cfg.color }]}>{cfg.label}</Text>
          </View>
        </View>
        <View style={styles.cardDivider} />
        <View style={styles.cardBottom}>
          <View style={styles.cardAmountRow}>
            <DollarSign size={13} color="#8b909a" />
            <Text style={styles.cardAmount}>{fmt(item.amount)}</Text>
          </View>
          <View style={styles.cardBankRow}>
            <Building2 size={13} color="#8b909a" />
            <Text style={styles.cardBank}>{item.bank_name || 'N/A'}</Text>
          </View>
          <Text style={styles.cardDate}>{new Date(item.created_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}</Text>
        </View>
      </TouchableOpacity>
    );
  };

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color="#ff8c00" />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={[styles.header, { paddingTop: insets.top + 16 }]}>
        {onBack && (
          <TouchableOpacity onPress={onBack} style={styles.backBtn} activeOpacity={0.7}>
            <ArrowLeft size={20} color="#ffffff" />
          </TouchableOpacity>
        )}
        <Text style={styles.headerTitle}>Vendor Payouts</Text>
        <TouchableOpacity style={styles.createBtn} onPress={() => setShowCreateModal(true)} activeOpacity={0.7}>
          <Text style={styles.createBtnText}>+ New</Text>
        </TouchableOpacity>
      </View>

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.statsScroll}
        contentContainerStyle={styles.statsScrollContent}
      >
        <View style={styles.statCard}>
          <View style={[styles.statIconWrap, { backgroundColor: '#fffbeb' }]}>
            <Clock size={16} color="#f59e0b" />
          </View>
          <Text style={styles.statValue}>{stats.totalPending}</Text>
          <Text style={styles.statLabel}>Pending</Text>
          <Text style={styles.statAmt}>{fmt(stats.pendingAmount)}</Text>
        </View>
        <View style={styles.statCard}>
          <View style={[styles.statIconWrap, { backgroundColor: '#eff6ff' }]}>
            <CircleCheck size={16} color="#3b82f6" />
          </View>
          <Text style={styles.statValue}>{stats.totalApproved}</Text>
          <Text style={styles.statLabel}>Approved</Text>
          <Text style={styles.statAmt}>–</Text>
        </View>
        <View style={styles.statCard}>
          <View style={[styles.statIconWrap, { backgroundColor: '#ecfdf5' }]}>
            <CheckCircle size={16} color="#059669" />
          </View>
          <Text style={styles.statValue}>{stats.totalCompleted}</Text>
          <Text style={styles.statLabel}>Completed</Text>
          <Text style={styles.statAmt}>{fmt(stats.completedAmount)}</Text>
        </View>
      </ScrollView>

      <View style={styles.searchRow}>
        <View style={styles.searchWrap}>
          <Search size={16} color="#8b909a" />
          <TextInput
            style={styles.searchInput}
            placeholder="Search vendor, account..."
            placeholderTextColor="#8b909a"
            value={searchQuery}
            onChangeText={setSearchQuery}
          />
          {searchQuery.length > 0 && (
            <TouchableOpacity onPress={() => setSearchQuery('')}>
              <X size={16} color="#8b909a" />
            </TouchableOpacity>
          )}
        </View>
      </View>

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.filterScroll}
        contentContainerStyle={styles.filterScrollContent}
      >
        {FILTER_TABS.map(tab => (
          <TouchableOpacity
            key={tab.key}
            style={[styles.filterTab, activeFilter === tab.key && styles.filterTabActive]}
            onPress={() => setActiveFilter(tab.key)}
            activeOpacity={0.7}
          >
            <Text style={[styles.filterTabText, activeFilter === tab.key && styles.filterTabTextActive]}>
              {tab.label}
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      <FlatList
        data={filtered}
        keyExtractor={item => item.id}
        renderItem={renderPayout}
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#ff8c00" />}
        ListEmptyComponent={
          <View style={styles.emptyWrap}>
            <Banknote size={40} color="#d1d5db" />
            <Text style={styles.emptyTitle}>No payouts found</Text>
            <Text style={styles.emptySub}>Payout requests will appear here</Text>
          </View>
        }
      />

      {/* Detail / Action Modal */}
      <Modal visible={showModal} transparent animationType="slide" onRequestClose={() => setShowModal(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalSheet}>
            {selectedPayout && (() => {
              const cfg = STATUS_CONFIG[selectedPayout.status] || STATUS_CONFIG.pending;
              const actions = STATUS_ACTIONS[selectedPayout.status] || { next: [], labels: [] };
              return (
                <>
                  <View style={styles.modalHeader}>
                    <Text style={styles.modalTitle}>Payout Details</Text>
                    <TouchableOpacity onPress={() => { setShowModal(false); setAdminNote(''); }} style={styles.closeBtn}>
                      <X size={22} color="#8b909a" />
                    </TouchableOpacity>
                  </View>

                  <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.modalBody}>
                    <View style={[styles.statusBanner, { backgroundColor: cfg.bg }]}>
                      <cfg.icon size={16} color={cfg.color} />
                      <Text style={[styles.statusBannerText, { color: cfg.color }]}>{cfg.label}</Text>
                    </View>

                    <View style={styles.detailSection}>
                      <SectionHeader icon={User} title="Vendor" />
                      <DetailRow label="Name" value={selectedPayout.vendor_name || 'Unknown'} />
                      <DetailRow label="Business" value={selectedPayout.vendor_business || 'N/A'} />
                      <DetailRow label="Email" value={selectedPayout.vendor_email || 'N/A'} last />
                    </View>

                    <View style={styles.detailSection}>
                      <SectionHeader icon={DollarSign} title="Payout Amount" />
                      <View style={styles.amountDisplay}>
                        <Text style={styles.amountDisplayText}>{fmt(selectedPayout.amount)}</Text>
                      </View>
                    </View>

                    <View style={styles.detailSection}>
                      <SectionHeader icon={Building2} title="Bank Details" />
                      <DetailRow label="Bank" value={selectedPayout.bank_name || 'N/A'} />
                      <DetailRow label="Account No." value={selectedPayout.account_number || 'N/A'} />
                      <DetailRow label="Account Name" value={selectedPayout.account_name || 'N/A'} last />
                    </View>

                    {selectedPayout.note ? (
                      <View style={styles.noteCard}>
                        <Text style={styles.noteLabel}>Vendor Note</Text>
                        <Text style={styles.noteText}>{selectedPayout.note}</Text>
                      </View>
                    ) : null}

                    <View style={styles.detailSection}>
                      <SectionHeader icon={AlertCircle} title="Admin Note" />
                      <TextInput
                        style={styles.adminNoteInput}
                        placeholder="Add internal note (optional)..."
                        placeholderTextColor="#9ca3af"
                        value={adminNote}
                        onChangeText={setAdminNote}
                        multiline
                        numberOfLines={3}
                      />
                    </View>

                    {selectedPayout.processed_at && (
                      <View style={styles.processedInfo}>
                        <Text style={styles.processedInfoText}>
                          Processed: {new Date(selectedPayout.processed_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                        </Text>
                      </View>
                    )}

                    {actions.next.length > 0 && (
                      <View style={styles.actionButtons}>
                        {actions.next.map((status, i) => {
                          const isReject = status === 'rejected';
                          const isPrimary = !isReject;
                          return (
                            <TouchableOpacity
                              key={status}
                              style={[styles.actionBtn, isPrimary ? styles.actionBtnPrimary : styles.actionBtnDanger]}
                              onPress={() => handleUpdateStatus(status)}
                              disabled={processing}
                              activeOpacity={0.7}
                            >
                              {processing ? (
                                <ActivityIndicator color="#ffffff" size="small" />
                              ) : (
                                <Text style={styles.actionBtnText}>{actions.labels[i]}</Text>
                              )}
                            </TouchableOpacity>
                          );
                        })}
                      </View>
                    )}
                  </ScrollView>
                </>
              );
            })()}
          </View>
        </View>
      </Modal>

      {/* Create Payout Modal */}
      <Modal visible={showCreateModal} transparent animationType="slide" onRequestClose={() => setShowCreateModal(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalSheet}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>New Payout</Text>
              <TouchableOpacity onPress={() => { setShowCreateModal(false); setCreateError(''); }} style={styles.closeBtn}>
                <X size={22} color="#8b909a" />
              </TouchableOpacity>
            </View>

            <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.modalBody}>
              <Text style={styles.formLabel}>Vendor</Text>
              <View style={styles.vendorSearchWrap}>
                <Search size={15} color="#8b909a" />
                <TextInput
                  style={styles.vendorSearchInput}
                  placeholder="Search vendor name or email..."
                  placeholderTextColor="#9ca3af"
                  value={createForm.vendorSearch}
                  onChangeText={q => {
                    setCreateForm(f => ({ ...f, vendorSearch: q, selectedVendorUserId: '', selectedVendorName: '' }));
                    searchVendors(q);
                  }}
                />
                {searchingVendors && <ActivityIndicator size="small" color="#ff8c00" />}
              </View>

              {createForm.selectedVendorName ? (
                <View style={styles.selectedVendorBadge}>
                  <User size={13} color="#059669" />
                  <Text style={styles.selectedVendorText}>{createForm.selectedVendorName}</Text>
                  <TouchableOpacity onPress={() => setCreateForm(f => ({ ...f, selectedVendorUserId: '', selectedVendorName: '', vendorSearch: '' }))}>
                    <X size={14} color="#6b7280" />
                  </TouchableOpacity>
                </View>
              ) : vendorResults.length > 0 ? (
                <View style={styles.vendorDropdown}>
                  {vendorResults.map(v => (
                    <TouchableOpacity
                      key={v.id}
                      style={styles.vendorDropdownItem}
                      onPress={() => {
                        setCreateForm(f => ({ ...f, selectedVendorUserId: v.id, selectedVendorName: v.business_name || v.full_name, vendorSearch: v.business_name || v.full_name }));
                        setVendorResults([]);
                      }}
                      activeOpacity={0.7}
                    >
                      <Text style={styles.vendorDropdownName}>{v.business_name || v.full_name}</Text>
                      <Text style={styles.vendorDropdownEmail}>{v.email}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              ) : null}

              <Text style={[styles.formLabel, { marginTop: 16 }]}>Amount (₦)</Text>
              <TextInput
                style={styles.formInput}
                placeholder="0.00"
                placeholderTextColor="#9ca3af"
                value={createForm.amount}
                onChangeText={v => setCreateForm(f => ({ ...f, amount: v }))}
                keyboardType="decimal-pad"
              />

              <Text style={[styles.formLabel, { marginTop: 16 }]}>Bank Name</Text>
              <TextInput
                style={styles.formInput}
                placeholder="e.g. First Bank"
                placeholderTextColor="#9ca3af"
                value={createForm.bankName}
                onChangeText={v => setCreateForm(f => ({ ...f, bankName: v }))}
              />

              <Text style={[styles.formLabel, { marginTop: 16 }]}>Account Number</Text>
              <TextInput
                style={styles.formInput}
                placeholder="0123456789"
                placeholderTextColor="#9ca3af"
                value={createForm.accountNumber}
                onChangeText={v => setCreateForm(f => ({ ...f, accountNumber: v }))}
                keyboardType="numeric"
                maxLength={10}
              />

              <Text style={[styles.formLabel, { marginTop: 16 }]}>Account Name</Text>
              <TextInput
                style={styles.formInput}
                placeholder="Account holder name"
                placeholderTextColor="#9ca3af"
                value={createForm.accountName}
                onChangeText={v => setCreateForm(f => ({ ...f, accountName: v }))}
              />

              <Text style={[styles.formLabel, { marginTop: 16 }]}>Note (optional)</Text>
              <TextInput
                style={[styles.formInput, styles.formInputMulti]}
                placeholder="Reason or note..."
                placeholderTextColor="#9ca3af"
                value={createForm.note}
                onChangeText={v => setCreateForm(f => ({ ...f, note: v }))}
                multiline
                numberOfLines={3}
              />

              {createError ? (
                <View style={styles.errorBanner}>
                  <AlertCircle size={14} color="#ef4444" />
                  <Text style={styles.errorBannerText}>{createError}</Text>
                </View>
              ) : null}

              <TouchableOpacity
                style={[styles.createSubmitBtn, creating && { opacity: 0.6 }]}
                onPress={handleCreatePayout}
                disabled={creating}
                activeOpacity={0.7}
              >
                {creating ? (
                  <ActivityIndicator color="#ffffff" size="small" />
                ) : (
                  <Text style={styles.createSubmitText}>Create Payout</Text>
                )}
              </TouchableOpacity>

              <View style={{ height: 24 }} />
            </ScrollView>
          </View>
        </View>
      </Modal>
    </View>
  );
}

function SectionHeader({ icon: Icon, title }: { icon: any; title: string }) {
  return (
    <View style={detailStyles.sectionHeader}>
      <Icon size={13} color="#ff8c00" />
      <Text style={detailStyles.sectionTitle}>{title}</Text>
    </View>
  );
}

function DetailRow({ label, value, last }: { label: string; value: string; last?: boolean }) {
  return (
    <View style={[detailStyles.row, !last && detailStyles.rowBorder]}>
      <Text style={detailStyles.rowLabel}>{label}</Text>
      <Text style={detailStyles.rowValue}>{value}</Text>
    </View>
  );
}

const detailStyles = StyleSheet.create({
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 8,
  },
  sectionTitle: {
    fontFamily: Fonts.semiBold,
    fontSize: 12,
    color: '#1a1d23',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    paddingVertical: 11,
    gap: 12,
  },
  rowBorder: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#e5e7eb',
  },
  rowLabel: {
    fontFamily: Fonts.medium,
    fontSize: 13,
    color: '#8b909a',
    flex: 1,
  },
  rowValue: {
    fontFamily: Fonts.semiBold,
    fontSize: 13,
    color: '#1a1d23',
    flex: 1.4,
    textAlign: 'right',
  },
});

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8f9fb',
  },
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f8f9fb',
  },
  header: {
    backgroundColor: '#1a1d23',
    paddingHorizontal: 20,
    paddingBottom: 20,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    borderBottomLeftRadius: 24,
    borderBottomRightRadius: 24,
  },
  backBtn: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: 'rgba(255,255,255,0.1)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerTitle: {
    fontFamily: Fonts.heading,
    fontSize: 20,
    color: '#ffffff',
    flex: 1,
  },
  createBtn: {
    backgroundColor: '#ff8c00',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 10,
  },
  createBtnText: {
    fontFamily: Fonts.semiBold,
    fontSize: 13,
    color: '#ffffff',
  },
  statsScroll: {
    maxHeight: 110,
    marginTop: 16,
  },
  statsScrollContent: {
    paddingHorizontal: 16,
    gap: 12,
  },
  statCard: {
    backgroundColor: '#ffffff',
    borderRadius: 16,
    padding: 16,
    width: 130,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 6,
    elevation: 2,
  },
  statIconWrap: {
    width: 32,
    height: 32,
    borderRadius: 9,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 8,
  },
  statValue: {
    fontFamily: Fonts.groteskBold,
    fontSize: 22,
    color: '#1a1d23',
    letterSpacing: -0.5,
  },
  statLabel: {
    fontFamily: Fonts.medium,
    fontSize: 12,
    color: '#8b909a',
    marginTop: 1,
  },
  statAmt: {
    fontFamily: Fonts.regular,
    fontSize: 11,
    color: '#9ca3af',
    marginTop: 2,
  },
  searchRow: {
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 8,
  },
  searchWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#ffffff',
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 10,
    gap: 10,
    borderWidth: 1,
    borderColor: '#f0f1f3',
  },
  searchInput: {
    flex: 1,
    fontFamily: Fonts.regular,
    fontSize: 14,
    color: '#1a1d23',
    padding: 0,
  },
  filterScroll: {
    maxHeight: 44,
    marginBottom: 4,
  },
  filterScrollContent: {
    paddingHorizontal: 16,
    gap: 8,
    alignItems: 'center',
  },
  filterTab: {
    paddingHorizontal: 16,
    paddingVertical: 7,
    borderRadius: 20,
    backgroundColor: '#f0f1f3',
  },
  filterTabActive: {
    backgroundColor: '#ff8c00',
  },
  filterTabText: {
    fontFamily: Fonts.medium,
    fontSize: 13,
    color: '#6b7280',
  },
  filterTabTextActive: {
    color: '#ffffff',
    fontFamily: Fonts.semiBold,
  },
  listContent: {
    padding: 16,
    gap: 12,
    paddingBottom: 32,
  },
  card: {
    backgroundColor: '#ffffff',
    borderRadius: 16,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 8,
    elevation: 2,
  },
  cardTop: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  cardAvatarWrap: {
    width: 38,
    height: 38,
    borderRadius: 10,
    backgroundColor: '#fff7ed',
    justifyContent: 'center',
    alignItems: 'center',
  },
  cardMeta: {
    flex: 1,
  },
  cardName: {
    fontFamily: Fonts.semiBold,
    fontSize: 14,
    color: '#1a1d23',
  },
  cardSub: {
    fontFamily: Fonts.regular,
    fontSize: 12,
    color: '#8b909a',
    marginTop: 1,
  },
  cardBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 20,
  },
  cardBadgeText: {
    fontFamily: Fonts.semiBold,
    fontSize: 11,
  },
  cardDivider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: '#f0f1f3',
    marginVertical: 12,
  },
  cardBottom: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
  },
  cardAmountRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  cardAmount: {
    fontFamily: Fonts.groteskBold,
    fontSize: 14,
    color: '#1a1d23',
  },
  cardBankRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    flex: 1,
  },
  cardBank: {
    fontFamily: Fonts.regular,
    fontSize: 12,
    color: '#6b7280',
  },
  cardDate: {
    fontFamily: Fonts.regular,
    fontSize: 11,
    color: '#9ca3af',
  },
  emptyWrap: {
    alignItems: 'center',
    paddingVertical: 60,
    gap: 10,
  },
  emptyTitle: {
    fontFamily: Fonts.heading,
    fontSize: 17,
    color: '#6b7280',
    marginTop: 8,
  },
  emptySub: {
    fontFamily: Fonts.regular,
    fontSize: 13,
    color: '#9ca3af',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.45)',
    justifyContent: 'flex-end',
  },
  modalSheet: {
    backgroundColor: '#ffffff',
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    maxHeight: '90%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 16,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#f0f1f3',
  },
  modalTitle: {
    fontFamily: Fonts.heading,
    fontSize: 18,
    color: '#1a1d23',
  },
  closeBtn: {
    padding: 4,
  },
  modalBody: {
    padding: 20,
  },
  statusBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 12,
    marginBottom: 20,
  },
  statusBannerText: {
    fontFamily: Fonts.semiBold,
    fontSize: 14,
  },
  detailSection: {
    marginBottom: 20,
  },
  amountDisplay: {
    backgroundColor: '#fff7ed',
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: 'center',
  },
  amountDisplayText: {
    fontFamily: Fonts.groteskBold,
    fontSize: 28,
    color: '#ff8c00',
    letterSpacing: -0.5,
  },
  noteCard: {
    backgroundColor: '#f8f9fb',
    borderRadius: 12,
    padding: 14,
    marginBottom: 20,
  },
  noteLabel: {
    fontFamily: Fonts.semiBold,
    fontSize: 12,
    color: '#8b909a',
    marginBottom: 6,
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
  noteText: {
    fontFamily: Fonts.regular,
    fontSize: 13,
    color: '#374151',
    lineHeight: 20,
  },
  adminNoteInput: {
    backgroundColor: '#f8f9fb',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#f0f1f3',
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontFamily: Fonts.regular,
    fontSize: 14,
    color: '#1a1d23',
    minHeight: 80,
    textAlignVertical: 'top',
  },
  processedInfo: {
    alignItems: 'center',
    marginBottom: 16,
  },
  processedInfoText: {
    fontFamily: Fonts.regular,
    fontSize: 12,
    color: '#9ca3af',
  },
  actionButtons: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 8,
  },
  actionBtn: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionBtnPrimary: {
    backgroundColor: '#ff8c00',
  },
  actionBtnDanger: {
    backgroundColor: '#ef4444',
  },
  actionBtnText: {
    fontFamily: Fonts.semiBold,
    fontSize: 14,
    color: '#ffffff',
  },
  formLabel: {
    fontFamily: Fonts.semiBold,
    fontSize: 13,
    color: '#374151',
    marginBottom: 6,
  },
  formInput: {
    backgroundColor: '#f8f9fb',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#f0f1f3',
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontFamily: Fonts.regular,
    fontSize: 14,
    color: '#1a1d23',
  },
  formInputMulti: {
    minHeight: 80,
    textAlignVertical: 'top',
  },
  vendorSearchWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f8f9fb',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#f0f1f3',
    paddingHorizontal: 12,
    paddingVertical: 10,
    gap: 8,
  },
  vendorSearchInput: {
    flex: 1,
    fontFamily: Fonts.regular,
    fontSize: 14,
    color: '#1a1d23',
    padding: 0,
  },
  vendorDropdown: {
    backgroundColor: '#ffffff',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#f0f1f3',
    marginTop: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 3,
  },
  vendorDropdownItem: {
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#f0f1f3',
  },
  vendorDropdownName: {
    fontFamily: Fonts.semiBold,
    fontSize: 13,
    color: '#1a1d23',
  },
  vendorDropdownEmail: {
    fontFamily: Fonts.regular,
    fontSize: 12,
    color: '#8b909a',
    marginTop: 1,
  },
  selectedVendorBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#ecfdf5',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 8,
    marginTop: 6,
  },
  selectedVendorText: {
    fontFamily: Fonts.semiBold,
    fontSize: 13,
    color: '#059669',
    flex: 1,
  },
  errorBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#fef2f2',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginTop: 12,
  },
  errorBannerText: {
    fontFamily: Fonts.medium,
    fontSize: 13,
    color: '#ef4444',
    flex: 1,
  },
  createSubmitBtn: {
    backgroundColor: '#ff8c00',
    borderRadius: 14,
    paddingVertical: 15,
    alignItems: 'center',
    marginTop: 20,
  },
  createSubmitText: {
    fontFamily: Fonts.semiBold,
    fontSize: 15,
    color: '#ffffff',
  },
});
