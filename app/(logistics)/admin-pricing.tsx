import { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, TextInput, Modal, Alert, Platform, RefreshControl } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/lib/supabase';
import {
  DollarSign, Plus, Edit2, Trash2, X, CheckCircle, XCircle,
  Building2, MapPin, Users, Search, Tag, Truck, Zap, BarChart2, Navigation, Layers,
} from 'lucide-react-native';
import { StatusBar } from 'expo-status-bar';
import { getUserFriendlyError } from '@/lib/errorHandler';
import { Toast } from '@/components/Toast';
import { ConfirmDialog } from '@/components/ConfirmDialog';
import { Fonts } from '@/constants/fonts';

type DeliveryZone = {
  id: string;
  name: string;
  description: string | null;
  min_distance_km: number;
  max_distance_km: number;
  price: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
};

type DeliveryPricing = {
  id: string;
  zone_id: string;
  min_weight_kg: number;
  max_weight_kg: number;
  base_price: number;
  price_per_kg: number;
  express_multiplier: number;
  created_at: string;
  updated_at: string;
};

type Promotion = {
  id: string;
  code: string;
  name: string;
  description: string | null;
  discount_type: 'percentage' | 'fixed';
  discount_value: number;
  min_order_amount: number;
  max_discount_amount: number | null;
  valid_from: string;
  valid_until: string | null;
  usage_limit: number | null;
  usage_count: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
};

type BankAccount = {
  id: string;
  bank_name: string;
  account_name: string;
  account_number: string;
  account_type: string;
  swift_code: string | null;
  branch: string | null;
  is_active: boolean;
  display_order: number;
  guidelines: string | null;
  created_at: string;
  updated_at: string;
};

