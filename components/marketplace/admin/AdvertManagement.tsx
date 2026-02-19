import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  FlatList,
  Modal,
  TextInput,
  ScrollView,
  ActivityIndicator,
  Image,
  Platform,
  Animated,
  Switch,
} from 'react-native';
import {
  Plus,
  Edit3,
  Trash2,
  Image as ImageIcon,
  ExternalLink,
  X,
  Check,
  Megaphone,
  AlertTriangle,
  Eye,
  Clock,
  Zap,
  Upload,
  Link as LinkIcon,
  Tag,
  Timer,
  Percent,
  Ticket,
  Sparkles,
  TrendingUp,
  Star,
  Flame,
  Gift,
  Package,
  ChevronDown,
  ChevronUp,
  Copy,
  Palette,
  FileText,
  BarChart2,
} from 'lucide-react-native';
import * as ImagePicker from 'expo-image-picker';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { supabase } from '@/lib/marketplace/supabase';
import { useToast } from '@/contexts/ToastContext';
import { Fonts } from '@/constants/fonts';
import { LinearGradient } from 'expo-linear-gradient';

type AdvertType = 'promo' | 'flash_sale' | 'announcement' | 'coupon' | 'new_arrival' | 'featured_brand';
type DisplayFrequency = 'once' | 'daily' | 'always';
type DisplayPosition = 'banner' | 'modal' | 'both';

interface Advert {
  id: string;
  title: string;
  description: string;
  image_url?: string;
  action_text?: string;
  action_url?: string;
  is_active: boolean;
  start_date?: string;
  end_date?: string;
  display_frequency: DisplayFrequency;
  display_position: DisplayPosition;
  priority: number;
  hot_deal_text?: string;
  featured_text?: string;
  trending_text?: string;
  limited_offer_text?: string;
  advert_type: AdvertType;
  countdown_end?: string;
  discount_percent?: number;
  original_price?: number;
  promo_price?: number;
  coupon_code?: string;
  coupon_discount?: string;
  bg_color_start?: string;
  bg_color_end?: string;
  terms_text?: string;
  created_at: string;
}

type FormData = {
  title: string;
  description: string;
  image_url: string;
  action_text: string;
  action_url: string;
  is_active: boolean;
  start_date: string;
  end_date: string;
  display_frequency: DisplayFrequency;
  display_position: DisplayPosition;
  priority: string;
  hot_deal_text: string;
  featured_text: string;
  trending_text: string;
  limited_offer_text: string;
  advert_type: AdvertType;
  countdown_end: string;
  discount_percent: string;
  original_price: string;
  promo_price: string;
  coupon_code: string;
  coupon_discount: string;
  bg_color_start: string;
  bg_color_end: string;
  terms_text: string;
};

const EMPTY_FORM: FormData = {
  title: '',
  description: '',
  image_url: '',
  action_text: '',
  action_url: '',
  is_active: true,
  start_date: '',
  end_date: '',
  display_frequency: 'daily',
  display_position: 'both',
  priority: '0',
  hot_deal_text: 'HOT DEAL',
  featured_text: 'Featured',
  trending_text: 'Trending Now',
  limited_offer_text: 'Limited Time Offer',
  advert_type: 'promo',
  countdown_end: '',
  discount_percent: '',
  original_price: '',
  promo_price: '',
  coupon_code: '',
  coupon_discount: '',
  bg_color_start: '',
  bg_color_end: '',
  terms_text: '',
};

const ADVERT_TYPES: { key: AdvertType; label: string; icon: any; color: string; bg: string; desc: string }[] = [
  { key: 'promo', label: 'Promo', icon: Tag, color: '#ff8c00', bg: '#fff7ed', desc: 'General promotion' },
  { key: 'flash_sale', label: 'Flash Sale', icon: Zap, color: '#ef4444', bg: '#fef2f2', desc: 'Timed sale with countdown' },
  { key: 'announcement', label: 'Announce', icon: Megaphone, color: '#3b82f6', bg: '#eff6ff', desc: 'News & updates' },
  { key: 'coupon', label: 'Coupon', icon: Ticket, color: '#8b5cf6', bg: '#f5f3ff', desc: 'Copyable promo code' },
  { key: 'new_arrival', label: 'New', icon: Sparkles, color: '#10b981', bg: '#f0fdf4', desc: 'New products/collections' },
  { key: 'featured_brand', label: 'Brand', icon: Star, color: '#f59e0b', bg: '#fefce8', desc: 'Spotlight a brand' },
];

const FREQ_OPTIONS: { key: DisplayFrequency; label: string; icon: any }[] = [
  { key: 'once', label: 'Once', icon: Eye },
  { key: 'daily', label: 'Daily', icon: Clock },
  { key: 'always', label: 'Always', icon: Zap },
];

const POS_OPTIONS: { key: DisplayPosition; label: string; desc: string }[] = [
  { key: 'banner', label: 'Banner', desc: 'Slider only' },
  { key: 'modal', label: 'Popup', desc: 'Modal only' },
  { key: 'both', label: 'Both', desc: 'Slider + popup' },
];

const PRESET_COLORS: string[][] = [
  ['#ff8c00', '#f97316'],
  ['#ef4444', '#dc2626'],
  ['#3b82f6', '#2563eb'],
  ['#10b981', '#059669'],
  ['#8b5cf6', '#7c3aed'],
  ['#f59e0b', '#d97706'],
  ['#1a1d23', '#374151'],
  ['#ec4899', '#db2777'],
];

function getTypeConfig(type: AdvertType) {
  return ADVERT_TYPES.find((t) => t.key === type) ?? ADVERT_TYPES[0];
}

function formatCountdown(endDate: string): string {
  const diff = new Date(endDate).getTime() - Date.now();
  if (diff <= 0) return 'Ended';
  const h = Math.floor(diff / 3600000);
  const m = Math.floor((diff % 3600000) / 60000);
  return `${h}h ${m}m left`;
}

