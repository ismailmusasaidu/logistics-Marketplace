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
  Image,
} from 'react-native';
import { Clock, CircleCheck as CheckCircle, Circle as XCircle, ChevronRight, ArrowLeft, Search, X, Store, Mail, Phone, MapPin, FileText, Award, ShoppingBag, RotateCcw, Truck, CreditCard, Share2, Info, Settings } from 'lucide-react-native';
import { supabase } from '@/lib/marketplace/supabase';
import { Profile } from '@/types/database';
import { Fonts } from '@/constants/fonts';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

interface VendorStoreData {
  vendor: {
    id: string;
    business_name: string | null;
    description: string | null;
    logo_url: string | null;
    address: string | null;
    city: string | null;
    state: string | null;
    is_verified: boolean;
    is_active: boolean;
    rating: number | null;
    total_sales: number;
  } | null;
  settings: {
    delivery_radius: number | null;
    minimum_order: number | null;
    accepts_online_payment: boolean;
    accepts_cash_on_delivery: boolean;
    store_banner_url: string | null;
    store_hours: Record<string, { open: string; close: string; closed: boolean }> | null;
    social_media: { facebook?: string; instagram?: string; twitter?: string; whatsapp?: string } | null;
    is_setup_complete: boolean;
  } | null;
}

const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

interface VendorManagementProps {
  onBack?: () => void;
}

const statusConfig: Record<string, { color: string; bg: string; icon: any; label: string }> = {
  pending: { color: '#f59e0b', bg: '#fffbeb', icon: Clock, label: 'Pending' },
  approved: { color: '#059669', bg: '#ecfdf5', icon: CheckCircle, label: 'Approved' },
  rejected: { color: '#ef4444', bg: '#fef2f2', icon: XCircle, label: 'Rejected' },
};

const FILTER_TABS = [
  { key: 'all', label: 'All' },
  { key: 'pending', label: 'Pending' },
  { key: 'approved', label: 'Approved' },
  { key: 'rejected', label: 'Rejected' },
];

