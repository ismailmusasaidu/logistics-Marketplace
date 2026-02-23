import { useState, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
  Modal,
} from 'react-native';
import {
  MapPin,
  DollarSign,
  Tag,
  FileText,
  Plus,
  ArrowLeft,
  Trash2,
  Edit3,
  Check,
  AlertTriangle,
  Ruler,
  ToggleLeft,
  ToggleRight,
  Percent,
  Gift,
  Truck,
  Calendar,
  Hash,
  ChevronRight,
  Zap,
} from 'lucide-react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { supabase } from '@/lib/marketplace/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { Fonts } from '@/constants/fonts';
import DeliveryLogs from './DeliveryLogs';

interface DeliveryZone {
  id: string;
  name: string;
  description: string;
  min_distance_km: number;
  max_distance_km: number;
  price: number;
  is_active: boolean;
}

interface DeliveryPricing {
  id: string;
  default_base_price: number;
  default_price_per_km: number;
  min_delivery_charge: number;
  max_delivery_distance_km: number;
  free_delivery_threshold: number;
  store_pickup_address: string;
}

interface Promotion {
  id: string;
  code: string;
  name: string;
  description: string;
  discount_type: 'percentage' | 'fixed_amount' | 'free_delivery';
  discount_value: number;
  min_order_amount: number;
  max_discount_amount: number;
  valid_from: string;
  valid_until: string;
  usage_limit: number;
  usage_count: number;
  is_active: boolean;
}

interface DeliverySpeedOption {
  id: string;
  name: string;
  label: string;
  description: string;
  additional_cost: number;
  estimated_time: string;
  is_active: boolean;
  display_order: number;
}

type TabKey = 'zones' | 'pricing' | 'promotions' | 'speed' | 'logs';

const TABS: { key: TabKey; label: string; icon: any }[] = [
  { key: 'zones', label: 'Zones', icon: MapPin },
  { key: 'pricing', label: 'Pricing', icon: DollarSign },
  { key: 'promotions', label: 'Promos', icon: Tag },
  { key: 'speed', label: 'Speed', icon: Zap },
  { key: 'logs', label: 'Logs', icon: FileText },
];

const DISCOUNT_TYPES: { key: Promotion['discount_type']; label: string; icon: any }[] = [
  { key: 'percentage', label: 'Percentage', icon: Percent },
  { key: 'fixed_amount', label: 'Fixed Amount', icon: DollarSign },
  { key: 'free_delivery', label: 'Free Delivery', icon: Truck },
];