export default function AdvertManagement() {
  const insets = useSafeAreaInsets();
  const { showToast } = useToast();
  const [adverts, setAdverts] = useState<Advert[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingAdvert, setEditingAdvert] = useState<Advert | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Advert | null>(null);
  const [togglingId, setTogglingId] = useState<string | null>(null);
  const [formData, setFormData] = useState<FormData>(EMPTY_FORM);
  const [localImageUri, setLocalImageUri] = useState<string | null>(null);
  const [uploadingImage, setUploadingImage] = useState(false);
  const [saving, setSaving] = useState(false);
  const [activeSection, setActiveSection] = useState<string | null>('basic');
  const [filterType, setFilterType] = useState<AdvertType | 'all'>('all');
  const [previewVisible, setPreviewVisible] = useState(false);

  useEffect(() => { fetchAdverts(); }, []);

  const fetchAdverts = useCallback(async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('adverts')
        .select('*')
        .order('priority', { ascending: false })
        .order('created_at', { ascending: false });
      if (error) throw error;
      setAdverts(data || []);
    } catch (error: any) {
      showToast(error.message || 'Error fetching adverts', 'error');
    } finally {
      setLoading(false);
    }
  }, []);

  const openAddModal = () => {
    setEditingAdvert(null);
    setLocalImageUri(null);
    setFormData(EMPTY_FORM);
    setActiveSection('basic');
    setShowModal(true);
  };

  const openEditModal = (advert: Advert) => {
    setEditingAdvert(advert);
    setLocalImageUri(null);
    setFormData({
      title: advert.title,
      description: advert.description,
      image_url: advert.image_url || '',
      action_text: advert.action_text || '',
      action_url: advert.action_url || '',
      is_active: advert.is_active,
      start_date: advert.start_date || '',
      end_date: advert.end_date || '',
      display_frequency: advert.display_frequency,
      display_position: advert.display_position ?? 'both',
      priority: String(advert.priority),
      hot_deal_text: advert.hot_deal_text || 'HOT DEAL',
      featured_text: advert.featured_text || 'Featured',
      trending_text: advert.trending_text || 'Trending Now',
      limited_offer_text: advert.limited_offer_text || 'Limited Time Offer',
      advert_type: advert.advert_type ?? 'promo',
      countdown_end: advert.countdown_end || '',
      discount_percent: advert.discount_percent != null ? String(advert.discount_percent) : '',
      original_price: advert.original_price != null ? String(advert.original_price) : '',
      promo_price: advert.promo_price != null ? String(advert.promo_price) : '',
      coupon_code: advert.coupon_code || '',
      coupon_discount: advert.coupon_discount || '',
      bg_color_start: advert.bg_color_start || '',
      bg_color_end: advert.bg_color_end || '',
      terms_text: advert.terms_text || '',
    });
    setActiveSection('basic');
    setShowModal(true);
  };

  const pickImageFromLibrary = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') { showToast('Permission to access photos is required', 'error'); return; }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [16, 9],
      quality: 0.85,
    });
    if (!result.canceled && result.assets[0]) {
      setLocalImageUri(result.assets[0].uri);
      setFormData((prev) => ({ ...prev, image_url: '' }));
    }
  };

  const uploadAdvertImage = async (uri: string): Promise<string | null> => {
    try {
      setUploadingImage(true);
      let fileData: ArrayBuffer | Blob;
      let contentType = 'image/jpeg';
      let fileExt = 'jpg';
      if (Platform.OS === 'web') {
        const response = await fetch(uri);
        fileData = await response.blob();
        const blobType = (fileData as Blob).type;
        if (blobType) { contentType = blobType; fileExt = blobType.split('/')[1] || 'jpg'; }
      } else {
        const response = await fetch(uri);
        fileData = await response.arrayBuffer();
        if (uri.toLowerCase().includes('.png')) { contentType = 'image/png'; fileExt = 'png'; }
        else if (uri.toLowerCase().includes('.webp')) { contentType = 'image/webp'; fileExt = 'webp'; }
      }
      const filePath = `adverts/advert_${Date.now()}.${fileExt}`;
      const { error: uploadError } = await supabase.storage.from('advert-images').upload(filePath, fileData, { contentType, upsert: false });
      if (uploadError) throw uploadError;
      const { data: urlData } = supabase.storage.from('advert-images').getPublicUrl(filePath);
      return urlData.publicUrl;
    } catch (error: any) {
      showToast(error.message || 'Failed to upload image', 'error');
      return null;
    } finally {
      setUploadingImage(false);
    }
  };

  const handleSave = async () => {
    if (!formData.title.trim() || !formData.description.trim()) {
      showToast('Please fill in title and description', 'error');
      return;
    }
    try {
      setSaving(true);
      let finalImageUrl = formData.image_url || null;
      if (localImageUri) {
        const uploadedUrl = await uploadAdvertImage(localImageUri);
        if (!uploadedUrl) return;
        finalImageUrl = uploadedUrl;
      }
      const advertData = {
        title: formData.title,
        description: formData.description,
        image_url: finalImageUrl,
        action_text: formData.action_text || null,
        action_url: formData.action_url || null,
        is_active: formData.is_active,
        start_date: formData.start_date || null,
        end_date: formData.end_date || null,
        display_frequency: formData.display_frequency,
        display_position: formData.display_position,
        priority: parseInt(formData.priority) || 0,
        hot_deal_text: formData.hot_deal_text || 'HOT DEAL',
        featured_text: formData.featured_text || 'Featured',
        trending_text: formData.trending_text || 'Trending Now',
        limited_offer_text: formData.limited_offer_text || 'Limited Time Offer',
        advert_type: formData.advert_type,
        countdown_end: formData.countdown_end || null,
        discount_percent: formData.discount_percent ? parseInt(formData.discount_percent) : null,
        original_price: formData.original_price ? parseFloat(formData.original_price) : null,
        promo_price: formData.promo_price ? parseFloat(formData.promo_price) : null,
        coupon_code: formData.coupon_code.trim().toUpperCase() || null,
        coupon_discount: formData.coupon_discount || null,
        bg_color_start: formData.bg_color_start || null,
        bg_color_end: formData.bg_color_end || null,
        terms_text: formData.terms_text || null,
      };
      if (editingAdvert) {
        const { error } = await supabase.from('adverts').update(advertData).eq('id', editingAdvert.id);
        if (error) throw error;
        showToast('Advert updated successfully', 'success');
      } else {
        const { error } = await supabase.from('adverts').insert([advertData]);
        if (error) throw error;
        showToast('Advert created successfully', 'success');
      }
      setShowModal(false);
      fetchAdverts();
    } catch (error: any) {
      showToast(error.message || 'Error saving advert', 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    try {
      const { error } = await supabase.from('adverts').delete().eq('id', deleteTarget.id);
      if (error) throw error;
      showToast('Advert deleted', 'success');
      setDeleteTarget(null);
      fetchAdverts();
    } catch (error: any) {
      showToast(error.message || 'Error deleting advert', 'error');
    }
  };

  const toggleActive = async (advert: Advert) => {
    try {
      setTogglingId(advert.id);
      const { error } = await supabase.from('adverts').update({ is_active: !advert.is_active }).eq('id', advert.id);
      if (error) throw error;
      setAdverts((prev) => prev.map((a) => a.id === advert.id ? { ...a, is_active: !a.is_active } : a));
      showToast(`Advert ${!advert.is_active ? 'activated' : 'deactivated'}`, 'success');
    } catch (error: any) {
      showToast(error.message || 'Error updating advert', 'error');
    } finally {
      setTogglingId(null);
    }
  };

  const filteredAdverts = filterType === 'all' ? adverts : adverts.filter((a) => a.advert_type === filterType);
  const activeCount = adverts.filter((a) => a.is_active).length;

  const renderAdvert = ({ item }: { item: Advert }) => {
    const cfg = getTypeConfig(item.advert_type);
    const TypeIcon = cfg.icon;
    const isToggling = togglingId === item.id;
    const hasCountdown = item.advert_type === 'flash_sale' && item.countdown_end;
    const gradColors: [string, string] = item.bg_color_start && item.bg_color_end
      ? [item.bg_color_start, item.bg_color_end]
      : ['#1a1d23', '#2d3748'];

    return (
      <View style={[styles.card, !item.is_active && styles.cardInactive]}>
        {item.image_url ? (
          <View style={styles.cardImgWrap}>
            <Image source={{ uri: item.image_url }} style={styles.cardImg} resizeMode="cover" />
            <LinearGradient colors={['transparent', 'rgba(0,0,0,0.65)']} style={styles.cardImgOverlay} />
            {item.discount_percent && (
              <View style={styles.discountBadge}>
                <Text style={styles.discountBadgeText}>-{item.discount_percent}%</Text>
              </View>
            )}
            <View style={[styles.typeBadgeOnImg, { backgroundColor: cfg.color }]}>
              <TypeIcon size={10} color="#fff" />
              <Text style={styles.typeBadgeOnImgText}>{cfg.label}</Text>
            </View>
          </View>
        ) : (
          <LinearGradient colors={gradColors} style={styles.cardImgPlaceholder} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}>
            <View style={[styles.placeholderIconWrap, { backgroundColor: cfg.bg }]}>
              <TypeIcon size={22} color={cfg.color} />
            </View>
            {item.discount_percent && (
              <View style={styles.discountBadge}>
                <Text style={styles.discountBadgeText}>-{item.discount_percent}%</Text>
              </View>
            )}
          </LinearGradient>
        )}

        <View style={styles.cardBody}>
          <View style={styles.cardTitleRow}>
            <Text style={styles.cardTitle} numberOfLines={1}>{item.title}</Text>
            <View style={[styles.activeDot, { backgroundColor: item.is_active ? '#059669' : '#d1d5db' }]} />
          </View>
          <Text style={styles.cardDesc} numberOfLines={2}>{item.description}</Text>

          {hasCountdown && item.countdown_end && (
            <View style={styles.countdownRow}>
              <Timer size={12} color="#ef4444" />
              <Text style={styles.countdownText}>{formatCountdown(item.countdown_end)}</Text>
            </View>
          )}

          {item.coupon_code && (
            <View style={styles.couponRow}>
              <Ticket size={12} color="#8b5cf6" />
              <Text style={styles.couponCode}>{item.coupon_code}</Text>
              {item.coupon_discount && <Text style={styles.couponDiscount}>{item.coupon_discount}</Text>}
            </View>
          )}

          {(item.original_price || item.promo_price) && (
            <View style={styles.priceRow}>
              {item.promo_price && <Text style={styles.promoPrice}>₦{Number(item.promo_price).toLocaleString()}</Text>}
              {item.original_price && <Text style={styles.originalPrice}>₦{Number(item.original_price).toLocaleString()}</Text>}
            </View>
          )}

          <View style={styles.chipsRow}>
            <View style={[styles.chip, { backgroundColor: cfg.bg }]}>
              <TypeIcon size={10} color={cfg.color} />
              <Text style={[styles.chipText, { color: cfg.color }]}>{cfg.label}</Text>
            </View>
            <View style={styles.chip}>
              <Clock size={10} color="#8b909a" />
              <Text style={styles.chipText}>{item.display_frequency}</Text>
            </View>
            <View style={styles.chip}>
              <Eye size={10} color="#8b909a" />
              <Text style={styles.chipText}>{item.display_position ?? 'both'}</Text>
            </View>
            <View style={styles.chip}>
              <BarChart2 size={10} color="#8b909a" />
              <Text style={styles.chipText}>P{item.priority}</Text>
            </View>
          </View>

          <View style={styles.cardActions}>
            <TouchableOpacity style={styles.toggleBtn} onPress={() => toggleActive(item)} disabled={isToggling}>
              {isToggling ? (
                <ActivityIndicator size="small" color="#ff8c00" />
              ) : (
                <View style={[styles.togglePill, { backgroundColor: item.is_active ? '#dcfce7' : '#f1f5f9' }]}>
                  <View style={[styles.toggleDot, { backgroundColor: item.is_active ? '#059669' : '#94a3b8' }]} />
                  <Text style={[styles.togglePillText, { color: item.is_active ? '#059669' : '#64748b' }]}>
                    {item.is_active ? 'Active' : 'Inactive'}
                  </Text>
                </View>
              )}
            </TouchableOpacity>
            <TouchableOpacity style={styles.actionBtn} onPress={() => openEditModal(item)}>
              <Edit3 size={15} color="#ff8c00" />
            </TouchableOpacity>
            <TouchableOpacity style={[styles.actionBtn, styles.actionBtnDanger]} onPress={() => setDeleteTarget(item)}>
              <Trash2 size={15} color="#ef4444" />
            </TouchableOpacity>
          </View>
        </View>
      </View>
    );
  };

  if (loading) {
    return (
      <View style={styles.loadingWrap}>
        <ActivityIndicator size="large" color="#ff8c00" />
      </View>
    );
  }

  const toggleSection = (key: string) => setActiveSection(activeSection === key ? null : key);

  return (
    <View style={styles.container}>
      <View style={[styles.header, { paddingTop: insets.top + 12 }]}>
        <View style={styles.headerTopRow}>
          <View>
            <Text style={styles.headerTitle}>Adverts & Promos</Text>
            <Text style={styles.headerSub}>{adverts.length} total · {activeCount} active</Text>
          </View>
          <TouchableOpacity style={styles.addBtn} onPress={openAddModal}>
            <Plus size={18} color="#fff" strokeWidth={2.5} />
            <Text style={styles.addBtnText}>Create</Text>
          </TouchableOpacity>
        </View>

        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.typeFilter} contentContainerStyle={styles.typeFilterContent}>
          <TouchableOpacity
            style={[styles.typeFilterChip, filterType === 'all' && styles.typeFilterChipActive]}
            onPress={() => setFilterType('all')}
          >
            <Text style={[styles.typeFilterChipText, filterType === 'all' && styles.typeFilterChipTextActive]}>All ({adverts.length})</Text>
          </TouchableOpacity>
          {ADVERT_TYPES.map((t) => {
            const count = adverts.filter((a) => a.advert_type === t.key).length;
            const Icon = t.icon;
            return (
              <TouchableOpacity
                key={t.key}
                style={[styles.typeFilterChip, filterType === t.key && styles.typeFilterChipActive]}
                onPress={() => setFilterType(t.key)}
              >
                <Icon size={11} color={filterType === t.key ? '#fff' : t.color} />
                <Text style={[styles.typeFilterChipText, filterType === t.key && styles.typeFilterChipTextActive]}>{t.label} ({count})</Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      </View>

      <FlatList
        data={filteredAdverts}
        keyExtractor={(item) => item.id}
        renderItem={renderAdvert}
        contentContainerStyle={styles.list}
        showsVerticalScrollIndicator={false}
        ListEmptyComponent={
          <View style={styles.emptyWrap}>
            <View style={styles.emptyIconCircle}>
              <Megaphone size={40} color="#d1d5db" />
            </View>
            <Text style={styles.emptyTitle}>No adverts yet</Text>
            <Text style={styles.emptyDesc}>Create your first advert to start promoting deals and announcements to customers.</Text>
            <TouchableOpacity style={styles.emptyCreateBtn} onPress={openAddModal}>
              <Plus size={16} color="#fff" />
              <Text style={styles.emptyCreateBtnText}>Create First Advert</Text>
            </TouchableOpacity>
          </View>
        }
      />

      <Modal visible={showModal} animationType="slide" transparent onRequestClose={() => setShowModal(false)}>
        <View style={styles.sheetOverlay}>
          <TouchableOpacity style={styles.sheetBackdrop} onPress={() => setShowModal(false)} />
          <View style={[styles.sheetContainer, { paddingBottom: insets.bottom + 20 }]}>
            <View style={styles.sheetHandle} />
            <View style={styles.sheetHeader}>
              <Text style={styles.sheetTitle}>{editingAdvert ? 'Edit Advert' : 'New Advert'}</Text>
              <TouchableOpacity onPress={() => setShowModal(false)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                <X size={22} color="#64748b" />
              </TouchableOpacity>
            </View>

            <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.formScrollContent}>
              <FormSection
                title="Basic Info"
                icon={<FileText size={15} color="#ff8c00" />}
                expanded={activeSection === 'basic'}
                onToggle={() => toggleSection('basic')}
              >
                <Text style={styles.fieldLabel}>Advert Type</Text>
                <View style={styles.typeGrid}>
                  {ADVERT_TYPES.map((t) => {
                    const Icon = t.icon;
                    const active = formData.advert_type === t.key;
                    return (
                      <TouchableOpacity
                        key={t.key}
                        style={[styles.typeOption, active && { borderColor: t.color, backgroundColor: t.bg }]}
                        onPress={() => setFormData((p) => ({ ...p, advert_type: t.key }))}
                        activeOpacity={0.8}
                      >
                        <Icon size={16} color={active ? t.color : '#94a3b8'} />
                        <Text style={[styles.typeOptionLabel, active && { color: t.color }]}>{t.label}</Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>

                <FFField label="Title *" placeholder="e.g. Mega Flash Sale — Up to 70% Off!" value={formData.title} onChangeText={(t) => setFormData((p) => ({ ...p, title: t }))} />
                <FFField label="Description" placeholder="Grab deals before they're gone. Shop now and save big!" value={formData.description} onChangeText={(t) => setFormData((p) => ({ ...p, description: t }))} multiline />

                <Text style={styles.fieldLabel}>Advert Image</Text>
                {(localImageUri || formData.image_url) ? (
                  <View style={styles.imgPreviewWrap}>
                    <Image source={{ uri: localImageUri || formData.image_url }} style={styles.imgPreview} resizeMode="cover" />
                    <TouchableOpacity style={styles.imgRemoveBtn} onPress={() => { setLocalImageUri(null); setFormData((p) => ({ ...p, image_url: '' })); }}>
                      <X size={13} color="#fff" strokeWidth={2.5} />
                    </TouchableOpacity>
                    {localImageUri && <View style={styles.localBadge}><Text style={styles.localBadgeText}>Local</Text></View>}
                  </View>
                ) : null}
                <View style={styles.imgSourceRow}>
                  <TouchableOpacity style={styles.imgUploadBtn} onPress={pickImageFromLibrary}>
                    <Upload size={14} color="#ff8c00" />
                    <Text style={styles.imgUploadText}>Upload</Text>
                  </TouchableOpacity>
                  <Text style={styles.orText}>or</Text>
                  <View style={styles.imgUrlWrap}>
                    <LinkIcon size={13} color="#94a3b8" />
                    <TextInput
                      style={styles.imgUrlInput}
                      placeholder="Paste image URL"
                      placeholderTextColor="#b0b5bf"
                      value={formData.image_url}
                      onChangeText={(t) => { setFormData((p) => ({ ...p, image_url: t })); if (t) setLocalImageUri(null); }}
                      autoCapitalize="none"
                      keyboardType="url"
                    />
                  </View>
                </View>

                <View style={styles.halfRow}>
                  <View style={styles.half}>
                    <FFField label="CTA Button Text" placeholder="Shop Now" value={formData.action_text} onChangeText={(t) => setFormData((p) => ({ ...p, action_text: t }))} />
                  </View>
                  <View style={styles.half}>
                    <FFField label="CTA Link (URL)" placeholder="https://..." value={formData.action_url} onChangeText={(t) => setFormData((p) => ({ ...p, action_url: t }))} />
                  </View>
                </View>
              </FormSection>

              <FormSection
                title="Pricing & Discount"
                icon={<Percent size={15} color="#ef4444" />}
                expanded={activeSection === 'pricing'}
                onToggle={() => toggleSection('pricing')}
              >
                <FFField label="Discount Percent (%)" placeholder="e.g. 50" value={formData.discount_percent} onChangeText={(t) => setFormData((p) => ({ ...p, discount_percent: t.replace(/[^0-9]/g, '') }))} keyboardType="number-pad" />
                <View style={styles.halfRow}>
                  <View style={styles.half}>
                    <FFField label="Original Price (₦)" placeholder="e.g. 20000" value={formData.original_price} onChangeText={(t) => setFormData((p) => ({ ...p, original_price: t.replace(/[^0-9.]/g, '') }))} keyboardType="decimal-pad" />
                  </View>
                  <View style={styles.half}>
                    <FFField label="Promo Price (₦)" placeholder="e.g. 10000" value={formData.promo_price} onChangeText={(t) => setFormData((p) => ({ ...p, promo_price: t.replace(/[^0-9.]/g, '') }))} keyboardType="decimal-pad" />
                  </View>
                </View>
              </FormSection>

              <FormSection
                title="Coupon Code"
                icon={<Ticket size={15} color="#8b5cf6" />}
                expanded={activeSection === 'coupon'}
                onToggle={() => toggleSection('coupon')}
              >
                <View style={styles.halfRow}>
                  <View style={styles.half}>
                    <FFField label="Coupon Code" placeholder="SAVE20" value={formData.coupon_code} onChangeText={(t) => setFormData((p) => ({ ...p, coupon_code: t.toUpperCase() }))} />
                  </View>
                  <View style={styles.half}>
                    <FFField label="Discount Label" placeholder="₦500 OFF" value={formData.coupon_discount} onChangeText={(t) => setFormData((p) => ({ ...p, coupon_discount: t }))} />
                  </View>
                </View>
                <Text style={styles.fieldHint}>Customers will see a tap-to-copy code on the advert</Text>
              </FormSection>

              <FormSection
                title="Flash Sale Countdown"
                icon={<Timer size={15} color="#ef4444" />}
                expanded={activeSection === 'countdown'}
                onToggle={() => toggleSection('countdown')}
              >
                <FFField
                  label="Sale Ends At (ISO date)"
                  placeholder={new Date(Date.now() + 86400000).toISOString().slice(0, 16)}
                  value={formData.countdown_end}
                  onChangeText={(t) => setFormData((p) => ({ ...p, countdown_end: t }))}
                />
                <Text style={styles.fieldHint}>Enter an ISO datetime e.g. 2026-02-25T23:59:00. A live countdown timer shows on the advert.</Text>
              </FormSection>

              <FormSection
                title="Display Settings"
                icon={<Eye size={15} color="#3b82f6" />}
                expanded={activeSection === 'display'}
                onToggle={() => toggleSection('display')}
              >
                <Text style={styles.fieldLabel}>Display Position</Text>
                <View style={styles.segRow}>
                  {POS_OPTIONS.map((opt) => (
                    <TouchableOpacity
                      key={opt.key}
                      style={[styles.segItem, formData.display_position === opt.key && styles.segItemActive]}
                      onPress={() => setFormData((p) => ({ ...p, display_position: opt.key }))}
                      activeOpacity={0.8}
                    >
                      <Text style={[styles.segLabel, formData.display_position === opt.key && styles.segLabelActive]}>{opt.label}</Text>
                      <Text style={[styles.segDesc, formData.display_position === opt.key && styles.segDescActive]}>{opt.desc}</Text>
                    </TouchableOpacity>
                  ))}
                </View>

                <Text style={[styles.fieldLabel, { marginTop: 12 }]}>Display Frequency</Text>
                <View style={styles.freqRow}>
                  {FREQ_OPTIONS.map((opt) => {
                    const Icon = opt.icon;
                    const active = formData.display_frequency === opt.key;
                    return (
                      <TouchableOpacity
                        key={opt.key}
                        style={[styles.freqOption, active && styles.freqOptionActive]}
                        onPress={() => setFormData((p) => ({ ...p, display_frequency: opt.key }))}
                      >
                        <Icon size={15} color={active ? '#fff' : '#8b909a'} />
                        <Text style={[styles.freqText, active && styles.freqTextActive]}>{opt.label}</Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>

                <FFField label="Priority (higher = shown first)" placeholder="0" value={formData.priority} onChangeText={(t) => setFormData((p) => ({ ...p, priority: t.replace(/[^0-9]/g, '') }))} keyboardType="number-pad" />

                <View style={styles.halfRow}>
                  <View style={styles.half}>
                    <FFField label="Start Date" placeholder="2026-01-01" value={formData.start_date} onChangeText={(t) => setFormData((p) => ({ ...p, start_date: t }))} />
                  </View>
                  <View style={styles.half}>
                    <FFField label="End Date" placeholder="2026-12-31" value={formData.end_date} onChangeText={(t) => setFormData((p) => ({ ...p, end_date: t }))} />
                  </View>
                </View>

                <View style={styles.activeToggleRow}>
                  <View>
                    <Text style={styles.fieldLabel}>Active</Text>
                    <Text style={styles.fieldHint}>Show this advert to customers</Text>
                  </View>
                  <Switch
                    value={formData.is_active}
                    onValueChange={(v) => setFormData((p) => ({ ...p, is_active: v }))}
                    trackColor={{ false: '#e2e8f0', true: '#fed7aa' }}
                    thumbColor={formData.is_active ? '#ff8c00' : '#94a3b8'}
                  />
                </View>
              </FormSection>

              <FormSection
                title="Visual Style"
                icon={<Palette size={15} color="#10b981" />}
                expanded={activeSection === 'style'}
                onToggle={() => toggleSection('style')}
              >
                <Text style={styles.fieldLabel}>Badge Labels</Text>
                <View style={styles.halfRow}>
                  <View style={styles.half}>
                    <FFField label="Hot Deal Badge" placeholder="HOT DEAL" value={formData.hot_deal_text} onChangeText={(t) => setFormData((p) => ({ ...p, hot_deal_text: t }))} />
                  </View>
                  <View style={styles.half}>
                    <FFField label="Featured Badge" placeholder="Featured" value={formData.featured_text} onChangeText={(t) => setFormData((p) => ({ ...p, featured_text: t }))} />
                  </View>
                </View>
                <View style={styles.halfRow}>
                  <View style={styles.half}>
                    <FFField label="Trending Badge" placeholder="Trending Now" value={formData.trending_text} onChangeText={(t) => setFormData((p) => ({ ...p, trending_text: t }))} />
                  </View>
                  <View style={styles.half}>
                    <FFField label="Limited Offer" placeholder="Limited Time Offer" value={formData.limited_offer_text} onChangeText={(t) => setFormData((p) => ({ ...p, limited_offer_text: t }))} />
                  </View>
                </View>

                <Text style={[styles.fieldLabel, { marginTop: 4 }]}>Background Gradient (when no image)</Text>
                <View style={styles.colorPresetsRow}>
                  {PRESET_COLORS.map(([start, end], i) => (
                    <TouchableOpacity
                      key={i}
                      style={[
                        styles.colorPreset,
                        formData.bg_color_start === start && styles.colorPresetActive,
                      ]}
                      onPress={() => setFormData((p) => ({ ...p, bg_color_start: start, bg_color_end: end }))}
                    >
                      <LinearGradient colors={[start, end]} style={styles.colorPresetGrad} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} />
                      {formData.bg_color_start === start && <View style={styles.colorPresetCheck}><Check size={10} color="#fff" /></View>}
                    </TouchableOpacity>
                  ))}
                </View>
                <View style={styles.halfRow}>
                  <View style={styles.half}>
                    <FFField label="Custom Gradient Start" placeholder="#ff8c00" value={formData.bg_color_start} onChangeText={(t) => setFormData((p) => ({ ...p, bg_color_start: t }))} />
                  </View>
                  <View style={styles.half}>
                    <FFField label="Custom Gradient End" placeholder="#f97316" value={formData.bg_color_end} onChangeText={(t) => setFormData((p) => ({ ...p, bg_color_end: t }))} />
                  </View>
                </View>

                <FFField label="Terms / Small Print" placeholder="*T&Cs apply. While stocks last." value={formData.terms_text} onChangeText={(t) => setFormData((p) => ({ ...p, terms_text: t }))} multiline />
              </FormSection>

              <View style={styles.formBtns}>
                <TouchableOpacity style={styles.cancelBtn} onPress={() => setShowModal(false)}>
                  <Text style={styles.cancelBtnText}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.saveBtn, (saving || uploadingImage) && { opacity: 0.7 }]}
                  onPress={handleSave}
                  disabled={saving || uploadingImage}
                >
                  {saving || uploadingImage ? (
                    <ActivityIndicator size="small" color="#fff" />
                  ) : (
                    <Check size={17} color="#fff" strokeWidth={2.5} />
                  )}
                  <Text style={styles.saveBtnText}>{saving || uploadingImage ? 'Saving...' : editingAdvert ? 'Save Changes' : 'Create Advert'}</Text>
                </TouchableOpacity>
              </View>
            </ScrollView>
          </View>
        </View>
      </Modal>

      <Modal visible={!!deleteTarget} transparent animationType="fade" onRequestClose={() => setDeleteTarget(null)}>
        <View style={styles.deleteOverlay}>
          <View style={styles.deleteModal}>
            <View style={styles.deleteIconWrap}>
              <AlertTriangle size={28} color="#ef4444" />
            </View>
            <Text style={styles.deleteTitle}>Delete Advert</Text>
            <Text style={styles.deleteMsg}>Delete "{deleteTarget?.title}"? This cannot be undone.</Text>
            <View style={styles.deleteActions}>
              <TouchableOpacity style={styles.deleteCancelBtn} onPress={() => setDeleteTarget(null)}>
                <Text style={styles.deleteCancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.deleteConfirmBtn} onPress={handleDelete}>
                <Text style={styles.deleteConfirmText}>Delete</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

function FormSection({ title, icon, expanded, onToggle, children }: {
  title: string; icon: React.ReactNode; expanded: boolean; onToggle: () => void; children: React.ReactNode;
}) {
  return (
    <View style={sectionStyles.wrap}>
      <TouchableOpacity style={sectionStyles.header} onPress={onToggle} activeOpacity={0.8}>
        <View style={sectionStyles.headerLeft}>
          {icon}
          <Text style={sectionStyles.title}>{title}</Text>
        </View>
        {expanded ? <ChevronUp size={16} color="#64748b" /> : <ChevronDown size={16} color="#64748b" />}
      </TouchableOpacity>
      {expanded && <View style={sectionStyles.body}>{children}</View>}
    </View>
  );
}

function FFField({ label, placeholder, value, onChangeText, multiline, keyboardType }: {
  label: string; placeholder: string; value: string; onChangeText: (t: string) => void;
  multiline?: boolean; keyboardType?: 'number-pad' | 'decimal-pad';
}) {
  return (
    <View style={ffStyles.wrap}>
      <Text style={ffStyles.label}>{label}</Text>
      <TextInput
        style={[ffStyles.input, multiline && ffStyles.multi]}
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

const sectionStyles = StyleSheet.create({
  wrap: { marginBottom: 8, borderRadius: 14, backgroundColor: '#f8f9fb', borderWidth: 1, borderColor: '#e8ecf1', overflow: 'hidden' },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 16 },
  headerLeft: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  title: { fontSize: 14, fontFamily: Fonts.semiBold, color: '#1e293b' },
  body: { paddingHorizontal: 16, paddingBottom: 16 },
});

const ffStyles = StyleSheet.create({
  wrap: { marginBottom: 12 },
  label: { fontSize: 12, fontFamily: Fonts.semiBold, color: '#475569', marginBottom: 6 },
  input: {
    backgroundColor: '#ffffff', borderRadius: 10, paddingHorizontal: 12, paddingVertical: 11,
    fontSize: 14, fontFamily: Fonts.regular, color: '#1e293b',
    borderWidth: 1, borderColor: '#e2e8f0',
    ...(Platform.OS === 'web' ? { outlineStyle: 'none' } : {}),
  } as any,
  multi: { minHeight: 72, paddingTop: 11 },
});

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f8f9fb' },
  loadingWrap: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  header: {
    backgroundColor: '#1a1d23',
    paddingHorizontal: 20,
    paddingBottom: 14,
    borderBottomLeftRadius: 24,
    borderBottomRightRadius: 24,
  },
  headerTopRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 },
  headerTitle: { fontSize: 22, fontFamily: Fonts.headingBold, color: '#ffffff' },
  headerSub: { fontSize: 12, fontFamily: Fonts.medium, color: 'rgba(255,255,255,0.45)', marginTop: 2 },
  addBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: '#ff8c00', paddingVertical: 10, paddingHorizontal: 16, borderRadius: 12,
    shadowColor: '#ff8c00', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.35, shadowRadius: 8, elevation: 5,
  },
  addBtnText: { fontSize: 14, fontFamily: Fonts.semiBold, color: '#ffffff' },
  typeFilter: { marginBottom: 4 },
  typeFilterContent: { gap: 8, paddingBottom: 2 },
  typeFilterChip: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    backgroundColor: 'rgba(255,255,255,0.1)', paddingHorizontal: 12, paddingVertical: 7, borderRadius: 20,
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.15)',
  },
  typeFilterChipActive: { backgroundColor: '#ff8c00', borderColor: '#ff8c00' },
  typeFilterChipText: { fontSize: 12, fontFamily: Fonts.semiBold, color: 'rgba(255,255,255,0.65)' },
  typeFilterChipTextActive: { color: '#ffffff' },
  list: { padding: 16, paddingBottom: 40, gap: 14 },
  card: {
    backgroundColor: '#ffffff', borderRadius: 18, overflow: 'hidden',
    borderWidth: 1, borderColor: '#e8ecf1',
    ...(Platform.OS === 'web'
      ? { boxShadow: '0 2px 12px rgba(0,0,0,0.06)' } as any
      : { shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.05, shadowRadius: 10, elevation: 2 }),
  },
  cardInactive: { opacity: 0.58 },
  cardImgWrap: { position: 'relative' },
  cardImg: { width: '100%', height: 150 },
  cardImgOverlay: { ...StyleSheet.absoluteFillObject },
  discountBadge: {
    position: 'absolute', top: 10, right: 10,
    backgroundColor: '#ef4444', paddingHorizontal: 10, paddingVertical: 5, borderRadius: 10,
  },
  discountBadgeText: { fontSize: 13, fontFamily: Fonts.headingBold, color: '#ffffff' },
  typeBadgeOnImg: {
    position: 'absolute', top: 10, left: 10,
    flexDirection: 'row', alignItems: 'center', gap: 4,
    paddingHorizontal: 10, paddingVertical: 5, borderRadius: 10,
  },
  typeBadgeOnImgText: { fontSize: 11, fontFamily: Fonts.semiBold, color: '#ffffff' },
  cardImgPlaceholder: { width: '100%', height: 100, alignItems: 'center', justifyContent: 'center', position: 'relative' },
  placeholderIconWrap: { width: 50, height: 50, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  cardBody: { padding: 14 },
  cardTitleRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 5 },
  cardTitle: { fontSize: 15, fontFamily: Fonts.bold, color: '#1e293b', flex: 1, marginRight: 8 },
  activeDot: { width: 8, height: 8, borderRadius: 4 },
  cardDesc: { fontSize: 13, fontFamily: Fonts.regular, color: '#64748b', lineHeight: 18, marginBottom: 8 },
  countdownRow: { flexDirection: 'row', alignItems: 'center', gap: 5, marginBottom: 6 },
  countdownText: { fontSize: 12, fontFamily: Fonts.semiBold, color: '#ef4444' },
  couponRow: {
    flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 8,
    backgroundColor: '#f5f3ff', borderRadius: 8, paddingHorizontal: 10, paddingVertical: 7,
    borderWidth: 1, borderColor: '#ddd6fe', borderStyle: 'dashed',
  },
  couponCode: { fontSize: 13, fontFamily: Fonts.headingBold, color: '#7c3aed', letterSpacing: 1 },
  couponDiscount: { fontSize: 12, fontFamily: Fonts.semiBold, color: '#8b5cf6', marginLeft: 'auto' },
  priceRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 8 },
  promoPrice: { fontSize: 16, fontFamily: Fonts.headingBold, color: '#ef4444' },
  originalPrice: { fontSize: 13, fontFamily: Fonts.regular, color: '#94a3b8', textDecorationLine: 'line-through' },
  chipsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: 10 },
  chip: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: '#f8f9fb', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8 },
  chipText: { fontSize: 11, fontFamily: Fonts.medium, color: '#8b909a', textTransform: 'capitalize' },
  cardActions: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingTop: 10, borderTopWidth: 1, borderTopColor: '#f1f5f9' },
  toggleBtn: { flex: 1 },
  togglePill: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 12, paddingVertical: 7, borderRadius: 20, alignSelf: 'flex-start' },
  toggleDot: { width: 7, height: 7, borderRadius: 4 },
  togglePillText: { fontSize: 12, fontFamily: Fonts.semiBold },
  actionBtn: { width: 36, height: 36, borderRadius: 10, backgroundColor: '#fff7ed', alignItems: 'center', justifyContent: 'center' },
  actionBtnDanger: { backgroundColor: '#fef2f2' },
  emptyWrap: { alignItems: 'center', paddingVertical: 64, paddingHorizontal: 32, gap: 12 },
  emptyIconCircle: { width: 88, height: 88, borderRadius: 44, backgroundColor: '#f1f5f9', alignItems: 'center', justifyContent: 'center', marginBottom: 4 },
  emptyTitle: { fontSize: 18, fontFamily: Fonts.semiBold, color: '#475569' },
  emptyDesc: { fontSize: 14, fontFamily: Fonts.regular, color: '#94a3b8', textAlign: 'center', lineHeight: 20 },
  emptyCreateBtn: { flexDirection: 'row', alignItems: 'center', gap: 7, backgroundColor: '#ff8c00', paddingHorizontal: 20, paddingVertical: 12, borderRadius: 14, marginTop: 8 },
  emptyCreateBtnText: { fontSize: 14, fontFamily: Fonts.semiBold, color: '#ffffff' },
  sheetOverlay: { flex: 1, justifyContent: 'flex-end' },
  sheetBackdrop: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.52)' },
  sheetContainer: { backgroundColor: '#ffffff', borderTopLeftRadius: 28, borderTopRightRadius: 28, maxHeight: '93%' },
  sheetHandle: { width: 40, height: 4, borderRadius: 2, backgroundColor: '#e2e8f0', alignSelf: 'center', marginTop: 12, marginBottom: 4 },
  sheetHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 22, paddingVertical: 16, borderBottomWidth: 1, borderBottomColor: '#f1f5f9' },
  sheetTitle: { fontSize: 20, fontFamily: Fonts.headingBold, color: '#1e293b' },
  formScrollContent: { padding: 18, paddingBottom: 8 },
  fieldLabel: { fontSize: 12, fontFamily: Fonts.semiBold, color: '#475569', marginBottom: 8 },
  fieldHint: { fontSize: 11, fontFamily: Fonts.regular, color: '#94a3b8', lineHeight: 16, marginTop: -4, marginBottom: 8 },
  typeGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 14 },
  typeOption: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    paddingHorizontal: 12, paddingVertical: 9, borderRadius: 10,
    backgroundColor: '#f8f9fb', borderWidth: 1.5, borderColor: '#e2e8f0',
  },
  typeOptionLabel: { fontSize: 12, fontFamily: Fonts.semiBold, color: '#64748b' },
  imgPreviewWrap: { position: 'relative', marginBottom: 10, borderRadius: 12, overflow: 'hidden', borderWidth: 1, borderColor: '#e8ecf1' },
  imgPreview: { width: '100%', height: 150, backgroundColor: '#f1f5f9' },
  imgRemoveBtn: { position: 'absolute', top: 8, right: 8, width: 28, height: 28, borderRadius: 8, backgroundColor: 'rgba(0,0,0,0.55)', alignItems: 'center', justifyContent: 'center' },
  localBadge: { position: 'absolute', bottom: 8, left: 8, backgroundColor: '#ff8c00', borderRadius: 6, paddingHorizontal: 8, paddingVertical: 3 },
  localBadgeText: { fontSize: 11, fontFamily: Fonts.semiBold, color: '#fff' },
  imgSourceRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 12 },
  imgUploadBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: '#fff7ed', borderWidth: 1.5, borderColor: '#fed7aa', borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10 },
  imgUploadText: { fontSize: 12, fontFamily: Fonts.semiBold, color: '#ff8c00' },
  orText: { fontSize: 12, fontFamily: Fonts.regular, color: '#94a3b8' },
  imgUrlWrap: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: '#f8f9fb', borderRadius: 10, borderWidth: 1, borderColor: '#e2e8f0', paddingHorizontal: 10, paddingVertical: 10 },
  imgUrlInput: { flex: 1, fontSize: 13, fontFamily: Fonts.regular, color: '#1e293b', ...(Platform.OS === 'web' ? { outlineStyle: 'none' } : {}) } as any,
  halfRow: { flexDirection: 'row', gap: 10 },
  half: { flex: 1 },
  segRow: { flexDirection: 'row', gap: 8, marginBottom: 4 },
  segItem: { flex: 1, backgroundColor: '#f8f9fb', borderWidth: 1.5, borderColor: '#e2e8f0', borderRadius: 10, padding: 10, alignItems: 'center' },
  segItemActive: { backgroundColor: '#fff7ed', borderColor: '#ff8c00' },
  segLabel: { fontSize: 12, fontFamily: Fonts.bold, color: '#64748b', marginBottom: 2 },
  segLabelActive: { color: '#ff8c00' },
  segDesc: { fontSize: 10, fontFamily: Fonts.regular, color: '#94a3b8' },
  segDescActive: { color: '#c2410c' },
  freqRow: { flexDirection: 'row', gap: 8, marginBottom: 12 },
  freqOption: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 11, borderRadius: 12, backgroundColor: '#f8f9fb', borderWidth: 1.5, borderColor: '#e8ecf1' },
  freqOptionActive: { backgroundColor: '#ff8c00', borderColor: '#ff8c00' },
  freqText: { fontSize: 13, fontFamily: Fonts.semiBold, color: '#8b909a' },
  freqTextActive: { color: '#ffffff' },
  activeToggleRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: '#f8f9fb', borderRadius: 12, padding: 14, marginTop: 4 },
  colorPresetsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: 12 },
  colorPreset: { width: 40, height: 40, borderRadius: 12, overflow: 'hidden', borderWidth: 2, borderColor: 'transparent' },
  colorPresetActive: { borderColor: '#1e293b' },
  colorPresetGrad: { flex: 1 },
  colorPresetCheck: { ...StyleSheet.absoluteFillObject, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(0,0,0,0.25)' },
  formBtns: { flexDirection: 'row', gap: 12, marginTop: 16, marginBottom: 8 },
  cancelBtn: { flex: 1, paddingVertical: 14, borderRadius: 14, backgroundColor: '#f1f5f9', alignItems: 'center' },
  cancelBtnText: { fontSize: 14, fontFamily: Fonts.semiBold, color: '#64748b' },
  saveBtn: { flex: 2, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 7, paddingVertical: 14, borderRadius: 14, backgroundColor: '#ff8c00', shadowColor: '#ff8c00', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 8, elevation: 4 },
  saveBtnText: { fontSize: 14, fontFamily: Fonts.semiBold, color: '#ffffff' },
  deleteOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center', padding: 32 },
  deleteModal: { backgroundColor: '#ffffff', borderRadius: 24, padding: 28, width: '100%', maxWidth: 360, alignItems: 'center' },
  deleteIconWrap: { width: 60, height: 60, borderRadius: 20, backgroundColor: '#fee2e2', alignItems: 'center', justifyContent: 'center', marginBottom: 16 },
  deleteTitle: { fontSize: 18, fontFamily: Fonts.headingBold, color: '#1e293b', marginBottom: 8 },
  deleteMsg: { fontSize: 14, fontFamily: Fonts.regular, color: '#64748b', textAlign: 'center', lineHeight: 21, marginBottom: 24 },
  deleteActions: { flexDirection: 'row', gap: 12, width: '100%' },
  deleteCancelBtn: { flex: 1, paddingVertical: 14, borderRadius: 14, backgroundColor: '#f1f5f9', alignItems: 'center' },
  deleteCancelText: { fontSize: 14, fontFamily: Fonts.semiBold, color: '#64748b' },
  deleteConfirmBtn: { flex: 1, paddingVertical: 14, borderRadius: 14, backgroundColor: '#ef4444', alignItems: 'center' },
  deleteConfirmText: { fontSize: 14, fontFamily: Fonts.semiBold, color: '#ffffff' },
});