export default function VendorManagement({ onBack }: VendorManagementProps) {
  const insets = useSafeAreaInsets();
  const [vendors, setVendors] = useState<Profile[]>([]);
  const [filteredVendors, setFilteredVendors] = useState<Profile[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedVendor, setSelectedVendor] = useState<Profile | null>(null);
  const [showModal, setShowModal] = useState(false);
  const [rejectionReason, setRejectionReason] = useState('');
  const [processing, setProcessing] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeFilter, setActiveFilter] = useState('all');
  const [modalTab, setModalTab] = useState<'info' | 'store'>('info');
  const [storeData, setStoreData] = useState<VendorStoreData | null>(null);
  const [loadingStore, setLoadingStore] = useState(false);

  useEffect(() => {
    fetchVendors();
  }, []);

  useEffect(() => {
    applyFilters();
  }, [searchQuery, activeFilter, vendors]);

  const applyFilters = () => {
    let result = [...vendors];

    if (activeFilter !== 'all') {
      result = result.filter((v) => v.vendor_status === activeFilter);
    }

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      result = result.filter(
        (v) =>
          (v.business_name || '').toLowerCase().includes(q) ||
          (v.full_name || '').toLowerCase().includes(q) ||
          (v.email || '').toLowerCase().includes(q) ||
          (v.business_address || '').toLowerCase().includes(q)
      );
    }

    setFilteredVendors(result);
  };

  const fetchVendors = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('role', 'vendor')
        .order('created_at', { ascending: false });

      if (error) throw error;
      setVendors(data || []);
    } catch (error) {
      console.error('Error fetching vendors:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchStoreData = async (profileId: string) => {
    try {
      setLoadingStore(true);
      setStoreData(null);

      const { data: vendorRow, error: vendorErr } = await supabase
        .from('vendors')
        .select('id, business_name, description, logo_url, address, city, state, is_verified, is_active, rating, total_sales')
        .eq('user_id', profileId)
        .maybeSingle();

      if (vendorErr) throw vendorErr;

      let settingsRow = null;
      if (vendorRow) {
        const { data: sData } = await supabase
          .from('vendor_settings')
          .select('delivery_radius, minimum_order, accepts_online_payment, accepts_cash_on_delivery, store_banner_url, store_hours, social_media, is_setup_complete')
          .eq('vendor_id', vendorRow.id)
          .maybeSingle();
        settingsRow = sData;
      }

      setStoreData({ vendor: vendorRow, settings: settingsRow });
    } catch (err) {
      console.error('Error fetching store data:', err);
      setStoreData({ vendor: null, settings: null });
    } finally {
      setLoadingStore(false);
    }
  };

  const handleApprove = async (vendorId: string) => {
    try {
      setProcessing(true);
      const { error } = await supabase
        .from('profiles')
        .update({ vendor_status: 'approved' })
        .eq('id', vendorId);

      if (error) throw error;
      await fetchVendors();
      setShowModal(false);
      setSelectedVendor(null);
    } catch (error) {
      console.error('Error approving vendor:', error);
    } finally {
      setProcessing(false);
    }
  };

  const handleReject = async (vendorId: string) => {
    if (!rejectionReason.trim()) return;

    try {
      setProcessing(true);
      const { error } = await supabase
        .from('profiles')
        .update({
          vendor_status: 'rejected',
          rejection_reason: rejectionReason,
        })
        .eq('id', vendorId);

      if (error) throw error;
      await fetchVendors();
      setShowModal(false);
      setSelectedVendor(null);
      setRejectionReason('');
    } catch (error) {
      console.error('Error rejecting vendor:', error);
    } finally {
      setProcessing(false);
    }
  };

  const handleUnreject = async (vendorId: string) => {
    try {
      setProcessing(true);
      const { error } = await supabase
        .from('profiles')
        .update({
          vendor_status: 'pending',
          rejection_reason: null,
        })
        .eq('id', vendorId);

      if (error) throw error;
      await fetchVendors();
      setShowModal(false);
      setSelectedVendor(null);
    } catch (error) {
      console.error('Error unrejecting vendor:', error);
    } finally {
      setProcessing(false);
    }
  };

  const getFilterCount = (key: string) => {
    if (key === 'all') return vendors.length;
    return vendors.filter((v) => v.vendor_status === key).length;
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#ff8c00" />
      </View>
    );
  }

  const renderVendorItem = useCallback(({ item }: { item: Profile }) => {
    const config = statusConfig[(item as any).vendor_status] || statusConfig.pending;
    const StatusIcon = config.icon;

    return (
      <TouchableOpacity
        style={styles.vendorCard}
        onPress={() => {
          setSelectedVendor(item);
          setModalTab('info');
          setStoreData(null);
          setShowModal(true);
        }}
        activeOpacity={0.7}
      >
        <View style={styles.cardTop}>
          <View style={styles.cardNameRow}>
            <View style={styles.vendorAvatarWrap}>
              <Store size={18} color="#ff8c00" />
            </View>
            <View style={styles.cardNameContent}>
              <Text style={styles.vendorName} numberOfLines={1}>
                {(item as any).business_name || item.full_name}
              </Text>
              <Text style={styles.vendorOwner} numberOfLines={1}>
                {(item as any).business_name ? item.full_name : ''}
              </Text>
            </View>
          </View>
          <View style={[styles.statusBadge, { backgroundColor: config.bg }]}>
            <StatusIcon size={12} color={config.color} />
            <Text style={[styles.statusText, { color: config.color }]}>
              {config.label}
            </Text>
          </View>
        </View>

        <View style={styles.cardDivider} />

        <View style={styles.detailRow}>
          <View style={styles.detailIconWrap}>
            <Mail size={13} color="#8b909a" />
          </View>
          <Text style={styles.detailText} numberOfLines={1}>{item.email}</Text>
        </View>

        {(item as any).business_address && (
          <View style={styles.detailRow}>
            <View style={styles.detailIconWrap}>
              <MapPin size={13} color="#8b909a" />
            </View>
            <Text style={styles.detailText} numberOfLines={1}>{(item as any).business_address}</Text>
          </View>
        )}

        {(item as any).business_phone && (
          <View style={styles.detailRow}>
            <View style={styles.detailIconWrap}>
              <Phone size={13} color="#8b909a" />
            </View>
            <Text style={styles.detailText}>{(item as any).business_phone}</Text>
          </View>
        )}

        <View style={styles.cardFooter}>
          <Text style={styles.viewDetailsText}>View Details</Text>
          <ChevronRight size={16} color="#c4c9d4" />
        </View>
      </TouchableOpacity>
    );
  }, [setSelectedVendor, setShowModal]);

  return (
    <View style={styles.container}>
      <View style={[styles.header, { paddingTop: insets.top + 16 }]}>
        <View style={styles.headerTop}>
          {onBack && (
            <TouchableOpacity style={styles.backButton} onPress={onBack}>
              <ArrowLeft size={22} color="#ffffff" />
            </TouchableOpacity>
          )}
          <View style={styles.headerTextContainer}>
            <Text style={styles.title}>Vendors</Text>
            <Text style={styles.subtitle}>
              {filteredVendors.length} of {vendors.length} vendors
            </Text>
          </View>
        </View>

        <View style={styles.searchContainer}>
          <Search size={18} color="#8b909a" />
          <TextInput
            style={styles.searchInput}
            placeholder="Search vendors..."
            placeholderTextColor="#8b909a"
            value={searchQuery}
            onChangeText={setSearchQuery}
          />
          {searchQuery.length > 0 && (
            <TouchableOpacity onPress={() => setSearchQuery('')}>
              <X size={18} color="#8b909a" />
            </TouchableOpacity>
          )}
        </View>

        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.filterRow}
        >
          {FILTER_TABS.map((tab) => {
            const count = getFilterCount(tab.key);
            const isActive = activeFilter === tab.key;
            return (
              <TouchableOpacity
                key={tab.key}
                style={[styles.filterTab, isActive && styles.filterTabActive]}
                onPress={() => setActiveFilter(tab.key)}
                activeOpacity={0.7}
              >
                <Text style={[styles.filterTabText, isActive && styles.filterTabTextActive]}>
                  {tab.label}
                </Text>
                <View style={[styles.filterBadge, isActive && styles.filterBadgeActive]}>
                  <Text style={[styles.filterBadgeText, isActive && styles.filterBadgeTextActive]}>
                    {count}
                  </Text>
                </View>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      </View>

      <View style={styles.statsRow}>
        {(['pending', 'approved', 'rejected'] as const).map((status) => {
          const config = statusConfig[status];
          const Icon = config.icon;
          return (
            <View key={status} style={[styles.statCard, { backgroundColor: config.bg }]}>
              <View style={[styles.statIconWrap, { backgroundColor: config.color + '20' }]}>
                <Icon size={18} color={config.color} />
              </View>
              <Text style={[styles.statNumber, { color: config.color }]}>
                {vendors.filter((v) => v.vendor_status === status).length}
              </Text>
              <Text style={styles.statLabel}>{config.label}</Text>
            </View>
          );
        })}
      </View>

      <FlatList
        data={filteredVendors}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.list}
        showsVerticalScrollIndicator={false}
        ListEmptyComponent={
          <View style={styles.emptyState}>
            <ShoppingBag size={48} color="#d1d5db" />
            <Text style={styles.emptyTitle}>No vendors found</Text>
            <Text style={styles.emptySubtitle}>Try a different search or filter</Text>
          </View>
        }
        renderItem={renderVendorItem}
        initialNumToRender={8}
        maxToRenderPerBatch={8}
        windowSize={5}
        removeClippedSubviews={true}
        updateCellsBatchingPeriod={50}
      />

      {/* Vendor Detail Modal */}
      <Modal visible={showModal} animationType="slide" transparent onRequestClose={() => setShowModal(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHandle} />

            {selectedVendor && (
              <>
                <View style={styles.modalHeader}>
                  <Text style={styles.modalTitle}>Vendor Details</Text>
                  <TouchableOpacity
                    onPress={() => {
                      setShowModal(false);
                      setSelectedVendor(null);
                      setRejectionReason('');
                      setModalTab('info');
                      setStoreData(null);
                    }}
                    style={styles.closeBtn}
                  >
                    <X size={22} color="#8b909a" />
                  </TouchableOpacity>
                </View>

                <View style={styles.modalTabRow}>
                  <TouchableOpacity
                    style={[styles.modalTabBtn, modalTab === 'info' && styles.modalTabBtnActive]}
                    onPress={() => setModalTab('info')}
                    activeOpacity={0.7}
                  >
                    <Info size={14} color={modalTab === 'info' ? '#ff8c00' : '#8b909a'} />
                    <Text style={[styles.modalTabText, modalTab === 'info' && styles.modalTabTextActive]}>
                      Business Info
                    </Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.modalTabBtn, modalTab === 'store' && styles.modalTabBtnActive]}
                    onPress={() => {
                      setModalTab('store');
                      if (!storeData) fetchStoreData(selectedVendor.id);
                    }}
                    activeOpacity={0.7}
                  >
                    <Settings size={14} color={modalTab === 'store' ? '#ff8c00' : '#8b909a'} />
                    <Text style={[styles.modalTabText, modalTab === 'store' && styles.modalTabTextActive]}>
                      Store Settings
                    </Text>
                  </TouchableOpacity>
                </View>

                <ScrollView
                  style={styles.modalScroll}
                  showsVerticalScrollIndicator={false}
                  contentContainerStyle={styles.modalScrollContent}
                >
                  {modalTab === 'info' ? (
                    <>
                      <View style={styles.modalVendorHeader}>
                        <View style={styles.modalAvatarWrap}>
                          <Store size={24} color="#ff8c00" />
                        </View>
                        <View style={styles.modalVendorInfo}>
                          <Text style={styles.modalVendorName}>
                            {selectedVendor.business_name || 'N/A'}
                          </Text>
                          <Text style={styles.modalVendorOwner}>{selectedVendor.full_name}</Text>
                        </View>
                        {(() => {
                          const config = statusConfig[selectedVendor.vendor_status] || statusConfig.pending;
                          const Icon = config.icon;
                          return (
                            <View style={[styles.modalStatusBadge, { backgroundColor: config.bg }]}>
                              <Icon size={14} color={config.color} />
                              <Text style={[styles.modalStatusText, { color: config.color }]}>
                                {config.label}
                              </Text>
                            </View>
                          );
                        })()}
                      </View>

                      <View style={styles.detailsCard}>
                        <DetailItem icon={Mail} label="Email" value={selectedVendor.email} />
                        <DetailItem icon={Phone} label="Phone" value={selectedVendor.business_phone || 'Not provided'} />
                        <DetailItem icon={MapPin} label="Address" value={selectedVendor.business_address || 'Not provided'} />
                        <DetailItem icon={FileText} label="Description" value={selectedVendor.business_description || 'Not provided'} />
                        <DetailItem icon={Award} label="License" value={selectedVendor.business_license || 'Not provided'} last />
                      </View>

                      {selectedVendor.vendor_status === 'pending' && (
                        <View style={styles.actionsSection}>
                          <Text style={styles.actionsSectionLabel}>Review Application</Text>

                          <TextInput
                            style={styles.reasonInput}
                            placeholder="Rejection reason (required for rejection)"
                            placeholderTextColor="#8b909a"
                            value={rejectionReason}
                            onChangeText={setRejectionReason}
                            multiline
                            numberOfLines={3}
                          />

                          <View style={styles.actionButtons}>
                            <TouchableOpacity
                              style={styles.approveButton}
                              onPress={() => handleApprove(selectedVendor.id)}
                              disabled={processing}
                              activeOpacity={0.7}
                            >
                              {processing ? (
                                <ActivityIndicator color="#ffffff" size="small" />
                              ) : (
                                <>
                                  <CheckCircle size={18} color="#ffffff" />
                                  <Text style={styles.approveButtonText}>Approve</Text>
                                </>
                              )}
                            </TouchableOpacity>

                            <TouchableOpacity
                              style={[
                                styles.rejectButton,
                                !rejectionReason.trim() && styles.rejectButtonDisabled,
                              ]}
                              onPress={() => handleReject(selectedVendor.id)}
                              disabled={processing || !rejectionReason.trim()}
                              activeOpacity={0.7}
                            >
                              {processing ? (
                                <ActivityIndicator color="#ffffff" size="small" />
                              ) : (
                                <>
                                  <XCircle size={18} color="#ffffff" />
                                  <Text style={styles.rejectButtonText}>Reject</Text>
                                </>
                              )}
                            </TouchableOpacity>
                          </View>
                        </View>
                      )}

                      {selectedVendor.vendor_status === 'rejected' && (
                        <View style={styles.actionsSection}>
                          <Text style={styles.actionsSectionLabel}>Rejected Vendor</Text>

                          {selectedVendor.rejection_reason && (
                            <View style={styles.rejectionReasonCard}>
                              <View style={styles.rejectionReasonHeader}>
                                <XCircle size={14} color="#ef4444" />
                                <Text style={styles.rejectionReasonLabel}>Rejection Reason</Text>
                              </View>
                              <Text style={styles.rejectionReasonText}>
                                {selectedVendor.rejection_reason}
                              </Text>
                            </View>
                          )}

                          <View style={styles.actionButtons}>
                            <TouchableOpacity
                              style={styles.unrejectButton}
                              onPress={() => handleUnreject(selectedVendor.id)}
                              disabled={processing}
                              activeOpacity={0.7}
                            >
                              {processing ? (
                                <ActivityIndicator color="#ffffff" size="small" />
                              ) : (
                                <>
                                  <RotateCcw size={18} color="#ffffff" />
                                  <Text style={styles.unrejectButtonText}>Move to Pending</Text>
                                </>
                              )}
                            </TouchableOpacity>

                            <TouchableOpacity
                              style={styles.approveButton}
                              onPress={() => handleApprove(selectedVendor.id)}
                              disabled={processing}
                              activeOpacity={0.7}
                            >
                              {processing ? (
                                <ActivityIndicator color="#ffffff" size="small" />
                              ) : (
                                <>
                                  <CheckCircle size={18} color="#ffffff" />
                                  <Text style={styles.approveButtonText}>Approve</Text>
                                </>
                              )}
                            </TouchableOpacity>
                          </View>
                        </View>
                      )}
                    </>
                  ) : (
                    <StoreDetailsPanel loading={loadingStore} data={storeData} />
                  )}
                </ScrollView>
              </>
            )}
          </View>
        </View>
      </Modal>
    </View>
  );
}

