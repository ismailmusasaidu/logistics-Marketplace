import { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, TextInput, Modal, Alert, Platform, RefreshControl } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/lib/supabase';
import { DollarSign, Plus, Edit2, Trash2, X, CheckCircle, XCircle, Building2, MapPin, Users, Search } from 'lucide-react-native';
import { StatusBar } from 'expo-status-bar';
import { getUserFriendlyError } from '@/lib/errorHandler';
import { Toast } from '@/components/Toast';
import { ConfirmDialog } from '@/components/ConfirmDialog';

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
  profile: {
    full_name: string;
  };
}

export default function AdminPricing() {
  const { profile } = useAuth();
  const [activeTab, setActiveTab] = useState<'zones' | 'pricing' | 'promotions' | 'banks' | 'areas'>('zones');
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

  const [toast, setToast] = useState<{
    visible: boolean;
    message: string;
    type: 'success' | 'error' | 'info' | 'warning';
  }>({ visible: false, message: '', type: 'success' });

  const [confirmDialog, setConfirmDialog] = useState<{
    visible: boolean;
    title: string;
    message: string;
    onConfirm: () => void;
  }>({ visible: false, title: '', message: '', onConfirm: () => {} });

  const showToast = (message: string, type: 'success' | 'error' | 'info' | 'warning' = 'success') => {
    setToast({ visible: true, message, type });
  };

  useEffect(() => {
    if (profile?.role === 'admin') {
      loadAllData();
    }
  }, [profile]);

  const loadAllData = async () => {
    await Promise.all([
      loadDeliveryZones(),
      loadPricing(),
      loadPromotions(),
      loadBankAccounts(),
      loadAreas(),
      loadRiders(),
    ]);
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await loadAllData();
    setRefreshing(false);
  };

  const loadDeliveryZones = async () => {
    const { data, error } = await supabase
      .from('delivery_zones')
      .select('*')
      .order('min_distance_km');
    if (!error && data) setDeliveryZones(data);
  };

  const loadPricing = async () => {
    const { data, error } = await supabase
      .from('delivery_pricing')
      .select('*')
      .order('min_weight_kg');
    if (!error && data) setPricing(data);
  };

  const loadPromotions = async () => {
    const { data, error } = await supabase
      .from('promotions')
      .select('*')
      .order('created_at', { ascending: false });
    if (!error && data) setPromotions(data);
  };

  const loadBankAccounts = async () => {
    const { data, error } = await supabase
      .from('bank_accounts')
      .select('*')
      .order('display_order');
    if (!error && data) setBankAccounts(data);
  };

  const loadAreas = async () => {
    try {
      const { data, error } = await supabase
        .from('zones')
        .select('*')
        .order('created_at', { ascending: false });
      if (error) throw error;
      setAreas(data || []);
    } catch (error) {
      console.error('Error loading areas:', error);
    }
  };

  const loadRiders = async () => {
    try {
      const { data, error } = await supabase
        .from('riders')
        .select(`id, zone_id, profile:profiles!riders_user_id_fkey(full_name)`);
      if (error) throw error;
      setRiders(data as any || []);
    } catch (error) {
      console.error('Error loading riders:', error);
    }
  };

  const handleSaveZone = async () => {
    if (!zoneName || !minDistance || !maxDistance || !zonePrice) {
      if (Platform.OS === 'web') alert('Please fill in all fields');
      return;
    }
    const zoneData = {
      name: zoneName,
      min_distance_km: parseFloat(minDistance),
      max_distance_km: parseFloat(maxDistance),
      price: parseFloat(zonePrice),
      is_active: true,
    };
    if (editingItem) {
      const { error } = await supabase.from('delivery_zones').update(zoneData).eq('id', editingItem.id);
      if (error) { console.error('Error updating zone:', error); return; }
    } else {
      const { error } = await supabase.from('delivery_zones').insert(zoneData);
      if (error) { console.error('Error creating zone:', error); return; }
    }
    setShowZoneModal(false);
    resetZoneForm();
    loadDeliveryZones();
  };

  const handleSavePricing = async () => {
    if (!pricingZoneId || !minWeight || !maxWeight || !basePrice || !pricePerKg || !expressMultiplier) {
      if (Platform.OS === 'web') alert('Please fill in all fields');
      return;
    }
    const pricingData = {
      zone_id: pricingZoneId,
      min_weight_kg: parseFloat(minWeight),
      max_weight_kg: parseFloat(maxWeight),
      base_price: parseFloat(basePrice),
      price_per_kg: parseFloat(pricePerKg),
      express_multiplier: parseFloat(expressMultiplier),
    };
    if (editingItem) {
      const { error } = await supabase.from('delivery_pricing').update(pricingData).eq('id', editingItem.id);
      if (error) { console.error('Error updating pricing:', error); return; }
    } else {
      const { error } = await supabase.from('delivery_pricing').insert(pricingData);
      if (error) { console.error('Error creating pricing:', error); return; }
    }
    setShowPricingModal(false);
    resetPricingForm();
    loadPricing();
  };

  const handleSavePromotion = async () => {
    if (!promoCode || !promoName || !discountValue) {
      if (Platform.OS === 'web') alert('Please fill in required fields');
      return;
    }
    const promoData = {
      code: promoCode.toUpperCase(),
      name: promoName,
      discount_type: discountType,
      discount_value: parseFloat(discountValue),
      min_order_amount: minOrderAmount ? parseFloat(minOrderAmount) : 0,
      usage_limit: usageLimit ? parseInt(usageLimit) : null,
      is_active: true,
    };
    if (editingItem) {
      const { error } = await supabase.from('promotions').update(promoData).eq('id', editingItem.id);
      if (error) { console.error('Error updating promotion:', error); return; }
    } else {
      const { error } = await supabase.from('promotions').insert(promoData);
      if (error) { console.error('Error creating promotion:', error); return; }
    }
    setShowPromotionModal(false);
    resetPromotionForm();
    loadPromotions();
  };

  const handleSaveBank = async () => {
    if (!bankName || !accountName || !accountNumber) {
      if (Platform.OS === 'web') alert('Please fill in all required fields');
      else Alert.alert('Error', 'Please fill in all required fields');
      return;
    }
    try {
      const accountData = {
        bank_name: bankName,
        account_name: accountName,
        account_number: accountNumber,
        account_type: accountType,
        swift_code: swiftCode || null,
        branch: branch || null,
        guidelines: bankGuidelines || null,
        is_active: bankIsActive,
        display_order: parseInt(displayOrder) || 1,
      };
      if (editingAccount) {
        const { error } = await supabase.from('bank_accounts').update(accountData).eq('id', editingAccount.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from('bank_accounts').insert([accountData]);
        if (error) throw error;
      }
      setShowBankModal(false);
      loadBankAccounts();
    } catch (error: any) {
      const friendlyError = getUserFriendlyError(error);
      if (Platform.OS === 'web') alert(friendlyError);
      else Alert.alert('Error', friendlyError);
    }
  };

  const handleDeleteBank = async (accountId: string) => {
    const confirmDelete = Platform.OS === 'web'
      ? confirm('Are you sure you want to delete this bank account?')
      : await new Promise(resolve => {
          Alert.alert('Confirm Delete', 'Are you sure you want to delete this bank account?', [
            { text: 'Cancel', onPress: () => resolve(false), style: 'cancel' },
            { text: 'Delete', onPress: () => resolve(true), style: 'destructive' },
          ]);
        });
    if (!confirmDelete) return;
    try {
      const { error } = await supabase.from('bank_accounts').delete().eq('id', accountId);
      if (error) throw error;
      loadBankAccounts();
    } catch (error: any) {
      const friendlyError = getUserFriendlyError(error);
      if (Platform.OS === 'web') alert(friendlyError);
      else Alert.alert('Error', friendlyError);
    }
  };

  const handleSaveArea = async () => {
    if (!areaName.trim()) { showToast('Zone name is required', 'error'); return; }
    try {
      if (selectedArea) {
        const { error } = await supabase.from('zones').update({
          name: areaName.trim(),
          description: areaDescription.trim() || null,
          is_active: areaIsActive,
        }).eq('id', selectedArea.id);
        if (error) throw error;
        showToast('Zone updated successfully', 'success');
      } else {
        const { error } = await supabase.from('zones').insert({
          name: areaName.trim(),
          description: areaDescription.trim() || null,
          is_active: areaIsActive,
        });
        if (error) throw error;
        showToast('Zone created successfully', 'success');
      }
      setAreaModalVisible(false);
      loadAreas();
    } catch (error: any) {
      showToast(error.message || 'Failed to save zone', 'error');
    }
  };

  const handleDeleteArea = (area: Zone) => {
    const ridersInZone = riders.filter(r => r.zone_id === area.id);
    setConfirmDialog({
      visible: true,
      title: 'Delete Zone',
      message: ridersInZone.length > 0
        ? `This zone has ${ridersInZone.length} rider(s) assigned. They will be unassigned. Are you sure?`
        : 'Are you sure you want to delete this zone? This action cannot be undone.',
      onConfirm: async () => {
        try {
          const { error } = await supabase.from('zones').delete().eq('id', area.id);
          if (error) throw error;
          showToast('Zone deleted successfully', 'success');
          loadAreas();
          loadRiders();
        } catch (error: any) {
          showToast(error.message || 'Failed to delete zone', 'error');
        }
      },
    });
  };

  const handleSaveRiderAssignments = async () => {
    if (!selectedArea) return;
    try {
      const updates = riders.map(rider => {
        const shouldBeInZone = assigningRiders.has(rider.id);
        const isCurrentlyInZone = rider.zone_id === selectedArea.id;
        if (shouldBeInZone && !isCurrentlyInZone) {
          return supabase.from('riders').update({ zone_id: selectedArea.id }).eq('id', rider.id);
        } else if (!shouldBeInZone && isCurrentlyInZone) {
          return supabase.from('riders').update({ zone_id: null }).eq('id', rider.id);
        }
        return null;
      }).filter(Boolean);
      await Promise.all(updates);
      showToast('Rider assignments updated successfully', 'success');
      setRiderAssignModalVisible(false);
      loadRiders();
    } catch (error: any) {
      showToast(error.message || 'Failed to update assignments', 'error');
    }
  };

  const handleToggleZone = async (zone: DeliveryZone) => {
    const { error } = await supabase.from('delivery_zones').update({ is_active: !zone.is_active }).eq('id', zone.id);
    if (!error) loadDeliveryZones();
  };

  const handleTogglePromotion = async (promotion: Promotion) => {
    const { error } = await supabase.from('promotions').update({ is_active: !promotion.is_active }).eq('id', promotion.id);
    if (!error) loadPromotions();
  };

  const handleDeleteDeliveryZone = async (zoneId: string) => {
    const { error } = await supabase.from('delivery_zones').delete().eq('id', zoneId);
    if (!error) loadDeliveryZones();
  };

  const handleDeletePricing = async (pricingId: string) => {
    const { error } = await supabase.from('delivery_pricing').delete().eq('id', pricingId);
    if (!error) loadPricing();
  };

  const handleDeletePromotion = async (promotionId: string) => {
    const { error } = await supabase.from('promotions').delete().eq('id', promotionId);
    if (!error) loadPromotions();
  };

  const openEditDeliveryZone = (zone: DeliveryZone) => {
    setEditingItem(zone);
    setZoneName(zone.name);
    setMinDistance(zone.min_distance_km.toString());
    setMaxDistance(zone.max_distance_km.toString());
    setZonePrice(zone.price.toString());
    setShowZoneModal(true);
  };

  const openEditPricing = (item: DeliveryPricing) => {
    setEditingItem(item);
    setPricingZoneId(item.zone_id);
    setMinWeight(item.min_weight_kg.toString());
    setMaxWeight(item.max_weight_kg.toString());
    setBasePrice(item.base_price.toString());
    setPricePerKg(item.price_per_kg.toString());
    setExpressMultiplier(item.express_multiplier.toString());
    setShowPricingModal(true);
  };

  const openEditPromotion = (promotion: Promotion) => {
    setEditingItem(promotion);
    setPromoCode(promotion.code);
    setPromoName(promotion.name);
    setDiscountType(promotion.discount_type);
    setDiscountValue(promotion.discount_value.toString());
    setMinOrderAmount(promotion.min_order_amount.toString());
    setUsageLimit(promotion.usage_limit?.toString() || '');
    setShowPromotionModal(true);
  };

  const openAddBankModal = () => {
    setEditingAccount(null);
    setBankName(''); setAccountName(''); setAccountNumber('');
    setAccountType('Checking'); setSwiftCode(''); setBranch('');
    setBankGuidelines(''); setBankIsActive(true); setDisplayOrder('1');
    setShowBankModal(true);
  };

  const openEditBankModal = (account: BankAccount) => {
    setEditingAccount(account);
    setBankName(account.bank_name);
    setAccountName(account.account_name);
    setAccountNumber(account.account_number);
    setAccountType(account.account_type);
    setSwiftCode(account.swift_code || '');
    setBranch(account.branch || '');
    setBankGuidelines(account.guidelines || '');
    setBankIsActive(account.is_active);
    setDisplayOrder(account.display_order.toString());
    setShowBankModal(true);
  };

  const toggleBankStatus = async (account: BankAccount) => {
    try {
      const { error } = await supabase.from('bank_accounts').update({ is_active: !account.is_active }).eq('id', account.id);
      if (error) throw error;
      loadBankAccounts();
    } catch (error: any) {
      console.error('Error updating status:', error);
    }
  };

  const resetZoneForm = () => {
    setEditingItem(null); setZoneName(''); setMinDistance(''); setMaxDistance(''); setZonePrice('');
  };

  const resetPricingForm = () => {
    setEditingItem(null); setPricingZoneId(''); setMinWeight(''); setMaxWeight('');
    setBasePrice(''); setPricePerKg(''); setExpressMultiplier('');
  };

  const resetPromotionForm = () => {
    setEditingItem(null); setPromoCode(''); setPromoName('');
    setDiscountType('fixed'); setDiscountValue(''); setMinOrderAmount(''); setUsageLimit('');
  };

  const getDeliveryZoneNameById = (zoneId: string) => {
    const zone = deliveryZones.find((z) => z.id === zoneId);
    return zone ? zone.name : zoneId;
  };

  const getRidersCount = (zoneId: string) => riders.filter(r => r.zone_id === zoneId).length;

  const filteredAreas = areas.filter(area => {
    if (!searchQuery.trim()) return true;
    const query = searchQuery.toLowerCase();
    return area.name.toLowerCase().includes(query) || (area.description?.toLowerCase().includes(query) ?? false);
  });

  const renderDeliveryZones = () => (
    <View style={styles.section}>
      <View style={styles.sectionHeader}>
        <Text style={styles.sectionTitle}>Delivery Zones</Text>
        <TouchableOpacity style={styles.addButton} onPress={() => { resetZoneForm(); setShowZoneModal(true); }}>
          <Plus size={20} color="#ffffff" />
          <Text style={styles.addButtonText}>Add Zone</Text>
        </TouchableOpacity>
      </View>
      {deliveryZones.map((zone) => (
        <View key={zone.id} style={[styles.card, !zone.is_active && styles.cardInactive]}>
          <View style={styles.cardHeader}>
            <Text style={styles.cardTitle}>{zone.name}</Text>
            <View style={styles.cardActions}>
              <TouchableOpacity onPress={() => handleToggleZone(zone)} style={styles.iconButton}>
                {zone.is_active ? <CheckCircle size={20} color="#f97316" /> : <XCircle size={20} color="#ef4444" />}
              </TouchableOpacity>
              <TouchableOpacity onPress={() => openEditDeliveryZone(zone)} style={styles.iconButton}>
                <Edit2 size={20} color="#3b82f6" />
              </TouchableOpacity>
              <TouchableOpacity onPress={() => handleDeleteDeliveryZone(zone.id)} style={styles.iconButton}>
                <Trash2 size={20} color="#ef4444" />
              </TouchableOpacity>
            </View>
          </View>
          <View style={styles.cardContent}>
            <Text style={styles.cardText}>Distance: {zone.min_distance_km} - {zone.max_distance_km} km</Text>
            <Text style={styles.cardPrice}>{zone.price.toLocaleString()}</Text>
            <Text style={styles.cardDate}>Updated: {new Date(zone.updated_at).toLocaleDateString()}</Text>
          </View>
        </View>
      ))}
    </View>
  );

  const renderPricing = () => (
    <View style={styles.section}>
      <View style={styles.sectionHeader}>
        <Text style={styles.sectionTitle}>Delivery Pricing</Text>
        <TouchableOpacity style={styles.addButton} onPress={() => { resetPricingForm(); setShowPricingModal(true); }}>
          <Plus size={20} color="#ffffff" />
          <Text style={styles.addButtonText}>Add Pricing</Text>
        </TouchableOpacity>
      </View>
      {pricing.map((item) => (
        <View key={item.id} style={styles.card}>
          <View style={styles.cardHeader}>
            <Text style={styles.cardTitle}>{getDeliveryZoneNameById(item.zone_id)}</Text>
            <View style={styles.cardActions}>
              <TouchableOpacity onPress={() => openEditPricing(item)} style={styles.iconButton}>
                <Edit2 size={20} color="#3b82f6" />
              </TouchableOpacity>
              <TouchableOpacity onPress={() => handleDeletePricing(item.id)} style={styles.iconButton}>
                <Trash2 size={20} color="#ef4444" />
              </TouchableOpacity>
            </View>
          </View>
          <View style={styles.cardContent}>
            <Text style={styles.cardText}>Weight: {item.min_weight_kg} - {item.max_weight_kg} kg</Text>
            <Text style={styles.cardText}>Base Price: {item.base_price.toLocaleString()}</Text>
            <Text style={styles.cardText}>Per kg: {item.price_per_kg.toLocaleString()}</Text>
            <Text style={styles.cardText}>Express Multiplier: {item.express_multiplier}x</Text>
            <Text style={styles.cardDate}>Updated: {new Date(item.updated_at).toLocaleDateString()}</Text>
          </View>
        </View>
      ))}
    </View>
  );

  const renderPromotions = () => (
    <View style={styles.section}>
      <View style={styles.sectionHeader}>
        <Text style={styles.sectionTitle}>Promotions & Discounts</Text>
        <TouchableOpacity style={styles.addButton} onPress={() => { resetPromotionForm(); setShowPromotionModal(true); }}>
          <Plus size={20} color="#ffffff" />
          <Text style={styles.addButtonText}>Add Promotion</Text>
        </TouchableOpacity>
      </View>
      {promotions.map((promotion) => (
        <View key={promotion.id} style={[styles.card, !promotion.is_active && styles.cardInactive]}>
          <View style={styles.cardHeader}>
            <View>
              <Text style={styles.cardTitle}>{promotion.name}</Text>
              <Text style={styles.promoCode}>{promotion.code}</Text>
            </View>
            <View style={styles.cardActions}>
              <TouchableOpacity onPress={() => handleTogglePromotion(promotion)} style={styles.iconButton}>
                {promotion.is_active ? <CheckCircle size={20} color="#f97316" /> : <XCircle size={20} color="#ef4444" />}
              </TouchableOpacity>
              <TouchableOpacity onPress={() => openEditPromotion(promotion)} style={styles.iconButton}>
                <Edit2 size={20} color="#3b82f6" />
              </TouchableOpacity>
              <TouchableOpacity onPress={() => handleDeletePromotion(promotion.id)} style={styles.iconButton}>
                <Trash2 size={20} color="#ef4444" />
              </TouchableOpacity>
            </View>
          </View>
          <View style={styles.cardContent}>
            <Text style={styles.cardText}>
              {promotion.discount_type === 'fixed' ? `${promotion.discount_value.toLocaleString()} off` : `${promotion.discount_value}% off`}
            </Text>
            <Text style={styles.cardText}>Min Order: {promotion.min_order_amount.toLocaleString()}</Text>
            <Text style={styles.cardText}>Usage: {promotion.usage_count} / {promotion.usage_limit || '\u221E'}</Text>
          </View>
        </View>
      ))}
    </View>
  );

  const renderBanks = () => (
    <View style={styles.section}>
      <View style={styles.sectionHeader}>
        <Text style={styles.sectionTitle}>Bank Accounts</Text>
        <TouchableOpacity style={styles.addButton} onPress={openAddBankModal}>
          <Plus size={20} color="#ffffff" />
          <Text style={styles.addButtonText}>Add Bank</Text>
        </TouchableOpacity>
      </View>
      {bankAccounts.length === 0 ? (
        <View style={styles.emptyState}>
          <Building2 size={48} color="#d1d5db" />
          <Text style={styles.emptyText}>No bank accounts yet</Text>
          <Text style={styles.emptySubtext}>Add a bank account to start accepting transfers</Text>
        </View>
      ) : bankAccounts.map((account) => (
        <View key={account.id} style={styles.bankCard}>
          <View style={styles.bankCardHeader}>
            <View style={styles.bankHeaderLeft}>
              <Building2 size={20} color="#8b5cf6" />
              <Text style={styles.bankName}>{account.bank_name}</Text>
              <TouchableOpacity
                style={[styles.statusBadge, account.is_active ? styles.statusActive : styles.statusInactive]}
                onPress={() => toggleBankStatus(account)}>
                <Text style={[styles.statusText, account.is_active ? styles.statusTextActive : styles.statusTextInactive]}>
                  {account.is_active ? 'Active' : 'Inactive'}
                </Text>
              </TouchableOpacity>
            </View>
            <View style={styles.bankActions}>
              <TouchableOpacity onPress={() => openEditBankModal(account)} style={styles.bankActionButton}>
                <Edit2 size={18} color="#6b7280" />
              </TouchableOpacity>
              <TouchableOpacity onPress={() => handleDeleteBank(account.id)} style={styles.bankActionButton}>
                <Trash2 size={18} color="#ef4444" />
              </TouchableOpacity>
            </View>
          </View>
          <View style={styles.bankDetails}>
            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>Account Name:</Text>
              <Text style={styles.detailValue}>{account.account_name}</Text>
            </View>
            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>Account Number:</Text>
              <Text style={styles.detailValue}>{account.account_number}</Text>
            </View>
            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>Account Type:</Text>
              <Text style={styles.detailValue}>{account.account_type}</Text>
            </View>
            {account.branch && (
              <View style={styles.detailRow}>
                <Text style={styles.detailLabel}>Branch:</Text>
                <Text style={styles.detailValue}>{account.branch}</Text>
              </View>
            )}
            {account.swift_code && (
              <View style={styles.detailRow}>
                <Text style={styles.detailLabel}>SWIFT Code:</Text>
                <Text style={styles.detailValue}>{account.swift_code}</Text>
              </View>
            )}
            {account.guidelines && (
              <View style={styles.guidelinesContainer}>
                <Text style={styles.guidelinesLabel}>Guidelines:</Text>
                <Text style={styles.guidelinesText}>{account.guidelines}</Text>
              </View>
            )}
          </View>
        </View>
      ))}
    </View>
  );

  const renderAreas = () => (
    <View style={styles.section}>
      <View style={styles.sectionHeader}>
        <Text style={styles.sectionTitle}>Delivery Areas</Text>
        <TouchableOpacity
          style={styles.addButton}
          onPress={() => {
            setSelectedArea(null);
            setAreaName(''); setAreaDescription(''); setAreaIsActive(true);
            setAreaModalVisible(true);
          }}>
          <Plus size={20} color="#ffffff" />
          <Text style={styles.addButtonText}>Add Area</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.searchContainer}>
        <Search size={18} color="#9ca3af" />
        <TextInput
          style={styles.searchInput}
          value={searchQuery}
          onChangeText={setSearchQuery}
          placeholder="Search areas..."
          placeholderTextColor="#9ca3af"
        />
        {searchQuery.length > 0 && (
          <TouchableOpacity onPress={() => setSearchQuery('')}>
            <X size={16} color="#6b7280" />
          </TouchableOpacity>
        )}
      </View>

      {filteredAreas.length === 0 ? (
        <View style={styles.emptyState}>
          <MapPin size={48} color="#d1d5db" />
          <Text style={styles.emptyText}>{areas.length === 0 ? 'No areas created yet' : 'No areas found'}</Text>
          <Text style={styles.emptySubtext}>{areas.length === 0 ? 'Create areas to organize riders by delivery zones' : 'Try adjusting your search'}</Text>
        </View>
      ) : filteredAreas.map((area) => (
        <View key={area.id} style={styles.areaCard}>
          <View style={styles.areaHeader}>
            <View style={styles.areaInfo}>
              <View style={styles.areaTitleRow}>
                <Text style={styles.areaName}>{area.name}</Text>
                {!area.is_active && (
                  <View style={styles.inactiveBadge}>
                    <Text style={styles.inactiveBadgeText}>Inactive</Text>
                  </View>
                )}
              </View>
              {area.description && <Text style={styles.areaDescription}>{area.description}</Text>}
            </View>
            <View style={styles.cardActions}>
              <TouchableOpacity
                style={styles.iconButton}
                onPress={() => {
                  setSelectedArea(area);
                  setAreaName(area.name);
                  setAreaDescription(area.description || '');
                  setAreaIsActive(area.is_active);
                  setAreaModalVisible(true);
                }}>
                <Edit2 size={18} color="#3b82f6" />
              </TouchableOpacity>
              <TouchableOpacity style={styles.iconButton} onPress={() => handleDeleteArea(area)}>
                <Trash2 size={18} color="#ef4444" />
              </TouchableOpacity>
            </View>
          </View>
          <View style={styles.areaStats}>
            <Users size={16} color="#8b5cf6" />
            <Text style={styles.areaStatText}>{getRidersCount(area.id)} Rider{getRidersCount(area.id) !== 1 ? 's' : ''}</Text>
          </View>
          <TouchableOpacity
            style={styles.assignButton}
            onPress={() => {
              setSelectedArea(area);
              const ridersInZone = riders.filter(r => r.zone_id === area.id);
              setAssigningRiders(new Set(ridersInZone.map(r => r.id)));
              setRiderAssignModalVisible(true);
            }}>
            <Users size={16} color="#8b5cf6" />
            <Text style={styles.assignButtonText}>Manage Riders</Text>
          </TouchableOpacity>
        </View>
      ))}
    </View>
  );

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <StatusBar style="dark" />

      <View style={styles.header}>
        <View style={styles.headerTop}>
          <DollarSign size={32} color="#8b5cf6" />
          <Text style={styles.headerTitle}>Pricing Dashboard</Text>
        </View>
        <Text style={styles.headerSubtitle}>Manage delivery charges, banks and areas</Text>
      </View>

      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.tabsScroll} contentContainerStyle={styles.tabsContent}>
        {(['zones', 'pricing', 'promotions', 'banks', 'areas'] as const).map((tab) => (
          <TouchableOpacity
            key={tab}
            style={[styles.tab, activeTab === tab && styles.tabActive]}
            onPress={() => setActiveTab(tab)}>
            <Text style={[styles.tabText, activeTab === tab && styles.tabTextActive]}>
              {tab === 'zones' ? 'Zones' : tab === 'pricing' ? 'Pricing' : tab === 'promotions' ? 'Promotions' : tab === 'banks' ? 'Banks' : 'Areas'}
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      <ScrollView
        style={styles.content}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#8b5cf6" />}>
        {activeTab === 'zones' && renderDeliveryZones()}
        {activeTab === 'pricing' && renderPricing()}
        {activeTab === 'promotions' && renderPromotions()}
        {activeTab === 'banks' && renderBanks()}
        {activeTab === 'areas' && renderAreas()}
      </ScrollView>

      <Modal visible={showZoneModal} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>{editingItem ? 'Edit Zone' : 'Add Zone'}</Text>
              <TouchableOpacity onPress={() => setShowZoneModal(false)}><X size={24} color="#6b7280" /></TouchableOpacity>
            </View>
            <TextInput style={styles.input} placeholder="Zone Name (e.g., Zone A - 0-3km)" value={zoneName} onChangeText={setZoneName} />
            <TextInput style={styles.input} placeholder="Min Distance (km)" value={minDistance} onChangeText={setMinDistance} keyboardType="decimal-pad" />
            <TextInput style={styles.input} placeholder="Max Distance (km)" value={maxDistance} onChangeText={setMaxDistance} keyboardType="decimal-pad" />
            <TextInput style={styles.input} placeholder="Price" value={zonePrice} onChangeText={setZonePrice} keyboardType="decimal-pad" />
            <TouchableOpacity style={styles.modalButton} onPress={handleSaveZone}>
              <Text style={styles.modalButtonText}>Save Zone</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      <Modal visible={showPricingModal} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>{editingItem ? 'Edit Pricing' : 'Add Pricing'}</Text>
              <TouchableOpacity onPress={() => setShowPricingModal(false)}><X size={24} color="#6b7280" /></TouchableOpacity>
            </View>
            <TextInput style={styles.input} placeholder="Zone ID" value={pricingZoneId} onChangeText={setPricingZoneId} />
            <TextInput style={styles.input} placeholder="Min Weight (kg)" value={minWeight} onChangeText={setMinWeight} keyboardType="decimal-pad" />
            <TextInput style={styles.input} placeholder="Max Weight (kg)" value={maxWeight} onChangeText={setMaxWeight} keyboardType="decimal-pad" />
            <TextInput style={styles.input} placeholder="Base Price" value={basePrice} onChangeText={setBasePrice} keyboardType="decimal-pad" />
            <TextInput style={styles.input} placeholder="Price Per Kg" value={pricePerKg} onChangeText={setPricePerKg} keyboardType="decimal-pad" />
            <TextInput style={styles.input} placeholder="Express Multiplier" value={expressMultiplier} onChangeText={setExpressMultiplier} keyboardType="decimal-pad" />
            <TouchableOpacity style={styles.modalButton} onPress={handleSavePricing}>
              <Text style={styles.modalButtonText}>Save Pricing</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      <Modal visible={showPromotionModal} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>{editingItem ? 'Edit Promotion' : 'Add Promotion'}</Text>
              <TouchableOpacity onPress={() => setShowPromotionModal(false)}><X size={24} color="#6b7280" /></TouchableOpacity>
            </View>
            <TextInput style={styles.input} placeholder="Promo Code" value={promoCode} onChangeText={setPromoCode} autoCapitalize="characters" />
            <TextInput style={styles.input} placeholder="Promotion Name" value={promoName} onChangeText={setPromoName} />
            <View style={styles.typeContainer}>
              <TouchableOpacity style={[styles.typeButton, discountType === 'fixed' && styles.typeButtonActive]} onPress={() => setDiscountType('fixed')}>
                <Text style={[styles.typeText, discountType === 'fixed' && styles.typeTextActive]}>Fixed</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.typeButton, discountType === 'percentage' && styles.typeButtonActive]} onPress={() => setDiscountType('percentage')}>
                <Text style={[styles.typeText, discountType === 'percentage' && styles.typeTextActive]}>%</Text>
              </TouchableOpacity>
            </View>
            <TextInput style={styles.input} placeholder="Discount Value" value={discountValue} onChangeText={setDiscountValue} keyboardType="decimal-pad" />
            <TextInput style={styles.input} placeholder="Min Order Amount" value={minOrderAmount} onChangeText={setMinOrderAmount} keyboardType="decimal-pad" />
            <TextInput style={styles.input} placeholder="Usage Limit (optional)" value={usageLimit} onChangeText={setUsageLimit} keyboardType="number-pad" />
            <TouchableOpacity style={styles.modalButton} onPress={handleSavePromotion}>
              <Text style={styles.modalButtonText}>Save Promotion</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      <Modal visible={showBankModal} animationType="slide" transparent onRequestClose={() => setShowBankModal(false)}>
        <View style={styles.bankModalOverlay}>
          <View style={styles.bankModalContainer}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>{editingAccount ? 'Edit Bank Account' : 'Add Bank Account'}</Text>
              <TouchableOpacity onPress={() => setShowBankModal(false)}><X size={24} color="#6b7280" /></TouchableOpacity>
            </View>
            <ScrollView style={styles.bankModalContent}>
              <Text style={styles.label}>Bank Name *</Text>
              <TextInput style={styles.input} value={bankName} onChangeText={setBankName} placeholder="e.g., First National Bank" />
              <Text style={styles.label}>Account Name *</Text>
              <TextInput style={styles.input} value={accountName} onChangeText={setAccountName} placeholder="e.g., QuickDeliver Inc." />
              <Text style={styles.label}>Account Number *</Text>
              <TextInput style={styles.input} value={accountNumber} onChangeText={setAccountNumber} placeholder="e.g., 1234567890" keyboardType="numeric" />
              <Text style={styles.label}>Account Type</Text>
              <View style={styles.accountTypeButtons}>
                {['Checking', 'Savings', 'Business Checking', 'Business Savings'].map((type) => (
                  <TouchableOpacity key={type} style={[styles.typeButton, accountType === type && styles.typeButtonActive]} onPress={() => setAccountType(type)}>
                    <Text style={[styles.typeText, accountType === type && styles.typeTextActive]}>{type}</Text>
                  </TouchableOpacity>
                ))}
              </View>
              <Text style={styles.label}>Branch (Optional)</Text>
              <TextInput style={styles.input} value={branch} onChangeText={setBranch} placeholder="e.g., Main Branch" />
              <Text style={styles.label}>SWIFT Code (Optional)</Text>
              <TextInput style={styles.input} value={swiftCode} onChangeText={setSwiftCode} placeholder="e.g., AAAA-BB-CC-123" autoCapitalize="characters" />
              <Text style={styles.label}>Guidelines (Optional)</Text>
              <TextInput style={[styles.input, styles.textArea]} value={bankGuidelines} onChangeText={setBankGuidelines} placeholder="e.g., Please include your order ID in transfer notes" multiline numberOfLines={3} />
              <Text style={styles.label}>Display Order</Text>
              <TextInput style={styles.input} value={displayOrder} onChangeText={setDisplayOrder} placeholder="1" keyboardType="numeric" />
              <TouchableOpacity style={styles.toggleButton} onPress={() => setBankIsActive(!bankIsActive)}>
                <View style={styles.toggleLeft}>
                  {bankIsActive ? <CheckCircle size={20} color="#10b981" /> : <XCircle size={20} color="#ef4444" />}
                  <Text style={styles.toggleLabel}>{bankIsActive ? 'Active' : 'Inactive'}</Text>
                </View>
                <Text style={styles.toggleHint}>{bankIsActive ? 'Customers can see this account' : 'Hidden from customers'}</Text>
              </TouchableOpacity>
            </ScrollView>
            <View style={styles.bankModalFooter}>
              <TouchableOpacity style={styles.cancelButton} onPress={() => setShowBankModal(false)}>
                <Text style={styles.cancelButtonText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.saveButton} onPress={handleSaveBank}>
                <Text style={styles.saveButtonText}>Save</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      <Modal visible={areaModalVisible} animationType="slide" transparent onRequestClose={() => setAreaModalVisible(false)}>
        <View style={styles.bankModalOverlay}>
          <View style={styles.bankModalContainer}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>{selectedArea ? 'Edit Zone' : 'Create Zone'}</Text>
              <TouchableOpacity onPress={() => setAreaModalVisible(false)}><X size={24} color="#6b7280" /></TouchableOpacity>
            </View>
            <ScrollView style={styles.bankModalContent}>
              <Text style={styles.label}>Zone Name *</Text>
              <TextInput style={styles.input} value={areaName} onChangeText={setAreaName} placeholder="e.g., Downtown, North Side, East District" placeholderTextColor="#9ca3af" />
              <Text style={styles.label}>Description</Text>
              <TextInput style={[styles.input, styles.textArea]} value={areaDescription} onChangeText={setAreaDescription} placeholder="Optional description of the zone coverage area" placeholderTextColor="#9ca3af" multiline numberOfLines={3} />
              <View style={styles.switchRow}>
                <Text style={styles.label}>Active</Text>
                <TouchableOpacity style={[styles.switchControl, areaIsActive && styles.switchActive]} onPress={() => setAreaIsActive(!areaIsActive)}>
                  <View style={[styles.switchThumb, areaIsActive && styles.switchThumbActive]} />
                </TouchableOpacity>
              </View>
            </ScrollView>
            <View style={styles.bankModalFooter}>
              <TouchableOpacity style={styles.cancelButton} onPress={() => setAreaModalVisible(false)}>
                <Text style={styles.cancelButtonText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.saveButton} onPress={handleSaveArea}>
                <Text style={styles.saveButtonText}>{selectedArea ? 'Update' : 'Create'}</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      <Modal visible={riderAssignModalVisible} animationType="slide" transparent onRequestClose={() => setRiderAssignModalVisible(false)}>
        <View style={styles.bankModalOverlay}>
          <View style={styles.bankModalContainer}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Assign Riders to {selectedArea?.name}</Text>
              <TouchableOpacity onPress={() => setRiderAssignModalVisible(false)}><X size={24} color="#6b7280" /></TouchableOpacity>
            </View>
            <ScrollView style={styles.bankModalContent}>
              <Text style={styles.helperText}>Select riders to assign to this zone. Riders can only be in one zone at a time.</Text>
              {riders.length === 0 ? (
                <View style={styles.emptyState}>
                  <Users size={48} color="#d1d5db" />
                  <Text style={styles.emptyText}>No riders available</Text>
                </View>
              ) : riders.map((rider) => (
                <TouchableOpacity
                  key={rider.id}
                  style={[styles.riderItem, assigningRiders.has(rider.id) && styles.riderItemSelected]}
                  onPress={() => {
                    setAssigningRiders(prev => {
                      const newSet = new Set(prev);
                      if (newSet.has(rider.id)) newSet.delete(rider.id);
                      else newSet.add(rider.id);
                      return newSet;
                    });
                  }}>
                  <View style={styles.riderInfo}>
                    <Text style={styles.riderName}>{rider.profile.full_name}</Text>
                    {rider.zone_id && rider.zone_id !== selectedArea?.id && (
                      <Text style={styles.riderCurrentZone}>
                        Currently in: {areas.find(z => z.id === rider.zone_id)?.name || 'Unknown Zone'}
                      </Text>
                    )}
                  </View>
                  <View style={[styles.checkbox, assigningRiders.has(rider.id) && styles.checkboxChecked]}>
                    {assigningRiders.has(rider.id) && <Text style={styles.checkmark}>✓</Text>}
                  </View>
                </TouchableOpacity>
              ))}
            </ScrollView>
            <View style={styles.bankModalFooter}>
              <TouchableOpacity style={styles.cancelButton} onPress={() => setRiderAssignModalVisible(false)}>
                <Text style={styles.cancelButtonText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.saveButton} onPress={handleSaveRiderAssignments}>
                <Text style={styles.saveButtonText}>Save Assignments</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      <Toast
        visible={toast.visible}
        message={toast.message}
        type={toast.type}
        duration={3000}
        onDismiss={() => setToast({ ...toast, visible: false })}
      />

      <ConfirmDialog
        visible={confirmDialog.visible}
        title={confirmDialog.title}
        message={confirmDialog.message}
        onConfirm={confirmDialog.onConfirm}
        onCancel={() => setConfirmDialog({ ...confirmDialog, visible: false })}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f9fafb' },
  header: {
    padding: 20,
    backgroundColor: '#ffffff',
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
  },
  headerTop: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  headerTitle: { fontSize: 28, fontWeight: '800', color: '#111827' },
  headerSubtitle: { fontSize: 14, color: '#6b7280', marginTop: 4 },
  tabsScroll: {
    backgroundColor: '#ffffff',
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
    maxHeight: 52,
  },
  tabsContent: { flexDirection: 'row', paddingHorizontal: 4 },
  tab: {
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderBottomWidth: 2,
    borderBottomColor: 'transparent',
  },
  tabActive: { borderBottomColor: '#8b5cf6' },
  tabText: { fontSize: 14, fontWeight: '600', color: '#6b7280' },
  tabTextActive: { color: '#8b5cf6' },
  content: { flex: 1 },
  section: { padding: 16 },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  sectionTitle: { fontSize: 20, fontWeight: '700', color: '#111827' },
  addButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#8b5cf6',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 8,
  },
  addButtonText: { color: '#ffffff', fontSize: 14, fontWeight: '600' },
  card: {
    backgroundColor: '#ffffff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  cardInactive: { opacity: 0.6, backgroundColor: '#f9fafb' },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  cardTitle: { fontSize: 16, fontWeight: '700', color: '#111827' },
  cardActions: { flexDirection: 'row', gap: 12 },
  iconButton: { padding: 4 },
  cardContent: { gap: 4 },
  cardText: { fontSize: 14, color: '#6b7280' },
  cardPrice: { fontSize: 18, fontWeight: '700', color: '#f97316', marginTop: 4 },
  cardDate: { fontSize: 12, color: '#9ca3af', marginTop: 4 },
  promoCode: { fontSize: 12, fontWeight: '600', color: '#8b5cf6', marginTop: 2 },
  emptyState: { alignItems: 'center', justifyContent: 'center', paddingVertical: 60, gap: 8 },
  emptyText: { fontSize: 18, fontWeight: '600', color: '#6b7280' },
  emptySubtext: { fontSize: 14, color: '#9ca3af', textAlign: 'center' },
  bankCard: {
    backgroundColor: '#ffffff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  bankCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
  },
  bankHeaderLeft: { flexDirection: 'row', alignItems: 'center', gap: 8, flex: 1 },
  bankName: { fontSize: 16, fontWeight: '700', color: '#111827', flex: 1 },
  statusBadge: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6 },
  statusActive: { backgroundColor: '#d1fae5' },
  statusInactive: { backgroundColor: '#fee2e2' },
  statusText: { fontSize: 11, fontWeight: '600' },
  statusTextActive: { color: '#065f46' },
  statusTextInactive: { color: '#991b1b' },
  bankActions: { flexDirection: 'row', gap: 8 },
  bankActionButton: {
    width: 36, height: 36, borderRadius: 8,
    backgroundColor: '#f3f4f6',
    justifyContent: 'center', alignItems: 'center',
  },
  bankDetails: { gap: 8 },
  detailRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  detailLabel: { fontSize: 13, color: '#6b7280', fontWeight: '500' },
  detailValue: { fontSize: 14, color: '#111827', fontWeight: '600' },
  guidelinesContainer: { marginTop: 8, padding: 12, backgroundColor: '#fef3c7', borderRadius: 8 },
  guidelinesLabel: { fontSize: 12, fontWeight: '600', color: '#92400e', marginBottom: 4 },
  guidelinesText: { fontSize: 12, color: '#92400e', lineHeight: 16 },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#ffffff',
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    gap: 8,
    marginBottom: 16,
  },
  searchInput: { flex: 1, fontSize: 15, color: '#111827', outlineStyle: 'none' } as any,
  areaCard: {
    backgroundColor: '#ffffff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  areaHeader: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 12 },
  areaInfo: { flex: 1 },
  areaTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 4 },
  areaName: { fontSize: 16, fontWeight: '700', color: '#111827' },
  inactiveBadge: { backgroundColor: '#fee2e2', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8 },
  inactiveBadgeText: { fontSize: 11, fontWeight: '700', color: '#991b1b' },
  areaDescription: { fontSize: 14, color: '#6b7280' },
  areaStats: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 12 },
  areaStatText: { fontSize: 14, color: '#6b7280', fontWeight: '600' },
  assignButton: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    backgroundColor: '#f5f3ff', paddingVertical: 10, paddingHorizontal: 16,
    borderRadius: 10, borderWidth: 2, borderColor: '#8b5cf6',
  },
  assignButtonText: { fontSize: 14, fontWeight: '700', color: '#8b5cf6' },
  modalOverlay: {
    flex: 1, backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center', alignItems: 'center', padding: 20,
  },
  modalContent: {
    backgroundColor: '#ffffff', borderRadius: 16,
    padding: 24, width: '100%', maxWidth: 500,
  },
  modalHeader: {
    flexDirection: 'row', justifyContent: 'space-between',
    alignItems: 'center', marginBottom: 20,
  },
  modalTitle: { fontSize: 20, fontWeight: '700', color: '#111827' },
  input: {
    backgroundColor: '#f9fafb', borderWidth: 1, borderColor: '#e5e7eb',
    borderRadius: 8, padding: 12, fontSize: 16, marginBottom: 12,
  },
  textArea: { minHeight: 80, textAlignVertical: 'top' },
  typeContainer: { flexDirection: 'row', gap: 8, marginBottom: 12 },
  typeButton: {
    flex: 1, paddingVertical: 10, borderRadius: 8,
    borderWidth: 2, borderColor: '#e5e7eb', alignItems: 'center',
  },
  typeButtonActive: { borderColor: '#8b5cf6', backgroundColor: '#f3e8ff' },
  typeText: { fontSize: 14, fontWeight: '600', color: '#6b7280' },
  typeTextActive: { color: '#8b5cf6' },
  modalButton: {
    backgroundColor: '#8b5cf6', paddingVertical: 14,
    borderRadius: 8, alignItems: 'center', marginTop: 8,
  },
  modalButtonText: { color: '#ffffff', fontSize: 16, fontWeight: '700' },
  bankModalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  bankModalContainer: {
    backgroundColor: '#ffffff', borderTopLeftRadius: 24,
    borderTopRightRadius: 24, maxHeight: '90%',
  },
  bankModalContent: { padding: 20 },
  bankModalFooter: {
    flexDirection: 'row', padding: 20, gap: 12,
    borderTopWidth: 1, borderTopColor: '#f3f4f6',
  },
  label: { fontSize: 14, fontWeight: '600', color: '#374151', marginBottom: 8 },
  accountTypeButtons: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 12 },
  toggleButton: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    padding: 16, backgroundColor: '#f9fafb', borderRadius: 12, borderWidth: 1, borderColor: '#e5e7eb',
  },
  toggleLeft: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  toggleLabel: { fontSize: 16, fontWeight: '600', color: '#111827' },
  toggleHint: { fontSize: 13, color: '#6b7280' },
  cancelButton: {
    flex: 1, paddingVertical: 16, borderRadius: 12,
    borderWidth: 1, borderColor: '#e5e7eb', alignItems: 'center',
  },
  cancelButtonText: { fontSize: 16, fontWeight: '700', color: '#6b7280' },
  saveButton: {
    flex: 1, paddingVertical: 16, borderRadius: 12,
    backgroundColor: '#8b5cf6', alignItems: 'center',
  },
  saveButtonText: { fontSize: 16, fontWeight: '700', color: '#ffffff' },
  switchRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 },
  switchControl: { width: 52, height: 32, borderRadius: 16, backgroundColor: '#e5e7eb', padding: 2 },
  switchActive: { backgroundColor: '#8b5cf6' },
  switchThumb: { width: 28, height: 28, borderRadius: 14, backgroundColor: '#ffffff' },
  switchThumbActive: { transform: [{ translateX: 20 }] },
  helperText: { fontSize: 14, color: '#6b7280', marginBottom: 16, lineHeight: 20 },
  riderItem: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    padding: 16, borderRadius: 12, borderWidth: 2, borderColor: '#e5e7eb',
    backgroundColor: '#ffffff', marginBottom: 12,
  },
  riderItemSelected: { borderColor: '#8b5cf6', backgroundColor: '#f5f3ff' },
  riderInfo: { flex: 1 },
  riderName: { fontSize: 16, fontWeight: '600', color: '#111827', marginBottom: 4 },
  riderCurrentZone: { fontSize: 12, color: '#6b7280' },
  checkbox: {
    width: 28, height: 28, borderRadius: 8, borderWidth: 2, borderColor: '#d1d5db',
    backgroundColor: '#ffffff', alignItems: 'center', justifyContent: 'center',
  },
  checkboxChecked: { borderColor: '#8b5cf6', backgroundColor: '#8b5cf6' },
  checkmark: { color: '#ffffff', fontSize: 16, fontWeight: '700' },
});
