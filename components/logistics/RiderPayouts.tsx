import { useState, useEffect } from 'react';
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
import { Search, X, Clock, CircleCheck as CheckCircle, Circle as XCircle, DollarSign, Building2, CreditCard, User, CircleAlert as AlertCircle, Banknote, RotateCcw, CircleCheck, Calendar, Plus } from 'lucide-react-native';
import { supabase } from '@/lib/supabase';
import { Fonts } from '@/constants/fonts';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

interface Payout {
  id: string;
  rider_id: string | null;
  rider_user_id: string | null;
  amount: number;
  status: 'pending' | 'approved' | 'processing' | 'completed' | 'rejected';
  bank_name: string | null;
  account_number: string | null;
  account_name: string | null;
  note: string | null;
  admin_note: string | null;
  period_from: string | null;
  period_to: string | null;
  processed_by: string | null;
  processed_at: string | null;
  created_at: string;
  rider_name?: string;
  rider_email?: string;
}

interface PayoutStats {
  totalPending: number;
  totalApproved: number;
  totalCompleted: number;
  pendingAmount: number;
  completedAmount: number;
}

const STATUS_CONFIG: Record<string, { color: string; bg: string; icon: any; label: string }> = {
  pending:    { color: '#f59e0b', bg: '#fffbeb', icon: Clock,        label: 'Pending' },
  approved:   { color: '#3b82f6', bg: '#eff6ff', icon: CircleCheck,  label: 'Approved' },
  processing: { color: '#0ea5e9', bg: '#f0f9ff', icon: RotateCcw,    label: 'Processing' },
  completed:  { color: '#059669', bg: '#ecfdf5', icon: CheckCircle,  label: 'Completed' },
  rejected:   { color: '#ef4444', bg: '#fef2f2', icon: XCircle,      label: 'Rejected' },
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
  pending:    { next: ['approved', 'rejected'],   labels: ['Approve', 'Reject'] },
  approved:   { next: ['processing', 'rejected'], labels: ['Mark Processing', 'Reject'] },
  processing: { next: ['completed', 'rejected'],  labels: ['Mark Completed', 'Reject'] },
  completed:  { next: [],                         labels: [] },
  rejected:   { next: ['pending'],                labels: ['Reset to Pending'] },
};

const fmt = (n: number) => `₦${n.toLocaleString('en-NG', { minimumFractionDigits: 2 })}`;

const fmtDate = (d: string) =>
  new Date(d).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });

function SectionHeader({ icon: Icon, title }: { icon: any; title: string }) {
  return (
    <View style={styles.sectionHeader}>
      <Icon size={14} color="#f97316" />
      <Text style={styles.sectionHeaderText}>{title}</Text>
    </View>
  );
}