function StoreDetailsPanel({ loading, data }: { loading: boolean; data: VendorStoreData | null }) {
  if (loading) {
    return (
      <View style={storePanelStyles.loadingWrap}>
        <ActivityIndicator size="large" color="#ff8c00" />
        <Text style={storePanelStyles.loadingText}>Loading store settings...</Text>
      </View>
    );
  }

  if (!data || (!data.vendor && !data.settings)) {
    return (
      <View style={storePanelStyles.emptyWrap}>
        <Store size={40} color="#d1d5db" />
        <Text style={storePanelStyles.emptyTitle}>Store not set up yet</Text>
        <Text style={storePanelStyles.emptySubtitle}>This vendor hasn't configured their store</Text>
      </View>
    );
  }

  const { vendor, settings } = data;

  return (
    <View>
      {settings?.store_banner_url ? (
        <View style={storePanelStyles.bannerWrap}>
          <Image
            source={{ uri: settings.store_banner_url }}
            style={storePanelStyles.bannerImage}
            resizeMode="cover"
          />
          <View style={storePanelStyles.bannerLabel}>
            <Text style={storePanelStyles.bannerLabelText}>Store Banner</Text>
          </View>
        </View>
      ) : null}

      {vendor ? (
        <View style={storePanelStyles.section}>
          <View style={storePanelStyles.sectionHeader}>
            <Store size={14} color="#ff8c00" />
            <Text style={storePanelStyles.sectionTitle}>Store Profile</Text>
          </View>
          <View style={storePanelStyles.card}>
            <StoreRow label="Business Name" value={vendor.business_name || 'Not set'} />
            <StoreRow label="Description" value={vendor.description || 'Not set'} />
            <StoreRow label="Address" value={[vendor.address, vendor.city, vendor.state].filter(Boolean).join(', ') || 'Not set'} />
            <StoreRow label="Rating" value={vendor.rating != null ? `${Number(vendor.rating).toFixed(1)} / 5.0` : 'No ratings yet'} />
            <StoreRow label="Total Sales" value={`${vendor.total_sales ?? 0} orders`} />
            <View style={storePanelStyles.badgeRow}>
              <View style={[storePanelStyles.badge, { backgroundColor: vendor.is_verified ? '#ecfdf5' : '#f8f9fb' }]}>
                <CheckCircle size={12} color={vendor.is_verified ? '#059669' : '#9ca3af'} />
                <Text style={[storePanelStyles.badgeText, { color: vendor.is_verified ? '#059669' : '#9ca3af' }]}>
                  {vendor.is_verified ? 'Verified' : 'Not Verified'}
                </Text>
              </View>
              <View style={[storePanelStyles.badge, { backgroundColor: vendor.is_active ? '#ecfdf5' : '#fef2f2' }]}>
                <View style={[storePanelStyles.dot, { backgroundColor: vendor.is_active ? '#059669' : '#ef4444' }]} />
                <Text style={[storePanelStyles.badgeText, { color: vendor.is_active ? '#059669' : '#ef4444' }]}>
                  {vendor.is_active ? 'Active' : 'Inactive'}
                </Text>
              </View>
            </View>
          </View>
        </View>
      ) : null}

      {settings ? (
        <>
          <View style={storePanelStyles.section}>
            <View style={storePanelStyles.sectionHeader}>
              <Truck size={14} color="#ff8c00" />
              <Text style={storePanelStyles.sectionTitle}>Delivery & Orders</Text>
            </View>
            <View style={storePanelStyles.card}>
              <StoreRow label="Delivery Radius" value={settings.delivery_radius != null ? `${settings.delivery_radius} km` : 'Not set'} />
              <StoreRow label="Minimum Order" value={settings.minimum_order != null ? `\u20A6${settings.minimum_order.toLocaleString()}` : 'Not set'} last />
            </View>
          </View>

          <View style={storePanelStyles.section}>
            <View style={storePanelStyles.sectionHeader}>
              <CreditCard size={14} color="#ff8c00" />
              <Text style={storePanelStyles.sectionTitle}>Payment Methods</Text>
            </View>
            <View style={storePanelStyles.card}>
              <View style={storePanelStyles.paymentRow}>
                <View style={[storePanelStyles.paymentIndicator, { backgroundColor: settings.accepts_online_payment ? '#ecfdf5' : '#f8f9fb' }]}>
                  <CheckCircle size={13} color={settings.accepts_online_payment ? '#059669' : '#9ca3af'} />
                  <Text style={[storePanelStyles.paymentText, { color: settings.accepts_online_payment ? '#059669' : '#9ca3af' }]}>Online Payment</Text>
                </View>
                <View style={[storePanelStyles.paymentIndicator, { backgroundColor: settings.accepts_cash_on_delivery ? '#ecfdf5' : '#f8f9fb' }]}>
                  <CheckCircle size={13} color={settings.accepts_cash_on_delivery ? '#059669' : '#9ca3af'} />
                  <Text style={[storePanelStyles.paymentText, { color: settings.accepts_cash_on_delivery ? '#059669' : '#9ca3af' }]}>Cash on Delivery</Text>
                </View>
              </View>
            </View>
          </View>

          {settings.store_hours && Object.keys(settings.store_hours).length > 0 ? (
            <View style={storePanelStyles.section}>
              <View style={storePanelStyles.sectionHeader}>
                <Clock size={14} color="#ff8c00" />
                <Text style={storePanelStyles.sectionTitle}>Store Hours</Text>
              </View>
              <View style={storePanelStyles.card}>
                {DAYS.map((day, i) => {
                  const h = settings.store_hours?.[day];
                  if (!h) return null;
                  return (
                    <View key={day} style={[storePanelStyles.hoursRow, i === DAYS.length - 1 && { borderBottomWidth: 0 }]}>
                      <Text style={storePanelStyles.hoursDay}>{day.slice(0, 3)}</Text>
                      {h.closed ? (
                        <View style={storePanelStyles.closedBadge}>
                          <Text style={storePanelStyles.closedBadgeText}>Closed</Text>
                        </View>
                      ) : (
                        <Text style={storePanelStyles.hoursTime}>{h.open} – {h.close}</Text>
                      )}
                    </View>
                  );
                })}
              </View>
            </View>
          ) : null}

          {settings.social_media && Object.values(settings.social_media).some(Boolean) ? (
            <View style={storePanelStyles.section}>
              <View style={storePanelStyles.sectionHeader}>
                <Share2 size={14} color="#ff8c00" />
                <Text style={storePanelStyles.sectionTitle}>Social Media</Text>
              </View>
              <View style={storePanelStyles.card}>
                {settings.social_media.facebook ? <StoreRow label="Facebook" value={settings.social_media.facebook} /> : null}
                {settings.social_media.instagram ? <StoreRow label="Instagram" value={settings.social_media.instagram} /> : null}
                {settings.social_media.twitter ? <StoreRow label="Twitter" value={settings.social_media.twitter} /> : null}
                {settings.social_media.whatsapp ? <StoreRow label="WhatsApp" value={settings.social_media.whatsapp} last /> : null}
              </View>
            </View>
          ) : null}
        </>
      ) : null}

      <View style={{ height: 8 }} />
    </View>
  );
}