interface Zone {
  id: string;
  name: string;
  description: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

interface Rider {
  id: string;
  zone_id: string | null;
  profile: { full_name: string };
}

type OrderTypeAdjustment = {
  id: string;
  adjustment_name: string;
  description: string | null;
  adjustment_type: 'flat' | 'percentage';
  adjustment_value: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
};

const TAB_CONFIG = [
  { key: 'zones',       label: 'Zones',        icon: Navigation },
  { key: 'pricing',     label: 'Pricing',      icon: DollarSign },
  { key: 'order_types', label: 'Order Types',  icon: Layers },
  { key: 'promotions',  label: 'Promos',       icon: Tag },
  { key: 'banks',       label: 'Banks',        icon: Building2 },
  { key: 'areas',       label: 'Areas',        icon: MapPin },
] as const;

type TabKey = typeof TAB_CONFIG[number]['key'];

export default function AdminPricing() {
  const insets = useSafeAreaInsets();
  const { profile } = useAuth();
  const [activeTab, setActiveTab] = useState<TabKey>('zones');
  const [refreshing, setRefreshing] = useState(false);

  const [deliveryZones, setDeliveryZones] = useState<DeliveryZone[]>([]);
  const [pricing, setPricing] = useState<DeliveryPricing[]>([]);
  const [promotions, setPromotions] = useState<Promotion[]>([]);

  const [showZoneModal, setShowZoneModal] = useState(false);
  const [showPricingModal, setShowPricingModal] = useState(false);
  const [showPromotionModal, setShowPromotionModal] = useState(false);
  const [editingItem, setEditingItem] = useState<any>(null);

  const [zoneName, setZoneName] = useState('');
  const [minDistance, setMinDistance] = useState('');
  const [maxDistance, setMaxDistance] = useState('');
  const [zonePrice, setZonePrice] = useState('');

  const [pricingZoneId, setPricingZoneId] = useState('');
  const [minWeight, setMinWeight] = useState('');
  const [maxWeight, setMaxWeight] = useState('');
  const [basePrice, setBasePrice] = useState('');
  const [pricePerKg, setPricePerKg] = useState('');
  const [expressMultiplier, setExpressMultiplier] = useState('');

  const [promoCode, setPromoCode] = useState('');
  const [promoName, setPromoName] = useState('');
  const [discountType, setDiscountType] = useState<'percentage' | 'fixed'>('fixed');
  const [discountValue, setDiscountValue] = useState('');
  const [minOrderAmount, setMinOrderAmount] = useState('');
  const [usageLimit, setUsageLimit] = useState('');
  const [validFrom, setValidFrom] = useState(new Date().toISOString().split('T')[0]);
  const [validUntil, setValidUntil] = useState('');

  const [bankAccounts, setBankAccounts] = useState<BankAccount[]>([]);
  const [showBankModal, setShowBankModal] = useState(false);
  const [editingAccount, setEditingAccount] = useState<BankAccount | null>(null);
  const [bankName, setBankName] = useState('');
  const [accountName, setAccountName] = useState('');
  const [accountNumber, setAccountNumber] = useState('');
  const [accountType, setAccountType] = useState('Checking');
  const [swiftCode, setSwiftCode] = useState('');
  const [branch, setBranch] = useState('');
  const [bankGuidelines, setBankGuidelines] = useState('');
  const [bankIsActive, setBankIsActive] = useState(true);
  const [displayOrder, setDisplayOrder] = useState('1');

  const [orderTypeAdjustments, setOrderTypeAdjustments] = useState<OrderTypeAdjustment[]>([]);
  const [showOrderTypeModal, setShowOrderTypeModal] = useState(false);
  const [editingOrderType, setEditingOrderType] = useState<OrderTypeAdjustment | null>(null);
  const [otName, setOtName] = useState('');
  const [otDescription, setOtDescription] = useState('');
  const [otType, setOtType] = useState<'flat' | 'percentage'>('flat');
  const [otValue, setOtValue] = useState('');
  const [otActive, setOtActive] = useState(true);

  const [areas, setAreas] = useState<Zone[]>([]);
  const [riders, setRiders] = useState<Rider[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [areaModalVisible, setAreaModalVisible] = useState(false);
  const [riderAssignModalVisible, setRiderAssignModalVisible] = useState(false);
  const [selectedArea, setSelectedArea] = useState<Zone | null>(null);
  const [areaName, setAreaName] = useState('');
  const [areaDescription, setAreaDescription] = useState('');
  const [areaIsActive, setAreaIsActive] = useState(true);
  const [assigningRiders, setAssigningRiders] = useState<Set<string>>(new Set());

  const [toast, setToast] = useState<{ visible: boolean; message: string; type: 'success' | 'error' | 'info' | 'warning' }>({ visible: false, message: '', type: 'success' });
  const [confirmDialog, setConfirmDialog] = useState<{ visible: boolean; title: string; message: string; onConfirm: () => void }>({ visible: false, title: '', message: '', onConfirm: () => {} });

  const showToast = (message: string, type: 'success' | 'error' | 'info' | 'warning' = 'success') => {
    setToast({ visible: true, message, type });
  };

  useEffect(() => {
    if (profile?.role === 'admin') loadAllData();
  }, [profile]);

  const loadAllData = async () => {
    await Promise.all([loadDeliveryZones(), loadPricing(), loadPromotions(), loadBankAccounts(), loadAreas(), loadRiders(), loadOrderTypeAdjustments()]);
  };

  const onRefresh = async () => { setRefreshing(true); await loadAllData(); setRefreshing(false); };

  const loadDeliveryZones = async () => {
    const { data, error } = await supabase.from('delivery_zones').select('*').order('min_distance_km');
    if (!error && data) setDeliveryZones(data);
  };
  const loadPricing = async () => {
    const { data, error } = await supabase.from('delivery_pricing').select('*').order('min_weight_kg');
    if (!error && data) setPricing(data);
  };
  const loadPromotions = async () => {
    const { data, error } = await supabase.from('promotions').select('*').order('created_at', { ascending: false });
    if (!error && data) setPromotions(data);
  };
  const loadBankAccounts = async () => {
    const { data, error } = await supabase.from('bank_accounts').select('*').order('display_order');
    if (!error && data) setBankAccounts(data);
  };
  const loadAreas = async () => {
    try {
      const { data, error } = await supabase.from('zones').select('*').order('created_at', { ascending: false });
      if (error) throw error;
      setAreas(data || []);
    } catch {}
  };
  const loadRiders = async () => {
    try {
      const { data, error } = await supabase.from('riders').select(`id, zone_id, profile:profiles!riders_user_id_fkey(full_name)`);
      if (error) throw error;
      setRiders(data as any || []);
    } catch {}
  };

  const loadOrderTypeAdjustments = async () => {
    const { data, error } = await supabase.from('order_type_adjustments').select('*').order('adjustment_name');
    if (!error && data) setOrderTypeAdjustments(data);
  };

  const handleSaveOrderType = async () => {
    if (!otName.trim() || !otValue) { showToast('Please fill in name and value', 'error'); return; }
    const numVal = parseFloat(otValue);
    if (isNaN(numVal) || numVal < 0) { showToast('Invalid value', 'error'); return; }
    if (otType === 'percentage' && numVal > 100) { showToast('Percentage cannot exceed 100', 'error'); return; }
    try {
      const payload = { adjustment_name: otName.trim(), description: otDescription.trim() || null, adjustment_type: otType, adjustment_value: numVal, is_active: otActive };
      if (editingOrderType) {
        const { error } = await supabase.from('order_type_adjustments').update(payload).eq('id', editingOrderType.id);
        if (error) throw error;
        showToast('Order type updated', 'success');
      } else {
        const { error } = await supabase.from('order_type_adjustments').insert(payload);
        if (error) throw error;
        showToast('Order type added', 'success');
      }
      setShowOrderTypeModal(false);
      loadOrderTypeAdjustments();
    } catch (err: any) { showToast(err.message || 'Failed to save', 'error'); }
  };

  const handleDeleteOrderType = (item: OrderTypeAdjustment) => {
    setConfirmDialog({ visible: true, title: 'Delete Order Type', message: `Delete "${item.adjustment_name}"? This will remove the surcharge from pricing calculations.`, onConfirm: async () => { try { const { error } = await supabase.from('order_type_adjustments').delete().eq('id', item.id); if (error) throw error; showToast('Deleted', 'success'); loadOrderTypeAdjustments(); } catch (err: any) { showToast(err.message || 'Failed to delete', 'error'); } } });
  };

  const handleToggleOrderType = async (item: OrderTypeAdjustment) => {
    const { error } = await supabase.from('order_type_adjustments').update({ is_active: !item.is_active }).eq('id', item.id);
    if (!error) loadOrderTypeAdjustments();
  };

  const openAddOrderType = () => { setEditingOrderType(null); setOtName(''); setOtDescription(''); setOtType('flat'); setOtValue(''); setOtActive(true); setShowOrderTypeModal(true); };
  const openEditOrderType = (item: OrderTypeAdjustment) => { setEditingOrderType(item); setOtName(item.adjustment_name); setOtDescription(item.description || ''); setOtType(item.adjustment_type); setOtValue(item.adjustment_value.toString()); setOtActive(item.is_active); setShowOrderTypeModal(true); };

  const handleSaveZone = async () => {
    if (!zoneName || !minDistance || !maxDistance || !zonePrice) { if (Platform.OS === 'web') alert('Please fill in all fields'); return; }
    const zoneData = { name: zoneName, min_distance_km: parseFloat(minDistance), max_distance_km: parseFloat(maxDistance), price: parseFloat(zonePrice), is_active: true };
    if (editingItem) await supabase.from('delivery_zones').update(zoneData).eq('id', editingItem.id);
    else await supabase.from('delivery_zones').insert(zoneData);
    setShowZoneModal(false); resetZoneForm(); loadDeliveryZones();
  };

  const handleSavePricing = async () => {
    if (!pricingZoneId || !minWeight || !maxWeight || !basePrice || !pricePerKg || !expressMultiplier) { if (Platform.OS === 'web') alert('Please fill in all fields'); return; }
    const pricingData = { zone_id: pricingZoneId, min_weight_kg: parseFloat(minWeight), max_weight_kg: parseFloat(maxWeight), base_price: parseFloat(basePrice), price_per_kg: parseFloat(pricePerKg), express_multiplier: parseFloat(expressMultiplier) };
    if (editingItem) await supabase.from('delivery_pricing').update(pricingData).eq('id', editingItem.id);
    else await supabase.from('delivery_pricing').insert(pricingData);
    setShowPricingModal(false); resetPricingForm(); loadPricing();
  };

  const handleSavePromotion = async () => {
    if (!promoCode || !promoName || !discountValue || !validFrom) {
      if (Platform.OS === 'web') alert('Please fill in all required fields (Code, Name, Discount Value, Valid From)');
      return;
    }
    try {
      const promoData = {
        code: promoCode.toUpperCase(),
        name: promoName,
        discount_type: discountType,
        discount_value: parseFloat(discountValue),
        min_order_amount: minOrderAmount ? parseFloat(minOrderAmount) : 0,
        usage_limit: usageLimit ? parseInt(usageLimit) : null,
        is_active: true,
        valid_from: new Date(validFrom).toISOString(),
        valid_until: validUntil ? new Date(validUntil).toISOString() : new Date('2099-12-31').toISOString(),
      };
      let error;
      if (editingItem) {
        ({ error } = await supabase.from('promotions').update(promoData).eq('id', editingItem.id));
      } else {
        ({ error } = await supabase.from('promotions').insert(promoData));
      }
      if (error) throw error;
      setShowPromotionModal(false);
      resetPromotionForm();
      loadPromotions();
    } catch (err: any) {
      if (Platform.OS === 'web') alert(err?.message || 'Failed to save promotion');
    }
  };

  const handleSaveBank = async () => {
    if (!bankName || !accountName || !accountNumber) { if (Platform.OS === 'web') alert('Please fill in all required fields'); else Alert.alert('Error', 'Please fill in all required fields'); return; }
    try {
      const accountData = { bank_name: bankName, account_name: accountName, account_number: accountNumber, account_type: accountType, swift_code: swiftCode || null, branch: branch || null, guidelines: bankGuidelines || null, is_active: bankIsActive, display_order: parseInt(displayOrder) || 1 };
      if (editingAccount) { const { error } = await supabase.from('bank_accounts').update(accountData).eq('id', editingAccount.id); if (error) throw error; }
      else { const { error } = await supabase.from('bank_accounts').insert([accountData]); if (error) throw error; }
      setShowBankModal(false); loadBankAccounts();
    } catch (error: any) {
      const msg = getUserFriendlyError(error);
      if (Platform.OS === 'web') alert(msg); else Alert.alert('Error', msg);
    }
  };

  const handleDeleteBank = async (accountId: string) => {
    const confirmDelete = Platform.OS === 'web' ? confirm('Are you sure you want to delete this bank account?') : await new Promise(resolve => { Alert.alert('Confirm Delete', 'Are you sure?', [{ text: 'Cancel', onPress: () => resolve(false), style: 'cancel' }, { text: 'Delete', onPress: () => resolve(true), style: 'destructive' }]); });
    if (!confirmDelete) return;
    try { const { error } = await supabase.from('bank_accounts').delete().eq('id', accountId); if (error) throw error; loadBankAccounts(); } catch (error: any) { const msg = getUserFriendlyError(error); if (Platform.OS === 'web') alert(msg); else Alert.alert('Error', msg); }
  };

  const handleSaveArea = async () => {
    if (!areaName.trim()) { showToast('Zone name is required', 'error'); return; }
    try {
      if (selectedArea) { const { error } = await supabase.from('zones').update({ name: areaName.trim(), description: areaDescription.trim() || null, is_active: areaIsActive }).eq('id', selectedArea.id); if (error) throw error; showToast('Zone updated successfully', 'success'); }
      else { const { error } = await supabase.from('zones').insert({ name: areaName.trim(), description: areaDescription.trim() || null, is_active: areaIsActive }); if (error) throw error; showToast('Zone created successfully', 'success'); }
      setAreaModalVisible(false); loadAreas();
    } catch (error: any) { showToast(error.message || 'Failed to save zone', 'error'); }
  };

  const handleDeleteArea = (area: Zone) => {
    const ridersInZone = riders.filter(r => r.zone_id === area.id);
    setConfirmDialog({ visible: true, title: 'Delete Zone', message: ridersInZone.length > 0 ? `This zone has ${ridersInZone.length} rider(s) assigned. They will be unassigned. Are you sure?` : 'Are you sure you want to delete this zone? This action cannot be undone.', onConfirm: async () => { try { const { error } = await supabase.from('zones').delete().eq('id', area.id); if (error) throw error; showToast('Zone deleted successfully', 'success'); loadAreas(); loadRiders(); } catch (error: any) { showToast(error.message || 'Failed to delete zone', 'error'); } } });
  };

  const handleSaveRiderAssignments = async () => {
    if (!selectedArea) return;
    try {
      const updates = riders.map(rider => {
        const shouldBeInZone = assigningRiders.has(rider.id);
        const isCurrentlyInZone = rider.zone_id === selectedArea.id;
        if (shouldBeInZone && !isCurrentlyInZone) return supabase.from('riders').update({ zone_id: selectedArea.id }).eq('id', rider.id);
        else if (!shouldBeInZone && isCurrentlyInZone) return supabase.from('riders').update({ zone_id: null }).eq('id', rider.id);
        return null;
      }).filter(Boolean);
      await Promise.all(updates);
      showToast('Rider assignments updated successfully', 'success');
      setRiderAssignModalVisible(false); loadRiders();
    } catch (error: any) { showToast(error.message || 'Failed to update assignments', 'error'); }
  };

  const handleToggleZone = async (zone: DeliveryZone) => { await supabase.from('delivery_zones').update({ is_active: !zone.is_active }).eq('id', zone.id); loadDeliveryZones(); };
  const handleTogglePromotion = async (p: Promotion) => { await supabase.from('promotions').update({ is_active: !p.is_active }).eq('id', p.id); loadPromotions(); };
  const handleDeleteDeliveryZone = async (zoneId: string) => { await supabase.from('delivery_zones').delete().eq('id', zoneId); loadDeliveryZones(); };
  const handleDeletePricing = async (pricingId: string) => { await supabase.from('delivery_pricing').delete().eq('id', pricingId); loadPricing(); };
  const handleDeletePromotion = async (promotionId: string) => { await supabase.from('promotions').delete().eq('id', promotionId); loadPromotions(); };

  const openEditDeliveryZone = (zone: DeliveryZone) => { setEditingItem(zone); setZoneName(zone.name); setMinDistance(zone.min_distance_km.toString()); setMaxDistance(zone.max_distance_km.toString()); setZonePrice(zone.price.toString()); setShowZoneModal(true); };
  const openEditPricing = (item: DeliveryPricing) => { setEditingItem(item); setPricingZoneId(item.zone_id); setMinWeight(item.min_weight_kg.toString()); setMaxWeight(item.max_weight_kg.toString()); setBasePrice(item.base_price.toString()); setPricePerKg(item.price_per_kg.toString()); setExpressMultiplier(item.express_multiplier.toString()); setShowPricingModal(true); };
  const openEditPromotion = (promotion: Promotion) => { setEditingItem(promotion); setPromoCode(promotion.code); setPromoName(promotion.name); setDiscountType(promotion.discount_type); setDiscountValue(promotion.discount_value.toString()); setMinOrderAmount(promotion.min_order_amount.toString()); setUsageLimit(promotion.usage_limit?.toString() || ''); setValidFrom(promotion.valid_from ? promotion.valid_from.split('T')[0] : new Date().toISOString().split('T')[0]); setValidUntil(promotion.valid_until ? promotion.valid_until.split('T')[0] : ''); setShowPromotionModal(true); };
  const openAddBankModal = () => { setEditingAccount(null); setBankName(''); setAccountName(''); setAccountNumber(''); setAccountType('Checking'); setSwiftCode(''); setBranch(''); setBankGuidelines(''); setBankIsActive(true); setDisplayOrder('1'); setShowBankModal(true); };
  const openEditBankModal = (account: BankAccount) => { setEditingAccount(account); setBankName(account.bank_name); setAccountName(account.account_name); setAccountNumber(account.account_number); setAccountType(account.account_type); setSwiftCode(account.swift_code || ''); setBranch(account.branch || ''); setBankGuidelines(account.guidelines || ''); setBankIsActive(account.is_active); setDisplayOrder(account.display_order.toString()); setShowBankModal(true); };
  const toggleBankStatus = async (account: BankAccount) => { try { await supabase.from('bank_accounts').update({ is_active: !account.is_active }).eq('id', account.id); loadBankAccounts(); } catch {} };

  const resetZoneForm = () => { setEditingItem(null); setZoneName(''); setMinDistance(''); setMaxDistance(''); setZonePrice(''); };
  const resetPricingForm = () => { setEditingItem(null); setPricingZoneId(''); setMinWeight(''); setMaxWeight(''); setBasePrice(''); setPricePerKg(''); setExpressMultiplier(''); };
  const resetPromotionForm = () => { setEditingItem(null); setPromoCode(''); setPromoName(''); setDiscountType('fixed'); setDiscountValue(''); setMinOrderAmount(''); setUsageLimit(''); setValidFrom(new Date().toISOString().split('T')[0]); setValidUntil(''); };
  const getZoneName = (zoneId: string) => deliveryZones.find(z => z.id === zoneId)?.name || zoneId;
  const getRidersCount = (zoneId: string) => riders.filter(r => r.zone_id === zoneId).length;
  const filteredAreas = areas.filter(area => !searchQuery.trim() || area.name.toLowerCase().includes(searchQuery.toLowerCase()) || (area.description?.toLowerCase().includes(searchQuery.toLowerCase()) ?? false));

  const renderDeliveryZones = () => (
    <View style={styles.section}>
      <View style={styles.sectionHeader}>
        <View>
          <Text style={styles.sectionTitle}>Delivery Zones</Text>
          <Text style={styles.sectionSubtitle}>{deliveryZones.length} zone{deliveryZones.length !== 1 ? 's' : ''} configured</Text>
        </View>
        <TouchableOpacity style={styles.addBtn} onPress={() => { resetZoneForm(); setShowZoneModal(true); }} activeOpacity={0.8}>
          <Plus size={16} color="#fff" />
          <Text style={styles.addBtnText}>Add Zone</Text>
        </TouchableOpacity>
      </View>
      {deliveryZones.length === 0 ? (
        <View style={styles.emptyState}>
          <View style={styles.emptyIconWrap}><Navigation size={32} color="#d1d5db" /></View>
          <Text style={styles.emptyTitle}>No zones yet</Text>
          <Text style={styles.emptySubtitle}>Add delivery zones to set up distance-based pricing</Text>
        </View>
      ) : deliveryZones.map((zone) => (
        <View key={zone.id} style={[styles.dataCard, !zone.is_active && styles.dataCardInactive]}>
          <View style={styles.dataCardTop}>
            <View style={styles.dataCardTitleRow}>
              <View style={[styles.dataCardIconWrap, { backgroundColor: '#fff7ed' }]}>
                <Navigation size={16} color="#f97316" />
              </View>
              <View style={styles.dataCardTitleBlock}>
                <Text style={styles.dataCardTitle}>{zone.name}</Text>
                <Text style={styles.dataCardMeta}>{zone.min_distance_km} – {zone.max_distance_km} km</Text>
              </View>
            </View>
            <View style={styles.dataCardActions}>
              <TouchableOpacity style={styles.iconBtn} onPress={() => handleToggleZone(zone)}>
                {zone.is_active ? <CheckCircle size={18} color="#10b981" /> : <XCircle size={18} color="#9ca3af" />}
              </TouchableOpacity>
              <TouchableOpacity style={[styles.iconBtn, styles.iconBtnBlue]} onPress={() => openEditDeliveryZone(zone)}>
                <Edit2 size={15} color="#3b82f6" />
              </TouchableOpacity>
              <TouchableOpacity style={[styles.iconBtn, styles.iconBtnRed]} onPress={() => handleDeleteDeliveryZone(zone.id)}>
                <Trash2 size={15} color="#ef4444" />
              </TouchableOpacity>
            </View>
          </View>
          <View style={styles.dataCardBody}>
            <View style={styles.pricingChip}>
              <DollarSign size={12} color="#f97316" />
              <Text style={styles.pricingChipText}>₦{zone.price.toLocaleString()}</Text>
            </View>
            <View style={[styles.statusChip, zone.is_active ? styles.statusChipActive : styles.statusChipInactive]}>
              <Text style={[styles.statusChipText, zone.is_active ? styles.statusChipTextActive : styles.statusChipTextInactive]}>
                {zone.is_active ? 'Active' : 'Inactive'}
              </Text>
            </View>
            <Text style={styles.dataCardDate}>Updated {new Date(zone.updated_at).toLocaleDateString()}</Text>
          </View>
        </View>
      ))}
    </View>
  );

  const renderPricing = () => (
    <View style={styles.section}>
      <View style={styles.sectionHeader}>
        <View>
          <Text style={styles.sectionTitle}>Delivery Pricing</Text>
          <Text style={styles.sectionSubtitle}>{pricing.length} rule{pricing.length !== 1 ? 's' : ''} configured</Text>
        </View>
        <TouchableOpacity style={styles.addBtn} onPress={() => { resetPricingForm(); setShowPricingModal(true); }} activeOpacity={0.8}>
          <Plus size={16} color="#fff" />
          <Text style={styles.addBtnText}>Add Pricing</Text>
        </TouchableOpacity>
      </View>
      {pricing.length === 0 ? (
        <View style={styles.emptyState}>
          <View style={styles.emptyIconWrap}><DollarSign size={32} color="#d1d5db" /></View>
          <Text style={styles.emptyTitle}>No pricing rules yet</Text>
          <Text style={styles.emptySubtitle}>Add weight-based pricing rules per zone</Text>
        </View>
      ) : pricing.map((item) => (
        <View key={item.id} style={styles.dataCard}>
          <View style={styles.dataCardTop}>
            <View style={styles.dataCardTitleRow}>
              <View style={[styles.dataCardIconWrap, { backgroundColor: '#f0fdf4' }]}>
                <Truck size={16} color="#16a34a" />
              </View>
              <View style={styles.dataCardTitleBlock}>
                <Text style={styles.dataCardTitle}>{getZoneName(item.zone_id)}</Text>
                <Text style={styles.dataCardMeta}>{item.min_weight_kg} – {item.max_weight_kg} kg</Text>
              </View>
            </View>
            <View style={styles.dataCardActions}>
              <TouchableOpacity style={[styles.iconBtn, styles.iconBtnBlue]} onPress={() => openEditPricing(item)}>
                <Edit2 size={15} color="#3b82f6" />
              </TouchableOpacity>
              <TouchableOpacity style={[styles.iconBtn, styles.iconBtnRed]} onPress={() => handleDeletePricing(item.id)}>
                <Trash2 size={15} color="#ef4444" />
              </TouchableOpacity>
            </View>
          </View>
          <View style={styles.pricingGrid}>
            <View style={styles.pricingGridItem}>
              <Text style={styles.pricingGridLabel}>Base Price</Text>
              <Text style={styles.pricingGridValue}>₦{item.base_price.toLocaleString()}</Text>
            </View>
            <View style={styles.pricingGridItem}>
              <Text style={styles.pricingGridLabel}>Per kg</Text>
              <Text style={styles.pricingGridValue}>₦{item.price_per_kg.toLocaleString()}</Text>
            </View>
            <View style={styles.pricingGridItem}>
              <Text style={styles.pricingGridLabel}>Express</Text>
              <View style={styles.expressChip}>
                <Zap size={11} color="#f59e0b" />
                <Text style={styles.expressChipText}>{item.express_multiplier}x</Text>
              </View>
            </View>
          </View>
          <Text style={styles.dataCardDate}>Updated {new Date(item.updated_at).toLocaleDateString()}</Text>
        </View>
      ))}
    </View>
  );

  const renderPromotions = () => (
    <View style={styles.section}>
      <View style={styles.sectionHeader}>
        <View>
          <Text style={styles.sectionTitle}>Promotions</Text>
          <Text style={styles.sectionSubtitle}>{promotions.length} promo{promotions.length !== 1 ? 's' : ''}</Text>
        </View>
        <TouchableOpacity style={styles.addBtn} onPress={() => { resetPromotionForm(); setShowPromotionModal(true); }} activeOpacity={0.8}>
          <Plus size={16} color="#fff" />
          <Text style={styles.addBtnText}>Add Promo</Text>
        </TouchableOpacity>
      </View>
      {promotions.length === 0 ? (
        <View style={styles.emptyState}>
          <View style={styles.emptyIconWrap}><Tag size={32} color="#d1d5db" /></View>
          <Text style={styles.emptyTitle}>No promotions yet</Text>
          <Text style={styles.emptySubtitle}>Create discount codes for your customers</Text>
        </View>
      ) : promotions.map((promo) => (
        <View key={promo.id} style={[styles.dataCard, !promo.is_active && styles.dataCardInactive]}>
          <View style={styles.dataCardTop}>
            <View style={styles.dataCardTitleRow}>
              <View style={[styles.dataCardIconWrap, { backgroundColor: '#fef3c7' }]}>
                <Tag size={16} color="#d97706" />
              </View>
              <View style={styles.dataCardTitleBlock}>
                <Text style={styles.dataCardTitle}>{promo.name}</Text>
                <View style={styles.promoCodeBadge}>
                  <Text style={styles.promoCodeText}>{promo.code}</Text>
                </View>
              </View>
            </View>
            <View style={styles.dataCardActions}>
              <TouchableOpacity style={styles.iconBtn} onPress={() => handleTogglePromotion(promo)}>
                {promo.is_active ? <CheckCircle size={18} color="#10b981" /> : <XCircle size={18} color="#9ca3af" />}
              </TouchableOpacity>
              <TouchableOpacity style={[styles.iconBtn, styles.iconBtnBlue]} onPress={() => openEditPromotion(promo)}>
                <Edit2 size={15} color="#3b82f6" />
              </TouchableOpacity>
              <TouchableOpacity style={[styles.iconBtn, styles.iconBtnRed]} onPress={() => handleDeletePromotion(promo.id)}>
                <Trash2 size={15} color="#ef4444" />
              </TouchableOpacity>
            </View>
          </View>
          <View style={styles.promoStats}>
            <View style={styles.promoStatItem}>
              <Text style={styles.promoStatLabel}>Discount</Text>
              <Text style={styles.promoStatValue}>
                {promo.discount_type === 'fixed' ? `₦${promo.discount_value.toLocaleString()}` : `${promo.discount_value}%`}
              </Text>
            </View>
            <View style={styles.promoStatDivider} />
            <View style={styles.promoStatItem}>
              <Text style={styles.promoStatLabel}>Min Order</Text>
              <Text style={styles.promoStatValue}>₦{promo.min_order_amount.toLocaleString()}</Text>
            </View>
            <View style={styles.promoStatDivider} />
            <View style={styles.promoStatItem}>
              <Text style={styles.promoStatLabel}>Used</Text>
              <Text style={styles.promoStatValue}>{promo.usage_count} / {promo.usage_limit ?? '∞'}</Text>
            </View>
          </View>
          <View style={styles.promoFooter}>
            <View style={[styles.statusChip, promo.is_active ? styles.statusChipActive : styles.statusChipInactive]}>
              <Text style={[styles.statusChipText, promo.is_active ? styles.statusChipTextActive : styles.statusChipTextInactive]}>
                {promo.is_active ? 'Active' : 'Inactive'}
              </Text>
            </View>
          </View>
        </View>
      ))}
    </View>
  );

  const renderBanks = () => (
    <View style={styles.section}>
      <View style={styles.sectionHeader}>
        <View>
          <Text style={styles.sectionTitle}>Bank Accounts</Text>
          <Text style={styles.sectionSubtitle}>{bankAccounts.length} account{bankAccounts.length !== 1 ? 's' : ''}</Text>
        </View>
        <TouchableOpacity style={styles.addBtn} onPress={openAddBankModal} activeOpacity={0.8}>
          <Plus size={16} color="#fff" />
          <Text style={styles.addBtnText}>Add Bank</Text>
        </TouchableOpacity>
      </View>
      {bankAccounts.length === 0 ? (
        <View style={styles.emptyState}>
          <View style={styles.emptyIconWrap}><Building2 size={32} color="#d1d5db" /></View>
          <Text style={styles.emptyTitle}>No bank accounts yet</Text>
          <Text style={styles.emptySubtitle}>Add a bank account to accept transfers</Text>
        </View>
      ) : bankAccounts.map((account) => (
        <View key={account.id} style={styles.bankCard}>
          <View style={styles.bankCardTop}>
            <View style={styles.bankCardLeft}>
              <View style={styles.bankIconWrap}>
                <Building2 size={18} color="#0ea5e9" />
              </View>
              <View>
                <Text style={styles.bankCardName}>{account.bank_name}</Text>
                <View style={[styles.statusChip, account.is_active ? styles.statusChipActive : styles.statusChipInactive, { marginTop: 4 }]}>
                  <Text style={[styles.statusChipText, account.is_active ? styles.statusChipTextActive : styles.statusChipTextInactive]}>
                    {account.is_active ? 'Active' : 'Inactive'}
                  </Text>
                </View>
              </View>
            </View>
            <View style={styles.dataCardActions}>
              <TouchableOpacity style={styles.iconBtn} onPress={() => toggleBankStatus(account)}>
                {account.is_active ? <CheckCircle size={18} color="#10b981" /> : <XCircle size={18} color="#9ca3af" />}
              </TouchableOpacity>
              <TouchableOpacity style={[styles.iconBtn, styles.iconBtnBlue]} onPress={() => openEditBankModal(account)}>
                <Edit2 size={15} color="#3b82f6" />
              </TouchableOpacity>
              <TouchableOpacity style={[styles.iconBtn, styles.iconBtnRed]} onPress={() => handleDeleteBank(account.id)}>
                <Trash2 size={15} color="#ef4444" />
              </TouchableOpacity>
            </View>
          </View>
          <View style={styles.bankDetailsGrid}>
            <View style={styles.bankDetailRow}>
              <Text style={styles.bankDetailLabel}>Account Name</Text>
              <Text style={styles.bankDetailValue}>{account.account_name}</Text>
            </View>
            <View style={styles.bankDetailRow}>
              <Text style={styles.bankDetailLabel}>Account Number</Text>
              <Text style={styles.bankDetailValueMono}>{account.account_number}</Text>
            </View>
            <View style={styles.bankDetailRow}>
              <Text style={styles.bankDetailLabel}>Type</Text>
              <Text style={styles.bankDetailValue}>{account.account_type}</Text>
            </View>
            {account.branch && (
              <View style={styles.bankDetailRow}>
                <Text style={styles.bankDetailLabel}>Branch</Text>
                <Text style={styles.bankDetailValue}>{account.branch}</Text>
              </View>
            )}
            {account.swift_code && (
              <View style={styles.bankDetailRow}>
                <Text style={styles.bankDetailLabel}>SWIFT</Text>
                <Text style={styles.bankDetailValueMono}>{account.swift_code}</Text>
              </View>
            )}
          </View>
          {account.guidelines && (
            <View style={styles.guidelinesBox}>
              <Text style={styles.guidelinesLabel}>Guidelines</Text>
              <Text style={styles.guidelinesText}>{account.guidelines}</Text>
            </View>
          )}
        </View>
      ))}
    </View>
  );

  const renderOrderTypes = () => (
    <View style={styles.section}>
      <View style={styles.sectionHeader}>
        <View>
          <Text style={styles.sectionTitle}>Order Type Charges</Text>
          <Text style={styles.sectionSubtitle}>{orderTypeAdjustments.length} type{orderTypeAdjustments.length !== 1 ? 's' : ''} configured</Text>
        </View>
        <TouchableOpacity style={styles.addBtn} onPress={openAddOrderType} activeOpacity={0.8}>
          <Plus size={16} color="#fff" />
          <Text style={styles.addBtnText}>Add Type</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.orderTypeInfoBox}>
        <Layers size={15} color="#0369a1" />
        <Text style={styles.orderTypeInfoText}>
          Order type charges are added to the base delivery fee when a customer selects special handling options (e.g., fragile, express, oversized).
        </Text>
      </View>

      {orderTypeAdjustments.length === 0 ? (
        <View style={styles.emptyState}>
          <View style={styles.emptyIconWrap}><Layers size={32} color="#d1d5db" /></View>
          <Text style={styles.emptyTitle}>No order types yet</Text>
          <Text style={styles.emptySubtitle}>Add surcharges for special handling options like fragile, bulky, or express</Text>
        </View>
      ) : orderTypeAdjustments.map((item) => (
        <View key={item.id} style={[styles.dataCard, !item.is_active && styles.dataCardInactive]}>
          <View style={styles.dataCardTop}>
            <View style={styles.dataCardTitleRow}>
              <View style={[styles.dataCardIconWrap, { backgroundColor: '#faf5ff' }]}>
                <Layers size={16} color="#7c3aed" />
              </View>
              <View style={styles.dataCardTitleBlock}>
                <Text style={styles.dataCardTitle}>{item.adjustment_name}</Text>
                {item.description ? <Text style={styles.dataCardMeta}>{item.description}</Text> : null}
              </View>
            </View>
            <View style={styles.dataCardActions}>
              <TouchableOpacity style={styles.iconBtn} onPress={() => handleToggleOrderType(item)}>
                {item.is_active ? <CheckCircle size={18} color="#10b981" /> : <XCircle size={18} color="#9ca3af" />}
              </TouchableOpacity>
              <TouchableOpacity style={[styles.iconBtn, styles.iconBtnBlue]} onPress={() => openEditOrderType(item)}>
                <Edit2 size={15} color="#3b82f6" />
              </TouchableOpacity>
              <TouchableOpacity style={[styles.iconBtn, styles.iconBtnRed]} onPress={() => handleDeleteOrderType(item)}>
                <Trash2 size={15} color="#ef4444" />
              </TouchableOpacity>
            </View>
          </View>
          <View style={styles.orderTypeCardBody}>
            <View style={styles.orderTypeCharge}>
              <Text style={styles.orderTypeChargeLabel}>
                {item.adjustment_type === 'flat' ? 'Flat Fee' : 'Surcharge'}
              </Text>
              <Text style={styles.orderTypeChargeValue}>
                {item.adjustment_type === 'flat'
                  ? `+ ₦${item.adjustment_value.toLocaleString()}`
                  : `+ ${item.adjustment_value}%`}
              </Text>
            </View>
            <View style={[styles.statusChip, item.is_active ? styles.statusChipActive : styles.statusChipInactive]}>
              <Text style={[styles.statusChipText, item.is_active ? styles.statusChipTextActive : styles.statusChipTextInactive]}>
                {item.is_active ? 'Active' : 'Inactive'}
              </Text>
            </View>
          </View>
        </View>
      ))}
    </View>
  );

  const renderAreas = () => (
    <View style={styles.section}>
      <View style={styles.sectionHeader}>
        <View>
          <Text style={styles.sectionTitle}>Delivery Areas</Text>
          <Text style={styles.sectionSubtitle}>{areas.length} area{areas.length !== 1 ? 's' : ''}</Text>
        </View>
        <TouchableOpacity style={styles.addBtn} onPress={() => { setSelectedArea(null); setAreaName(''); setAreaDescription(''); setAreaIsActive(true); setAreaModalVisible(true); }} activeOpacity={0.8}>
          <Plus size={16} color="#fff" />
          <Text style={styles.addBtnText}>Add Area</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.searchBar}>
        <Search size={16} color="#9ca3af" />
        <TextInput
          style={styles.searchInput}
          value={searchQuery}
          onChangeText={setSearchQuery}
          placeholder="Search areas..."
          placeholderTextColor="#9ca3af"
        />
        {searchQuery.length > 0 && (
          <TouchableOpacity onPress={() => setSearchQuery('')}><X size={15} color="#9ca3af" /></TouchableOpacity>
        )}
      </View>

      {filteredAreas.length === 0 ? (
        <View style={styles.emptyState}>
          <View style={styles.emptyIconWrap}><MapPin size={32} color="#d1d5db" /></View>
          <Text style={styles.emptyTitle}>{areas.length === 0 ? 'No areas yet' : 'No areas found'}</Text>
          <Text style={styles.emptySubtitle}>{areas.length === 0 ? 'Create areas to organise riders by zone' : 'Try adjusting your search'}</Text>
        </View>
      ) : filteredAreas.map((area) => (
        <View key={area.id} style={styles.dataCard}>
          <View style={styles.dataCardTop}>
            <View style={styles.dataCardTitleRow}>
              <View style={[styles.dataCardIconWrap, { backgroundColor: '#f0f9ff' }]}>
                <MapPin size={16} color="#0ea5e9" />
              </View>
              <View style={styles.dataCardTitleBlock}>
                <View style={styles.areaNameRow}>
                  <Text style={styles.dataCardTitle}>{area.name}</Text>
                  {!area.is_active && (
                    <View style={styles.inactivePill}>
                      <Text style={styles.inactivePillText}>Inactive</Text>
                    </View>
                  )}
                </View>
                {area.description && <Text style={styles.dataCardMeta}>{area.description}</Text>}
              </View>
            </View>
            <View style={styles.dataCardActions}>
              <TouchableOpacity style={[styles.iconBtn, styles.iconBtnBlue]} onPress={() => { setSelectedArea(area); setAreaName(area.name); setAreaDescription(area.description || ''); setAreaIsActive(area.is_active); setAreaModalVisible(true); }}>
                <Edit2 size={15} color="#3b82f6" />
              </TouchableOpacity>
              <TouchableOpacity style={[styles.iconBtn, styles.iconBtnRed]} onPress={() => handleDeleteArea(area)}>
                <Trash2 size={15} color="#ef4444" />
              </TouchableOpacity>
            </View>
          </View>
          <View style={styles.areaFooter}>
            <View style={styles.riderCountBadge}>
              <Users size={13} color="#6b7280" />
              <Text style={styles.riderCountText}>{getRidersCount(area.id)} Rider{getRidersCount(area.id) !== 1 ? 's' : ''}</Text>
            </View>
            <TouchableOpacity
              style={styles.assignBtn}
              onPress={() => { setSelectedArea(area); const ridersInZone = riders.filter(r => r.zone_id === area.id); setAssigningRiders(new Set(ridersInZone.map(r => r.id))); setRiderAssignModalVisible(true); }}
              activeOpacity={0.8}>
              <Users size={14} color="#0ea5e9" />
              <Text style={styles.assignBtnText}>Manage Riders</Text>
            </TouchableOpacity>
          </View>
        </View>
      ))}
    </View>
  );

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <StatusBar style="light" />

      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <View style={styles.headerIconWrap}>
            <BarChart2 size={22} color="#f97316" />
          </View>
          <View>
            <Text style={styles.headerTitle}>Pricing Dashboard</Text>
            <Text style={styles.headerSubtitle}>Manage zones, charges & promotions</Text>
          </View>
        </View>
      </View>

