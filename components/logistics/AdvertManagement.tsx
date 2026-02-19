import { useState, useEffect, useCallback } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity, Modal,
  TextInput, Switch, Image, Platform, Alert,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import {
  Plus, X, Edit2, Trash2, Flame, Star, TrendingUp, Timer,
  Image as ImageIcon, Link, Megaphone, Eye, EyeOff, ChevronDown,
} from 'lucide-react-native';
import * as ImagePicker from 'expo-image-picker';
import { supabase } from '@/lib/supabase';
import { Fonts } from '@/constants/fonts';
import { Toast } from '@/components/Toast';
import { ConfirmDialog } from '@/components/ConfirmDialog';

type BadgeType = 'hot_deal' | 'featured' | 'trending' | 'limited';
type DisplayMode = 'banner' | 'modal' | 'both';
type DisplayFrequency = 'once' | 'daily' | 'always';

type LogisticsAdvert = {
  id: string;
  title: string;
  description: string;
  image_url: string | null;
  badge_text: string;
  badge_type: BadgeType;
  action_text: string | null;
  action_url: string | null;
  display_mode: DisplayMode;
  display_frequency: DisplayFrequency;
  priority: number;
  is_active: boolean;
  start_date: string | null;
  end_date: string | null;
  created_at: string;
};

type FormState = {
  title: string;
  description: string;
  image_url: string;
  badge_text: string;
  badge_type: BadgeType;
  action_text: string;
  action_url: string;
  display_mode: DisplayMode;
  display_frequency: DisplayFrequency;
  priority: string;
  is_active: boolean;
};

const EMPTY_FORM: FormState = {
  title: '',
  description: '',
  image_url: '',
  badge_text: 'NEW',
  badge_type: 'featured',
  action_text: '',
  action_url: '',
  display_mode: 'both',
  display_frequency: 'always',
  priority: '0',
  is_active: true,
};

const BADGE_OPTIONS: { type: BadgeType; label: string; icon: any; color: string; bg: string }[] = [
  { type: 'hot_deal', label: 'Hot Deal', icon: Flame, color: '#ef4444', bg: '#fef2f2' },
  { type: 'featured', label: 'Featured', icon: Star, color: '#f59e0b', bg: '#fefce8' },
  { type: 'trending', label: 'Trending', icon: TrendingUp, color: '#10b981', bg: '#f0fdf4' },
  { type: 'limited', label: 'Limited', icon: Timer, color: '#3b82f6', bg: '#eff6ff' },
];

const MODE_OPTIONS: { value: DisplayMode; label: string; desc: string }[] = [
  { value: 'banner', label: 'Banner', desc: 'Scrolling banner only' },
  { value: 'modal', label: 'Popup', desc: 'Full-screen popup only' },
  { value: 'both', label: 'Both', desc: 'Banner + popup on open' },
];

const FREQ_OPTIONS: { value: DisplayFrequency; label: string; desc: string }[] = [
  { value: 'always', label: 'Always', desc: 'Show every visit' },
  { value: 'daily', label: 'Daily', desc: 'Once per day' },
  { value: 'once', label: 'Once', desc: 'First visit only' },
];

const getBadgeColor = (type: BadgeType) => BADGE_OPTIONS.find(b => b.type === type)?.color ?? '#6b7280';
const getBadgeBg = (type: BadgeType) => BADGE_OPTIONS.find(b => b.type === type)?.bg ?? '#f9fafb';
const getBadgeIcon = (type: BadgeType) => BADGE_OPTIONS.find(b => b.type === type)?.icon ?? Star;