export default function DeliveryManagement() {
  const insets = useSafeAreaInsets();
  const { profile } = useAuth();
  const [activeTab, setActiveTab] = useState<TabKey>('zones');
  const [zones, setZones] = useState<DeliveryZone[]>([]);
  const [pricing, setPricing] = useState<DeliveryPricing | null>(null);
  const [promotions, setPromotions] = useState<Promotion[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingZone, setEditingZone] = useState<DeliveryZone | null>(null);
  const [editingPromotion, setEditingPromotion] = useState<Promotion | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<{ type: 'zone' | 'promotion'; id: string; name: string } | null>(null);
  const [pricingSaved, setPricingSaved] = useState(false);
  const [speedOptions, setSpeedOptions] = useState<DeliverySpeedOption[]>([]);
  const [editingSpeed, setEditingSpeed] = useState<DeliverySpeedOption | null>(null);
  const [speedError, setSpeedError] = useState<string | null>(null);
  const [speedSaving, setSpeedSaving] = useState(false);

  useEffect(() => {
    loadData();
  }, [activeTab]);

  const loadData = async () => {
    setLoading(true);
    try {
      if (activeTab === 'zones') await loadZones();
      else if (activeTab === 'pricing') await loadPricing();
      else if (activeTab === 'promotions') await loadPromotions();
      else if (activeTab === 'speed') await loadSpeedOptions();
    } catch (error) {
      console.error('Error loading data:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadZones = async () => {
    const { data, error } = await supabase
      .from('delivery_zones')
      .select('*')
      .order('created_at', { ascending: false });
    if (!error && data) setZones(data);
  };

  const loadPricing = async () => {
    const { data, error } = await supabase
      .from('delivery_pricing')
      .select('*')
      .limit(1)
      .maybeSingle();
    if (!error && data) setPricing(data);
  };

  const loadPromotions = async () => {
    const { data, error } = await supabase
      .from('promotions')
      .select('*')
      .order('created_at', { ascending: false });
    if (!error && data) setPromotions(data);
  };

  const loadSpeedOptions = async () => {
    const { data, error } = await supabase
      .from('delivery_speed_options')
      .select('*')
      .order('display_order');
    if (!error && data) setSpeedOptions(data);
  };

  const saveSpeedOption = async () => {
    if (!editingSpeed) return;
    setSpeedSaving(true);
    setSpeedError(null);
    const { error } = editingSpeed.id.startsWith('new-')
      ? await supabase.from('delivery_speed_options').insert([{
          name: editingSpeed.name,
          label: editingSpeed.label,
          description: editingSpeed.description,
          additional_cost: editingSpeed.additional_cost,
          estimated_time: editingSpeed.estimated_time,
          is_active: editingSpeed.is_active,
          display_order: editingSpeed.display_order,
        }])
      : await supabase.from('delivery_speed_options').update({
          name: editingSpeed.name,
          label: editingSpeed.label,
          description: editingSpeed.description,
          additional_cost: editingSpeed.additional_cost,
          estimated_time: editingSpeed.estimated_time,
          is_active: editingSpeed.is_active,
          display_order: editingSpeed.display_order,
          updated_at: new Date().toISOString(),
        }).eq('id', editingSpeed.id);
    setSpeedSaving(false);
    if (error) {
      setSpeedError(error.message);
    } else {
      setEditingSpeed(null);
      setSpeedError(null);
      loadSpeedOptions();
    }
  };

  const deleteSpeedOption = async (id: string) => {
    const { error } = await supabase.from('delivery_speed_options').delete().eq('id', id);
    if (!error) loadSpeedOptions();
  };

  const saveZone = async () => {
    if (!editingZone) return;
    const { error } = editingZone.id.startsWith('new-')
      ? await supabase.from('delivery_zones').insert([{
          name: editingZone.name,
          description: editingZone.description,
          min_distance_km: editingZone.min_distance_km,
          max_distance_km: editingZone.max_distance_km,
          price: editingZone.price,
          is_active: editingZone.is_active,
        }])
      : await supabase.from('delivery_zones').update({
          name: editingZone.name,
          description: editingZone.description,
          min_distance_km: editingZone.min_distance_km,
          max_distance_km: editingZone.max_distance_km,
          price: editingZone.price,
          is_active: editingZone.is_active,
          updated_at: new Date().toISOString(),
        }).eq('id', editingZone.id);
    if (!error) {
      setEditingZone(null);
      loadZones();
    }
  };

  const savePricing = async () => {
    if (!pricing) return;
    const { error } = await supabase
      .from('delivery_pricing')
      .update({
        default_base_price: pricing.default_base_price,
        default_price_per_km: pricing.default_price_per_km,
        min_delivery_charge: pricing.min_delivery_charge,
        max_delivery_distance_km: pricing.max_delivery_distance_km,
        free_delivery_threshold: pricing.free_delivery_threshold,
        store_pickup_address: pricing.store_pickup_address,
        updated_at: new Date().toISOString(),
        updated_by: profile?.id,
      })
      .eq('id', pricing.id);
    if (!error) {
      setPricingSaved(true);
      setTimeout(() => setPricingSaved(false), 2000);
    }
  };

  const savePromotion = async () => {
    if (!editingPromotion) return;
    const { error } = editingPromotion.id.startsWith('new-')
      ? await supabase.from('promotions').insert([{
          code: editingPromotion.code,
          name: editingPromotion.name,
          description: editingPromotion.description,
          discount_type: editingPromotion.discount_type,
          discount_value: editingPromotion.discount_value,
          min_order_amount: editingPromotion.min_order_amount,
          max_discount_amount: editingPromotion.max_discount_amount,
          valid_from: editingPromotion.valid_from,
          valid_until: editingPromotion.valid_until,
          usage_limit: editingPromotion.usage_limit,
          is_active: editingPromotion.is_active,
          created_by: profile?.id,
        }])
      : await supabase.from('promotions').update({
          code: editingPromotion.code,
          name: editingPromotion.name,
          description: editingPromotion.description,
          discount_type: editingPromotion.discount_type,
          discount_value: editingPromotion.discount_value,
          min_order_amount: editingPromotion.min_order_amount,
          max_discount_amount: editingPromotion.max_discount_amount,
          valid_from: editingPromotion.valid_from,
          valid_until: editingPromotion.valid_until,
          usage_limit: editingPromotion.usage_limit,
          is_active: editingPromotion.is_active,
        }).eq('id', editingPromotion.id);
    if (!error) {
      setEditingPromotion(null);
      loadPromotions();
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    const table = deleteTarget.type === 'zone' ? 'delivery_zones' : 'promotions';
    const { error } = await supabase.from(table).delete().eq('id', deleteTarget.id);
    if (!error) {
      setDeleteTarget(null);
      if (deleteTarget.type === 'zone') loadZones();
      else loadPromotions();
    }
  };

  const renderZoneForm = () => {
    if (!editingZone) return null;
    const isNew = editingZone.id.startsWith('new-');
    return (
      <ScrollView contentContainerStyle={styles.formScroll} showsVerticalScrollIndicator={false}>
        <View style={styles.formHeader}>
          <TouchableOpacity style={styles.formBackBtn} onPress={() => setEditingZone(null)}>
            <ArrowLeft size={20} color="#ff8c00" />
          </TouchableOpacity>
          <Text style={styles.formTitle}>{isNew ? 'Add Zone' : 'Edit Zone'}</Text>
        </View>

        <View style={styles.formCard}>
          <FormField label="Zone Name" placeholder="e.g., ZONE A, City Center" value={editingZone.name} onChangeText={(t) => setEditingZone({ ...editingZone, name: t })} />
          <FormField label="Description" placeholder="e.g., Covers downtown area" value={editingZone.description} onChangeText={(t) => setEditingZone({ ...editingZone, description: t })} multiline />
          <View style={styles.fieldRow}>
            <View style={styles.fieldHalf}>
              <FormField label="Min Distance (km)" placeholder="0" value={editingZone.min_distance_km === 0 && isNew ? '' : String(editingZone.min_distance_km)} onChangeText={(t) => setEditingZone({ ...editingZone, min_distance_km: parseFloat(t) || 0 })} keyboardType="decimal-pad" />
            </View>
            <View style={styles.fieldHalf}>
              <FormField label="Max Distance (km)" placeholder="5" value={editingZone.max_distance_km === 0 && isNew ? '' : String(editingZone.max_distance_km)} onChangeText={(t) => setEditingZone({ ...editingZone, max_distance_km: parseFloat(t) || 0 })} keyboardType="decimal-pad" />
            </View>
          </View>
          <FormField label="Delivery Price (N)" placeholder="500" value={editingZone.price === 0 && isNew ? '' : String(editingZone.price)} onChangeText={(t) => setEditingZone({ ...editingZone, price: parseFloat(t) || 0 })} keyboardType="decimal-pad" />

          <TouchableOpacity style={styles.toggleRow} onPress={() => setEditingZone({ ...editingZone, is_active: !editingZone.is_active })}>
            {editingZone.is_active ? <ToggleRight size={28} color="#ff8c00" /> : <ToggleLeft size={28} color="#8b909a" />}
            <Text style={[styles.toggleLabel, editingZone.is_active && { color: '#1e293b' }]}>Active</Text>
          </TouchableOpacity>
        </View>

        <TouchableOpacity style={styles.saveBtn} onPress={saveZone}>
          <Check size={18} color="#ffffff" />
          <Text style={styles.saveBtnText}>Save Zone</Text>
        </TouchableOpacity>
      </ScrollView>
    );
  };

  const renderZonesList = () => (
    <ScrollView contentContainerStyle={styles.tabScroll} showsVerticalScrollIndicator={false}>
      <TouchableOpacity
        style={styles.addBtn}
        onPress={() => setEditingZone({
          id: `new-${Date.now()}`,
          name: '',
          description: '',
          min_distance_km: 0,
          max_distance_km: 0,
          price: 0,
          is_active: true,
        })}
      >
        <Plus size={18} color="#ffffff" />
        <Text style={styles.addBtnText}>Add New Zone</Text>
      </TouchableOpacity>

      {zones.length === 0 && (
        <View style={styles.emptyState}>
          <MapPin size={40} color="#d1d5db" />
          <Text style={styles.emptyText}>No delivery zones yet</Text>
        </View>
      )}

      {zones.map((zone) => (
        <View key={zone.id} style={[styles.itemCard, !zone.is_active && styles.itemCardInactive]}>
          <View style={styles.itemCardHeader}>
            <View style={styles.itemNameRow}>
              <View style={[styles.zoneIconWrap, { backgroundColor: zone.is_active ? '#fff7ed' : '#f1f5f9' }]}>
                <MapPin size={16} color={zone.is_active ? '#ff8c00' : '#8b909a'} />
              </View>
              <View style={styles.itemNameCol}>
                <Text style={styles.itemName}>{zone.name}</Text>
                {zone.description ? <Text style={styles.itemDesc} numberOfLines={1}>{zone.description}</Text> : null}
              </View>
            </View>
            <View style={[styles.statusDot, { backgroundColor: zone.is_active ? '#059669' : '#8b909a' }]} />
          </View>

          <View style={styles.itemInfoRow}>
            <View style={styles.infoChip}>
              <Ruler size={12} color="#3b82f6" />
              <Text style={styles.infoChipText}>{zone.min_distance_km}-{zone.max_distance_km} km</Text>
            </View>
            <View style={styles.infoChip}>
              <DollarSign size={12} color="#059669" />
              <Text style={styles.infoChipText}>N{zone.price.toLocaleString()}</Text>
            </View>
          </View>

          <View style={styles.itemActions}>
            <TouchableOpacity style={styles.editItemBtn} onPress={() => setEditingZone(zone)}>
              <Edit3 size={14} color="#ff8c00" />
              <Text style={styles.editItemText}>Edit</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.deleteItemBtn} onPress={() => setDeleteTarget({ type: 'zone', id: zone.id, name: zone.name })}>
              <Trash2 size={14} color="#ef4444" />
              <Text style={styles.deleteItemText}>Delete</Text>
            </TouchableOpacity>
          </View>
        </View>
      ))}
    </ScrollView>
  );

  const renderPricingTab = () => {
    if (!pricing) return null;
    return (
      <ScrollView contentContainerStyle={styles.tabScroll} showsVerticalScrollIndicator={false}>
        <View style={styles.formCard}>
          <Text style={styles.sectionTitle}>Store Pickup Address</Text>
          <Text style={styles.sectionDesc}>This is the store's physical address used as the origin point when calculating delivery distances for customer orders. Include full details and landmarks for accuracy.</Text>
          <FormField
            label="Store / Pickup Address"
            placeholder="e.g., 10 Admiralty Way, near Mega Chicken, Lekki Phase 1, Lagos"
            value={pricing.store_pickup_address || ''}
            onChangeText={(t) => setPricing({ ...pricing, store_pickup_address: t })}
            multiline
          />
        </View>

        <View style={[styles.formCard, { marginTop: 16 }]}>
          <Text style={styles.sectionTitle}>Global Delivery Pricing</Text>
          <Text style={styles.sectionDesc}>These settings apply as defaults when no zone-specific pricing is matched.</Text>

          <PricingField icon={<DollarSign size={16} color="#ff8c00" />} label="Default Base Price (N)" value={String(pricing.default_base_price)} onChangeText={(t) => setPricing({ ...pricing, default_base_price: parseFloat(t) || 0 })} />
          <PricingField icon={<Ruler size={16} color="#3b82f6" />} label="Price per km (N)" value={String(pricing.default_price_per_km)} onChangeText={(t) => setPricing({ ...pricing, default_price_per_km: parseFloat(t) || 0 })} />
          <PricingField icon={<DollarSign size={16} color="#059669" />} label="Minimum Charge (N)" value={String(pricing.min_delivery_charge)} onChangeText={(t) => setPricing({ ...pricing, min_delivery_charge: parseFloat(t) || 0 })} />
          <PricingField icon={<MapPin size={16} color="#ef4444" />} label="Max Distance (km)" value={String(pricing.max_delivery_distance_km)} onChangeText={(t) => setPricing({ ...pricing, max_delivery_distance_km: parseFloat(t) || 0 })} />
          <PricingField icon={<Gift size={16} color="#f59e0b" />} label="Free Delivery Threshold (N)" value={String(pricing.free_delivery_threshold)} onChangeText={(t) => setPricing({ ...pricing, free_delivery_threshold: parseFloat(t) || 0 })} last />
        </View>

        <TouchableOpacity style={[styles.saveBtn, pricingSaved && styles.saveBtnSuccess]} onPress={savePricing}>
          {pricingSaved ? <Check size={18} color="#ffffff" /> : null}
          <Text style={styles.saveBtnText}>{pricingSaved ? 'Saved!' : 'Save Pricing'}</Text>
        </TouchableOpacity>
      </ScrollView>
    );
  };

  const renderPromoForm = () => {
    if (!editingPromotion) return null;
    const isNew = editingPromotion.id.startsWith('new-');
    return (
      <ScrollView contentContainerStyle={styles.formScroll} showsVerticalScrollIndicator={false}>
        <View style={styles.formHeader}>
          <TouchableOpacity style={styles.formBackBtn} onPress={() => setEditingPromotion(null)}>
            <ArrowLeft size={20} color="#ff8c00" />
          </TouchableOpacity>
          <Text style={styles.formTitle}>{isNew ? 'Add Promotion' : 'Edit Promotion'}</Text>
        </View>

        <View style={styles.formCard}>
          <FormField label="Promotion Code" placeholder="SUMMER2026" value={editingPromotion.code} onChangeText={(t) => setEditingPromotion({ ...editingPromotion, code: t.toUpperCase() })} />
          <FormField label="Promotion Name" placeholder="Summer Sale" value={editingPromotion.name} onChangeText={(t) => setEditingPromotion({ ...editingPromotion, name: t })} />
          <FormField label="Description" placeholder="Get discounts on all orders" value={editingPromotion.description} onChangeText={(t) => setEditingPromotion({ ...editingPromotion, description: t })} multiline />

          <Text style={styles.fieldLabel}>Discount Type</Text>
          <View style={styles.typeSelector}>
            {DISCOUNT_TYPES.map((dt) => {
              const isSelected = editingPromotion.discount_type === dt.key;
              const Icon = dt.icon;
              return (
                <TouchableOpacity
                  key={dt.key}
                  style={[styles.typeOption, isSelected && styles.typeOptionActive]}
                  onPress={() => setEditingPromotion({ ...editingPromotion, discount_type: dt.key })}
                >
                  <View style={[styles.typeIconWrap, isSelected && styles.typeIconWrapActive]}>
                    <Icon size={14} color={isSelected ? '#ffffff' : '#8b909a'} />
                  </View>
                  <Text style={[styles.typeOptionText, isSelected && styles.typeOptionTextActive]}>{dt.label}</Text>
                </TouchableOpacity>
              );
            })}
          </View>

          <View style={styles.fieldRow}>
            <View style={styles.fieldHalf}>
              <FormField label="Discount Value" placeholder="10" value={editingPromotion.discount_value === 0 && isNew ? '' : String(editingPromotion.discount_value)} onChangeText={(t) => setEditingPromotion({ ...editingPromotion, discount_value: parseFloat(t) || 0 })} keyboardType="decimal-pad" />
            </View>
            <View style={styles.fieldHalf}>
              <FormField label="Min Order (N)" placeholder="1000" value={editingPromotion.min_order_amount === 0 && isNew ? '' : String(editingPromotion.min_order_amount)} onChangeText={(t) => setEditingPromotion({ ...editingPromotion, min_order_amount: parseFloat(t) || 0 })} keyboardType="decimal-pad" />
            </View>
          </View>

          <FormField label="Usage Limit (0 = unlimited)" placeholder="0" value={String(editingPromotion.usage_limit)} onChangeText={(t) => setEditingPromotion({ ...editingPromotion, usage_limit: parseInt(t) || 0 })} keyboardType="number-pad" />

          <View style={styles.fieldRow}>
            <View style={styles.fieldHalf}>
              <FormField label="Valid From" placeholder="YYYY-MM-DD" value={editingPromotion.valid_from ? new Date(editingPromotion.valid_from).toISOString().split('T')[0] : ''} onChangeText={(t) => { const d = new Date(t); if (!isNaN(d.getTime())) setEditingPromotion({ ...editingPromotion, valid_from: d.toISOString() }); }} />
            </View>
            <View style={styles.fieldHalf}>
              <FormField label="Valid Until" placeholder="YYYY-MM-DD" value={editingPromotion.valid_until ? new Date(editingPromotion.valid_until).toISOString().split('T')[0] : ''} onChangeText={(t) => { const d = new Date(t + 'T23:59:59.999Z'); if (!isNaN(d.getTime())) setEditingPromotion({ ...editingPromotion, valid_until: d.toISOString() }); }} />
            </View>
          </View>

          <TouchableOpacity style={styles.toggleRow} onPress={() => setEditingPromotion({ ...editingPromotion, is_active: !editingPromotion.is_active })}>
            {editingPromotion.is_active ? <ToggleRight size={28} color="#ff8c00" /> : <ToggleLeft size={28} color="#8b909a" />}
            <Text style={[styles.toggleLabel, editingPromotion.is_active && { color: '#1e293b' }]}>Active</Text>
          </TouchableOpacity>
        </View>

        <TouchableOpacity style={styles.saveBtn} onPress={savePromotion}>
          <Check size={18} color="#ffffff" />
          <Text style={styles.saveBtnText}>Save Promotion</Text>
        </TouchableOpacity>
      </ScrollView>
    );
  };

  const renderPromosList = () => (
    <ScrollView contentContainerStyle={styles.tabScroll} showsVerticalScrollIndicator={false}>
      <TouchableOpacity
        style={styles.addBtn}
        onPress={() => {
          const now = new Date();
          const nextMonth = new Date(now);
          nextMonth.setMonth(now.getMonth() + 1);
          nextMonth.setHours(23, 59, 59, 999);
          setEditingPromotion({
            id: `new-${Date.now()}`,
            code: '',
            name: '',
            description: '',
            discount_type: 'percentage',
            discount_value: 0,
            min_order_amount: 0,
            max_discount_amount: 0,
            valid_from: now.toISOString(),
            valid_until: nextMonth.toISOString(),
            usage_limit: 0,
            usage_count: 0,
            is_active: true,
          });
        }}
      >
        <Plus size={18} color="#ffffff" />
        <Text style={styles.addBtnText}>Add New Promotion</Text>
      </TouchableOpacity>

      {promotions.length === 0 && (
        <View style={styles.emptyState}>
          <Tag size={40} color="#d1d5db" />
          <Text style={styles.emptyText}>No promotions yet</Text>
        </View>
      )}

      {promotions.map((promo) => {
        const typeConfig: Record<string, { color: string; icon: any; label: string }> = {
          percentage: { color: '#3b82f6', icon: Percent, label: `${promo.discount_value}%` },
          fixed_amount: { color: '#059669', icon: DollarSign, label: `N${promo.discount_value}` },
          free_delivery: { color: '#f59e0b', icon: Truck, label: 'Free' },
        };
        const tc = typeConfig[promo.discount_type] || typeConfig.percentage;
        const TypeIcon = tc.icon;

        return (
          <View key={promo.id} style={[styles.itemCard, !promo.is_active && styles.itemCardInactive]}>
            <View style={styles.itemCardHeader}>
              <View style={styles.itemNameRow}>
                <View style={[styles.zoneIconWrap, { backgroundColor: `${tc.color}15` }]}>
                  <TypeIcon size={16} color={tc.color} />
                </View>
                <View style={styles.itemNameCol}>
                  <Text style={styles.itemName}>{promo.name}</Text>
                  <View style={styles.promoCodeRow}>
                    <View style={styles.promoCodeBadge}>
                      <Text style={styles.promoCodeText}>{promo.code}</Text>
                    </View>
                    <View style={[styles.discountBadge, { backgroundColor: `${tc.color}15` }]}>
                      <Text style={[styles.discountBadgeText, { color: tc.color }]}>{tc.label}</Text>
                    </View>
                  </View>
                </View>
              </View>
              <View style={[styles.statusDot, { backgroundColor: promo.is_active ? '#059669' : '#8b909a' }]} />
            </View>

            {promo.description ? <Text style={styles.promoDesc} numberOfLines={2}>{promo.description}</Text> : null}

            <View style={styles.itemInfoRow}>
              <View style={styles.infoChip}>
                <DollarSign size={12} color="#8b909a" />
                <Text style={styles.infoChipText}>Min N{promo.min_order_amount.toLocaleString()}</Text>
              </View>
              <View style={styles.infoChip}>
                <Hash size={12} color="#8b909a" />
                <Text style={styles.infoChipText}>{promo.usage_count}/{promo.usage_limit || 'Unlimited'}</Text>
              </View>
              <View style={styles.infoChip}>
                <Calendar size={12} color="#8b909a" />
                <Text style={styles.infoChipText}>{new Date(promo.valid_until).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</Text>
              </View>
            </View>

            <View style={styles.itemActions}>
              <TouchableOpacity style={styles.editItemBtn} onPress={() => setEditingPromotion(promo)}>
                <Edit3 size={14} color="#ff8c00" />
                <Text style={styles.editItemText}>Edit</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.deleteItemBtn} onPress={() => setDeleteTarget({ type: 'promotion', id: promo.id, name: promo.name })}>
                <Trash2 size={14} color="#ef4444" />
                <Text style={styles.deleteItemText}>Delete</Text>
              </TouchableOpacity>
            </View>
          </View>
        );
      })}
    </ScrollView>
  );

  const renderSpeedForm = () => {
    if (!editingSpeed) return null;
    const isNew = editingSpeed.id.startsWith('new-');
    return (
      <ScrollView contentContainerStyle={styles.formScroll} showsVerticalScrollIndicator={false}>
        <View style={styles.formHeader}>
          <TouchableOpacity style={styles.formBackBtn} onPress={() => setEditingSpeed(null)}>
            <ArrowLeft size={20} color="#ff8c00" />
          </TouchableOpacity>
          <Text style={styles.formTitle}>{isNew ? 'Add Speed Option' : 'Edit Speed Option'}</Text>
        </View>

        <View style={styles.formCard}>
          <FormField label="Name (internal)" placeholder="e.g. Express" value={editingSpeed.name} onChangeText={(t) => setEditingSpeed({ ...editingSpeed, name: t })} />
          <FormField label="Label (shown to customer)" placeholder="e.g. Express Delivery" value={editingSpeed.label} onChangeText={(t) => setEditingSpeed({ ...editingSpeed, label: t })} />
          <FormField label="Description" placeholder="e.g. Priority handling and fastest delivery" value={editingSpeed.description} onChangeText={(t) => setEditingSpeed({ ...editingSpeed, description: t })} multiline />
          <FormField label="Estimated Time" placeholder="e.g. 30–60 minutes" value={editingSpeed.estimated_time} onChangeText={(t) => setEditingSpeed({ ...editingSpeed, estimated_time: t })} />
          <View style={styles.fieldRow}>
            <View style={styles.fieldHalf}>
              <FormField label="Additional Cost (₦)" placeholder="0" value={editingSpeed.additional_cost === 0 && isNew ? '' : String(editingSpeed.additional_cost)} onChangeText={(t) => setEditingSpeed({ ...editingSpeed, additional_cost: parseFloat(t) || 0 })} keyboardType="decimal-pad" />
            </View>
            <View style={styles.fieldHalf}>
              <FormField label="Display Order" placeholder="1" value={String(editingSpeed.display_order)} onChangeText={(t) => setEditingSpeed({ ...editingSpeed, display_order: parseInt(t) || 0 })} keyboardType="number-pad" />
            </View>
          </View>

          <TouchableOpacity style={styles.toggleRow} onPress={() => setEditingSpeed({ ...editingSpeed, is_active: !editingSpeed.is_active })}>
            {editingSpeed.is_active ? <ToggleRight size={28} color="#ff8c00" /> : <ToggleLeft size={28} color="#8b909a" />}
            <Text style={[styles.toggleLabel, editingSpeed.is_active && { color: '#1e293b' }]}>Active</Text>
          </TouchableOpacity>
        </View>

        {speedError ? (
          <View style={styles.errorBanner}>
            <AlertTriangle size={14} color="#ef4444" />
            <Text style={styles.errorBannerText}>{speedError}</Text>
          </View>
        ) : null}

        <TouchableOpacity style={[styles.saveBtn, speedSaving && { opacity: 0.7 }]} onPress={saveSpeedOption} disabled={speedSaving}>
          {speedSaving ? <ActivityIndicator size="small" color="#ffffff" /> : <Check size={18} color="#ffffff" />}
          <Text style={styles.saveBtnText}>{speedSaving ? 'Saving...' : 'Save Speed Option'}</Text>
        </TouchableOpacity>
      </ScrollView>
    );
  };

  const renderSpeedList = () => (
    <ScrollView contentContainerStyle={styles.tabScroll} showsVerticalScrollIndicator={false}>
      <View style={styles.speedInfoBanner}>
        <Zap size={16} color="#f97316" />
        <Text style={styles.speedInfoText}>
          These options appear in checkout when a customer chooses delivery. Additional cost is added on top of the zone fee.
        </Text>
      </View>

      <TouchableOpacity
        style={styles.addBtn}
        onPress={() => setEditingSpeed({
          id: `new-${Date.now()}`,
          name: '',
          label: '',
          description: '',
          additional_cost: 0,
          estimated_time: '',
          is_active: true,
          display_order: speedOptions.length + 1,
        })}
      >
        <Plus size={18} color="#ffffff" />
        <Text style={styles.addBtnText}>Add Speed Option</Text>
      </TouchableOpacity>

      {speedOptions.length === 0 && (
        <View style={styles.emptyState}>
          <Zap size={40} color="#d1d5db" />
          <Text style={styles.emptyText}>No speed options yet</Text>
        </View>
      )}

      {speedOptions.map((opt) => (
        <View key={opt.id} style={[styles.itemCard, !opt.is_active && styles.itemCardInactive]}>
          <View style={styles.itemCardHeader}>
            <View style={styles.itemNameRow}>
              <View style={[styles.zoneIconWrap, { backgroundColor: opt.is_active ? '#fff7ed' : '#f1f5f9' }]}>
                <Zap size={16} color={opt.is_active ? '#f97316' : '#8b909a'} />
              </View>
              <View style={styles.itemNameCol}>
                <Text style={styles.itemName}>{opt.label || opt.name}</Text>
                {opt.estimated_time ? <Text style={styles.itemDesc}>{opt.estimated_time}</Text> : null}
              </View>
            </View>
            <View style={[styles.statusDot, { backgroundColor: opt.is_active ? '#059669' : '#8b909a' }]} />
          </View>

          <View style={styles.itemInfoRow}>
            <View style={styles.infoChip}>
              <DollarSign size={12} color="#059669" />
              <Text style={styles.infoChipText}>
                {opt.additional_cost > 0 ? `+₦${opt.additional_cost.toLocaleString()}` : 'Free'}
              </Text>
            </View>
            {opt.description ? (
              <Text style={[styles.itemDesc, { flex: 1 }]} numberOfLines={1}>{opt.description}</Text>
            ) : null}
          </View>

          <View style={styles.itemActions}>
            <TouchableOpacity style={styles.editItemBtn} onPress={() => setEditingSpeed(opt)}>
              <Edit3 size={14} color="#ff8c00" />
              <Text style={styles.editItemText}>Edit</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.deleteItemBtn} onPress={() => deleteSpeedOption(opt.id)}>
              <Trash2 size={14} color="#ef4444" />
              <Text style={styles.deleteItemText}>Delete</Text>
            </TouchableOpacity>
          </View>
        </View>
      ))}
    </ScrollView>
  );

  const renderContent = () => {
    if (activeTab === 'logs') return <DeliveryLogs onBack={() => setActiveTab('zones')} />;

    if (loading) {
      return (
        <View style={styles.loadingWrap}>
          <ActivityIndicator size="large" color="#ff8c00" />
        </View>
      );
    }

    if (activeTab === 'zones') return editingZone ? renderZoneForm() : renderZonesList();
    if (activeTab === 'pricing') return renderPricingTab();
    if (activeTab === 'promotions') return editingPromotion ? renderPromoForm() : renderPromosList();
    if (activeTab === 'speed') return editingSpeed ? renderSpeedForm() : renderSpeedList();
    return null;
  };

  return (
    <View style={styles.container}>
      <View style={[styles.header, { paddingTop: insets.top + 12 }]}>
        <Text style={styles.headerTitle}>Delivery</Text>
        <Text style={styles.headerSubtitle}>Manage zones, pricing & promotions</Text>

        <View style={styles.tabBar}>
          {TABS.map((tab) => {
            const isActive = activeTab === tab.key;
            const Icon = tab.icon;
            return (
              <TouchableOpacity
                key={tab.key}
                style={[styles.tabItem, isActive && styles.tabItemActive]}
                onPress={() => setActiveTab(tab.key)}
              >
                <Icon size={16} color={isActive ? '#ffffff' : 'rgba(255,255,255,0.4)'} />
                <Text style={[styles.tabLabel, isActive && styles.tabLabelActive]}>{tab.label}</Text>
              </TouchableOpacity>
            );
          })}
        </View>
      </View>

      <View style={styles.contentArea}>
        {renderContent()}
      </View>

      <Modal visible={!!deleteTarget} transparent animationType="fade" onRequestClose={() => setDeleteTarget(null)}>
        <View style={styles.modalOverlay}>
          <View style={styles.confirmModal}>
            <View style={styles.confirmIconWrap}>
              <AlertTriangle size={28} color="#ef4444" />
            </View>
            <Text style={styles.confirmTitle}>Delete {deleteTarget?.type === 'zone' ? 'Zone' : 'Promotion'}</Text>
            <Text style={styles.confirmMessage}>
              Are you sure you want to delete "{deleteTarget?.name}"? This cannot be undone.
            </Text>
            <View style={styles.confirmActions}>
              <TouchableOpacity style={styles.cancelBtn} onPress={() => setDeleteTarget(null)}>
                <Text style={styles.cancelBtnText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.confirmDeleteBtn} onPress={handleDelete}>
                <Text style={styles.confirmDeleteText}>Delete</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

function FormField({ label, placeholder, value, onChangeText, multiline, keyboardType }: {
  label: string;
  placeholder: string;
  value: string;
  onChangeText: (t: string) => void;
  multiline?: boolean;
  keyboardType?: 'decimal-pad' | 'number-pad';
}) {
  return (
    <View style={formStyles.field}>
      <Text style={formStyles.label}>{label}</Text>
      <TextInput
        style={[formStyles.input, multiline && formStyles.multilineInput]}
        placeholder={placeholder}
        placeholderTextColor="#b0b5bf"
        value={value}
        onChangeText={onChangeText}
        multiline={multiline}
        numberOfLines={multiline ? 3 : 1}
        textAlignVertical={multiline ? 'top' : 'center'}
        keyboardType={keyboardType}
      />
    </View>
  );
}

function PricingField({ icon, label, value, onChangeText, last }: {
  icon: React.ReactNode;
  label: string;
  value: string;
  onChangeText: (t: string) => void;
  last?: boolean;
}) {
  return (
    <View style={[pricingStyles.field, !last && pricingStyles.fieldBorder]}>
      <View style={pricingStyles.iconWrap}>{icon}</View>
      <View style={pricingStyles.content}>
        <Text style={pricingStyles.label}>{label}</Text>
        <TextInput
          style={pricingStyles.input}
          value={value}
          onChangeText={onChangeText}
          keyboardType="decimal-pad"
          placeholderTextColor="#b0b5bf"
        />
      </View>
    </View>
  );
}

const formStyles = StyleSheet.create({
  field: {
    marginBottom: 16,
  },
  label: {
    fontSize: 13,
    fontFamily: Fonts.semiBold,
    color: '#1e293b',
    marginBottom: 6,
  },
  input: {
    backgroundColor: '#f8f9fb',
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 14,
    fontFamily: Fonts.regular,
    color: '#1e293b',
    borderWidth: 1,
    borderColor: '#e8ecf1',
    outlineStyle: 'none',
  } as any,
  multilineInput: {
    minHeight: 80,
    paddingTop: 12,
  },
});

const pricingStyles = StyleSheet.create({
  field: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    gap: 12,
  },
  fieldBorder: {
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
  },
  iconWrap: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: '#f8f9fb',
    alignItems: 'center',
    justifyContent: 'center',
  },
  content: {
    flex: 1,
  },
  label: {
    fontSize: 12,
    fontFamily: Fonts.medium,
    color: '#8b909a',
    marginBottom: 4,
  },
  input: {
    fontSize: 16,
    fontFamily: Fonts.groteskBold,
    color: '#1e293b',
    padding: 0,
    outlineStyle: 'none',
  } as any,
});

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8f9fb',
  },
  header: {
    backgroundColor: '#1a1d23',
    paddingHorizontal: 20,
    paddingBottom: 0,
    borderBottomLeftRadius: 24,
    borderBottomRightRadius: 24,
  },
  headerTitle: {
    fontSize: 22,
    fontFamily: Fonts.headingBold,
    color: '#ffffff',
  },
  headerSubtitle: {
    fontSize: 13,
    fontFamily: Fonts.medium,
    color: 'rgba(255,255,255,0.5)',
    marginTop: 2,
    marginBottom: 16,
  },
  tabBar: {
    flexDirection: 'row',
    gap: 4,
    marginBottom: -1,
  },
  tabItem: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 12,
    borderTopLeftRadius: 14,
    borderTopRightRadius: 14,
  },
  tabItemActive: {
    backgroundColor: '#f8f9fb',
  },
  tabLabel: {
    fontSize: 13,
    fontFamily: Fonts.semiBold,
    color: 'rgba(255,255,255,0.4)',
  },
  tabLabelActive: {
    color: '#1e293b',
  },
  contentArea: {
    flex: 1,
  },
  loadingWrap: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  tabScroll: {
    padding: 16,
    paddingBottom: 40,
  },
  formScroll: {
    padding: 16,
    paddingBottom: 40,
  },
  formHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 20,
  },
  formBackBtn: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: '#fff7ed',
    alignItems: 'center',
    justifyContent: 'center',
  },
  formTitle: {
    fontSize: 20,
    fontFamily: Fonts.headingBold,
    color: '#1e293b',
  },
  formCard: {
    backgroundColor: '#ffffff',
    borderRadius: 18,
    padding: 18,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 8,
    elevation: 1,
  },
  sectionTitle: {
    fontSize: 17,
    fontFamily: Fonts.headingBold,
    color: '#1e293b',
    marginBottom: 4,
  },
  sectionDesc: {
    fontSize: 13,
    fontFamily: Fonts.regular,
    color: '#8b909a',
    lineHeight: 19,
    marginBottom: 12,
  },
  fieldRow: {
    flexDirection: 'row',
    gap: 12,
  },
  fieldHalf: {
    flex: 1,
  },
  fieldLabel: {
    fontSize: 13,
    fontFamily: Fonts.semiBold,
    color: '#1e293b',
    marginBottom: 8,
  },
  typeSelector: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 16,
  },
  typeOption: {
    flex: 1,
    alignItems: 'center',
    gap: 6,
    paddingVertical: 12,
    borderRadius: 12,
    backgroundColor: '#f8f9fb',
    borderWidth: 1.5,
    borderColor: '#e8ecf1',
  },
  typeOptionActive: {
    backgroundColor: '#fff7ed',
    borderColor: '#ff8c00',
  },
  typeIconWrap: {
    width: 28,
    height: 28,
    borderRadius: 8,
    backgroundColor: '#e8ecf1',
    alignItems: 'center',
    justifyContent: 'center',
  },
  typeIconWrapActive: {
    backgroundColor: '#ff8c00',
  },
  typeOptionText: {
    fontSize: 11,
    fontFamily: Fonts.semiBold,
    color: '#8b909a',
  },
  typeOptionTextActive: {
    color: '#ff8c00',
  },
  toggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginTop: 4,
  },
  toggleLabel: {
    fontSize: 14,
    fontFamily: Fonts.semiBold,
    color: '#8b909a',
  },
  saveBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#ff8c00',
    borderRadius: 14,
    paddingVertical: 16,
    marginTop: 16,
    shadowColor: '#ff8c00',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  saveBtnSuccess: {
    backgroundColor: '#059669',
    shadowColor: '#059669',
  },
  saveBtnText: {
    fontSize: 15,
    fontFamily: Fonts.semiBold,
    color: '#ffffff',
  },
  addBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#ff8c00',
    borderRadius: 14,
    paddingVertical: 14,
    marginBottom: 16,
    shadowColor: '#ff8c00',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 3,
  },
  addBtnText: {
    fontSize: 14,
    fontFamily: Fonts.semiBold,
    color: '#ffffff',
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: 48,
    gap: 12,
  },
  emptyText: {
    fontSize: 15,
    fontFamily: Fonts.medium,
    color: '#8b909a',
  },
  itemCard: {
    backgroundColor: '#ffffff',
    borderRadius: 18,
    padding: 16,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 8,
    elevation: 1,
  },
  itemCardInactive: {
    opacity: 0.6,
  },
  itemCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  itemNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    flex: 1,
  },
  zoneIconWrap: {
    width: 36,
    height: 36,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  itemNameCol: {
    flex: 1,
  },
  itemName: {
    fontSize: 15,
    fontFamily: Fonts.bold,
    color: '#1e293b',
  },
  itemDesc: {
    fontSize: 12,
    fontFamily: Fonts.regular,
    color: '#8b909a',
    marginTop: 2,
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginTop: 6,
  },
  itemInfoRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 12,
    flexWrap: 'wrap',
  },
  infoChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#f8f9fb',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
  },
  infoChipText: {
    fontSize: 12,
    fontFamily: Fonts.groteskMedium,
    color: '#1e293b',
  },
  promoCodeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 4,
  },
  promoCodeBadge: {
    backgroundColor: '#1a1d23',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  promoCodeText: {
    fontSize: 11,
    fontFamily: Fonts.groteskBold,
    color: '#ffffff',
    letterSpacing: 0.5,
  },
  discountBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  discountBadgeText: {
    fontSize: 11,
    fontFamily: Fonts.groteskBold,
  },
  promoDesc: {
    fontSize: 13,
    fontFamily: Fonts.regular,
    color: '#64748b',
    marginTop: 8,
    lineHeight: 19,
  },
  itemActions: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#f1f5f9',
  },
  editItemBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 10,
    borderRadius: 10,
    backgroundColor: '#fff7ed',
  },
  editItemText: {
    fontSize: 13,
    fontFamily: Fonts.semiBold,
    color: '#ff8c00',
  },
  deleteItemBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 10,
    borderRadius: 10,
    backgroundColor: '#fef2f2',
  },
  deleteItemText: {
    fontSize: 13,
    fontFamily: Fonts.semiBold,
    color: '#ef4444',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 32,
  },
  confirmModal: {
    backgroundColor: '#ffffff',
    borderRadius: 24,
    padding: 28,
    width: '100%',
    maxWidth: 360,
    alignItems: 'center',
  },
  confirmIconWrap: {
    width: 60,
    height: 60,
    borderRadius: 20,
    backgroundColor: '#fee2e2',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  confirmTitle: {
    fontSize: 18,
    fontFamily: Fonts.headingBold,
    color: '#1e293b',
    marginBottom: 8,
  },
  confirmMessage: {
    fontSize: 14,
    fontFamily: Fonts.regular,
    color: '#64748b',
    textAlign: 'center',
    lineHeight: 21,
    marginBottom: 24,
  },
  confirmActions: {
    flexDirection: 'row',
    gap: 12,
    width: '100%',
  },
  cancelBtn: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 14,
    backgroundColor: '#f1f5f9',
    alignItems: 'center',
  },
  cancelBtnText: {
    fontSize: 14,
    fontFamily: Fonts.semiBold,
    color: '#64748b',
  },
  confirmDeleteBtn: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 14,
    backgroundColor: '#ef4444',
    alignItems: 'center',
  },
  confirmDeleteText: {
    fontSize: 14,
    fontFamily: Fonts.semiBold,
    color: '#ffffff',
  },
  errorBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#fef2f2',
    borderRadius: 10,
    padding: 12,
    marginTop: 12,
    borderWidth: 1,
    borderColor: '#fecaca',
  },
  errorBannerText: {
    flex: 1,
    fontSize: 13,
    fontFamily: Fonts.regular,
    color: '#ef4444',
  },
  speedInfoBanner: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    backgroundColor: '#fff7ed',
    borderRadius: 12,
    padding: 14,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#fed7aa',
  },
  speedInfoText: {
    flex: 1,
    fontSize: 13,
    fontFamily: Fonts.regular,
    color: '#92400e',
    lineHeight: 18,
  },
});