function StoreRow({ label, value, last }: { label: string; value: string; last?: boolean }) {
  return (
    <View style={[storePanelStyles.row, !last && storePanelStyles.rowBorder]}>
      <Text style={storePanelStyles.rowLabel}>{label}</Text>
      <Text style={storePanelStyles.rowValue}>{value}</Text>
    </View>
  );
}

const storePanelStyles = StyleSheet.create({
  loadingWrap: {
    alignItems: 'center',
    paddingVertical: 40,
    gap: 12,
  },
  loadingText: {
    fontFamily: Fonts.regular,
    fontSize: 14,
    color: '#8b909a',
  },
  emptyWrap: {
    alignItems: 'center',
    paddingVertical: 48,
    gap: 8,
  },
  emptyTitle: {
    fontFamily: Fonts.heading,
    fontSize: 16,
    color: '#6b7280',
    marginTop: 8,
  },
  emptySubtitle: {
    fontFamily: Fonts.regular,
    fontSize: 13,
    color: '#9ca3af',
  },
  bannerWrap: {
    width: '100%',
    height: 160,
    borderRadius: 14,
    overflow: 'hidden',
    marginBottom: 16,
    position: 'relative',
  },
  bannerImage: {
    width: '100%',
    height: '100%',
  },
  bannerLabel: {
    position: 'absolute',
    bottom: 10,
    left: 12,
    backgroundColor: 'rgba(0,0,0,0.55)',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  bannerLabelText: {
    fontFamily: Fonts.medium,
    fontSize: 11,
    color: '#ffffff',
  },
  section: {
    marginBottom: 14,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 8,
  },
  sectionTitle: {
    fontFamily: Fonts.semiBold,
    fontSize: 13,
    color: '#1a1d23',
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
  card: {
    backgroundColor: '#f8f9fb',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#f0f1f3',
    paddingHorizontal: 14,
    paddingVertical: 4,
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    paddingVertical: 12,
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
    flex: 0.9,
  },
  rowValue: {
    fontFamily: Fonts.semiBold,
    fontSize: 13,
    color: '#1a1d23',
    flex: 1.1,
    textAlign: 'right',
  },
  badgeRow: {
    flexDirection: 'row',
    gap: 8,
    paddingVertical: 12,
  },
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 20,
  },
  dot: {
    width: 7,
    height: 7,
    borderRadius: 4,
  },
  badgeText: {
    fontFamily: Fonts.semiBold,
    fontSize: 12,
  },
  paymentRow: {
    flexDirection: 'row',
    gap: 8,
    paddingVertical: 12,
    flexWrap: 'wrap',
  },
  paymentIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
    flex: 1,
  },
  paymentText: {
    fontFamily: Fonts.medium,
    fontSize: 12,
  },
  hoursRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#e5e7eb',
  },
  hoursDay: {
    fontFamily: Fonts.semiBold,
    fontSize: 13,
    color: '#374151',
    width: 36,
  },
  hoursTime: {
    fontFamily: Fonts.regular,
    fontSize: 13,
    color: '#1a1d23',
  },
  closedBadge: {
    backgroundColor: '#fee2e2',
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  closedBadgeText: {
    fontFamily: Fonts.medium,
    fontSize: 11,
    color: '#ef4444',
  },
});