export default function LogisticsAdvertManagement() {
  const [adverts, setAdverts] = useState<LogisticsAdvert[]>([]);
  const [loading, setLoading] = useState(false);
  const [modalVisible, setModalVisible] = useState(false);
  const [editTarget, setEditTarget] = useState<LogisticsAdvert | null>(null);
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [badgeDropOpen, setBadgeDropOpen] = useState(false);
  const [toast, setToast] = useState<{ visible: boolean; message: string; type: 'success' | 'error' | 'info' | 'warning' }>({ visible: false, message: '', type: 'success' });
  const [confirmDialog, setConfirmDialog] = useState<{ visible: boolean; title: string; message: string; onConfirm: () => void }>({ visible: false, title: '', message: '', onConfirm: () => {} });

  const showToast = (message: string, type: 'success' | 'error' | 'info' | 'warning' = 'success') => setToast({ visible: true, message, type });

  useEffect(() => { loadAdverts(); }, []);

  const loadAdverts = useCallback(async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('logistics_adverts')
        .select('*')
        .order('priority', { ascending: false })
        .order('created_at', { ascending: false });
      if (error) throw error;
      setAdverts(data || []);
    } catch (err: any) {
      showToast('Failed to load adverts', 'error');
    } finally {
      setLoading(false);
    }
  }, []);

  const openCreate = () => {
    setEditTarget(null);
    setForm(EMPTY_FORM);
    setModalVisible(true);
  };

  const openEdit = (advert: LogisticsAdvert) => {
    setEditTarget(advert);
    setForm({
      title: advert.title,
      description: advert.description,
      image_url: advert.image_url || '',
      badge_text: advert.badge_text,
      badge_type: advert.badge_type,
      action_text: advert.action_text || '',
      action_url: advert.action_url || '',
      display_mode: advert.display_mode,
      display_frequency: advert.display_frequency,
      priority: String(advert.priority),
      is_active: advert.is_active,
    });
    setModalVisible(true);
  };

  const handlePickImage = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [16, 9],
      quality: 0.8,
    });
    if (result.canceled || !result.assets[0]) return;
    const asset = result.assets[0];
    const ext = asset.uri.split('.').pop()?.toLowerCase() || 'jpg';
    const path = `logistics-adverts/${Date.now()}.${ext}`;
    setUploading(true);
    try {
      const response = await fetch(asset.uri);
      const blob = await response.blob();
      const { error: upErr } = await supabase.storage.from('advert-images').upload(path, blob, { contentType: `image/${ext}` });
      if (upErr) throw upErr;
      const { data: urlData } = supabase.storage.from('advert-images').getPublicUrl(path);
      setForm(f => ({ ...f, image_url: urlData.publicUrl }));
      showToast('Image uploaded', 'success');
    } catch (err: any) {
      showToast('Image upload failed', 'error');
    } finally {
      setUploading(false);
    }
  };

  const handleSave = async () => {
    if (!form.title.trim()) { showToast('Title is required', 'error'); return; }
    setSaving(true);
    try {
      const payload = {
        title: form.title.trim(),
        description: form.description.trim(),
        image_url: form.image_url.trim() || null,
        badge_text: form.badge_text.trim() || 'NEW',
        badge_type: form.badge_type,
        action_text: form.action_text.trim() || null,
        action_url: form.action_url.trim() || null,
        display_mode: form.display_mode,
        display_frequency: form.display_frequency,
        priority: parseInt(form.priority) || 0,
        is_active: form.is_active,
      };
      if (editTarget) {
        const { error } = await supabase.from('logistics_adverts').update(payload).eq('id', editTarget.id);
        if (error) throw error;
        showToast('Advert updated', 'success');
      } else {
        const { error } = await supabase.from('logistics_adverts').insert(payload);
        if (error) throw error;
        showToast('Advert created', 'success');
      }
      setModalVisible(false);
      loadAdverts();
    } catch (err: any) {
      showToast(err.message || 'Save failed', 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleToggle = async (advert: LogisticsAdvert) => {
    try {
      const { error } = await supabase.from('logistics_adverts').update({ is_active: !advert.is_active }).eq('id', advert.id);
      if (error) throw error;
      setAdverts(prev => prev.map(a => a.id === advert.id ? { ...a, is_active: !a.is_active } : a));
    } catch {
      showToast('Failed to update status', 'error');
    }
  };

  const handleDelete = (advert: LogisticsAdvert) => {
    setConfirmDialog({
      visible: true,
      title: 'Delete Advert',
      message: `Delete "${advert.title}"? This cannot be undone.`,
      onConfirm: async () => {
        try {
          const { error } = await supabase.from('logistics_adverts').delete().eq('id', advert.id);
          if (error) throw error;
          showToast('Advert deleted', 'success');
          loadAdverts();
        } catch {
          showToast('Failed to delete', 'error');
        }
      },
    });
  };

  return (
    <View style={styles.root}>
      <View style={styles.topBar}>
        <View>
          <Text style={styles.pageTitle}>Adverts & Promos</Text>
          <Text style={styles.pageSubtitle}>{adverts.length} item{adverts.length !== 1 ? 's' : ''}</Text>
        </View>
        <TouchableOpacity style={styles.createBtn} onPress={openCreate} activeOpacity={0.85}>
          <LinearGradient colors={['#f97316', '#ea580c']} style={styles.createBtnGrad} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}>
            <Plus size={18} color="#fff" />
            <Text style={styles.createBtnText}>New Advert</Text>
          </LinearGradient>
        </TouchableOpacity>
      </View>

      <ScrollView style={styles.list} showsVerticalScrollIndicator={false} contentContainerStyle={styles.listContent}>
        {loading ? (
          <View style={styles.emptyWrap}>
            <Text style={styles.emptyText}>Loading...</Text>
          </View>
        ) : adverts.length === 0 ? (
          <View style={styles.emptyWrap}>
            <Megaphone size={52} color="#d1d5db" />
            <Text style={styles.emptyTitle}>No Adverts Yet</Text>
            <Text style={styles.emptyText}>Create your first advert to promote deals and announcements to customers.</Text>
          </View>
        ) : (
          adverts.map(advert => {
            const BadgeIcon = getBadgeIcon(advert.badge_type);
            const badgeColor = getBadgeColor(advert.badge_type);
            const badgeBg = getBadgeBg(advert.badge_type);
            return (
              <View key={advert.id} style={[styles.card, !advert.is_active && styles.cardInactive]}>
                {advert.image_url ? (
                  <Image source={{ uri: advert.image_url }} style={styles.cardImg} />
                ) : (
                  <LinearGradient colors={['#1c1917', '#292524']} style={styles.cardImgPlaceholder}>
                    <Megaphone size={28} color="rgba(255,255,255,0.3)" />
                  </LinearGradient>
                )}
                <View style={styles.cardBody}>
                  <View style={styles.cardTopRow}>
                    <View style={[styles.cardBadge, { backgroundColor: badgeBg }]}>
                      <BadgeIcon size={11} color={badgeColor} />
                      <Text style={[styles.cardBadgeText, { color: badgeColor }]}>{advert.badge_text}</Text>
                    </View>
                    <View style={styles.cardMeta}>
                      <View style={[styles.modePill, { backgroundColor: advert.display_mode === 'both' ? '#f0fdf4' : '#eff6ff' }]}>
                        <Text style={[styles.modePillText, { color: advert.display_mode === 'both' ? '#059669' : '#2563eb' }]}>
                          {advert.display_mode === 'both' ? 'Banner+Popup' : advert.display_mode === 'banner' ? 'Banner' : 'Popup'}
                        </Text>
                      </View>
                      <View style={[styles.prioChip]}>
                        <Text style={styles.prioText}>P{advert.priority}</Text>
                      </View>
                    </View>
                  </View>
                  <Text style={styles.cardTitle} numberOfLines={1}>{advert.title}</Text>
                  {advert.description ? <Text style={styles.cardDesc} numberOfLines={2}>{advert.description}</Text> : null}
                  <View style={styles.cardFooter}>
                    <TouchableOpacity style={styles.toggleBtn} onPress={() => handleToggle(advert)} activeOpacity={0.8}>
                      {advert.is_active ? <Eye size={14} color="#10b981" /> : <EyeOff size={14} color="#9ca3af" />}
                      <Text style={[styles.toggleText, { color: advert.is_active ? '#10b981' : '#9ca3af' }]}>
                        {advert.is_active ? 'Active' : 'Inactive'}
                      </Text>
                    </TouchableOpacity>
                    <View style={styles.cardActions}>
                      <TouchableOpacity style={styles.actionIconBtn} onPress={() => openEdit(advert)} activeOpacity={0.8}>
                        <Edit2 size={15} color="#3b82f6" />
                      </TouchableOpacity>
                      <TouchableOpacity style={[styles.actionIconBtn, styles.deleteIconBtn]} onPress={() => handleDelete(advert)} activeOpacity={0.8}>
                        <Trash2 size={15} color="#ef4444" />
                      </TouchableOpacity>
                    </View>
                  </View>
                </View>
              </View>
            );
          })
        )}
        <View style={{ height: 32 }} />
      </ScrollView>

      <Modal visible={modalVisible} animationType="slide" presentationStyle="pageSheet" onRequestClose={() => setModalVisible(false)}>
        <View style={styles.modal}>
          <View style={styles.modalHandle} />
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>{editTarget ? 'Edit Advert' : 'New Advert'}</Text>
            <TouchableOpacity onPress={() => setModalVisible(false)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
              <X size={22} color="#6b7280" />
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.modalBody} showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 48 }}>
            <Text style={styles.fieldLabel}>Title *</Text>
            <TextInput
              style={styles.input}
              placeholder="e.g. 50% Off First Delivery!"
              placeholderTextColor="#9ca3af"
              value={form.title}
              onChangeText={v => setForm(f => ({ ...f, title: v }))}
            />

            <Text style={styles.fieldLabel}>Description</Text>
            <TextInput
              style={[styles.input, styles.textarea]}
              placeholder="Tell customers more about this offer..."
              placeholderTextColor="#9ca3af"
              value={form.description}
              onChangeText={v => setForm(f => ({ ...f, description: v }))}
              multiline
              numberOfLines={3}
              textAlignVertical="top"
            />

            <Text style={styles.fieldLabel}>Image</Text>
            <View style={styles.imageRow}>
              <TouchableOpacity style={styles.imgPickBtn} onPress={handlePickImage} activeOpacity={0.8} disabled={uploading}>
                <ImageIcon size={16} color="#f97316" />
                <Text style={styles.imgPickText}>{uploading ? 'Uploading...' : 'Pick Image'}</Text>
              </TouchableOpacity>
              <TextInput
                style={[styles.input, { flex: 1, marginBottom: 0 }]}
                placeholder="or paste URL"
                placeholderTextColor="#9ca3af"
                value={form.image_url}
                onChangeText={v => setForm(f => ({ ...f, image_url: v }))}
              />
            </View>
            {form.image_url ? (
              <Image source={{ uri: form.image_url }} style={styles.imagePreview} resizeMode="cover" />
            ) : null}

            <Text style={styles.fieldLabel}>Badge Type</Text>
            <TouchableOpacity style={styles.dropdownBtn} onPress={() => setBadgeDropOpen(o => !o)} activeOpacity={0.8}>
              {(() => {
                const opt = BADGE_OPTIONS.find(b => b.type === form.badge_type)!;
                const IconComp = opt.icon;
                return (
                  <>
                    <View style={[styles.dropBadgeDot, { backgroundColor: opt.bg }]}>
                      <IconComp size={14} color={opt.color} />
                    </View>
                    <Text style={styles.dropdownBtnText}>{opt.label}</Text>
                    <ChevronDown size={16} color="#6b7280" />
                  </>
                );
              })()}
            </TouchableOpacity>
            {badgeDropOpen && (
              <View style={styles.dropdown}>
                {BADGE_OPTIONS.map(opt => {
                  const IconComp = opt.icon;
                  return (
                    <TouchableOpacity
                      key={opt.type}
                      style={[styles.dropItem, form.badge_type === opt.type && styles.dropItemActive]}
                      onPress={() => { setForm(f => ({ ...f, badge_type: opt.type })); setBadgeDropOpen(false); }}
                      activeOpacity={0.8}
                    >
                      <View style={[styles.dropBadgeDot, { backgroundColor: opt.bg }]}>
                        <IconComp size={14} color={opt.color} />
                      </View>
                      <Text style={[styles.dropItemText, form.badge_type === opt.type && { color: '#f97316', fontFamily: Fonts.bold }]}>{opt.label}</Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            )}

            <Text style={styles.fieldLabel}>Badge Label</Text>
            <TextInput
              style={styles.input}
              placeholder="e.g. HOT DEAL, NEW, 50% OFF"
              placeholderTextColor="#9ca3af"
              value={form.badge_text}
              onChangeText={v => setForm(f => ({ ...f, badge_text: v }))}
            />

            <Text style={styles.fieldLabel}>CTA Button Text</Text>
            <TextInput
              style={styles.input}
              placeholder="e.g. Book Now, Learn More"
              placeholderTextColor="#9ca3af"
              value={form.action_text}
              onChangeText={v => setForm(f => ({ ...f, action_text: v }))}
            />

            <Text style={styles.fieldLabel}>CTA Link (optional)</Text>
            <View style={styles.linkRow}>
              <Link size={16} color="#9ca3af" />
              <TextInput
                style={[styles.input, { flex: 1, marginBottom: 0 }]}
                placeholder="https://..."
                placeholderTextColor="#9ca3af"
                value={form.action_url}
                onChangeText={v => setForm(f => ({ ...f, action_url: v }))}
                autoCapitalize="none"
                keyboardType="url"
              />
            </View>

            <Text style={styles.fieldLabel}>Display Mode</Text>
            <View style={styles.segRow}>
              {MODE_OPTIONS.map(opt => (
                <TouchableOpacity
                  key={opt.value}
                  style={[styles.segItem, form.display_mode === opt.value && styles.segItemActive]}
                  onPress={() => setForm(f => ({ ...f, display_mode: opt.value }))}
                  activeOpacity={0.8}
                >
                  <Text style={[styles.segLabel, form.display_mode === opt.value && styles.segLabelActive]}>{opt.label}</Text>
                  <Text style={[styles.segDesc, form.display_mode === opt.value && styles.segDescActive]}>{opt.desc}</Text>
                </TouchableOpacity>
              ))}
            </View>

            <Text style={styles.fieldLabel}>Display Frequency</Text>
            <View style={styles.segRow}>
              {FREQ_OPTIONS.map(opt => (
                <TouchableOpacity
                  key={opt.value}
                  style={[styles.segItem, form.display_frequency === opt.value && styles.segItemActive]}
                  onPress={() => setForm(f => ({ ...f, display_frequency: opt.value }))}
                  activeOpacity={0.8}
                >
                  <Text style={[styles.segLabel, form.display_frequency === opt.value && styles.segLabelActive]}>{opt.label}</Text>
                  <Text style={[styles.segDesc, form.display_frequency === opt.value && styles.segDescActive]}>{opt.desc}</Text>
                </TouchableOpacity>
              ))}
            </View>

            <Text style={styles.fieldLabel}>Priority (higher = shown first)</Text>
            <TextInput
              style={styles.input}
              placeholder="0"
              placeholderTextColor="#9ca3af"
              value={form.priority}
              onChangeText={v => setForm(f => ({ ...f, priority: v.replace(/[^0-9]/g, '') }))}
              keyboardType="number-pad"
            />

            <View style={styles.activeRow}>
              <View>
                <Text style={styles.fieldLabel}>Active</Text>
                <Text style={styles.activeDesc}>Show this advert to customers</Text>
              </View>
              <Switch
                value={form.is_active}
                onValueChange={v => setForm(f => ({ ...f, is_active: v }))}
                trackColor={{ false: '#e5e7eb', true: '#fed7aa' }}
                thumbColor={form.is_active ? '#f97316' : '#9ca3af'}
              />
            </View>

            <TouchableOpacity style={[styles.saveBtn, saving && styles.saveBtnDisabled]} onPress={handleSave} activeOpacity={0.85} disabled={saving}>
              <LinearGradient colors={saving ? ['#d1d5db', '#d1d5db'] : ['#f97316', '#ea580c']} style={styles.saveBtnGrad} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}>
                <Text style={styles.saveBtnText}>{saving ? 'Saving...' : editTarget ? 'Save Changes' : 'Create Advert'}</Text>
              </LinearGradient>
            </TouchableOpacity>
          </ScrollView>
        </View>
      </Modal>

      <Toast visible={toast.visible} message={toast.message} type={toast.type} duration={3000} onDismiss={() => setToast(t => ({ ...t, visible: false }))} />
      <ConfirmDialog visible={confirmDialog.visible} title={confirmDialog.title} message={confirmDialog.message} onConfirm={confirmDialog.onConfirm} onCancel={() => setConfirmDialog(d => ({ ...d, visible: false }))} />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#f1f5f9' },
  topBar: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingHorizontal: 20, paddingTop: 18, paddingBottom: 14,
    backgroundColor: '#ffffff', borderBottomWidth: 1, borderBottomColor: '#e5e7eb',
  },
  pageTitle: { fontSize: 20, fontFamily: Fonts.bold, color: '#111827' },
  pageSubtitle: { fontSize: 13, fontFamily: Fonts.regular, color: '#9ca3af', marginTop: 2 },
  createBtn: { borderRadius: 12, overflow: 'hidden' },
  createBtnGrad: { flexDirection: 'row', alignItems: 'center', gap: 7, paddingHorizontal: 16, paddingVertical: 10 },
  createBtnText: { fontSize: 14, fontFamily: Fonts.bold, color: '#ffffff' },
  list: { flex: 1 },
  listContent: { padding: 16, gap: 12 },
  emptyWrap: { alignItems: 'center', paddingVertical: 72, gap: 12 },
  emptyTitle: { fontSize: 18, fontFamily: Fonts.bold, color: '#374151' },
  emptyText: { fontSize: 14, fontFamily: Fonts.regular, color: '#9ca3af', textAlign: 'center', maxWidth: 260, lineHeight: 20 },
  card: {
    backgroundColor: '#ffffff', borderRadius: 16, overflow: 'hidden',
    borderWidth: 1, borderColor: '#e5e7eb',
    ...Platform.select({
      ios: { shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.06, shadowRadius: 8 },
      android: { elevation: 2 },
      web: { boxShadow: '0 2px 8px rgba(0,0,0,0.06)' } as any,
    }),
  },
  cardInactive: { opacity: 0.55 },
  cardImg: { width: '100%', height: 120 },
  cardImgPlaceholder: { width: '100%', height: 120, alignItems: 'center', justifyContent: 'center' },
  cardBody: { padding: 14 },
  cardTopRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 },
  cardBadge: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 10, paddingVertical: 4, borderRadius: 20 },
  cardBadgeText: { fontSize: 11, fontFamily: Fonts.bold, textTransform: 'uppercase', letterSpacing: 0.5 },
  cardMeta: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  modePill: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8 },
  modePillText: { fontSize: 11, fontFamily: Fonts.semiBold },
  prioChip: { backgroundColor: '#f3f4f6', paddingHorizontal: 7, paddingVertical: 3, borderRadius: 8 },
  prioText: { fontSize: 11, fontFamily: Fonts.bold, color: '#6b7280' },
  cardTitle: { fontSize: 15, fontFamily: Fonts.bold, color: '#111827', marginBottom: 4 },
  cardDesc: { fontSize: 13, fontFamily: Fonts.regular, color: '#6b7280', lineHeight: 18, marginBottom: 10 },
  cardFooter: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 4 },
  toggleBtn: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  toggleText: { fontSize: 13, fontFamily: Fonts.semiBold },
  cardActions: { flexDirection: 'row', gap: 8 },
  actionIconBtn: { width: 34, height: 34, borderRadius: 10, backgroundColor: '#eff6ff', alignItems: 'center', justifyContent: 'center' },
  deleteIconBtn: { backgroundColor: '#fff5f5' },
  modal: { flex: 1, backgroundColor: '#ffffff' },
  modalHandle: { width: 36, height: 4, backgroundColor: '#e5e7eb', borderRadius: 2, alignSelf: 'center', marginTop: 12 },
  modalHeader: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingHorizontal: 24, paddingVertical: 18, borderBottomWidth: 1, borderBottomColor: '#f3f4f6',
  },
  modalTitle: { fontSize: 20, fontFamily: Fonts.bold, color: '#111827' },
  modalBody: { flex: 1, paddingHorizontal: 24, paddingTop: 20 },
  fieldLabel: { fontSize: 13, fontFamily: Fonts.semiBold, color: '#374151', marginBottom: 8, marginTop: 16 },
  input: {
    backgroundColor: '#f9fafb', borderWidth: 1, borderColor: '#e5e7eb', borderRadius: 12,
    paddingHorizontal: 14, paddingVertical: 12, fontSize: 15, fontFamily: Fonts.regular, color: '#111827',
    marginBottom: 0,
  },
  textarea: { minHeight: 80 },
  imageRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  imgPickBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: '#fff7ed', borderWidth: 1, borderColor: '#fed7aa', borderRadius: 12,
    paddingHorizontal: 14, paddingVertical: 12,
  },
  imgPickText: { fontSize: 13, fontFamily: Fonts.semiBold, color: '#f97316' },
  imagePreview: { width: '100%', height: 140, borderRadius: 12, marginTop: 12 },
  linkRow: { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: '#f9fafb', borderWidth: 1, borderColor: '#e5e7eb', borderRadius: 12, paddingHorizontal: 14 },
  dropdownBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    backgroundColor: '#f9fafb', borderWidth: 1, borderColor: '#e5e7eb', borderRadius: 12,
    paddingHorizontal: 14, paddingVertical: 12,
  },
  dropdownBtnText: { flex: 1, fontSize: 15, fontFamily: Fonts.regular, color: '#111827' },
  dropBadgeDot: { width: 28, height: 28, borderRadius: 8, alignItems: 'center', justifyContent: 'center' },
  dropdown: { backgroundColor: '#ffffff', borderWidth: 1, borderColor: '#e5e7eb', borderRadius: 12, marginTop: 4, overflow: 'hidden' },
  dropItem: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 14, paddingVertical: 12 },
  dropItemActive: { backgroundColor: '#fff7ed' },
  dropItemText: { fontSize: 15, fontFamily: Fonts.regular, color: '#374151' },
  segRow: { flexDirection: 'row', gap: 8 },
  segItem: {
    flex: 1, backgroundColor: '#f9fafb', borderWidth: 1.5, borderColor: '#e5e7eb',
    borderRadius: 12, padding: 12, alignItems: 'center',
  },
  segItemActive: { backgroundColor: '#fff7ed', borderColor: '#f97316' },
  segLabel: { fontSize: 13, fontFamily: Fonts.bold, color: '#6b7280', marginBottom: 3 },
  segLabelActive: { color: '#f97316' },
  segDesc: { fontSize: 11, fontFamily: Fonts.regular, color: '#9ca3af', textAlign: 'center' },
  segDescActive: { color: '#c2410c' },
  activeRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    backgroundColor: '#f9fafb', borderRadius: 14, paddingHorizontal: 16, paddingVertical: 14, marginTop: 16,
  },
  activeDesc: { fontSize: 12, fontFamily: Fonts.regular, color: '#9ca3af', marginTop: 2 },
  saveBtn: { marginTop: 24, borderRadius: 16, overflow: 'hidden' },
  saveBtnDisabled: { opacity: 0.7 },
  saveBtnGrad: { paddingVertical: 18, alignItems: 'center' },
  saveBtnText: { fontSize: 16, fontFamily: Fonts.bold, color: '#ffffff', letterSpacing: 0.3 },
});