export default function RiderPayouts() {
  const insets = useSafeAreaInsets();
  const [payouts, setPayouts] = useState<Payout[]>([]);
  const [filtered, setFiltered] = useState<Payout[]>([]);
  const [stats, setStats] = useState<PayoutStats>({
    totalPending: 0, totalApproved: 0, totalCompleted: 0, pendingAmount: 0, completedAmount: 0,
  });
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
    riderSearch: '',
    selectedRiderUserId: '',
    selectedRiderName: '',
    amount: '',
    bankName: '',
    accountNumber: '',
    accountName: '',
    periodFrom: '',
    periodTo: '',
    note: '',
  });
  const [riderResults, setRiderResults] = useState<any[]>([]);
  const [searchingRiders, setSearchingRiders] = useState(false);
  const [createError, setCreateError] = useState('');
  const [creating, setCreating] = useState(false);

  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');

  useEffect(() => { fetchPayouts(); }, []);

  useEffect(() => {
    let list = payouts;
    if (activeFilter !== 'all') list = list.filter(p => p.status === activeFilter);
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      list = list.filter(p =>
        p.rider_name?.toLowerCase().includes(q) ||
        p.rider_email?.toLowerCase().includes(q) ||
        p.account_name?.toLowerCase().includes(q) ||
        p.account_number?.includes(q)
      );
    }
    if (dateFrom) {
      const from = new Date(dateFrom);
      from.setHours(0, 0, 0, 0);
      list = list.filter(p => new Date(p.created_at) >= from);
    }
    if (dateTo) {
      const to = new Date(dateTo);
      to.setHours(23, 59, 59, 999);
      list = list.filter(p => new Date(p.created_at) <= to);
    }
    setFiltered(list);
  }, [payouts, activeFilter, searchQuery, dateFrom, dateTo]);

  const fetchPayouts = async (silent = false) => {
    try {
      if (!silent) setLoading(true);
      const { data, error } = await supabase
        .from('rider_payouts')
        .select(`
          id, rider_id, rider_user_id, amount, status,
          bank_name, account_number, account_name,
          note, admin_note, period_from, period_to,
          processed_by, processed_at, created_at
        `)
        .order('created_at', { ascending: false });

      if (error) throw error;

      const userIds = [...new Set((data || []).map((p: any) => p.rider_user_id).filter(Boolean))];
      let profileMap: Record<string, { full_name: string; email: string }> = {};
      if (userIds.length > 0) {
        const { data: profilesData } = await supabase
          .from('profiles')
          .select('id, full_name, email')
          .in('id', userIds);
        (profilesData || []).forEach((pr: any) => { profileMap[pr.id] = pr; });
      }

      const enriched: Payout[] = (data || []).map((p: any) => ({
        ...p,
        rider_name: profileMap[p.rider_user_id]?.full_name || 'Unknown',
        rider_email: profileMap[p.rider_user_id]?.email || '',
      }));

      setPayouts(enriched);

      const pendingList   = enriched.filter(p => p.status === 'pending');
      const approvedList  = enriched.filter(p => p.status === 'approved');
      const completedList = enriched.filter(p => p.status === 'completed');
      setStats({
        totalPending:    pendingList.length,
        totalApproved:   approvedList.length,
        totalCompleted:  completedList.length,
        pendingAmount:   pendingList.reduce((s, p) => s + p.amount, 0),
        completedAmount: completedList.reduce((s, p) => s + p.amount, 0),
      });
    } catch (err) {
      console.error('Error fetching rider payouts:', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const onRefresh = () => { setRefreshing(true); fetchPayouts(true); };

  const handleUpdateStatus = async (newStatus: string) => {
    if (!selectedPayout) return;

    const allowedTransitions = STATUS_ACTIONS[selectedPayout.status]?.next ?? [];
    if (!allowedTransitions.includes(newStatus)) {
      console.warn(`Invalid status transition: ${selectedPayout.status} -> ${newStatus}`);
      return;
    }

    try {
      setProcessing(true);
      const { error } = await supabase
        .from('rider_payouts')
        .update({
          status: newStatus,
          admin_note: adminNote.trim() || null,
          processed_at: ['completed', 'rejected'].includes(newStatus)
            ? new Date().toISOString()
            : selectedPayout.processed_at,
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

  const searchRiders = async (query: string) => {
    if (!query.trim()) { setRiderResults([]); return; }
    setSearchingRiders(true);
    try {
      const { data } = await supabase
        .from('profiles')
        .select('id, full_name, email')
        .eq('role', 'rider')
        .or(`full_name.ilike.%${query}%,email.ilike.%${query}%`)
        .limit(8);
      setRiderResults(data || []);
    } finally {
      setSearchingRiders(false);
    }
  };

  const resetCreateForm = () => {
    setCreateForm({
      riderSearch: '', selectedRiderUserId: '', selectedRiderName: '',
      amount: '', bankName: '', accountNumber: '', accountName: '',
      periodFrom: '', periodTo: '', note: '',
    });
    setRiderResults([]);
    setCreateError('');
  };

  const handleCreatePayout = async () => {
    setCreateError('');
    if (!createForm.selectedRiderUserId) { setCreateError('Please select a rider'); return; }
    if (!createForm.amount || isNaN(Number(createForm.amount)) || Number(createForm.amount) <= 0) {
      setCreateError('Enter a valid amount'); return;
    }
    if (!createForm.bankName || !createForm.accountNumber || !createForm.accountName) {
      setCreateError('Enter full bank details'); return;
    }

    try {
      setCreating(true);
      const { data: riderRow } = await supabase
        .from('riders')
        .select('id')
        .eq('user_id', createForm.selectedRiderUserId)
        .maybeSingle();

      const { error } = await supabase.from('rider_payouts').insert({
        rider_id:       riderRow?.id || null,
        rider_user_id:  createForm.selectedRiderUserId,
        amount:         Number(createForm.amount),
        status:         'pending',
        bank_name:      createForm.bankName,
        account_number: createForm.accountNumber,
        account_name:   createForm.accountName,
        note:           createForm.note.trim() || null,
        period_from:    createForm.periodFrom || null,
        period_to:      createForm.periodTo || null,
      });

      if (error) throw error;

      setShowCreateModal(false);
      resetCreateForm();
      fetchPayouts(true);
    } catch (err: any) {
      setCreateError(err.message || 'Failed to create payout');
    } finally {
      setCreating(false);
    }
  };

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
            <User size={18} color="#f97316" />
          </View>
          <View style={styles.cardMid}>
            <Text style={styles.cardName}>{item.rider_name}</Text>
            {item.rider_email ? <Text style={styles.cardEmail}>{item.rider_email}</Text> : null}
          </View>
          <View style={[styles.statusBadge, { backgroundColor: cfg.bg }]}>
            <StatusIcon size={11} color={cfg.color} />
            <Text style={[styles.statusText, { color: cfg.color }]}>{cfg.label}</Text>
          </View>
        </View>

        <View style={styles.cardDivider} />

        <View style={styles.cardBottom}>
          <View style={styles.cardAmountWrap}>
            <Banknote size={13} color="#059669" />
            <Text style={styles.cardAmount}>{fmt(item.amount)}</Text>
          </View>
          {item.account_number && (
            <View style={styles.cardBankWrap}>
              <CreditCard size={11} color="#9ca3af" />
              <Text style={styles.cardBank}>{item.account_number}</Text>
            </View>
          )}
          {(item.period_from || item.period_to) && (
            <View style={styles.cardPeriodWrap}>
              <Calendar size={11} color="#9ca3af" />
              <Text style={styles.cardPeriod}>
                {item.period_from ? fmtDate(item.period_from) : '?'}
                {' – '}
                {item.period_to ? fmtDate(item.period_to) : '?'}
              </Text>
            </View>
          )}
          <Text style={styles.cardDate}>{fmtDate(item.created_at)}</Text>
        </View>
      </TouchableOpacity>
    );
  };

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color="#f97316" />
      </View>
    );
  }

  return (
    <View style={styles.root}>
      {/* Stats Strip */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.statsStrip} contentContainerStyle={styles.statsStripContent}>
        <View style={styles.statPill}>
          <Text style={styles.statPillNum}>{stats.totalPending}</Text>
          <Text style={styles.statPillLabel}>Pending</Text>
        </View>
        <View style={[styles.statPill, { backgroundColor: '#eff6ff' }]}>
          <Text style={[styles.statPillNum, { color: '#3b82f6' }]}>{stats.totalApproved}</Text>
          <Text style={styles.statPillLabel}>Approved</Text>
        </View>
        <View style={[styles.statPill, { backgroundColor: '#ecfdf5' }]}>
          <Text style={[styles.statPillNum, { color: '#059669' }]}>{stats.totalCompleted}</Text>
          <Text style={styles.statPillLabel}>Completed</Text>
        </View>
        <View style={[styles.statPill, { backgroundColor: '#fff7ed' }]}>
          <Text style={[styles.statPillNum, { color: '#ea580c' }]}>{fmt(stats.pendingAmount)}</Text>
          <Text style={styles.statPillLabel}>Pending ₦</Text>
        </View>
        <View style={[styles.statPill, { backgroundColor: '#ecfdf5' }]}>
          <Text style={[styles.statPillNum, { color: '#059669' }]}>{fmt(stats.completedAmount)}</Text>
          <Text style={styles.statPillLabel}>Paid Out ₦</Text>
        </View>
      </ScrollView>

      {/* Search + New Payout */}
      <View style={styles.controlRow}>
        <View style={styles.searchBox}>
          <Search size={15} color="#9ca3af" />
          <TextInput
            style={styles.searchInput}
            placeholder="Search rider, account..."
            placeholderTextColor="#9ca3af"
            value={searchQuery}
            onChangeText={setSearchQuery}
          />
          {searchQuery.length > 0 && (
            <TouchableOpacity onPress={() => setSearchQuery('')}>
              <X size={14} color="#9ca3af" />
            </TouchableOpacity>
          )}
        </View>
        <TouchableOpacity style={styles.newBtn} onPress={() => setShowCreateModal(true)} activeOpacity={0.8}>
          <Plus size={16} color="#ffffff" />
          <Text style={styles.newBtnText}>New</Text>
        </TouchableOpacity>
      </View>

      {/* Date Filter */}
      <View style={styles.dateRow}>
        <View style={styles.dateField}>
          <Calendar size={13} color="#9ca3af" />
          <TextInput
            style={styles.dateInput}
            placeholder="From (YYYY-MM-DD)"
            placeholderTextColor="#9ca3af"
            value={dateFrom}
            onChangeText={setDateFrom}
            maxLength={10}
          />
          {dateFrom.length > 0 && (
            <TouchableOpacity onPress={() => setDateFrom('')}>
              <X size={12} color="#9ca3af" />
            </TouchableOpacity>
          )}
        </View>
        <View style={styles.dateSep}><Text style={styles.dateSepText}>–</Text></View>
        <View style={styles.dateField}>
          <Calendar size={13} color="#9ca3af" />
          <TextInput
            style={styles.dateInput}
            placeholder="To (YYYY-MM-DD)"
            placeholderTextColor="#9ca3af"
            value={dateTo}
            onChangeText={setDateTo}
            maxLength={10}
          />
          {dateTo.length > 0 && (
            <TouchableOpacity onPress={() => setDateTo('')}>
              <X size={12} color="#9ca3af" />
            </TouchableOpacity>
          )}
        </View>
      </View>

      {/* Filter Tabs */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.filterBar} contentContainerStyle={styles.filterBarContent}>
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
        contentContainerStyle={[styles.list, { paddingBottom: Math.max(insets.bottom + 20, 40) }]}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#f97316" />}
        showsVerticalScrollIndicator={false}
        ListEmptyComponent={
          <View style={styles.empty}>
            <DollarSign size={32} color="#d1d5db" />
            <Text style={styles.emptyTitle}>No payouts found</Text>
            <Text style={styles.emptyText}>Create a new payout to get started</Text>
          </View>
        }
      />

      {/* Detail Modal */}
      <Modal visible={showModal} transparent animationType="slide" onRequestClose={() => setShowModal(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalSheet}>
            {selectedPayout && (() => {
              const cfg = STATUS_CONFIG[selectedPayout.status] || STATUS_CONFIG.pending;
              const StatusIcon = cfg.icon;
              const actions = STATUS_ACTIONS[selectedPayout.status] || { next: [], labels: [] };
              return (
                <>
                  <View style={styles.modalHeader}>
                    <View style={styles.modalHeaderLeft}>
                      <View style={[styles.modalStatusDot, { backgroundColor: cfg.color }]} />
                      <Text style={styles.modalTitle}>Payout Details</Text>
                    </View>
                    <TouchableOpacity onPress={() => { setShowModal(false); setSelectedPayout(null); setAdminNote(''); }} style={styles.closeBtn}>
                      <X size={22} color="#8b909a" />
                    </TouchableOpacity>
                  </View>

                  <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.modalBody}>
                    <View style={[styles.statusBannerLarge, { backgroundColor: cfg.bg, borderColor: cfg.color + '30' }]}>
                      <StatusIcon size={20} color={cfg.color} />
                      <Text style={[styles.statusBannerText, { color: cfg.color }]}>{cfg.label}</Text>
                    </View>

                    <View style={styles.detailSection}>
                      <SectionHeader icon={User} title="Rider" />
                      <View style={styles.detailRow}>
                        <Text style={styles.detailLabel}>Name</Text>
                        <Text style={styles.detailValue}>{selectedPayout.rider_name}</Text>
                      </View>
                      {selectedPayout.rider_email && (
                        <View style={styles.detailRow}>
                          <Text style={styles.detailLabel}>Email</Text>
                          <Text style={styles.detailValue}>{selectedPayout.rider_email}</Text>
                        </View>
                      )}
                    </View>

                    <View style={styles.detailSection}>
                      <SectionHeader icon={DollarSign} title="Amount" />
                      <Text style={styles.bigAmount}>{fmt(selectedPayout.amount)}</Text>
                    </View>

                    {(selectedPayout.period_from || selectedPayout.period_to) && (
                      <View style={styles.detailSection}>
                        <SectionHeader icon={Calendar} title="Payout Period" />
                        <View style={styles.periodBadgeRow}>
                          <View style={styles.periodBadge}>
                            <Text style={styles.periodBadgeLabel}>From</Text>
                            <Text style={styles.periodBadgeVal}>
                              {selectedPayout.period_from ? fmtDate(selectedPayout.period_from) : '—'}
                            </Text>
                          </View>
                          <Text style={styles.periodArrow}>→</Text>
                          <View style={styles.periodBadge}>
                            <Text style={styles.periodBadgeLabel}>To</Text>
                            <Text style={styles.periodBadgeVal}>
                              {selectedPayout.period_to ? fmtDate(selectedPayout.period_to) : '—'}
                            </Text>
                          </View>
                        </View>
                      </View>
                    )}

                    <View style={styles.detailSection}>
                      <SectionHeader icon={Building2} title="Bank Details" />
                      <View style={styles.detailRow}>
                        <Text style={styles.detailLabel}>Bank</Text>
                        <Text style={styles.detailValue}>{selectedPayout.bank_name || '—'}</Text>
                      </View>
                      <View style={styles.detailRow}>
                        <Text style={styles.detailLabel}>Account No.</Text>
                        <Text style={styles.detailValue}>{selectedPayout.account_number || '—'}</Text>
                      </View>
                      <View style={styles.detailRow}>
                        <Text style={styles.detailLabel}>Account Name</Text>
                        <Text style={styles.detailValue}>{selectedPayout.account_name || '—'}</Text>
                      </View>
                    </View>

                    {selectedPayout.note && (
                      <View style={styles.noteBox}>
                        <Text style={styles.noteLabel}>Rider Note</Text>
                        <Text style={styles.noteText}>{selectedPayout.note}</Text>
                      </View>
                    )}

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
                          Processed: {new Date(selectedPayout.processed_at).toLocaleDateString('en-GB', {
                            day: 'numeric', month: 'short', year: 'numeric',
                            hour: '2-digit', minute: '2-digit',
                          })}
                        </Text>
                      </View>
                    )}

                    {actions.next.length > 0 && (
                      <View style={styles.actionButtons}>
                        {actions.next.map((status, i) => {
                          const isReject = status === 'rejected';
                          return (
                            <TouchableOpacity
                              key={status}
                              style={[styles.actionBtn, isReject ? styles.actionBtnDanger : styles.actionBtnPrimary]}
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
      <Modal visible={showCreateModal} transparent animationType="slide" onRequestClose={() => { setShowCreateModal(false); resetCreateForm(); }}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalSheet}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>New Rider Payout</Text>
              <TouchableOpacity onPress={() => { setShowCreateModal(false); resetCreateForm(); }} style={styles.closeBtn}>
                <X size={22} color="#8b909a" />
              </TouchableOpacity>
            </View>

            <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.modalBody}>
              <Text style={styles.formLabel}>Rider</Text>
              <View style={styles.vendorSearchWrap}>
                <Search size={15} color="#8b909a" />
                <TextInput
                  style={styles.vendorSearchInput}
                  placeholder="Search rider name or email..."
                  placeholderTextColor="#9ca3af"
                  value={createForm.riderSearch}
                  onChangeText={q => {
                    setCreateForm(f => ({ ...f, riderSearch: q, selectedRiderUserId: '', selectedRiderName: '' }));
                    searchRiders(q);
                  }}
                />
                {searchingRiders && <ActivityIndicator size="small" color="#f97316" />}
              </View>

              {createForm.selectedRiderName ? (
                <View style={styles.selectedBadge}>
                  <User size={13} color="#059669" />
                  <Text style={styles.selectedBadgeText}>{createForm.selectedRiderName}</Text>
                  <TouchableOpacity onPress={() => setCreateForm(f => ({ ...f, selectedRiderUserId: '', selectedRiderName: '', riderSearch: '' }))}>
                    <X size={14} color="#6b7280" />
                  </TouchableOpacity>
                </View>
              ) : riderResults.length > 0 ? (
                <View style={styles.dropdown}>
                  {riderResults.map(r => (
                    <TouchableOpacity
                      key={r.id}
                      style={styles.dropdownItem}
                      onPress={() => {
                        setCreateForm(f => ({ ...f, selectedRiderUserId: r.id, selectedRiderName: r.full_name, riderSearch: r.full_name }));
                        setRiderResults([]);
                      }}
                      activeOpacity={0.7}
                    >
                      <Text style={styles.dropdownName}>{r.full_name}</Text>
                      <Text style={styles.dropdownEmail}>{r.email}</Text>
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

              <Text style={[styles.formLabel, { marginTop: 16 }]}>Payout Period (optional)</Text>
              <View style={styles.periodRow}>
                <View style={styles.periodFieldWrap}>
                  <Text style={styles.periodFieldLabel}>From</Text>
                  <View style={styles.periodInputWrap}>
                    <Calendar size={13} color="#8b909a" />
                    <TextInput
                      style={styles.periodInput}
                      placeholder="YYYY-MM-DD"
                      placeholderTextColor="#9ca3af"
                      value={createForm.periodFrom}
                      onChangeText={v => setCreateForm(f => ({ ...f, periodFrom: v }))}
                      keyboardType="numeric"
                      maxLength={10}
                    />
                  </View>
                </View>
                <View style={styles.periodSep}>
                  <Text style={styles.periodSepText}>–</Text>
                </View>
                <View style={styles.periodFieldWrap}>
                  <Text style={styles.periodFieldLabel}>To</Text>
                  <View style={styles.periodInputWrap}>
                    <Calendar size={13} color="#8b909a" />
                    <TextInput
                      style={styles.periodInput}
                      placeholder="YYYY-MM-DD"
                      placeholderTextColor="#9ca3af"
                      value={createForm.periodTo}
                      onChangeText={v => setCreateForm(f => ({ ...f, periodTo: v }))}
                      keyboardType="numeric"
                      maxLength={10}
                    />
                  </View>
                </View>
              </View>

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

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#f8f9fb' },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center' },

  statsStrip: { flexGrow: 0 },
  statsStripContent: { paddingHorizontal: 16, paddingVertical: 12, gap: 8 },
  statPill: {
    backgroundColor: '#fffbeb', borderRadius: 12,
    paddingHorizontal: 14, paddingVertical: 10, minWidth: 90, alignItems: 'center',
  },
  statPillNum: { fontFamily: Fonts.bold, fontSize: 15, color: '#f59e0b' },
  statPillLabel: { fontFamily: Fonts.regular, fontSize: 11, color: '#6b7280', marginTop: 2 },

  controlRow: { flexDirection: 'row', paddingHorizontal: 16, gap: 10, marginBottom: 10 },
  searchBox: {
    flex: 1, flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: '#ffffff', borderRadius: 12, borderWidth: 1,
    borderColor: '#e5e7eb', paddingHorizontal: 12, paddingVertical: 9,
  },
  searchInput: { flex: 1, fontFamily: Fonts.regular, fontSize: 13, color: '#1a1d23', padding: 0 },
  newBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: '#f97316', borderRadius: 12,
    paddingHorizontal: 14, paddingVertical: 9,
  },
  newBtnText: { fontFamily: Fonts.semiBold, fontSize: 13, color: '#ffffff' },

  dateRow: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, gap: 8, marginBottom: 10 },
  dateField: {
    flex: 1, flexDirection: 'row', alignItems: 'center', gap: 7,
    backgroundColor: '#ffffff', borderRadius: 10, borderWidth: 1,
    borderColor: '#e5e7eb', paddingHorizontal: 10, paddingVertical: 8,
  },
  dateInput: { flex: 1, fontFamily: Fonts.regular, fontSize: 12, color: '#1a1d23', padding: 0 },
  dateSep: { paddingHorizontal: 2 },
  dateSepText: { fontFamily: Fonts.semiBold, fontSize: 15, color: '#c4c9d4' },

  filterBar: { flexGrow: 0 },
  filterBarContent: { paddingHorizontal: 16, paddingBottom: 10, gap: 8 },
  filterTab: {
    paddingHorizontal: 14, paddingVertical: 7, borderRadius: 20,
    backgroundColor: '#f1f3f5', borderWidth: 1, borderColor: 'transparent',
  },
  filterTabActive: { backgroundColor: '#fff7ed', borderColor: '#f97316' },
  filterTabText: { fontFamily: Fonts.semiBold, fontSize: 12, color: '#6b7280' },
  filterTabTextActive: { color: '#f97316' },

  list: { paddingHorizontal: 16, paddingTop: 4 },
  card: {
    backgroundColor: '#ffffff', borderRadius: 14, marginBottom: 10,
    padding: 14, borderWidth: 1, borderColor: '#f0f1f3',
    shadowColor: '#000', shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04, shadowRadius: 4, elevation: 1,
  },
  cardTop: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  cardAvatarWrap: {
    width: 36, height: 36, borderRadius: 10,
    backgroundColor: '#fff7ed', justifyContent: 'center', alignItems: 'center',
  },
  cardMid: { flex: 1 },
  cardName: { fontFamily: Fonts.semiBold, fontSize: 14, color: '#1a1d23' },
  cardEmail: { fontFamily: Fonts.regular, fontSize: 12, color: '#6b7280', marginTop: 1 },
  statusBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    borderRadius: 8, paddingHorizontal: 8, paddingVertical: 4,
  },
  statusText: { fontFamily: Fonts.semiBold, fontSize: 11 },
  cardDivider: { height: 1, backgroundColor: '#f3f4f6', marginVertical: 10 },
  cardBottom: { flexDirection: 'row', alignItems: 'center', gap: 10, flexWrap: 'wrap' },
  cardAmountWrap: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  cardAmount: { fontFamily: Fonts.bold, fontSize: 14, color: '#059669' },
  cardBankWrap: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  cardBank: { fontFamily: Fonts.regular, fontSize: 12, color: '#9ca3af' },
  cardPeriodWrap: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  cardPeriod: { fontFamily: Fonts.regular, fontSize: 11, color: '#9ca3af' },
  cardDate: { fontFamily: Fonts.regular, fontSize: 11, color: '#c4c9d4', marginLeft: 'auto' },

  empty: { alignItems: 'center', paddingTop: 60, gap: 8 },
  emptyTitle: { fontFamily: Fonts.semiBold, fontSize: 16, color: '#6b7280' },
  emptyText: { fontFamily: Fonts.regular, fontSize: 13, color: '#9ca3af' },

  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'flex-end' },
  modalSheet: {
    backgroundColor: '#ffffff', borderTopLeftRadius: 24, borderTopRightRadius: 24,
    maxHeight: '90%',
  },
  modalHeader: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 20, paddingVertical: 16,
    borderBottomWidth: 1, borderBottomColor: '#f3f4f6',
  },
  modalHeaderLeft: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  modalStatusDot: { width: 8, height: 8, borderRadius: 4 },
  modalTitle: { fontFamily: Fonts.bold, fontSize: 17, color: '#1a1d23' },
  closeBtn: { padding: 4 },
  modalBody: { paddingHorizontal: 20, paddingTop: 16, paddingBottom: 24 },

  statusBannerLarge: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    borderRadius: 12, paddingHorizontal: 14, paddingVertical: 10,
    borderWidth: 1, marginBottom: 16,
  },
  statusBannerText: { fontFamily: Fonts.semiBold, fontSize: 14 },

  detailSection: { marginBottom: 16 },
  sectionHeader: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 10 },
  sectionHeaderText: { fontFamily: Fonts.semiBold, fontSize: 12, color: '#8b909a', textTransform: 'uppercase', letterSpacing: 0.5 },
  detailRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 7, borderBottomWidth: 1, borderBottomColor: '#f9fafb' },
  detailLabel: { fontFamily: Fonts.regular, fontSize: 13, color: '#9ca3af' },
  detailValue: { fontFamily: Fonts.semiBold, fontSize: 13, color: '#1a1d23', flex: 1, textAlign: 'right' },
  bigAmount: { fontFamily: Fonts.bold, fontSize: 26, color: '#059669' },

  periodBadgeRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  periodBadge: { flex: 1, backgroundColor: '#f8f9fb', borderRadius: 10, padding: 10, alignItems: 'center' },
  periodBadgeLabel: { fontFamily: Fonts.regular, fontSize: 11, color: '#9ca3af' },
  periodBadgeVal: { fontFamily: Fonts.semiBold, fontSize: 13, color: '#1a1d23', marginTop: 2 },
  periodArrow: { fontFamily: Fonts.semiBold, fontSize: 16, color: '#d1d5db' },

  noteBox: { backgroundColor: '#fffbeb', borderRadius: 10, padding: 12, marginBottom: 16, borderLeftWidth: 3, borderLeftColor: '#f59e0b' },
  noteLabel: { fontFamily: Fonts.semiBold, fontSize: 11, color: '#92400e', marginBottom: 4, textTransform: 'uppercase', letterSpacing: 0.4 },
  noteText: { fontFamily: Fonts.regular, fontSize: 13, color: '#78350f', lineHeight: 19 },

  adminNoteInput: {
    backgroundColor: '#f8f9fb', borderRadius: 10, borderWidth: 1,
    borderColor: '#f0f1f3', padding: 12, fontFamily: Fonts.regular,
    fontSize: 13, color: '#1a1d23', minHeight: 70, textAlignVertical: 'top',
  },
  processedInfo: { alignItems: 'center', marginBottom: 12 },
  processedInfoText: { fontFamily: Fonts.regular, fontSize: 12, color: '#9ca3af' },

  actionButtons: { flexDirection: 'row', gap: 10, marginTop: 8 },
  actionBtn: { flex: 1, borderRadius: 12, paddingVertical: 13, alignItems: 'center' },
  actionBtnPrimary: { backgroundColor: '#f97316' },
  actionBtnDanger: { backgroundColor: '#ef4444' },
  actionBtnText: { fontFamily: Fonts.semiBold, fontSize: 14, color: '#ffffff' },

  formLabel: { fontFamily: Fonts.semiBold, fontSize: 13, color: '#374151', marginBottom: 6 },
  formInput: {
    backgroundColor: '#f8f9fb', borderRadius: 10, borderWidth: 1,
    borderColor: '#f0f1f3', paddingHorizontal: 12, paddingVertical: 11,
    fontFamily: Fonts.regular, fontSize: 14, color: '#1a1d23',
  },
  formInputMulti: { minHeight: 80, textAlignVertical: 'top' },

  vendorSearchWrap: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: '#f8f9fb', borderRadius: 10, borderWidth: 1,
    borderColor: '#f0f1f3', paddingHorizontal: 10, paddingVertical: 10,
  },
  vendorSearchInput: { flex: 1, fontFamily: Fonts.regular, fontSize: 14, color: '#1a1d23', padding: 0 },
  selectedBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: '#ecfdf5', borderRadius: 8, paddingHorizontal: 10,
    paddingVertical: 7, marginTop: 6, alignSelf: 'flex-start',
  },
  selectedBadgeText: { fontFamily: Fonts.semiBold, fontSize: 13, color: '#059669' },
  dropdown: {
    backgroundColor: '#ffffff', borderRadius: 10, borderWidth: 1,
    borderColor: '#e5e7eb', marginTop: 4, overflow: 'hidden',
  },
  dropdownItem: { paddingHorizontal: 12, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: '#f3f4f6' },
  dropdownName: { fontFamily: Fonts.semiBold, fontSize: 13, color: '#1a1d23' },
  dropdownEmail: { fontFamily: Fonts.regular, fontSize: 12, color: '#6b7280' },

  periodRow: { flexDirection: 'row', alignItems: 'flex-end', gap: 8 },
  periodFieldWrap: { flex: 1 },
  periodFieldLabel: {
    fontFamily: Fonts.semiBold, fontSize: 11, color: '#8b909a',
    textTransform: 'uppercase', letterSpacing: 0.4, marginBottom: 5,
  },
  periodInputWrap: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: '#f8f9fb', borderRadius: 10, borderWidth: 1,
    borderColor: '#f0f1f3', paddingHorizontal: 10, paddingVertical: 9,
  },
  periodInput: { flex: 1, fontFamily: Fonts.regular, fontSize: 13, color: '#1a1d23', padding: 0 },
  periodSep: { paddingBottom: 10 },
  periodSepText: { fontFamily: Fonts.semiBold, fontSize: 16, color: '#c4c9d4' },

  errorBanner: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: '#fef2f2', borderRadius: 8, padding: 10, marginTop: 12,
  },
  errorBannerText: { fontFamily: Fonts.regular, fontSize: 13, color: '#ef4444', flex: 1 },
  createSubmitBtn: {
    backgroundColor: '#f97316', borderRadius: 12,
    paddingVertical: 15, alignItems: 'center', marginTop: 20,
  },
  createSubmitText: { fontFamily: Fonts.semiBold, fontSize: 15, color: '#ffffff' },
});