function DetailItem({
  icon: Icon,
  label,
  value,
  last,
}: {
  icon: any;
  label: string;
  value: string;
  last?: boolean;
}) {
  return (
    <View style={[detailItemStyles.row, !last && detailItemStyles.rowBorder]}>
      <View style={detailItemStyles.iconWrap}>
        <Icon size={16} color="#ff8c00" />
      </View>
      <View style={detailItemStyles.content}>
        <Text style={detailItemStyles.label}>{label}</Text>
        <Text style={detailItemStyles.value}>{value}</Text>
      </View>
    </View>
  );
}

const detailItemStyles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    paddingVertical: 14,
    gap: 12,
  },
  rowBorder: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#f0f1f3',
  },
  iconWrap: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: '#fff7ed',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 2,
  },
  content: {
    flex: 1,
  },
  label: {
    fontSize: 11,
    fontFamily: Fonts.medium,
    color: '#8b909a',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 3,
  },
  value: {
    fontSize: 14,
    fontFamily: Fonts.regular,
    color: '#1a1d23',
    lineHeight: 20,
  },
});

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8f9fb',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f8f9fb',
  },

  header: {
    backgroundColor: '#1a1d23',
    paddingHorizontal: 20,
    paddingBottom: 16,
    borderBottomLeftRadius: 24,
    borderBottomRightRadius: 24,
  },
  headerTop: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 16,
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: 'rgba(255, 140, 0, 0.12)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerTextContainer: {
    flex: 1,
  },
  title: {
    fontSize: 26,
    fontFamily: Fonts.headingBold,
    color: '#ffffff',
    letterSpacing: -0.3,
  },
  subtitle: {
    fontSize: 13,
    fontFamily: Fonts.regular,
    color: '#8b909a',
    marginTop: 2,
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    borderRadius: 14,
    paddingHorizontal: 14,
    gap: 10,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.06)',
  },
  searchInput: {
    flex: 1,
    fontSize: 14,
    fontFamily: Fonts.regular,
    color: '#ffffff',
    paddingVertical: 12,
    outlineStyle: 'none',
  } as any,

  filterRow: {
    gap: 8,
    paddingBottom: 2,
  },
  filterTab: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.06)',
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: 10,
    gap: 6,
  },
  filterTabActive: {
    backgroundColor: '#ff8c00',
  },
  filterTabText: {
    fontFamily: Fonts.medium,
    fontSize: 13,
    color: '#8b909a',
  },
  filterTabTextActive: {
    color: '#ffffff',
  },
  filterBadge: {
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 8,
    minWidth: 22,
    alignItems: 'center',
  },
  filterBadgeActive: {
    backgroundColor: 'rgba(255, 255, 255, 0.25)',
  },
  filterBadgeText: {
    fontFamily: Fonts.groteskMedium,
    fontSize: 11,
    color: '#8b909a',
  },
  filterBadgeTextActive: {
    color: '#ffffff',
  },

  statsRow: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    paddingTop: 16,
    gap: 10,
  },
  statCard: {
    flex: 1,
    borderRadius: 14,
    padding: 14,
    alignItems: 'center',
    gap: 6,
  },
  statIconWrap: {
    width: 36,
    height: 36,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
  },
  statNumber: {
    fontSize: 22,
    fontFamily: Fonts.groteskBold,
    letterSpacing: -0.3,
  },
  statLabel: {
    fontSize: 11,
    fontFamily: Fonts.medium,
    color: '#6b7280',
  },

  list: {
    padding: 16,
    paddingBottom: 32,
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: 60,
    gap: 8,
  },
  emptyTitle: {
    fontFamily: Fonts.heading,
    fontSize: 17,
    color: '#6b7280',
    marginTop: 8,
  },
  emptySubtitle: {
    fontFamily: Fonts.regular,
    fontSize: 13,
    color: '#9ca3af',
  },

  vendorCard: {
    backgroundColor: '#ffffff',
    borderRadius: 18,
    padding: 18,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 8,
    elevation: 2,
  },
  cardTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 14,
  },
  cardNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    gap: 12,
    marginRight: 10,
  },
  vendorAvatarWrap: {
    width: 42,
    height: 42,
    borderRadius: 12,
    backgroundColor: '#fff7ed',
    justifyContent: 'center',
    alignItems: 'center',
  },
  cardNameContent: {
    flex: 1,
  },
  vendorName: {
    fontSize: 15,
    fontFamily: Fonts.semiBold,
    color: '#1a1d23',
    marginBottom: 2,
  },
  vendorOwner: {
    fontSize: 12,
    fontFamily: Fonts.regular,
    color: '#8b909a',
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 20,
    gap: 5,
    flexShrink: 0,
  },
  statusText: {
    fontSize: 11,
    fontFamily: Fonts.semiBold,
  },
  cardDivider: {
    height: 1,
    backgroundColor: '#f0f1f3',
    marginBottom: 10,
  },

  detailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 6,
    gap: 8,
  },
  detailIconWrap: {
    width: 26,
    height: 26,
    borderRadius: 7,
    backgroundColor: '#f8f9fb',
    justifyContent: 'center',
    alignItems: 'center',
  },
  detailText: {
    fontSize: 13,
    fontFamily: Fonts.regular,
    color: '#6b7280',
    flex: 1,
  },

  cardFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    marginTop: 8,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: '#f0f1f3',
    gap: 4,
  },
  viewDetailsText: {
    fontFamily: Fonts.medium,
    fontSize: 12,
    color: '#8b909a',
  },

  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: '#ffffff',
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    paddingHorizontal: 24,
    paddingBottom: 32,
    maxHeight: '85%',
    flexShrink: 1,
  },
  modalHandle: {
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#e5e7eb',
    alignSelf: 'center',
    marginTop: 12,
    marginBottom: 16,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  modalTitle: {
    fontSize: 20,
    fontFamily: Fonts.headingBold,
    color: '#1a1d23',
  },
  closeBtn: {
    padding: 4,
  },
  modalTabRow: {
    flexDirection: 'row',
    backgroundColor: '#f0f1f3',
    borderRadius: 12,
    padding: 4,
    marginBottom: 16,
    gap: 4,
  },
  modalTabBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 9,
    borderRadius: 9,
  },
  modalTabBtnActive: {
    backgroundColor: '#ffffff',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 4,
    elevation: 1,
  },
  modalTabText: {
    fontFamily: Fonts.medium,
    fontSize: 13,
    color: '#8b909a',
  },
  modalTabTextActive: {
    color: '#1a1d23',
    fontFamily: Fonts.semiBold,
  },
  modalScroll: {
    flexGrow: 0,
    flexShrink: 1,
  },
  modalScrollContent: {
    paddingBottom: 20,
  },

  modalVendorHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f8f9fb',
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
    gap: 12,
  },
  modalAvatarWrap: {
    width: 50,
    height: 50,
    borderRadius: 14,
    backgroundColor: '#fff7ed',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalVendorInfo: {
    flex: 1,
  },
  modalVendorName: {
    fontSize: 16,
    fontFamily: Fonts.semiBold,
    color: '#1a1d23',
    marginBottom: 2,
  },
  modalVendorOwner: {
    fontSize: 13,
    fontFamily: Fonts.regular,
    color: '#8b909a',
  },
  modalStatusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 20,
    gap: 5,
  },
  modalStatusText: {
    fontSize: 11,
    fontFamily: Fonts.semiBold,
  },

  detailsCard: {
    backgroundColor: '#ffffff',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#f0f1f3',
    paddingHorizontal: 16,
    marginBottom: 16,
  },

  actionsSection: {
    marginTop: 4,
  },
  actionsSectionLabel: {
    fontFamily: Fonts.heading,
    fontSize: 14,
    color: '#8b909a',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 12,
  },
  reasonInput: {
    backgroundColor: '#f8f9fb',
    borderRadius: 14,
    padding: 14,
    fontSize: 14,
    fontFamily: Fonts.regular,
    color: '#1a1d23',
    marginBottom: 14,
    minHeight: 80,
    textAlignVertical: 'top',
    borderWidth: 1,
    borderColor: '#f0f1f3',
  },
  actionButtons: {
    flexDirection: 'row',
    gap: 12,
  },
  approveButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16,
    borderRadius: 14,
    gap: 8,
    backgroundColor: '#ff8c00',
    shadowColor: '#ff8c00',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 4,
  },
  approveButtonText: {
    color: '#ffffff',
    fontSize: 15,
    fontFamily: Fonts.semiBold,
  },
  rejectButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16,
    borderRadius: 14,
    gap: 8,
    backgroundColor: '#ef4444',
  },
  rejectButtonDisabled: {
    opacity: 0.5,
  },
  rejectButtonText: {
    color: '#ffffff',
    fontSize: 15,
    fontFamily: Fonts.semiBold,
  },
  rejectionReasonCard: {
    backgroundColor: '#fef2f2',
    borderRadius: 12,
    padding: 14,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#fecaca',
  },
  rejectionReasonHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 8,
  },
  rejectionReasonLabel: {
    fontSize: 12,
    fontFamily: Fonts.semiBold,
    color: '#ef4444',
    textTransform: 'uppercase',
    letterSpacing: 0.3,
  },
  rejectionReasonText: {
    fontSize: 14,
    fontFamily: Fonts.regular,
    color: '#991b1b',
    lineHeight: 20,
  },
  unrejectButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16,
    borderRadius: 14,
    gap: 8,
    backgroundColor: '#3b82f6',
  },
  unrejectButtonText: {
    color: '#ffffff',
    fontSize: 15,
    fontFamily: Fonts.semiBold,
  },
});
