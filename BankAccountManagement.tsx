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
  Modal,
} from 'react-native';
import { Building2, Plus, Edit2, Trash2, Eye, EyeOff } from 'lucide-react-native';
import { supabase } from '@/lib/supabase';

interface BankAccount {
  id: string;
  bank_name: string;
  account_number: string;
  account_name: string;
  description: string;
  is_active: boolean;
  display_order: number;
  created_at: string;
  updated_at: string;
}

export default function BankAccountManagement() {
  const [accounts, setAccounts] = useState<BankAccount[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingAccount, setEditingAccount] = useState<BankAccount | null>(null);
  const [formData, setFormData] = useState({
    bank_name: '',
    account_number: '',
    account_name: '',
    description: 'Please include your Order ID in the transfer description/narration. Example: "Payment for Order ORD-123456"',
    is_active: true,
    display_order: 0,
  });
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    fetchAccounts();
  }, []);

  const fetchAccounts = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('bank_accounts')
        .select('*')
        .order('display_order');

      if (error) throw error;
      setAccounts(data || []);
    } catch (error) {
      console.error('Error fetching bank accounts:', error);
      Alert.alert('Error', 'Failed to load bank accounts');
    } finally {
      setLoading(false);
    }
  };

  const handleAdd = () => {
    const maxOrder = accounts.reduce((max, acc) => Math.max(max, acc.display_order), 0);
    setFormData({
      bank_name: '',
      account_number: '',
      account_name: '',
      description: 'Please include your Order ID in the transfer description/narration. Example: "Payment for Order ORD-123456"',
      is_active: true,
      display_order: maxOrder + 1,
    });
    setEditingAccount(null);
    setShowAddModal(true);
  };

  const handleEdit = (account: BankAccount) => {
    setFormData({
      bank_name: account.bank_name,
      account_number: account.account_number,
      account_name: account.account_name,
      description: account.description || '',
      is_active: account.is_active,
      display_order: account.display_order,
    });
    setEditingAccount(account);
    setShowAddModal(true);
  };

  const handleSubmit = async () => {
    if (!formData.bank_name.trim()) {
      Alert.alert('Error', 'Please enter bank name');
      return;
    }
    if (!formData.account_number.trim()) {
      Alert.alert('Error', 'Please enter account number');
      return;
    }
    if (!formData.account_name.trim()) {
      Alert.alert('Error', 'Please enter account name');
      return;
    }

    try {
      setSubmitting(true);

      if (editingAccount) {
        const { error } = await supabase
          .from('bank_accounts')
          .update({
            bank_name: formData.bank_name,
            account_number: formData.account_number,
            account_name: formData.account_name,
            description: formData.description,
            is_active: formData.is_active,
            display_order: formData.display_order,
            updated_at: new Date().toISOString(),
          })
          .eq('id', editingAccount.id);

        if (error) throw error;
        Alert.alert('Success', 'Bank account updated successfully');
      } else {
        const { error } = await supabase
          .from('bank_accounts')
          .insert({
            bank_name: formData.bank_name,
            account_number: formData.account_number,
            account_name: formData.account_name,
            description: formData.description,
            is_active: formData.is_active,
            display_order: formData.display_order,
          });

        if (error) throw error;
        Alert.alert('Success', 'Bank account added successfully');
      }

      setShowAddModal(false);
      fetchAccounts();
    } catch (error) {
      console.error('Error saving bank account:', error);
      Alert.alert('Error', 'Failed to save bank account');
    } finally {
      setSubmitting(false);
    }
  };

  const handleToggleActive = async (account: BankAccount) => {
    try {
      const { error } = await supabase
        .from('bank_accounts')
        .update({
          is_active: !account.is_active,
          updated_at: new Date().toISOString(),
        })
        .eq('id', account.id);

      if (error) throw error;
      fetchAccounts();
    } catch (error) {
      console.error('Error toggling account status:', error);
      Alert.alert('Error', 'Failed to update account status');
    }
  };

  const handleDelete = async (account: BankAccount) => {
    Alert.alert(
      'Delete Bank Account',
      `Are you sure you want to delete ${account.bank_name} account?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              const { error } = await supabase
                .from('bank_accounts')
                .delete()
                .eq('id', account.id);

              if (error) throw error;
              Alert.alert('Success', 'Bank account deleted successfully');
              fetchAccounts();
            } catch (error) {
              console.error('Error deleting bank account:', error);
              Alert.alert('Error', 'Failed to delete bank account');
            }
          },
        },
      ]
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
      <View style={styles.header}>
        <View style={styles.headerContent}>
          <Building2 size={24} color="#ff8c00" />
          <View style={styles.headerText}>
            <Text style={styles.headerTitle}>Bank Account Management</Text>
            <Text style={styles.headerSubtitle}>Manage bank transfer payment accounts</Text>
          </View>
        </View>
        <TouchableOpacity style={styles.addButton} onPress={handleAdd}>
          <Plus size={20} color="#ffffff" />
          <Text style={styles.addButtonText}>Add Account</Text>
        </TouchableOpacity>
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        {accounts.length === 0 ? (
          <View style={styles.emptyState}>
            <Building2 size={64} color="#cbd5e1" />
            <Text style={styles.emptyTitle}>No Bank Accounts</Text>
            <Text style={styles.emptySubtitle}>
              Add bank accounts for customers to transfer payments
            </Text>
          </View>
        ) : (
          accounts.map((account) => (
            <View
              key={account.id}
              style={[
                styles.accountCard,
                !account.is_active && styles.accountCardInactive,
              ]}
            >
              <View style={styles.accountHeader}>
                <View style={styles.accountHeaderLeft}>
                  <Text style={styles.accountBankName}>{account.bank_name}</Text>
                  <View style={styles.statusBadge}>
                    <View
                      style={[
                        styles.statusDot,
                        account.is_active
                          ? styles.statusDotActive
                          : styles.statusDotInactive,
                      ]}
                    />
                    <Text
                      style={[
                        styles.statusText,
                        account.is_active
                          ? styles.statusTextActive
                          : styles.statusTextInactive,
                      ]}
                    >
                      {account.is_active ? 'Active' : 'Inactive'}
                    </Text>
                  </View>
                </View>
                <Text style={styles.displayOrder}>Order: {account.display_order}</Text>
              </View>

              <View style={styles.accountDetails}>
                <View style={styles.detailRow}>
                  <Text style={styles.detailLabel}>Account Number:</Text>
                  <Text style={styles.detailValue}>{account.account_number}</Text>
                </View>
                <View style={styles.detailRow}>
                  <Text style={styles.detailLabel}>Account Name:</Text>
                  <Text style={styles.detailValue}>{account.account_name}</Text>
                </View>
                {account.description && (
                  <View style={styles.instructionsContainer}>
                    <Text style={styles.instructionsLabel}>Instructions:</Text>
                    <Text style={styles.instructionsText}>{account.description}</Text>
                  </View>
                )}
              </View>

              <View style={styles.accountActions}>
                <TouchableOpacity
                  style={styles.actionButton}
                  onPress={() => handleToggleActive(account)}
                >
                  {account.is_active ? (
                    <EyeOff size={18} color="#64748b" />
                  ) : (
                    <Eye size={18} color="#64748b" />
                  )}
                  <Text style={styles.actionButtonText}>
                    {account.is_active ? 'Deactivate' : 'Activate'}
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.actionButton}
                  onPress={() => handleEdit(account)}
                >
                  <Edit2 size={18} color="#64748b" />
                  <Text style={styles.actionButtonText}>Edit</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[styles.actionButton, styles.deleteButton]}
                  onPress={() => handleDelete(account)}
                >
                  <Trash2 size={18} color="#ef4444" />
                  <Text style={[styles.actionButtonText, styles.deleteButtonText]}>
                    Delete
                  </Text>
                </TouchableOpacity>
              </View>
            </View>
          ))
        )}
      </ScrollView>

      <Modal
        visible={showAddModal}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setShowAddModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>
                {editingAccount ? 'Edit Bank Account' : 'Add Bank Account'}
              </Text>
              <TouchableOpacity onPress={() => setShowAddModal(false)}>
                <Text style={styles.closeButton}>✕</Text>
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.modalBody} showsVerticalScrollIndicator={false}>
              <Text style={styles.inputLabel}>Bank Name *</Text>
              <TextInput
                style={styles.input}
                placeholder="e.g., First Bank of Nigeria"
                value={formData.bank_name}
                onChangeText={(text) => setFormData({ ...formData, bank_name: text })}
              />

              <Text style={styles.inputLabel}>Account Number *</Text>
              <TextInput
                style={styles.input}
                placeholder="e.g., 1234567890"
                value={formData.account_number}
                onChangeText={(text) =>
                  setFormData({ ...formData, account_number: text })
                }
                keyboardType="numeric"
              />

              <Text style={styles.inputLabel}>Account Name *</Text>
              <TextInput
                style={styles.input}
                placeholder="e.g., FreshMart Store"
                value={formData.account_name}
                onChangeText={(text) =>
                  setFormData({ ...formData, account_name: text })
                }
              />

              <Text style={styles.inputLabel}>Instructions for Customers</Text>
              <TextInput
                style={[styles.input, styles.textArea]}
                placeholder="Instructions for customers making transfers..."
                value={formData.description}
                onChangeText={(text) => setFormData({ ...formData, description: text })}
                multiline
                numberOfLines={4}
              />

              <Text style={styles.inputLabel}>Display Order</Text>
              <TextInput
                style={styles.input}
                placeholder="Display order (1, 2, 3...)"
                value={formData.display_order.toString()}
                onChangeText={(text) =>
                  setFormData({ ...formData, display_order: parseInt(text) || 0 })
                }
                keyboardType="numeric"
              />

              <View style={styles.checkboxContainer}>
                <TouchableOpacity
                  style={styles.checkbox}
                  onPress={() =>
                    setFormData({ ...formData, is_active: !formData.is_active })
                  }
                >
                  <View
                    style={[
                      styles.checkboxBox,
                      formData.is_active && styles.checkboxBoxChecked,
                    ]}
                  >
                    {formData.is_active && <Text style={styles.checkmark}>✓</Text>}
                  </View>
                  <Text style={styles.checkboxLabel}>Active</Text>
                </TouchableOpacity>
              </View>
            </ScrollView>

            <View style={styles.modalFooter}>
              <TouchableOpacity
                style={styles.cancelButton}
                onPress={() => setShowAddModal(false)}
              >
                <Text style={styles.cancelButtonText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.submitButton, submitting && styles.buttonDisabled]}
                onPress={handleSubmit}
                disabled={submitting}
              >
                {submitting ? (
                  <ActivityIndicator color="#ffffff" />
                ) : (
                  <Text style={styles.submitButtonText}>
                    {editingAccount ? 'Update' : 'Add'}
                  </Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f9fafb',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  header: {
    backgroundColor: '#ffffff',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
  },
  headerContent: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
    gap: 12,
  },
  headerText: {
    flex: 1,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#1f2937',
  },
  headerSubtitle: {
    fontSize: 14,
    color: '#6b7280',
    marginTop: 2,
  },
  addButton: {
    flexDirection: 'row',
    backgroundColor: '#ff8c00',
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 16,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  addButtonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '600',
  },
  content: {
    flex: 1,
    padding: 16,
  },
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#64748b',
    marginTop: 16,
  },
  emptySubtitle: {
    fontSize: 14,
    color: '#94a3b8',
    marginTop: 8,
    textAlign: 'center',
    paddingHorizontal: 40,
  },
  accountCard: {
    backgroundColor: '#ffffff',
    borderRadius: 16,
    padding: 20,
    marginBottom: 16,
    borderWidth: 2,
    borderColor: '#e5e7eb',
  },
  accountCardInactive: {
    opacity: 0.6,
    backgroundColor: '#f9fafb',
  },
  accountHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 16,
  },
  accountHeaderLeft: {
    flex: 1,
  },
  accountBankName: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1f2937',
    marginBottom: 8,
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  statusDotActive: {
    backgroundColor: '#10b981',
  },
  statusDotInactive: {
    backgroundColor: '#ef4444',
  },
  statusText: {
    fontSize: 14,
    fontWeight: '600',
  },
  statusTextActive: {
    color: '#10b981',
  },
  statusTextInactive: {
    color: '#ef4444',
  },
  displayOrder: {
    fontSize: 14,
    color: '#6b7280',
    fontWeight: '500',
  },
  accountDetails: {
    marginBottom: 16,
  },
  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  detailLabel: {
    fontSize: 14,
    color: '#6b7280',
    flex: 1,
  },
  detailValue: {
    fontSize: 14,
    color: '#1f2937',
    fontWeight: '600',
    flex: 1,
    textAlign: 'right',
  },
  instructionsContainer: {
    marginTop: 12,
    padding: 12,
    backgroundColor: '#f0f9ff',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#bfdbfe',
  },
  instructionsLabel: {
    fontSize: 12,
    color: '#1e40af',
    fontWeight: '600',
    marginBottom: 4,
  },
  instructionsText: {
    fontSize: 13,
    color: '#1e40af',
    lineHeight: 18,
  },
  accountActions: {
    flexDirection: 'row',
    gap: 8,
    borderTopWidth: 1,
    borderTopColor: '#e5e7eb',
    paddingTop: 16,
  },
  actionButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    paddingHorizontal: 12,
    backgroundColor: '#f9fafb',
    borderRadius: 8,
    gap: 6,
  },
  actionButtonText: {
    fontSize: 14,
    color: '#64748b',
    fontWeight: '600',
  },
  deleteButton: {
    backgroundColor: '#fef2f2',
  },
  deleteButtonText: {
    color: '#ef4444',
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
    borderRadius: 20,
    width: '100%',
    maxWidth: 500,
    maxHeight: '90%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#1f2937',
  },
  closeButton: {
    fontSize: 28,
    color: '#6b7280',
    fontWeight: '300',
  },
  modalBody: {
    padding: 20,
  },
  inputLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#374151',
    marginBottom: 8,
  },
  input: {
    backgroundColor: '#ffffff',
    borderRadius: 12,
    padding: 14,
    fontSize: 16,
    color: '#1f2937',
    borderWidth: 2,
    borderColor: '#e5e7eb',
    marginBottom: 16,
  },
  textArea: {
    minHeight: 100,
    textAlignVertical: 'top',
  },
  checkboxContainer: {
    marginBottom: 16,
  },
  checkbox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  checkboxBox: {
    width: 24,
    height: 24,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: '#d1d5db',
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkboxBoxChecked: {
    backgroundColor: '#ff8c00',
    borderColor: '#ff8c00',
  },
  checkmark: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '700',
  },
  checkboxLabel: {
    fontSize: 16,
    color: '#374151',
    fontWeight: '500',
  },
  modalFooter: {
    flexDirection: 'row',
    padding: 20,
    borderTopWidth: 1,
    borderTopColor: '#e5e7eb',
    gap: 12,
  },
  cancelButton: {
    flex: 1,
    paddingVertical: 14,
    paddingHorizontal: 20,
    backgroundColor: '#f3f4f6',
    borderRadius: 12,
    alignItems: 'center',
  },
  cancelButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#6b7280',
  },
  submitButton: {
    flex: 1,
    paddingVertical: 14,
    paddingHorizontal: 20,
    backgroundColor: '#ff8c00',
    borderRadius: 12,
    alignItems: 'center',
  },
  submitButtonText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#ffffff',
  },
  buttonDisabled: {
    opacity: 0.6,
  },
});