      <View style={styles.tabBar}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.tabBarContent}>
          {TAB_CONFIG.map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.key;
            return (
              <TouchableOpacity
                key={tab.key}
                style={[styles.tab, isActive && styles.tabActive]}
                onPress={() => setActiveTab(tab.key)}
                activeOpacity={0.75}>
                <Icon size={15} color={isActive ? '#f97316' : '#9ca3af'} />
                <Text style={[styles.tabText, isActive && styles.tabTextActive]}>{tab.label}</Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      </View>

      <ScrollView
        style={styles.content}
        contentContainerStyle={{ paddingBottom: Math.max(insets.bottom, 24) }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#f97316" />}>
        {activeTab === 'zones'       && renderDeliveryZones()}
        {activeTab === 'pricing'     && renderPricing()}
        {activeTab === 'order_types' && renderOrderTypes()}
        {activeTab === 'promotions'  && renderPromotions()}
        {activeTab === 'banks'       && renderBanks()}
        {activeTab === 'areas'       && renderAreas()}
        <View style={{ height: 32 }} />
      </ScrollView>

      <Modal visible={showZoneModal} animationType="slide" transparent>
        <View style={styles.sheetOverlay}>
          <View style={styles.sheet}>
            <View style={styles.sheetHandle} />
            <View style={styles.sheetHeader}>
              <Text style={styles.sheetTitle}>{editingItem ? 'Edit Zone' : 'New Zone'}</Text>
              <TouchableOpacity style={styles.sheetClose} onPress={() => setShowZoneModal(false)}><X size={20} color="#6b7280" /></TouchableOpacity>
            </View>
            <ScrollView style={styles.sheetBody} showsVerticalScrollIndicator={false}>
              <Text style={styles.inputLabel}>Zone Name</Text>
              <TextInput style={styles.input} placeholder="e.g., Zone A – 0–3 km" value={zoneName} onChangeText={setZoneName} placeholderTextColor="#9ca3af" />
              <View style={styles.inputRow}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.inputLabel}>Min Distance (km)</Text>
                  <TextInput style={styles.input} placeholder="0" value={minDistance} onChangeText={setMinDistance} keyboardType="decimal-pad" placeholderTextColor="#9ca3af" />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.inputLabel}>Max Distance (km)</Text>
                  <TextInput style={styles.input} placeholder="10" value={maxDistance} onChangeText={setMaxDistance} keyboardType="decimal-pad" placeholderTextColor="#9ca3af" />
                </View>
              </View>
              <Text style={styles.inputLabel}>Price (₦)</Text>
              <TextInput style={styles.input} placeholder="500" value={zonePrice} onChangeText={setZonePrice} keyboardType="decimal-pad" placeholderTextColor="#9ca3af" />
            </ScrollView>
            <View style={styles.sheetFooter}>
              <TouchableOpacity style={styles.cancelBtn2} onPress={() => setShowZoneModal(false)}><Text style={styles.cancelBtn2Text}>Cancel</Text></TouchableOpacity>
              <TouchableOpacity style={styles.saveBtn2} onPress={handleSaveZone}><CheckCircle size={16} color="#fff" /><Text style={styles.saveBtn2Text}>Save Zone</Text></TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      <Modal visible={showPricingModal} animationType="slide" transparent>
        <View style={styles.sheetOverlay}>
          <View style={styles.sheet}>
            <View style={styles.sheetHandle} />
            <View style={styles.sheetHeader}>
              <Text style={styles.sheetTitle}>{editingItem ? 'Edit Pricing' : 'New Pricing Rule'}</Text>
              <TouchableOpacity style={styles.sheetClose} onPress={() => setShowPricingModal(false)}><X size={20} color="#6b7280" /></TouchableOpacity>
            </View>
            <ScrollView style={styles.sheetBody} showsVerticalScrollIndicator={false}>
              <Text style={styles.inputLabel}>Zone ID</Text>
              <TextInput style={styles.input} placeholder="Zone ID" value={pricingZoneId} onChangeText={setPricingZoneId} placeholderTextColor="#9ca3af" />
              <View style={styles.inputRow}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.inputLabel}>Min Weight (kg)</Text>
                  <TextInput style={styles.input} placeholder="0" value={minWeight} onChangeText={setMinWeight} keyboardType="decimal-pad" placeholderTextColor="#9ca3af" />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.inputLabel}>Max Weight (kg)</Text>
                  <TextInput style={styles.input} placeholder="5" value={maxWeight} onChangeText={setMaxWeight} keyboardType="decimal-pad" placeholderTextColor="#9ca3af" />
                </View>
              </View>
              <Text style={styles.inputLabel}>Base Price (₦)</Text>
              <TextInput style={styles.input} placeholder="500" value={basePrice} onChangeText={setBasePrice} keyboardType="decimal-pad" placeholderTextColor="#9ca3af" />
              <Text style={styles.inputLabel}>Price Per kg (₦)</Text>
              <TextInput style={styles.input} placeholder="50" value={pricePerKg} onChangeText={setPricePerKg} keyboardType="decimal-pad" placeholderTextColor="#9ca3af" />
              <Text style={styles.inputLabel}>Express Multiplier</Text>
              <TextInput style={styles.input} placeholder="1.5" value={expressMultiplier} onChangeText={setExpressMultiplier} keyboardType="decimal-pad" placeholderTextColor="#9ca3af" />
            </ScrollView>
            <View style={styles.sheetFooter}>
              <TouchableOpacity style={styles.cancelBtn2} onPress={() => setShowPricingModal(false)}><Text style={styles.cancelBtn2Text}>Cancel</Text></TouchableOpacity>
              <TouchableOpacity style={styles.saveBtn2} onPress={handleSavePricing}><CheckCircle size={16} color="#fff" /><Text style={styles.saveBtn2Text}>Save Pricing</Text></TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      <Modal visible={showPromotionModal} animationType="slide" transparent>
        <View style={styles.sheetOverlay}>
          <View style={styles.sheet}>
            <View style={styles.sheetHandle} />
            <View style={styles.sheetHeader}>
              <Text style={styles.sheetTitle}>{editingItem ? 'Edit Promotion' : 'New Promotion'}</Text>
              <TouchableOpacity style={styles.sheetClose} onPress={() => setShowPromotionModal(false)}><X size={20} color="#6b7280" /></TouchableOpacity>
            </View>
            <ScrollView style={styles.sheetBody} showsVerticalScrollIndicator={false}>
              <Text style={styles.inputLabel}>Promo Code</Text>
              <TextInput style={styles.input} placeholder="SAVE20" value={promoCode} onChangeText={setPromoCode} autoCapitalize="characters" placeholderTextColor="#9ca3af" />
              <Text style={styles.inputLabel}>Promotion Name</Text>
              <TextInput style={styles.input} placeholder="Summer Sale" value={promoName} onChangeText={setPromoName} placeholderTextColor="#9ca3af" />
              <Text style={styles.inputLabel}>Discount Type</Text>
              <View style={styles.discountTypeRow}>
                <TouchableOpacity style={[styles.typeChip, discountType === 'fixed' && styles.typeChipActive]} onPress={() => setDiscountType('fixed')}>
                  <Text style={[styles.typeChipText, discountType === 'fixed' && styles.typeChipTextActive]}>₦ Fixed</Text>
                </TouchableOpacity>
                <TouchableOpacity style={[styles.typeChip, discountType === 'percentage' && styles.typeChipActive]} onPress={() => setDiscountType('percentage')}>
                  <Text style={[styles.typeChipText, discountType === 'percentage' && styles.typeChipTextActive]}>% Percentage</Text>
                </TouchableOpacity>
              </View>
              <Text style={styles.inputLabel}>Discount Value</Text>
              <TextInput style={styles.input} placeholder={discountType === 'fixed' ? '500' : '10'} value={discountValue} onChangeText={setDiscountValue} keyboardType="decimal-pad" placeholderTextColor="#9ca3af" />
              <Text style={styles.inputLabel}>Min Order Amount (₦)</Text>
              <TextInput style={styles.input} placeholder="1000" value={minOrderAmount} onChangeText={setMinOrderAmount} keyboardType="decimal-pad" placeholderTextColor="#9ca3af" />
              <Text style={styles.inputLabel}>Usage Limit (optional)</Text>
              <TextInput style={styles.input} placeholder="100" value={usageLimit} onChangeText={setUsageLimit} keyboardType="number-pad" placeholderTextColor="#9ca3af" />
              <Text style={styles.inputLabel}>Valid From *</Text>
              <TextInput style={styles.input} placeholder="YYYY-MM-DD" value={validFrom} onChangeText={setValidFrom} placeholderTextColor="#9ca3af" />
              <Text style={styles.inputLabel}>Valid Until (optional)</Text>
              <TextInput style={styles.input} placeholder="YYYY-MM-DD (leave blank = no expiry)" value={validUntil} onChangeText={setValidUntil} placeholderTextColor="#9ca3af" />
            </ScrollView>
            <View style={styles.sheetFooter}>
              <TouchableOpacity style={styles.cancelBtn2} onPress={() => setShowPromotionModal(false)}><Text style={styles.cancelBtn2Text}>Cancel</Text></TouchableOpacity>
              <TouchableOpacity style={styles.saveBtn2} onPress={handleSavePromotion}><CheckCircle size={16} color="#fff" /><Text style={styles.saveBtn2Text}>Save Promo</Text></TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      <Modal visible={showBankModal} animationType="slide" transparent onRequestClose={() => setShowBankModal(false)}>
        <View style={styles.sheetOverlay}>
          <View style={styles.sheet}>
            <View style={styles.sheetHandle} />
            <View style={styles.sheetHeader}>
              <Text style={styles.sheetTitle}>{editingAccount ? 'Edit Bank Account' : 'Add Bank Account'}</Text>
              <TouchableOpacity style={styles.sheetClose} onPress={() => setShowBankModal(false)}><X size={20} color="#6b7280" /></TouchableOpacity>
            </View>
            <ScrollView style={styles.sheetBody} showsVerticalScrollIndicator={false}>
              <Text style={styles.inputLabel}>Bank Name *</Text>
              <TextInput style={styles.input} value={bankName} onChangeText={setBankName} placeholder="e.g., First Bank" placeholderTextColor="#9ca3af" />
              <Text style={styles.inputLabel}>Account Name *</Text>
              <TextInput style={styles.input} value={accountName} onChangeText={setAccountName} placeholder="e.g., QuickDeliver Inc." placeholderTextColor="#9ca3af" />
              <Text style={styles.inputLabel}>Account Number *</Text>
              <TextInput style={styles.input} value={accountNumber} onChangeText={setAccountNumber} placeholder="0123456789" keyboardType="numeric" placeholderTextColor="#9ca3af" />
              <Text style={styles.inputLabel}>Account Type</Text>
              <View style={styles.accountTypeGrid}>
                {['Checking', 'Savings', 'Business Checking', 'Business Savings'].map((type) => (
                  <TouchableOpacity key={type} style={[styles.typeChip, accountType === type && styles.typeChipActive]} onPress={() => setAccountType(type)}>
                    <Text style={[styles.typeChipText, accountType === type && styles.typeChipTextActive]}>{type}</Text>
                  </TouchableOpacity>
                ))}
              </View>
              <Text style={styles.inputLabel}>Branch (Optional)</Text>
              <TextInput style={styles.input} value={branch} onChangeText={setBranch} placeholder="e.g., Main Branch" placeholderTextColor="#9ca3af" />
              <Text style={styles.inputLabel}>SWIFT Code (Optional)</Text>
              <TextInput style={styles.input} value={swiftCode} onChangeText={setSwiftCode} placeholder="AAAA-BB-CC-123" autoCapitalize="characters" placeholderTextColor="#9ca3af" />
              <Text style={styles.inputLabel}>Guidelines (Optional)</Text>
              <TextInput style={[styles.input, styles.textArea]} value={bankGuidelines} onChangeText={setBankGuidelines} placeholder="Include order ID in transfer notes" multiline numberOfLines={3} placeholderTextColor="#9ca3af" />
              <Text style={styles.inputLabel}>Display Order</Text>
              <TextInput style={styles.input} value={displayOrder} onChangeText={setDisplayOrder} placeholder="1" keyboardType="numeric" placeholderTextColor="#9ca3af" />
              <TouchableOpacity style={styles.toggleRow} onPress={() => setBankIsActive(!bankIsActive)}>
                <View style={styles.toggleRowLeft}>
                  {bankIsActive ? <CheckCircle size={18} color="#10b981" /> : <XCircle size={18} color="#ef4444" />}
                  <Text style={styles.toggleRowLabel}>{bankIsActive ? 'Active' : 'Inactive'}</Text>
                </View>
                <Text style={styles.toggleRowHint}>{bankIsActive ? 'Visible to customers' : 'Hidden from customers'}</Text>
              </TouchableOpacity>
              <View style={{ height: 8 }} />
            </ScrollView>
            <View style={styles.sheetFooter}>
              <TouchableOpacity style={styles.cancelBtn2} onPress={() => setShowBankModal(false)}><Text style={styles.cancelBtn2Text}>Cancel</Text></TouchableOpacity>
              <TouchableOpacity style={styles.saveBtn2} onPress={handleSaveBank}><CheckCircle size={16} color="#fff" /><Text style={styles.saveBtn2Text}>Save</Text></TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      <Modal visible={showOrderTypeModal} animationType="slide" transparent onRequestClose={() => setShowOrderTypeModal(false)}>
        <View style={styles.sheetOverlay}>
          <View style={styles.sheet}>
            <View style={styles.sheetHandle} />
            <View style={styles.sheetHeader}>
              <Text style={styles.sheetTitle}>{editingOrderType ? 'Edit Order Type' : 'New Order Type'}</Text>
              <TouchableOpacity style={styles.sheetClose} onPress={() => setShowOrderTypeModal(false)}><X size={20} color="#6b7280" /></TouchableOpacity>
            </View>
            <ScrollView style={styles.sheetBody} showsVerticalScrollIndicator={false}>
              <Text style={styles.inputLabel}>Name *</Text>
              <TextInput style={styles.input} value={otName} onChangeText={setOtName} placeholder="e.g., Fragile Item, Oversized, Express" placeholderTextColor="#9ca3af" />
              <Text style={styles.inputLabel}>Description (Optional)</Text>
              <TextInput style={[styles.input, styles.textArea]} value={otDescription} onChangeText={setOtDescription} placeholder="Describe when this surcharge applies" placeholderTextColor="#9ca3af" multiline numberOfLines={3} />
              <Text style={styles.inputLabel}>Charge Type</Text>
              <View style={styles.discountTypeRow}>
                <TouchableOpacity style={[styles.typeChip, otType === 'flat' && styles.typeChipActive]} onPress={() => setOtType('flat')}>
                  <Text style={[styles.typeChipText, otType === 'flat' && styles.typeChipTextActive]}>₦ Flat Amount</Text>
                </TouchableOpacity>
                <TouchableOpacity style={[styles.typeChip, otType === 'percentage' && styles.typeChipActive]} onPress={() => setOtType('percentage')}>
                  <Text style={[styles.typeChipText, otType === 'percentage' && styles.typeChipTextActive]}>% Percentage</Text>
                </TouchableOpacity>
              </View>
              <Text style={styles.inputLabel}>{otType === 'flat' ? 'Amount (₦)' : 'Percentage (%)'}</Text>
              <TextInput style={styles.input} value={otValue} onChangeText={setOtValue} placeholder={otType === 'flat' ? 'e.g., 500' : 'e.g., 15'} keyboardType="decimal-pad" placeholderTextColor="#9ca3af" />
              <TouchableOpacity style={styles.toggleRow} onPress={() => setOtActive(!otActive)}>
                <View style={styles.toggleRowLeft}>
                  {otActive ? <CheckCircle size={18} color="#10b981" /> : <XCircle size={18} color="#ef4444" />}
                  <Text style={styles.toggleRowLabel}>{otActive ? 'Active' : 'Inactive'}</Text>
                </View>
                <Text style={styles.toggleRowHint}>{otActive ? 'Applied to matching orders' : 'Not applied to orders'}</Text>
              </TouchableOpacity>
              <View style={{ height: 8 }} />
            </ScrollView>
            <View style={styles.sheetFooter}>
              <TouchableOpacity style={styles.cancelBtn2} onPress={() => setShowOrderTypeModal(false)}><Text style={styles.cancelBtn2Text}>Cancel</Text></TouchableOpacity>
              <TouchableOpacity style={styles.saveBtn2} onPress={handleSaveOrderType}><CheckCircle size={16} color="#fff" /><Text style={styles.saveBtn2Text}>{editingOrderType ? 'Update' : 'Add Type'}</Text></TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      <Modal visible={areaModalVisible} animationType="slide" transparent onRequestClose={() => setAreaModalVisible(false)}>
        <View style={styles.sheetOverlay}>
          <View style={styles.sheet}>
            <View style={styles.sheetHandle} />
            <View style={styles.sheetHeader}>
              <Text style={styles.sheetTitle}>{selectedArea ? 'Edit Area' : 'New Area'}</Text>
              <TouchableOpacity style={styles.sheetClose} onPress={() => setAreaModalVisible(false)}><X size={20} color="#6b7280" /></TouchableOpacity>
            </View>
            <ScrollView style={styles.sheetBody} showsVerticalScrollIndicator={false}>
              <Text style={styles.inputLabel}>Area Name *</Text>
              <TextInput style={styles.input} value={areaName} onChangeText={setAreaName} placeholder="e.g., Downtown, North Side" placeholderTextColor="#9ca3af" />
              <Text style={styles.inputLabel}>Description</Text>
              <TextInput style={[styles.input, styles.textArea]} value={areaDescription} onChangeText={setAreaDescription} placeholder="Optional description of coverage area" placeholderTextColor="#9ca3af" multiline numberOfLines={3} />
              <View style={styles.switchRow}>
                <Text style={styles.inputLabel}>Active</Text>
                <TouchableOpacity style={[styles.switchControl, areaIsActive && styles.switchControlActive]} onPress={() => setAreaIsActive(!areaIsActive)}>
                  <View style={[styles.switchThumb, areaIsActive && styles.switchThumbActive]} />
                </TouchableOpacity>
              </View>
            </ScrollView>
            <View style={styles.sheetFooter}>
              <TouchableOpacity style={styles.cancelBtn2} onPress={() => setAreaModalVisible(false)}><Text style={styles.cancelBtn2Text}>Cancel</Text></TouchableOpacity>
              <TouchableOpacity style={styles.saveBtn2} onPress={handleSaveArea}><CheckCircle size={16} color="#fff" /><Text style={styles.saveBtn2Text}>{selectedArea ? 'Update' : 'Create'}</Text></TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      <Modal visible={riderAssignModalVisible} animationType="slide" transparent onRequestClose={() => setRiderAssignModalVisible(false)}>
        <View style={styles.sheetOverlay}>
          <View style={styles.sheet}>
            <View style={styles.sheetHandle} />
            <View style={styles.sheetHeader}>
              <Text style={styles.sheetTitle}>Assign Riders</Text>
              <TouchableOpacity style={styles.sheetClose} onPress={() => setRiderAssignModalVisible(false)}><X size={20} color="#6b7280" /></TouchableOpacity>
            </View>
            <ScrollView style={styles.sheetBody} showsVerticalScrollIndicator={false}>
              <View style={styles.assignHelpBox}>
                <Text style={styles.assignHelpText}>
                  Select riders to assign to <Text style={styles.assignHelpZone}>{selectedArea?.name}</Text>. Riders can only be in one zone at a time.
                </Text>
              </View>
              {riders.length === 0 ? (
                <View style={styles.emptyState}>
                  <View style={styles.emptyIconWrap}><Users size={32} color="#d1d5db" /></View>
                  <Text style={styles.emptyTitle}>No riders available</Text>
                </View>
              ) : riders.map((rider) => {
                const isSelected = assigningRiders.has(rider.id);
                return (
                  <TouchableOpacity
                    key={rider.id}
                    style={[styles.riderRow, isSelected && styles.riderRowSelected]}
                    onPress={() => setAssigningRiders(prev => { const s = new Set(prev); if (s.has(rider.id)) s.delete(rider.id); else s.add(rider.id); return s; })}
                    activeOpacity={0.8}>
                    <View style={styles.riderRowLeft}>
                      <View style={[styles.riderRowAvatar, isSelected && { backgroundColor: '#0ea5e9' }]}>
                        <Users size={14} color={isSelected ? '#fff' : '#6b7280'} />
                      </View>
                      <View>
                        <Text style={[styles.riderRowName, isSelected && { color: '#0c4a6e' }]}>{rider.profile.full_name}</Text>
                        {rider.zone_id && rider.zone_id !== selectedArea?.id && (
                          <Text style={styles.riderRowZone}>Currently: {areas.find(z => z.id === rider.zone_id)?.name || 'Unknown'}</Text>
                        )}
                      </View>
                    </View>
                    <View style={[styles.checkBox, isSelected && styles.checkBoxActive]}>
                      {isSelected && <CheckCircle size={14} color="#fff" />}
                    </View>
                  </TouchableOpacity>
                );
              })}
              <View style={{ height: 8 }} />
            </ScrollView>
            <View style={styles.sheetFooter}>
              <TouchableOpacity style={styles.cancelBtn2} onPress={() => setRiderAssignModalVisible(false)}><Text style={styles.cancelBtn2Text}>Cancel</Text></TouchableOpacity>
              <TouchableOpacity style={styles.saveBtn2} onPress={handleSaveRiderAssignments}><CheckCircle size={16} color="#fff" /><Text style={styles.saveBtn2Text}>Save Assignments</Text></TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      <Toast visible={toast.visible} message={toast.message} type={toast.type} duration={3000} onDismiss={() => setToast({ ...toast, visible: false })} />
      <ConfirmDialog visible={confirmDialog.visible} title={confirmDialog.title} message={confirmDialog.message} onConfirm={confirmDialog.onConfirm} onCancel={() => setConfirmDialog({ ...confirmDialog, visible: false })} />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f1f5f9' },

  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 16,
    backgroundColor: '#1a1a2e',
  },
  headerLeft: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  headerIconWrap: {
    width: 44, height: 44, borderRadius: 14,
    backgroundColor: 'rgba(249,115,22,0.15)',
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 1, borderColor: 'rgba(249,115,22,0.25)',
  },
  headerTitle: { fontSize: 22, fontFamily: Fonts.bold, color: '#ffffff', letterSpacing: 0.1 },
  headerSubtitle: { fontSize: 12, fontFamily: Fonts.regular, color: 'rgba(255,255,255,0.45)', marginTop: 2 },

  tabBar: {
    backgroundColor: '#ffffff',
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
  },
  tabBarContent: { flexDirection: 'row', paddingHorizontal: 8 },
  tab: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 14,
    paddingHorizontal: 14,
    borderBottomWidth: 2.5,
    borderBottomColor: 'transparent',
  },
  tabActive: { borderBottomColor: '#f97316' },
  tabText: { fontSize: 13, fontFamily: Fonts.semiBold, color: '#9ca3af' },
  tabTextActive: { fontFamily: Fonts.bold, color: '#f97316' },

  content: { flex: 1 },

  section: { padding: 16 },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
    marginBottom: 16,
  },
  sectionTitle: { fontSize: 20, fontFamily: Fonts.bold, color: '#111827' },
  sectionSubtitle: { fontSize: 12, fontFamily: Fonts.regular, color: '#9ca3af', marginTop: 2 },
  addBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#f97316',
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderRadius: 10,
  },
  addBtnText: { fontSize: 13, fontFamily: Fonts.bold, color: '#ffffff' },

  emptyState: { alignItems: 'center', paddingVertical: 56, gap: 10 },
  emptyIconWrap: {
    width: 72, height: 72, borderRadius: 20,
    backgroundColor: '#f3f4f6', alignItems: 'center', justifyContent: 'center', marginBottom: 4,
  },
  emptyTitle: { fontSize: 17, fontFamily: Fonts.bold, color: '#374151' },
  emptySubtitle: { fontSize: 13, fontFamily: Fonts.regular, color: '#9ca3af', textAlign: 'center', maxWidth: 260 },

  dataCard: {
    backgroundColor: '#ffffff',
    borderRadius: 16,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
    overflow: 'hidden',
  },
  dataCardInactive: { opacity: 0.55 },
  dataCardTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 14,
    paddingBottom: 10,
  },
  dataCardTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 10, flex: 1 },
  dataCardIconWrap: {
    width: 36, height: 36, borderRadius: 10,
    alignItems: 'center', justifyContent: 'center',
  },
  dataCardTitleBlock: { flex: 1 },
  dataCardTitle: { fontSize: 15, fontFamily: Fonts.bold, color: '#111827' },
  dataCardMeta: { fontSize: 12, fontFamily: Fonts.regular, color: '#6b7280', marginTop: 2 },
  dataCardActions: { flexDirection: 'row', gap: 6 },
  dataCardDate: { fontSize: 11, fontFamily: Fonts.regular, color: '#9ca3af', paddingHorizontal: 14, paddingBottom: 12 },
  dataCardBody: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 14,
    paddingBottom: 12,
    flexWrap: 'wrap',
  },

  iconBtn: {
    width: 32, height: 32, borderRadius: 8,
    backgroundColor: '#f3f4f6', alignItems: 'center', justifyContent: 'center',
  },
  iconBtnBlue: { backgroundColor: '#eff6ff' },
  iconBtnRed: { backgroundColor: '#fff1f2' },

  pricingChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#fff7ed',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#fed7aa',
  },
  pricingChipText: { fontSize: 14, fontFamily: Fonts.bold, color: '#f97316' },

  statusChip: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
  },
  statusChipActive: { backgroundColor: '#d1fae5' },
  statusChipInactive: { backgroundColor: '#f3f4f6' },
  statusChipText: { fontSize: 11, fontFamily: Fonts.bold },
  statusChipTextActive: { color: '#065f46' },
  statusChipTextInactive: { color: '#6b7280' },

  pricingGrid: {
    flexDirection: 'row',
    paddingHorizontal: 14,
    paddingBottom: 12,
    borderTopWidth: 1,
    borderTopColor: '#f3f4f6',
    paddingTop: 10,
  },
  pricingGridItem: { flex: 1, alignItems: 'center' },
  pricingGridLabel: { fontSize: 10, fontFamily: Fonts.semiBold, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 4 },
  pricingGridValue: { fontSize: 14, fontFamily: Fonts.bold, color: '#111827' },
  expressChip: {
    flexDirection: 'row', alignItems: 'center', gap: 3,
    backgroundColor: '#fef3c7', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6,
  },
  expressChipText: { fontSize: 13, fontFamily: Fonts.bold, color: '#d97706' },

  promoCodeBadge: {
    alignSelf: 'flex-start',
    backgroundColor: '#fef3c7',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
    marginTop: 4,
  },
  promoCodeText: { fontSize: 11, fontFamily: Fonts.bold, color: '#b45309', letterSpacing: 1 },
  promoStats: {
    flexDirection: 'row',
    alignItems: 'center',
    borderTopWidth: 1,
    borderTopColor: '#f3f4f6',
    paddingTop: 12,
    paddingHorizontal: 14,
    paddingBottom: 8,
  },
  promoStatItem: { flex: 1, alignItems: 'center' },
  promoStatLabel: { fontSize: 10, fontFamily: Fonts.semiBold, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 3 },
  promoStatValue: { fontSize: 15, fontFamily: Fonts.bold, color: '#111827' },
  promoStatDivider: { width: 1, height: 32, backgroundColor: '#f3f4f6' },
  promoFooter: { paddingHorizontal: 14, paddingBottom: 12 },

  bankCard: {
    backgroundColor: '#ffffff',
    borderRadius: 16,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
    overflow: 'hidden',
  },
  bankCardTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    padding: 14,
    paddingBottom: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#f3f4f6',
  },
  bankCardLeft: { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  bankIconWrap: {
    width: 40, height: 40, borderRadius: 12,
    backgroundColor: '#f0f9ff', alignItems: 'center', justifyContent: 'center',
  },
  bankCardName: { fontSize: 16, fontFamily: Fonts.bold, color: '#111827' },
  bankDetailsGrid: { padding: 14, gap: 8 },
  bankDetailRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  bankDetailLabel: { fontSize: 12, fontFamily: Fonts.medium, color: '#9ca3af' },
  bankDetailValue: { fontSize: 13, fontFamily: Fonts.semiBold, color: '#111827' },
  bankDetailValueMono: { fontSize: 13, fontFamily: Fonts.bold, color: '#0ea5e9', letterSpacing: 0.5 },
  guidelinesBox: {
    marginHorizontal: 14,
    marginBottom: 14,
    backgroundColor: '#fffbeb',
    borderRadius: 10,
    padding: 12,
    borderLeftWidth: 3,
    borderLeftColor: '#f59e0b',
  },
  guidelinesLabel: { fontSize: 11, fontFamily: Fonts.bold, color: '#92400e', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 4 },
  guidelinesText: { fontSize: 12, fontFamily: Fonts.regular, color: '#78350f', lineHeight: 16 },

  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#ffffff',
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    marginBottom: 16,
  },
  searchInput: { flex: 1, fontSize: 14, fontFamily: Fonts.regular, color: '#111827', padding: 0, outlineStyle: 'none' } as any,

  areaNameRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  inactivePill: { backgroundColor: '#fee2e2', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8 },
  inactivePillText: { fontSize: 11, fontFamily: Fonts.bold, color: '#991b1b' },
  areaFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 14,
    paddingBottom: 12,
    paddingTop: 4,
    borderTopWidth: 1,
    borderTopColor: '#f3f4f6',
  },
  riderCountBadge: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  riderCountText: { fontSize: 13, fontFamily: Fonts.semiBold, color: '#6b7280' },
  assignBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: '#f0f9ff', paddingHorizontal: 12, paddingVertical: 7,
    borderRadius: 8, borderWidth: 1, borderColor: '#bae6fd',
  },
  assignBtnText: { fontSize: 13, fontFamily: Fonts.bold, color: '#0ea5e9' },

  sheetOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  sheet: {
    backgroundColor: '#ffffff',
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    maxHeight: '92%',
  },
  sheetHandle: { width: 36, height: 4, backgroundColor: '#e5e7eb', borderRadius: 2, alignSelf: 'center', marginTop: 12, marginBottom: 4 },
  sheetHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 24,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#f3f4f6',
  },
  sheetTitle: { fontSize: 20, fontFamily: Fonts.bold, color: '#111827' },
  sheetClose: {
    width: 36, height: 36, borderRadius: 10,
    backgroundColor: '#f3f4f6', alignItems: 'center', justifyContent: 'center',
  },
  sheetBody: { paddingHorizontal: 24, paddingTop: 20 },
  sheetFooter: {
    flexDirection: 'row',
    paddingHorizontal: 24,
    paddingVertical: 16,
    gap: 12,
    borderTopWidth: 1,
    borderTopColor: '#f3f4f6',
  },

  inputLabel: { fontSize: 13, fontFamily: Fonts.bold, color: '#374151', marginBottom: 6, textTransform: 'uppercase', letterSpacing: 0.5 },
  input: {
    backgroundColor: '#f9fafb',
    borderWidth: 1.5,
    borderColor: '#e5e7eb',
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
    fontFamily: Fonts.regular,
    color: '#111827',
    marginBottom: 16,
  },
  textArea: { minHeight: 80, textAlignVertical: 'top' },
  inputRow: { flexDirection: 'row', gap: 12 },

  discountTypeRow: { flexDirection: 'row', gap: 10, marginBottom: 16 },
  typeChip: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 10,
    borderWidth: 1.5,
    borderColor: '#e5e7eb',
    alignItems: 'center',
    backgroundColor: '#f9fafb',
  },
  typeChipActive: { borderColor: '#f97316', backgroundColor: '#fff7ed' },
  typeChipText: { fontSize: 13, fontFamily: Fonts.semiBold, color: '#6b7280' },
  typeChipTextActive: { color: '#f97316' },

  accountTypeGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 16 },

  toggleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 14,
    backgroundColor: '#f9fafb',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    marginBottom: 16,
  },
  toggleRowLeft: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  toggleRowLabel: { fontSize: 15, fontFamily: Fonts.semiBold, color: '#111827' },
  toggleRowHint: { fontSize: 12, fontFamily: Fonts.regular, color: '#9ca3af' },

  cancelBtn2: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 14,
    backgroundColor: '#f3f4f6',
    alignItems: 'center',
  },
  cancelBtn2Text: { fontSize: 15, fontFamily: Fonts.semiBold, color: '#374151' },
  saveBtn2: {
    flex: 2,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 14,
    borderRadius: 14,
    backgroundColor: '#f97316',
  },
  saveBtn2Text: { fontSize: 15, fontFamily: Fonts.bold, color: '#ffffff' },

  switchRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 },
  switchControl: { width: 50, height: 30, borderRadius: 15, backgroundColor: '#e5e7eb', padding: 2, justifyContent: 'center' },
  switchControlActive: { backgroundColor: '#f97316' },
  switchThumb: { width: 26, height: 26, borderRadius: 13, backgroundColor: '#ffffff', shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.15, shadowRadius: 2, elevation: 2 },
  switchThumbActive: { transform: [{ translateX: 20 }] },

  assignHelpBox: {
    backgroundColor: '#f0f9ff',
    borderRadius: 12,
    padding: 12,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#bae6fd',
  },
  assignHelpText: { fontSize: 13, fontFamily: Fonts.regular, color: '#0c4a6e', lineHeight: 18 },
  assignHelpZone: { fontFamily: Fonts.bold, color: '#0369a1' },

  riderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 14,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: '#e5e7eb',
    backgroundColor: '#ffffff',
    marginBottom: 10,
  },
  riderRowSelected: { borderColor: '#0ea5e9', backgroundColor: '#f0f9ff' },
  riderRowLeft: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  riderRowAvatar: {
    width: 36, height: 36, borderRadius: 10,
    backgroundColor: '#f3f4f6', alignItems: 'center', justifyContent: 'center',
  },
  riderRowName: { fontSize: 14, fontFamily: Fonts.semiBold, color: '#111827' },
  riderRowZone: { fontSize: 12, fontFamily: Fonts.regular, color: '#6b7280', marginTop: 2 },
  checkBox: {
    width: 26, height: 26, borderRadius: 8,
    borderWidth: 2, borderColor: '#d1d5db',
    backgroundColor: '#ffffff', alignItems: 'center', justifyContent: 'center',
  },
  checkBoxActive: { borderColor: '#0ea5e9', backgroundColor: '#0ea5e9' },

  orderTypeInfoBox: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    backgroundColor: '#f0f9ff',
    borderRadius: 12,
    padding: 13,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#bae6fd',
  },
  orderTypeInfoText: { flex: 1, fontSize: 13, fontFamily: Fonts.regular, color: '#0c4a6e', lineHeight: 18 },
  orderTypeCardBody: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 14,
    paddingBottom: 12,
    borderTopWidth: 1,
    borderTopColor: '#f3f4f6',
    paddingTop: 10,
  },
  orderTypeCharge: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#faf5ff',
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#e9d5ff',
  },
  orderTypeChargeLabel: { fontSize: 11, fontFamily: Fonts.semiBold, color: '#7c3aed', textTransform: 'uppercase', letterSpacing: 0.4 },
  orderTypeChargeValue: { fontSize: 16, fontFamily: Fonts.bold, color: '#5b21b6' },
});
