import React, { useState, useEffect } from 'react';
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
  ToggleLeft,
  ToggleRight,
  AlertTriangle,
  Eye,
  Clock,
  Zap,
  Hash,
  Upload,
  Link as LinkIcon,
} from 'lucide-react-native';
import * as ImagePicker from 'expo-image-picker';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { supabase } from '@/lib/marketplace/supabase';
import { useToast } from '@/contexts/ToastContext';
import { Fonts } from '@/constants/fonts';

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
  display_frequency: 'once' | 'daily' | 'always';
  priority: number;
  hot_deal_text?: string;
  featured_text?: string;
  trending_text?: string;
  limited_offer_text?: string;
  created_at: string;
}

const FREQUENCY_OPTIONS: { key: 'once' | 'daily' | 'always'; label: string; icon: any }[] = [
  { key: 'once', label: 'Once', icon: Eye },
  { key: 'daily', label: 'Daily', icon: Clock },
  { key: 'always', label: 'Always', icon: Zap },
];

export default function AdvertManagement() {
  const insets = useSafeAreaInsets();
  const { showToast } = useToast();
  const [adverts, setAdverts] = useState<Advert[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingAdvert, setEditingAdvert] = useState<Advert | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Advert | null>(null);
  const [togglingId, setTogglingId] = useState<string | null>(null);

  const [formData, setFormData] = useState({
    title: '',
    description: '',
    image_url: '',
    action_text: '',
    action_url: '',
    is_active: true,
    start_date: '',
    end_date: '',
    display_frequency: 'daily' as 'once' | 'daily' | 'always',
    priority: 0,
    hot_deal_text: '',
    featured_text: '',
    trending_text: '',
    limited_offer_text: '',
  });
  const [localImageUri, setLocalImageUri] = useState<string | null>(null);
  const [uploadingImage, setUploadingImage] = useState(false);

  useEffect(() => {
    fetchAdverts();
  }, []);

  const fetchAdverts = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('adverts')
        .select('*')
        .order('priority', { ascending: false });
      if (error) throw error;
      setAdverts(data || []);
    } catch (error: any) {
      showToast(error.message || 'Error fetching adverts', 'error');
    } finally {
      setLoading(false);
    }
  };

  const openAddModal = () => {
    setEditingAdvert(null);
    setLocalImageUri(null);
    setFormData({
      title: '',
      description: '',
      image_url: '',
      action_text: '',
      action_url: '',
      is_active: true,
      start_date: '',
      end_date: '',
      display_frequency: 'daily',
      priority: 0,
      hot_deal_text: '',
      featured_text: '',
      trending_text: '',
      limited_offer_text: '',
    });
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
      priority: advert.priority,
      hot_deal_text: advert.hot_deal_text || '',
      featured_text: advert.featured_text || '',
      trending_text: advert.trending_text || '',
      limited_offer_text: advert.limited_offer_text || '',
    });
    setShowModal(true);
  };

  const pickImageFromLibrary = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      showToast('Permission to access photos is required', 'error');
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
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
        if (blobType) {
          contentType = blobType;
          fileExt = blobType.split('/')[1] || 'jpg';
        }
      } else {
        const response = await fetch(uri);
        fileData = await response.arrayBuffer();
        if (uri.toLowerCase().includes('.png')) { contentType = 'image/png'; fileExt = 'png'; }
        else if (uri.toLowerCase().includes('.webp')) { contentType = 'image/webp'; fileExt = 'webp'; }
        else if (uri.toLowerCase().includes('.gif')) { contentType = 'image/gif'; fileExt = 'gif'; }
      }

      const fileName = `advert_${Date.now()}.${fileExt}`;
      const filePath = `adverts/${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from('advert-images')
        .upload(filePath, fileData, { contentType, upsert: false });

      if (uploadError) throw uploadError;

      const { data: urlData } = supabase.storage
        .from('advert-images')
        .getPublicUrl(filePath);

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
        priority: formData.priority,
        hot_deal_text: formData.hot_deal_text || null,
        featured_text: formData.featured_text || null,
        trending_text: formData.trending_text || null,
        limited_offer_text: formData.limited_offer_text || null,
      };

      if (editingAdvert) {
        const { error } = await supabase
          .from('adverts')
          .update(advertData)
          .eq('id', editingAdvert.id);
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
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    try {
      const { error } = await supabase.from('adverts').delete().eq('id', deleteTarget.id);
      if (error) throw error;
      showToast('Advert deleted successfully', 'success');
      setDeleteTarget(null);
      fetchAdverts();
    } catch (error: any) {
      showToast(error.message || 'Error deleting advert', 'error');
    }
  };

  const toggleActive = async (advert: Advert) => {
    try {
      setTogglingId(advert.id);
      const { error } = await supabase
        .from('adverts')
        .update({ is_active: !advert.is_active })
        .eq('id', advert.id);
      if (error) throw error;
      showToast(`Advert ${!advert.is_active ? 'activated' : 'deactivated'}`, 'success');
      fetchAdverts();
    } catch (error: any) {
      showToast(error.message || 'Error updating advert', 'error');
    } finally {
      setTogglingId(null);
    }
  };

  const activeCount = adverts.filter((a) => a.is_active).length;

  const renderAdvert = ({ item }: { item: Advert }) => {
    const isToggling = togglingId === item.id;
    return (
      <View style={[styles.advertCard, !item.is_active && styles.advertCardInactive]}>
        {item.image_url ? (
          <Image source={{ uri: item.image_url }} style={styles.advertImage} />
        ) : (
          <View style={styles.advertImagePlaceholder}>
            <ImageIcon size={24} color="#d1d5db" />
          </View>
        )}

        <View style={styles.advertBody}>
          <View style={styles.advertTitleRow}>
            <Text style={styles.advertTitle} numberOfLines={1}>{item.title}</Text>
            <View style={[styles.statusDot, { backgroundColor: item.is_active ? '#059669' : '#8b909a' }]} />
          </View>

          <Text style={styles.advertDescription} numberOfLines={2}>{item.description}</Text>

          <View style={styles.chipRow}>
            <View style={styles.chip}>
              <Clock size={11} color="#8b909a" />
              <Text style={styles.chipText}>{item.display_frequency}</Text>
            </View>
            <View style={styles.chip}>
              <Hash size={11} color="#8b909a" />
              <Text style={styles.chipText}>P{item.priority}</Text>
            </View>
            {item.action_url && (
              <View style={[styles.chip, { backgroundColor: '#eef6ff' }]}>
                <ExternalLink size={11} color="#3b82f6" />
                <Text style={[styles.chipText, { color: '#3b82f6' }]}>Link</Text>
              </View>
            )}
          </View>

          <View style={styles.advertActions}>
            <TouchableOpacity
              style={styles.toggleBtn}
              onPress={() => toggleActive(item)}
              disabled={isToggling}
            >
              {isToggling ? (
                <ActivityIndicator size="small" color="#ff8c00" />
              ) : item.is_active ? (
                <ToggleRight size={22} color="#059669" />
              ) : (
                <ToggleLeft size={22} color="#8b909a" />
              )}
            </TouchableOpacity>
            <TouchableOpacity style={styles.actionBtn} onPress={() => openEditModal(item)}>
              <Edit3 size={16} color="#ff8c00" />
            </TouchableOpacity>
            <TouchableOpacity style={[styles.actionBtn, styles.actionBtnDanger]} onPress={() => setDeleteTarget(item)}>
              <Trash2 size={16} color="#ef4444" />
            </TouchableOpacity>
          </View>
        </View>
      </View>
    );
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#ff8c00" />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={[styles.header, { paddingTop: insets.top + 12 }]}>
        <View style={styles.headerTop}>
          <View style={styles.headerTextWrap}>
            <Text style={styles.headerTitle}>Adverts</Text>
            <Text style={styles.headerSubtitle}>{adverts.length} total, {activeCount} active</Text>
          </View>
          <TouchableOpacity style={styles.addBtn} onPress={openAddModal}>
            <Plus size={18} color="#ffffff" />
            <Text style={styles.addBtnText}>New</Text>
          </TouchableOpacity>
        </View>
      </View>

      <FlatList
        data={adverts}
        keyExtractor={(item) => item.id}
        renderItem={renderAdvert}
        contentContainerStyle={styles.list}
        ListEmptyComponent={
          <View style={styles.emptyState}>
            <Megaphone size={48} color="#d1d5db" />
            <Text style={styles.emptyText}>No adverts yet</Text>
            <Text style={styles.emptySubtext}>Create your first advert to get started</Text>
          </View>
        }
      />

      {/* Create/Edit Modal */}
      <Modal visible={showModal} animationType="slide" transparent onRequestClose={() => setShowModal(false)}>
        <View style={styles.sheetOverlay}>
          <TouchableOpacity style={styles.sheetBackdrop} onPress={() => setShowModal(false)} />
          <View style={[styles.sheetContainer, { paddingBottom: insets.bottom + 20 }]}>
            <View style={styles.sheetHandle} />
            <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.formContent}>
              <View style={styles.formHeaderRow}>
                <Text style={styles.formTitle}>
                  {editingAdvert ? 'Edit Advert' : 'New Advert'}
                </Text>
                <TouchableOpacity onPress={() => setShowModal(false)}>
                  <X size={22} color="#8b909a" />
                </TouchableOpacity>
              </View>

              <FormField label="Title" placeholder="Enter advert title" value={formData.title} onChangeText={(t) => setFormData({ ...formData, title: t })} />
              <FormField label="Description" placeholder="Enter advert description" value={formData.description} onChangeText={(t) => setFormData({ ...formData, description: t })} multiline />

              <Text style={styles.fieldLabel}>Advert Image</Text>
              {(localImageUri || formData.image_url) ? (
                <View style={styles.imagePreviewWrap}>
                  <Image
                    source={{ uri: localImageUri || formData.image_url }}
                    style={styles.imagePreview}
                    resizeMode="cover"
                  />
                  <TouchableOpacity
                    style={styles.imageRemoveBtn}
                    onPress={() => { setLocalImageUri(null); setFormData((p) => ({ ...p, image_url: '' })); }}
                  >
                    <X size={14} color="#ffffff" strokeWidth={2.5} />
                  </TouchableOpacity>
                  {localImageUri && (
                    <View style={styles.imageLocalBadge}>
                      <Text style={styles.imageLocalBadgeText}>Local</Text>
                    </View>
                  )}
                </View>
              ) : null}

              <View style={styles.imageSourceRow}>
                <TouchableOpacity style={styles.imageSourceBtn} onPress={pickImageFromLibrary}>
                  <Upload size={15} color="#ff8c00" strokeWidth={2} />
                  <Text style={styles.imageSourceBtnText}>Upload from Device</Text>
                </TouchableOpacity>
                <Text style={styles.imageSourceOr}>or</Text>
                <View style={styles.imageUrlInputWrap}>
                  <LinkIcon size={14} color="#94a3b8" strokeWidth={2} />
                  <TextInput
                    style={styles.imageUrlInput}
                    placeholder="Paste image URL"
                    placeholderTextColor="#b0b5bf"
                    value={formData.image_url}
                    onChangeText={(t) => {
                      setFormData((p) => ({ ...p, image_url: t }));
                      if (t) setLocalImageUri(null);
                    }}
                    autoCapitalize="none"
                    keyboardType="url"
                  />
                </View>
              </View>

              <View style={styles.fieldRow}>
                <View style={styles.fieldHalf}>
                  <FormField label="Button Text" placeholder="Shop Now" value={formData.action_text} onChangeText={(t) => setFormData({ ...formData, action_text: t })} />
                </View>
                <View style={styles.fieldHalf}>
                  <FormField label="Button URL" placeholder="https://..." value={formData.action_url} onChangeText={(t) => setFormData({ ...formData, action_url: t })} />
                </View>
              </View>

              <Text style={styles.fieldLabel}>Display Frequency</Text>
              <View style={styles.frequencyRow}>
                {FREQUENCY_OPTIONS.map((opt) => {
                  const isSelected = formData.display_frequency === opt.key;
                  const Icon = opt.icon;
                  return (
                    <TouchableOpacity
                      key={opt.key}
                      style={[styles.freqOption, isSelected && styles.freqOptionActive]}
                      onPress={() => setFormData({ ...formData, display_frequency: opt.key })}
                    >
                      <Icon size={16} color={isSelected ? '#ffffff' : '#8b909a'} />
                      <Text style={[styles.freqOptionText, isSelected && styles.freqOptionTextActive]}>{opt.label}</Text>
                    </TouchableOpacity>
                  );
                })}
              </View>

              <FormField label="Priority" placeholder="0" value={String(formData.priority)} onChangeText={(t) => setFormData({ ...formData, priority: parseInt(t) || 0 })} keyboardType="number-pad" />

              <Text style={styles.sectionLabel}>Customizable Labels</Text>

              <View style={styles.fieldRow}>
                <View style={styles.fieldHalf}>
                  <FormField label="Hot Deal Badge" placeholder="HOT DEAL" value={formData.hot_deal_text} onChangeText={(t) => setFormData({ ...formData, hot_deal_text: t })} />
                </View>
                <View style={styles.fieldHalf}>
                  <FormField label="Featured Badge" placeholder="Featured" value={formData.featured_text} onChangeText={(t) => setFormData({ ...formData, featured_text: t })} />
                </View>
              </View>

              <View style={styles.fieldRow}>
                <View style={styles.fieldHalf}>
                  <FormField label="Trending Badge" placeholder="Trending Now" value={formData.trending_text} onChangeText={(t) => setFormData({ ...formData, trending_text: t })} />
                </View>
                <View style={styles.fieldHalf}>
                  <FormField label="Limited Offer" placeholder="Limited Time" value={formData.limited_offer_text} onChangeText={(t) => setFormData({ ...formData, limited_offer_text: t })} />
                </View>
              </View>

              <TouchableOpacity style={styles.toggleRow} onPress={() => setFormData({ ...formData, is_active: !formData.is_active })}>
                {formData.is_active ? <ToggleRight size={28} color="#ff8c00" /> : <ToggleLeft size={28} color="#8b909a" />}
                <Text style={[styles.toggleLabel, formData.is_active && { color: '#1e293b' }]}>Active</Text>
              </TouchableOpacity>

              <View style={styles.formActions}>
                <TouchableOpacity style={styles.cancelBtn} onPress={() => setShowModal(false)}>
                  <Text style={styles.cancelBtnText}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity style={[styles.saveBtn, uploadingImage && { opacity: 0.7 }]} onPress={handleSave} disabled={uploadingImage}>
                  {uploadingImage ? (
                    <ActivityIndicator size="small" color="#ffffff" />
                  ) : (
                    <Check size={18} color="#ffffff" />
                  )}
                  <Text style={styles.saveBtnText}>{uploadingImage ? 'Uploading...' : 'Save'}</Text>
                </TouchableOpacity>
              </View>
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* Delete Confirmation Modal */}
      <Modal visible={!!deleteTarget} transparent animationType="fade" onRequestClose={() => setDeleteTarget(null)}>
        <View style={styles.modalOverlay}>
          <View style={styles.confirmModal}>
            <View style={styles.confirmIconWrap}>
              <AlertTriangle size={28} color="#ef4444" />
            </View>
            <Text style={styles.confirmTitle}>Delete Advert</Text>
            <Text style={styles.confirmMessage}>
              Are you sure you want to delete "{deleteTarget?.title}"? This cannot be undone.
            </Text>
            <View style={styles.confirmActions}>
              <TouchableOpacity style={styles.confirmCancelBtn} onPress={() => setDeleteTarget(null)}>
                <Text style={styles.confirmCancelText}>Cancel</Text>
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
  keyboardType?: 'number-pad' | 'decimal-pad';
}) {
  return (
    <View style={fieldStyles.field}>
      <Text style={fieldStyles.label}>{label}</Text>
      <TextInput
        style={[fieldStyles.input, multiline && fieldStyles.multiline]}
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

const fieldStyles = StyleSheet.create({
  field: {
    marginBottom: 14,
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
  multiline: {
    minHeight: 80,
    paddingTop: 12,
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
  },
  header: {
    backgroundColor: '#1a1d23',
    paddingHorizontal: 20,
    paddingBottom: 20,
    borderBottomLeftRadius: 24,
    borderBottomRightRadius: 24,
  },
  headerTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  headerTextWrap: {
    flex: 1,
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
  },
  addBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#ff8c00',
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 12,
    shadowColor: '#ff8c00',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  addBtnText: {
    fontSize: 14,
    fontFamily: Fonts.semiBold,
    color: '#ffffff',
  },
  list: {
    padding: 16,
    paddingBottom: 40,
  },
  advertCard: {
    backgroundColor: '#ffffff',
    borderRadius: 18,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 8,
    elevation: 1,
    overflow: 'hidden',
  },
  advertCardInactive: {
    opacity: 0.6,
  },
  advertImage: {
    width: '100%',
    height: 140,
    backgroundColor: '#f1f5f9',
  },
  advertImagePlaceholder: {
    width: '100%',
    height: 80,
    backgroundColor: '#f1f5f9',
    alignItems: 'center',
    justifyContent: 'center',
  },
  advertBody: {
    padding: 14,
    gap: 8,
  },
  advertTitleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  advertTitle: {
    fontSize: 16,
    fontFamily: Fonts.bold,
    color: '#1e293b',
    flex: 1,
    marginRight: 8,
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  advertDescription: {
    fontSize: 13,
    fontFamily: Fonts.regular,
    color: '#64748b',
    lineHeight: 19,
  },
  chipRow: {
    flexDirection: 'row',
    gap: 6,
    flexWrap: 'wrap',
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#f8f9fb',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  chipText: {
    fontSize: 11,
    fontFamily: Fonts.groteskMedium,
    color: '#8b909a',
    textTransform: 'capitalize',
  },
  advertActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: '#f1f5f9',
  },
  toggleBtn: {
    flex: 1,
  },
  actionBtn: {
    width: 38,
    height: 38,
    borderRadius: 10,
    backgroundColor: '#fff7ed',
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionBtnDanger: {
    backgroundColor: '#fef2f2',
  },
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60,
    gap: 10,
  },
  emptyText: {
    fontSize: 17,
    fontFamily: Fonts.semiBold,
    color: '#8b909a',
  },
  emptySubtext: {
    fontSize: 13,
    fontFamily: Fonts.regular,
    color: '#b0b5bf',
  },
  sheetOverlay: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  sheetBackdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.5)',
  },
  sheetContainer: {
    backgroundColor: '#ffffff',
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    maxHeight: '90%',
  },
  sheetHandle: {
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#e2e8f0',
    alignSelf: 'center',
    marginTop: 12,
    marginBottom: 4,
  },
  formContent: {
    padding: 20,
    paddingBottom: 20,
  },
  formHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  formTitle: {
    fontSize: 20,
    fontFamily: Fonts.headingBold,
    color: '#1e293b',
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
  sectionLabel: {
    fontSize: 14,
    fontFamily: Fonts.headingBold,
    color: '#ff8c00',
    marginTop: 8,
    marginBottom: 4,
  },
  frequencyRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 14,
  },
  freqOption: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 11,
    borderRadius: 12,
    backgroundColor: '#f8f9fb',
    borderWidth: 1.5,
    borderColor: '#e8ecf1',
  },
  freqOptionActive: {
    backgroundColor: '#ff8c00',
    borderColor: '#ff8c00',
  },
  freqOptionText: {
    fontSize: 13,
    fontFamily: Fonts.semiBold,
    color: '#8b909a',
  },
  freqOptionTextActive: {
    color: '#ffffff',
  },
  toggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 16,
  },
  toggleLabel: {
    fontSize: 14,
    fontFamily: Fonts.semiBold,
    color: '#8b909a',
  },
  formActions: {
    flexDirection: 'row',
    gap: 12,
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
  saveBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 14,
    borderRadius: 14,
    backgroundColor: '#ff8c00',
    shadowColor: '#ff8c00',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  saveBtnText: {
    fontSize: 14,
    fontFamily: Fonts.semiBold,
    color: '#ffffff',
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
  confirmCancelBtn: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 14,
    backgroundColor: '#f1f5f9',
    alignItems: 'center',
  },
  confirmCancelText: {
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
  fieldLabel: {
    fontSize: 13,
    fontFamily: Fonts.semiBold,
    color: '#1e293b',
    marginBottom: 8,
  },
  imagePreviewWrap: {
    position: 'relative',
    marginBottom: 10,
    borderRadius: 14,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#e8ecf1',
  },
  imagePreview: {
    width: '100%',
    height: 160,
    backgroundColor: '#f1f5f9',
  },
  imageRemoveBtn: {
    position: 'absolute',
    top: 8,
    right: 8,
    width: 28,
    height: 28,
    borderRadius: 8,
    backgroundColor: 'rgba(0,0,0,0.55)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  imageLocalBadge: {
    position: 'absolute',
    bottom: 8,
    left: 8,
    backgroundColor: '#ff8c00',
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  imageLocalBadgeText: {
    fontSize: 11,
    fontFamily: Fonts.semiBold,
    color: '#ffffff',
  },
  imageSourceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 14,
  },
  imageSourceBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#fff7ed',
    borderWidth: 1.5,
    borderColor: '#fed7aa',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  imageSourceBtnText: {
    fontSize: 12,
    fontFamily: Fonts.semiBold,
    color: '#ff8c00',
  },
  imageSourceOr: {
    fontSize: 12,
    fontFamily: Fonts.regular,
    color: '#94a3b8',
  },
  imageUrlInputWrap: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#f8f9fb',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#e8ecf1',
    paddingHorizontal: 10,
    paddingVertical: 10,
  },
  imageUrlInput: {
    flex: 1,
    fontSize: 13,
    fontFamily: Fonts.regular,
    color: '#1e293b',
    outlineStyle: 'none',
  } as any,
});
