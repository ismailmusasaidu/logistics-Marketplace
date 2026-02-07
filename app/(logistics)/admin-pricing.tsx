import { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, TextInput, Modal, Alert, Platform, RefreshControl } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/lib/supabase';
import { DollarSign, Plus, Edit2, Trash2, X, CheckCircle, XCircle } from 'lucide-react-native';
import { StatusBar } from 'expo-status-bar';

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

export default function AdminPricing() {
  const { profile, signOut } = useAuth();
  const [activeTab, setActiveTab] = useState<'zones' | 'pricing' | 'promotions'>('zones');
  const [refreshing, setRefreshing] = useState(false);

  const [zones, setZones] = useState<DeliveryZone[]>([]);
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

  useEffect(() => {
    if (profile?.role === 'admin') {
      loadAllData();
    }
  }, [profile]);

  const loadAllData = async () => {
    await Promise.all([
      loadZones(),
      loadPricing(),
      loadPromotions(),
    ]);
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await loadAllData();
    setRefreshing(false);
  };

  const loadZones = async () => {
    const { data, error } = await supabase
      .from('delivery_zones')
      .select('*')
      .order('min_distance_km');

    if (!error && data) {
      setZones(data);
    }
  };

  const loadPricing = async () => {
    const { data, error } = await supabase
      .from('delivery_pricing')
      .select('*')
      .order('min_weight_kg');

    if (!error && data) {
      setPricing(data);
    }
  };

  const loadPromotions = async () => {
    const { data, error } = await supabase
      .from('promotions')
      .select('*')
      .order('created_at', { ascending: false });

    if (!error && data) {
      setPromotions(data);
    }
  };

  const handleSaveZone = async () => {
    if (!zoneName || !minDistance || !maxDistance || !zonePrice) {
      if (Platform.OS === 'web') {
        alert('Please fill in all fields');
      }
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
      const { error } = await supabase
        .from('delivery_zones')
        .update(zoneData)
        .eq('id', editingItem.id);

      if (error) {
        console.error('Error updating zone:', error);
        return;
      }
    } else {
      const { error } = await supabase
        .from('delivery_zones')
        .insert(zoneData);

      if (error) {
        console.error('Error creating zone:', error);
        return;
      }
    }

    setShowZoneModal(false);
    resetZoneForm();
    loadZones();
  };

  const handleSavePricing = async () => {
    if (!pricingZoneId || !minWeight || !maxWeight || !basePrice || !pricePerKg || !expressMultiplier) {
      if (Platform.OS === 'web') {
        alert('Please fill in all fields');
      }
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
      const { error } = await supabase
        .from('delivery_pricing')
        .update(pricingData)
        .eq('id', editingItem.id);

      if (error) {
        console.error('Error updating pricing:', error);
        return;
      }
    } else {
      const { error } = await supabase
        .from('delivery_pricing')
        .insert(pricingData);

      if (error) {
        console.error('Error creating pricing:', error);
        return;
      }
    }

    setShowPricingModal(false);
    resetPricingForm();
    loadPricing();
  };

  const handleSavePromotion = async () => {
    if (!promoCode || !promoName || !discountValue) {
      if (Platform.OS === 'web') {
        alert('Please fill in required fields');
      }
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
      const { error } = await supabase
        .from('promotions')
        .update(promoData)
        .eq('id', editingItem.id);

      if (error) {
        console.error('Error updating promotion:', error);
        return;
      }
    } else {
      const { error } = await supabase
        .from('promotions')
        .insert(promoData);

      if (error) {
        console.error('Error creating promotion:', error);
        return;
      }
    }

    setShowPromotionModal(false);
    resetPromotionForm();
    loadPromotions();
  };

  const handleToggleZone = async (zone: DeliveryZone) => {
    const { error } = await supabase
      .from('delivery_zones')
      .update({ is_active: !zone.is_active })
      .eq('id', zone.id);

    if (!error) {
      loadZones();
    }
  };

  const handleTogglePromotion = async (promotion: Promotion) => {
    const { error } = await supabase
      .from('promotions')
      .update({ is_active: !promotion.is_active })
      .eq('id', promotion.id);

    if (!error) {
      loadPromotions();
    }
  };

  const handleDeleteZone = async (zoneId: string) => {
    const { error } = await supabase
      .from('delivery_zones')
      .delete()
      .eq('id', zoneId);

    if (!error) {
      loadZones();
    }
  };

  const handleDeletePricing = async (pricingId: string) => {
    const { error } = await supabase
      .from('delivery_pricing')
      .delete()
      .eq('id', pricingId);

    if (!error) {
      loadPricing();
    }
  };

  const handleDeletePromotion = async (promotionId: string) => {
    const { error } = await supabase
      .from('promotions')
      .delete()
      .eq('id', promotionId);

    if (!error) {
      loadPromotions();
    }
  };

  const openEditZone = (zone: DeliveryZone) => {
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

  const resetZoneForm = () => {
    setEditingItem(null);
    setZoneName('');
    setMinDistance('');
    setMaxDistance('');
    setZonePrice('');
  };

  const resetPricingForm = () => {
    setEditingItem(null);
    setPricingZoneId('');
    setMinWeight('');
    setMaxWeight('');
    setBasePrice('');
    setPricePerKg('');
    setExpressMultiplier('');
  };

  const resetPromotionForm = () => {
    setEditingItem(null);
    setPromoCode('');
    setPromoName('');
    setDiscountType('fixed');
    setDiscountValue('');
    setMinOrderAmount('');
    setUsageLimit('');
  };

  const getZoneNameById = (zoneId: string) => {
    const zone = zones.find((z) => z.id === zoneId);
    return zone ? zone.name : zoneId;
  };

  const renderZones = () => (
    <View style={styles.section}>
      <View style={styles.sectionHeader}>
        <Text style={styles.sectionTitle}>Delivery Zones</Text>
        <TouchableOpacity
          style={styles.addButton}
          onPress={() => {
            resetZoneForm();
            setShowZoneModal(true);
          }}>
          <Plus size={20} color="#ffffff" />
          <Text style={styles.addButtonText}>Add Zone</Text>
        </TouchableOpacity>
      </View>

      {zones.map((zone) => (
        <View key={zone.id} style={[styles.card, !zone.is_active && styles.cardInactive]}>
          <View style={styles.cardHeader}>
            <Text style={styles.cardTitle}>{zone.name}</Text>
            <View style={styles.cardActions}>
              <TouchableOpacity onPress={() => handleToggleZone(zone)} style={styles.iconButton}>
                {zone.is_active ? (
                  <CheckCircle size={20} color="#f97316" />
                ) : (
                  <XCircle size={20} color="#ef4444" />
                )}
              </TouchableOpacity>
              <TouchableOpacity onPress={() => openEditZone(zone)} style={styles.iconButton}>
                <Edit2 size={20} color="#3b82f6" />
              </TouchableOpacity>
              <TouchableOpacity onPress={() => handleDeleteZone(zone.id)} style={styles.iconButton}>
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
        <TouchableOpacity
          style={styles.addButton}
          onPress={() => {
            resetPricingForm();
            setShowPricingModal(true);
          }}>
          <Plus size={20} color="#ffffff" />
          <Text style={styles.addButtonText}>Add Pricing</Text>
        </TouchableOpacity>
      </View>

      {pricing.map((item) => (
        <View key={item.id} style={styles.card}>
          <View style={styles.cardHeader}>
            <Text style={styles.cardTitle}>{getZoneNameById(item.zone_id)}</Text>
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
        <TouchableOpacity
          style={styles.addButton}
          onPress={() => {
            resetPromotionForm();
            setShowPromotionModal(true);
          }}>
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
                {promotion.is_active ? (
                  <CheckCircle size={20} color="#f97316" />
                ) : (
                  <XCircle size={20} color="#ef4444" />
                )}
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
              {promotion.discount_type === 'fixed'
                ? `${promotion.discount_value.toLocaleString()} off`
                : `${promotion.discount_value}% off`
              }
            </Text>
            <Text style={styles.cardText}>Min Order: {promotion.min_order_amount.toLocaleString()}</Text>
            <Text style={styles.cardText}>
              Usage: {promotion.usage_count} / {promotion.usage_limit || '\u221E'}
            </Text>
          </View>
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
        <Text style={styles.headerSubtitle}>Manage delivery charges and promotions</Text>
      </View>

      <View style={styles.tabs}>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'zones' && styles.tabActive]}
          onPress={() => setActiveTab('zones')}>
          <Text style={[styles.tabText, activeTab === 'zones' && styles.tabTextActive]}>Zones</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'pricing' && styles.tabActive]}
          onPress={() => setActiveTab('pricing')}>
          <Text style={[styles.tabText, activeTab === 'pricing' && styles.tabTextActive]}>Pricing</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'promotions' && styles.tabActive]}
          onPress={() => setActiveTab('promotions')}>
          <Text style={[styles.tabText, activeTab === 'promotions' && styles.tabTextActive]}>Promotions</Text>
        </TouchableOpacity>
      </View>

      <ScrollView
        style={styles.content}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#8b5cf6" />
        }>
        {activeTab === 'zones' && renderZones()}
        {activeTab === 'pricing' && renderPricing()}
        {activeTab === 'promotions' && renderPromotions()}
      </ScrollView>

      <Modal visible={showZoneModal} animationType="slide" transparent={true}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>{editingItem ? 'Edit Zone' : 'Add Zone'}</Text>
              <TouchableOpacity onPress={() => setShowZoneModal(false)}>
                <X size={24} color="#6b7280" />
              </TouchableOpacity>
            </View>

            <TextInput
              style={styles.input}
              placeholder="Zone Name (e.g., Zone A - 0-3km)"
              value={zoneName}
              onChangeText={setZoneName}
            />
            <TextInput
              style={styles.input}
              placeholder="Min Distance (km)"
              value={minDistance}
              onChangeText={setMinDistance}
              keyboardType="decimal-pad"
            />
            <TextInput
              style={styles.input}
              placeholder="Max Distance (km)"
              value={maxDistance}
              onChangeText={setMaxDistance}
              keyboardType="decimal-pad"
            />
            <TextInput
              style={styles.input}
              placeholder="Price"
              value={zonePrice}
              onChangeText={setZonePrice}
              keyboardType="decimal-pad"
            />

            <TouchableOpacity style={styles.modalButton} onPress={handleSaveZone}>
              <Text style={styles.modalButtonText}>Save Zone</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      <Modal visible={showPricingModal} animationType="slide" transparent={true}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>{editingItem ? 'Edit Pricing' : 'Add Pricing'}</Text>
              <TouchableOpacity onPress={() => setShowPricingModal(false)}>
                <X size={24} color="#6b7280" />
              </TouchableOpacity>
            </View>

            <TextInput
              style={styles.input}
              placeholder="Zone ID"
              value={pricingZoneId}
              onChangeText={setPricingZoneId}
            />
            <TextInput
              style={styles.input}
              placeholder="Min Weight (kg)"
              value={minWeight}
              onChangeText={setMinWeight}
              keyboardType="decimal-pad"
            />
            <TextInput
              style={styles.input}
              placeholder="Max Weight (kg)"
              value={maxWeight}
              onChangeText={setMaxWeight}
              keyboardType="decimal-pad"
            />
            <TextInput
              style={styles.input}
              placeholder="Base Price"
              value={basePrice}
              onChangeText={setBasePrice}
              keyboardType="decimal-pad"
            />
            <TextInput
              style={styles.input}
              placeholder="Price Per Kg"
              value={pricePerKg}
              onChangeText={setPricePerKg}
              keyboardType="decimal-pad"
            />
            <TextInput
              style={styles.input}
              placeholder="Express Multiplier"
              value={expressMultiplier}
              onChangeText={setExpressMultiplier}
              keyboardType="decimal-pad"
            />

            <TouchableOpacity style={styles.modalButton} onPress={handleSavePricing}>
              <Text style={styles.modalButtonText}>Save Pricing</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      <Modal visible={showPromotionModal} animationType="slide" transparent={true}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>{editingItem ? 'Edit Promotion' : 'Add Promotion'}</Text>
              <TouchableOpacity onPress={() => setShowPromotionModal(false)}>
                <X size={24} color="#6b7280" />
              </TouchableOpacity>
            </View>

            <TextInput
              style={styles.input}
              placeholder="Promo Code"
              value={promoCode}
              onChangeText={setPromoCode}
              autoCapitalize="characters"
            />
            <TextInput
              style={styles.input}
              placeholder="Promotion Name"
              value={promoName}
              onChangeText={setPromoName}
            />

            <View style={styles.typeContainer}>
              <TouchableOpacity
                style={[styles.typeButton, discountType === 'fixed' && styles.typeButtonActive]}
                onPress={() => setDiscountType('fixed')}>
                <Text style={[styles.typeText, discountType === 'fixed' && styles.typeTextActive]}>Fixed</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.typeButton, discountType === 'percentage' && styles.typeButtonActive]}
                onPress={() => setDiscountType('percentage')}>
                <Text style={[styles.typeText, discountType === 'percentage' && styles.typeTextActive]}>%</Text>
              </TouchableOpacity>
            </View>

            <TextInput
              style={styles.input}
              placeholder="Discount Value"
              value={discountValue}
              onChangeText={setDiscountValue}
              keyboardType="decimal-pad"
            />
            <TextInput
              style={styles.input}
              placeholder="Min Order Amount"
              value={minOrderAmount}
              onChangeText={setMinOrderAmount}
              keyboardType="decimal-pad"
            />
            <TextInput
              style={styles.input}
              placeholder="Usage Limit (optional)"
              value={usageLimit}
              onChangeText={setUsageLimit}
              keyboardType="number-pad"
            />

            <TouchableOpacity style={styles.modalButton} onPress={handleSavePromotion}>
              <Text style={styles.modalButtonText}>Save Promotion</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f9fafb',
  },
  header: {
    padding: 20,
    backgroundColor: '#ffffff',
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
  },
  headerTop: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  headerTitle: {
    fontSize: 28,
    fontWeight: '800',
    color: '#111827',
  },
  headerSubtitle: {
    fontSize: 14,
    color: '#6b7280',
    marginTop: 4,
  },
  tabs: {
    flexDirection: 'row',
    backgroundColor: '#ffffff',
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
  },
  tab: {
    flex: 1,
    paddingVertical: 16,
    alignItems: 'center',
    borderBottomWidth: 2,
    borderBottomColor: 'transparent',
  },
  tabActive: {
    borderBottomColor: '#8b5cf6',
  },
  tabText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#6b7280',
  },
  tabTextActive: {
    color: '#8b5cf6',
  },
  content: {
    flex: 1,
  },
  section: {
    padding: 16,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#111827',
  },
  addButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#8b5cf6',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 8,
  },
  addButtonText: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '600',
  },
  card: {
    backgroundColor: '#ffffff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  cardInactive: {
    opacity: 0.6,
    backgroundColor: '#f9fafb',
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#111827',
  },
  cardActions: {
    flexDirection: 'row',
    gap: 12,
  },
  iconButton: {
    padding: 4,
  },
  cardContent: {
    gap: 4,
  },
  cardText: {
    fontSize: 14,
    color: '#6b7280',
  },
  cardPrice: {
    fontSize: 18,
    fontWeight: '700',
    color: '#f97316',
    marginTop: 4,
  },
  cardDate: {
    fontSize: 12,
    color: '#9ca3af',
    marginTop: 4,
  },
  promoCode: {
    fontSize: 12,
    fontWeight: '600',
    color: '#8b5cf6',
    marginTop: 2,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalContent: {
    backgroundColor: '#ffffff',
    borderRadius: 16,
    padding: 24,
    width: '100%',
    maxWidth: 500,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#111827',
  },
  input: {
    backgroundColor: '#f9fafb',
    borderWidth: 1,
    borderColor: '#e5e7eb',
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    marginBottom: 12,
  },
  typeContainer: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 12,
  },
  typeButton: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 8,
    borderWidth: 2,
    borderColor: '#e5e7eb',
    alignItems: 'center',
  },
  typeButtonActive: {
    borderColor: '#8b5cf6',
    backgroundColor: '#f3e8ff',
  },
  typeText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#6b7280',
  },
  typeTextActive: {
    color: '#8b5cf6',
  },
  modalButton: {
    backgroundColor: '#8b5cf6',
    paddingVertical: 14,
    borderRadius: 8,
    alignItems: 'center',
    marginTop: 8,
  },
  modalButtonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '700',
  },
});
