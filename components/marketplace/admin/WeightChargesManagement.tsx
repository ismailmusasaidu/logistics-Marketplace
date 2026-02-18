import { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
  Alert,
  Platform,
  Switch,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  Scale,
  Plus,
  Pencil,
  Trash2,
  X,
  Check,
  ChevronUp,
  ChevronDown,
  Info,
} from 'lucide-react-native';
import { supabase } from '@/lib/marketplace/supabase';
import { Fonts } from '@/constants/fonts';

interface WeightTier {
  id: string;
  min_weight_kg: number;
  max_weight_kg: number | null;
  charge_amount: number;
  label: string;
  is_active: boolean;
  display_order: number;
  created_at: string;
  updated_at: string;
}

interface TierFormData {
  label: string;
  min_weight_kg: string;
  max_weight_kg: string;
  charge_amount: string;
  is_active: boolean;
}

const EMPTY_FORM: TierFormData = {
  label: '',
  min_weight_kg: '',
  max_weight_kg: '',
  charge_amount: '',
  is_active: true,
};

export default function WeightChargesManagement() {
  const insets = useSafeAreaInsets();
  const [tiers, setTiers] = useState<WeightTier[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<TierFormData>(EMPTY_FORM);
  const [formError, setFormError] = useState('');

  useEffect(() => {
    fetchTiers();
  }, []);

  const fetchTiers = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('weight_surcharge_tiers')
        .select('*')
        .order('display_order', { ascending: true });
      if (error) throw error;
      setTiers(data || []);
    } catch (err: any) {
      console.error('Error fetching tiers:', err);
    } finally {
      setLoading(false);
    }
  };

  const openAdd = () => {
    setEditingId(null);
    setForm(EMPTY_FORM);
    setFormError('');
    setShowForm(true);
  };

  const openEdit = (tier: WeightTier) => {
    setEditingId(tier.id);
    setForm({
      label: tier.label,
      min_weight_kg: String(tier.min_weight_kg),
      max_weight_kg: tier.max_weight_kg != null ? String(tier.max_weight_kg) : '',
      charge_amount: String(tier.charge_amount),
      is_active: tier.is_active,
    });
    setFormError('');
    setShowForm(true);
  };

  const closeForm = () => {
    setShowForm(false);
    setEditingId(null);
    setForm(EMPTY_FORM);
    setFormError('');
  };

  const validate = (): boolean => {
    if (!form.label.trim()) {
      setFormError('Tier label is required.');
      return false;
    }
    const min = parseFloat(form.min_weight_kg);
    if (isNaN(min) || min < 0) {
      setFormError('Min weight must be a non-negative number.');
      return false;
    }
    if (form.max_weight_kg.trim() !== '') {
      const max = parseFloat(form.max_weight_kg);
      if (isNaN(max) || max <= min) {
        setFormError('Max weight must be greater than min weight.');
        return false;
      }
    }
    const charge = parseFloat(form.charge_amount);
    if (isNaN(charge) || charge < 0) {
      setFormError('Charge amount must be a non-negative number.');
      return false;
    }
    setFormError('');
    return true;
  };

  const handleSave = async () => {
    if (!validate()) return;
    try {
      setSaving(true);
      const payload = {
        label: form.label.trim(),
        min_weight_kg: parseFloat(form.min_weight_kg),
        max_weight_kg: form.max_weight_kg.trim() !== '' ? parseFloat(form.max_weight_kg) : null,
        charge_amount: parseFloat(form.charge_amount),
        is_active: form.is_active,
        display_order: editingId
          ? (tiers.find((t) => t.id === editingId)?.display_order ?? tiers.length)
          : tiers.length,
      };

      if (editingId) {
        const { error } = await supabase
          .from('weight_surcharge_tiers')
          .update(payload)
          .eq('id', editingId);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('weight_surcharge_tiers')
          .insert(payload);
        if (error) throw error;
      }

      await fetchTiers();
      closeForm();
    } catch (err: any) {
      setFormError(err.message || 'Failed to save tier.');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = (tier: WeightTier) => {
    Alert.alert(
      'Delete Tier',
      `Delete "${tier.label}"? This cannot be undone.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              const { error } = await supabase
                .from('weight_surcharge_tiers')
                .delete()
                .eq('id', tier.id);
              if (error) throw error;
              await fetchTiers();
            } catch (err: any) {
              Alert.alert('Error', err.message || 'Failed to delete tier.');
            }
          },
        },
      ]
    );
  };

  const handleToggleActive = async (tier: WeightTier) => {
    try {
      const { error } = await supabase
        .from('weight_surcharge_tiers')
        .update({ is_active: !tier.is_active })
        .eq('id', tier.id);
      if (error) throw error;
      setTiers((prev) =>
        prev.map((t) => (t.id === tier.id ? { ...t, is_active: !t.is_active } : t))
      );
    } catch (err: any) {
      Alert.alert('Error', err.message || 'Failed to update tier.');
    }
  };

  const handleMoveOrder = async (index: number, direction: 'up' | 'down') => {
    const swapIndex = direction === 'up' ? index - 1 : index + 1;
    if (swapIndex < 0 || swapIndex >= tiers.length) return;

    const updated = [...tiers];
    const temp = updated[index];
    updated[index] = updated[swapIndex];
    updated[swapIndex] = temp;

    const reordered = updated.map((t, i) => ({ ...t, display_order: i }));
    setTiers(reordered);

    try {
      await Promise.all(
        reordered.map((t) =>
          supabase
            .from('weight_surcharge_tiers')
            .update({ display_order: t.display_order })
            .eq('id', t.id)
        )
      );
    } catch (err) {
      fetchTiers();
    }
  };

  const formatWeight = (kg: number | null) =>
    kg != null ? `${kg} kg` : 'No limit';

  const formatCharge = (amount: number) =>
    `₦${amount.toLocaleString('en-NG', { minimumFractionDigits: 2 })}`;

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color="#ff8c00" />
      </View>
    );
  }

  return (
    <View style={styles.root}>
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.infoCard}>
          <View style={styles.infoIconWrap}>
            <Info size={16} color="#0369a1" />
          </View>
          <Text style={styles.infoText}>
            Define weight-based surcharge tiers. When a customer's cart total weight falls within a
            tier's range, the charge amount is added to their cart total automatically.
          </Text>
        </View>

        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Surcharge Tiers</Text>
          <TouchableOpacity style={styles.addBtn} onPress={openAdd} activeOpacity={0.8}>
            <Plus size={16} color="#ffffff" />
            <Text style={styles.addBtnText}>Add Tier</Text>
          </TouchableOpacity>
        </View>

        {tiers.length === 0 ? (
          <View style={styles.emptyBox}>
            <Scale size={40} color="#d1d5db" />
            <Text style={styles.emptyTitle}>No tiers configured</Text>
            <Text style={styles.emptyText}>
              Tap "Add Tier" to create your first weight-based surcharge.
            </Text>
          </View>
        ) : (
          tiers.map((tier, index) => (
            <View key={tier.id} style={[styles.tierCard, !tier.is_active && styles.tierCardInactive]}>
              <View style={styles.tierTop}>
                <View style={styles.tierOrderBtns}>
                  <TouchableOpacity
                    onPress={() => handleMoveOrder(index, 'up')}
                    disabled={index === 0}
                    style={[styles.orderBtn, index === 0 && styles.orderBtnDisabled]}
                  >
                    <ChevronUp size={14} color={index === 0 ? '#d1d5db' : '#64748b'} />
                  </TouchableOpacity>
                  <TouchableOpacity
                    onPress={() => handleMoveOrder(index, 'down')}
                    disabled={index === tiers.length - 1}
                    style={[styles.orderBtn, index === tiers.length - 1 && styles.orderBtnDisabled]}
                  >
                    <ChevronDown size={14} color={index === tiers.length - 1 ? '#d1d5db' : '#64748b'} />
                  </TouchableOpacity>
                </View>

                <View style={styles.tierInfo}>
                  <Text style={[styles.tierLabel, !tier.is_active && styles.tierLabelInactive]}>
                    {tier.label}
                  </Text>
                  <View style={styles.tierRangeRow}>
                    <Scale size={12} color="#64748b" />
                    <Text style={styles.tierRange}>
                      {formatWeight(tier.min_weight_kg)} — {formatWeight(tier.max_weight_kg)}
                    </Text>
                  </View>
                </View>

                <View style={styles.tierRight}>
                  <Text style={[styles.tierCharge, !tier.is_active && styles.tierChargeInactive]}>
                    +{formatCharge(tier.charge_amount)}
                  </Text>
                  <View style={[styles.statusBadge, tier.is_active ? styles.statusActive : styles.statusInactive]}>
                    <Text style={[styles.statusText, tier.is_active ? styles.statusTextActive : styles.statusTextInactive]}>
                      {tier.is_active ? 'Active' : 'Off'}
                    </Text>
                  </View>
                </View>
              </View>

              <View style={styles.tierActions}>
                <Switch
                  value={tier.is_active}
                  onValueChange={() => handleToggleActive(tier)}
                  trackColor={{ false: '#e2e8f0', true: '#fed7aa' }}
                  thumbColor={tier.is_active ? '#ff8c00' : '#94a3b8'}
                />
                <Text style={styles.switchLabel}>{tier.is_active ? 'Enabled' : 'Disabled'}</Text>
                <View style={styles.tierActionBtns}>
                  <TouchableOpacity
                    style={styles.editBtn}
                    onPress={() => openEdit(tier)}
                    activeOpacity={0.7}
                  >
                    <Pencil size={14} color="#ff8c00" />
                    <Text style={styles.editBtnText}>Edit</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={styles.deleteBtn}
                    onPress={() => handleDelete(tier)}
                    activeOpacity={0.7}
                  >
                    <Trash2 size={14} color="#ef4444" />
                    <Text style={styles.deleteBtnText}>Delete</Text>
                  </TouchableOpacity>
                </View>
              </View>
            </View>
          ))
        )}

        <View style={{ height: 40 }} />
      </ScrollView>

      {showForm && (
        <View style={styles.formOverlay}>
          <View style={[styles.formSheet, { paddingBottom: insets.bottom + 16 }]}>
            <View style={styles.formHeader}>
              <Text style={styles.formTitle}>
                {editingId ? 'Edit Tier' : 'New Weight Surcharge Tier'}
              </Text>
              <TouchableOpacity onPress={closeForm} style={styles.closeBtn}>
                <X size={20} color="#64748b" />
              </TouchableOpacity>
            </View>

            <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
              <View style={styles.field}>
                <Text style={styles.fieldLabel}>Tier Label *</Text>
                <TextInput
                  style={[styles.input, Platform.OS === 'web' && { outlineStyle: 'none' } as any]}
                  value={form.label}
                  onChangeText={(v) => setForm({ ...form, label: v })}
                  placeholder="e.g. Heavy order surcharge"
                  placeholderTextColor="#94a3b8"
                />
              </View>

              <View style={styles.fieldRow}>
                <View style={[styles.field, { flex: 1 }]}>
                  <Text style={styles.fieldLabel}>Min Weight (kg) *</Text>
                  <TextInput
                    style={[styles.input, Platform.OS === 'web' && { outlineStyle: 'none' } as any]}
                    value={form.min_weight_kg}
                    onChangeText={(v) => setForm({ ...form, min_weight_kg: v })}
                    placeholder="0"
                    placeholderTextColor="#94a3b8"
                    keyboardType="decimal-pad"
                  />
                </View>
                <View style={[styles.field, { flex: 1 }]}>
                  <Text style={styles.fieldLabel}>Max Weight (kg)</Text>
                  <TextInput
                    style={[styles.input, Platform.OS === 'web' && { outlineStyle: 'none' } as any]}
                    value={form.max_weight_kg}
                    onChangeText={(v) => setForm({ ...form, max_weight_kg: v })}
                    placeholder="Leave empty = no limit"
                    placeholderTextColor="#94a3b8"
                    keyboardType="decimal-pad"
                  />
                </View>
              </View>

              <View style={styles.field}>
                <Text style={styles.fieldLabel}>Charge Amount (₦) *</Text>
                <TextInput
                  style={[styles.input, Platform.OS === 'web' && { outlineStyle: 'none' } as any]}
                  value={form.charge_amount}
                  onChangeText={(v) => setForm({ ...form, charge_amount: v })}
                  placeholder="0.00"
                  placeholderTextColor="#94a3b8"
                  keyboardType="decimal-pad"
                />
              </View>

              <View style={styles.switchRow}>
                <View>
                  <Text style={styles.fieldLabel}>Active</Text>
                  <Text style={styles.switchHint}>Apply this tier to customer carts</Text>
                </View>
                <Switch
                  value={form.is_active}
                  onValueChange={(v) => setForm({ ...form, is_active: v })}
                  trackColor={{ false: '#e2e8f0', true: '#fed7aa' }}
                  thumbColor={form.is_active ? '#ff8c00' : '#94a3b8'}
                />
              </View>

              {formError !== '' && (
                <View style={styles.errorBox}>
                  <Text style={styles.errorText}>{formError}</Text>
                </View>
              )}

              <TouchableOpacity
                style={[styles.saveBtn, saving && styles.saveBtnDisabled]}
                onPress={handleSave}
                disabled={saving}
                activeOpacity={0.8}
              >
                {saving ? (
                  <ActivityIndicator size="small" color="#ffffff" />
                ) : (
                  <>
                    <Check size={18} color="#ffffff" />
                    <Text style={styles.saveBtnText}>
                      {editingId ? 'Save Changes' : 'Create Tier'}
                    </Text>
                  </>
                )}
              </TouchableOpacity>
            </ScrollView>
          </View>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: '#f8f9fb',
  },
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    padding: 16,
  },
  infoCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    backgroundColor: '#f0f9ff',
    borderRadius: 12,
    padding: 14,
    borderWidth: 1,
    borderColor: '#bae6fd',
    marginBottom: 20,
  },
  infoIconWrap: {
    marginTop: 1,
  },
  infoText: {
    flex: 1,
    fontSize: 13,
    fontFamily: Fonts.regular,
    color: '#0369a1',
    lineHeight: 19,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 17,
    fontFamily: Fonts.heading,
    color: '#1a1d23',
  },
  addBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#ff8c00',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 10,
  },
  addBtnText: {
    fontSize: 13,
    fontFamily: Fonts.semiBold,
    color: '#ffffff',
  },
  emptyBox: {
    alignItems: 'center',
    padding: 48,
    backgroundColor: '#ffffff',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#f0f1f3',
    gap: 8,
  },
  emptyTitle: {
    fontSize: 16,
    fontFamily: Fonts.semiBold,
    color: '#334155',
    marginTop: 4,
  },
  emptyText: {
    fontSize: 13,
    fontFamily: Fonts.regular,
    color: '#94a3b8',
    textAlign: 'center',
  },
  tierCard: {
    backgroundColor: '#ffffff',
    borderRadius: 16,
    padding: 14,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: '#f0f1f3',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 4,
    elevation: 1,
  },
  tierCardInactive: {
    opacity: 0.65,
  },
  tierTop: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 12,
  },
  tierOrderBtns: {
    gap: 2,
  },
  orderBtn: {
    width: 26,
    height: 26,
    borderRadius: 6,
    backgroundColor: '#f8f9fb',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    justifyContent: 'center',
    alignItems: 'center',
  },
  orderBtnDisabled: {
    opacity: 0.4,
  },
  tierInfo: {
    flex: 1,
  },
  tierLabel: {
    fontSize: 15,
    fontFamily: Fonts.semiBold,
    color: '#1a1d23',
    marginBottom: 4,
  },
  tierLabelInactive: {
    color: '#94a3b8',
  },
  tierRangeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  tierRange: {
    fontSize: 12,
    fontFamily: Fonts.medium,
    color: '#64748b',
  },
  tierRight: {
    alignItems: 'flex-end',
    gap: 6,
  },
  tierCharge: {
    fontSize: 17,
    fontFamily: Fonts.groteskBold,
    color: '#ff8c00',
    letterSpacing: -0.3,
  },
  tierChargeInactive: {
    color: '#94a3b8',
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  statusActive: {
    backgroundColor: '#ecfdf5',
  },
  statusInactive: {
    backgroundColor: '#f1f5f9',
  },
  statusText: {
    fontSize: 11,
    fontFamily: Fonts.semiBold,
  },
  statusTextActive: {
    color: '#16a34a',
  },
  statusTextInactive: {
    color: '#94a3b8',
  },
  tierActions: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: '#f0f1f3',
    gap: 8,
  },
  switchLabel: {
    fontSize: 12,
    fontFamily: Fonts.medium,
    color: '#64748b',
    flex: 1,
  },
  tierActionBtns: {
    flexDirection: 'row',
    gap: 8,
  },
  editBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    backgroundColor: '#fff7ed',
    borderWidth: 1,
    borderColor: '#fed7aa',
  },
  editBtnText: {
    fontSize: 12,
    fontFamily: Fonts.semiBold,
    color: '#ff8c00',
  },
  deleteBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    backgroundColor: '#fef2f2',
    borderWidth: 1,
    borderColor: '#fecaca',
  },
  deleteBtnText: {
    fontSize: 12,
    fontFamily: Fonts.semiBold,
    color: '#ef4444',
  },
  formOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.45)',
    justifyContent: 'flex-end',
  },
  formSheet: {
    backgroundColor: '#ffffff',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 20,
    maxHeight: '88%',
  },
  formHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  formTitle: {
    fontSize: 18,
    fontFamily: Fonts.heading,
    color: '#1a1d23',
  },
  closeBtn: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: '#f1f5f9',
    justifyContent: 'center',
    alignItems: 'center',
  },
  fieldRow: {
    flexDirection: 'row',
    gap: 12,
  },
  field: {
    marginBottom: 14,
  },
  fieldLabel: {
    fontSize: 13,
    fontFamily: Fonts.semiBold,
    color: '#374151',
    marginBottom: 6,
  },
  input: {
    backgroundColor: '#f8f9fb',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    paddingHorizontal: 14,
    paddingVertical: 11,
    fontSize: 14,
    fontFamily: Fonts.regular,
    color: '#1a1d23',
  },
  switchRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#f8f9fb',
    borderRadius: 12,
    padding: 14,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  switchHint: {
    fontSize: 12,
    fontFamily: Fonts.regular,
    color: '#94a3b8',
    marginTop: 2,
  },
  errorBox: {
    backgroundColor: '#fef2f2',
    borderRadius: 10,
    padding: 12,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: '#fecaca',
  },
  errorText: {
    fontSize: 13,
    fontFamily: Fonts.medium,
    color: '#dc2626',
  },
  saveBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#ff8c00',
    borderRadius: 12,
    paddingVertical: 14,
    marginBottom: 8,
    shadowColor: '#ff8c00',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 4,
  },
  saveBtnDisabled: {
    opacity: 0.6,
  },
  saveBtnText: {
    fontSize: 15,
    fontFamily: Fonts.semiBold,
    color: '#ffffff',
  },
});
