import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  FlatList,
  StyleSheet,
  Alert,
  ActivityIndicator,
  Modal,
  ScrollView,
  Switch,
} from 'react-native';
import { supabase } from '@/lib/marketplace/supabase';
import { Pencil, Trash2, Plus, X, Package } from 'lucide-react-native';
import { useToast } from '@/contexts/ToastContext';

interface Category {
  id: string;
  name: string;
  description: string | null;
  icon: string | null;
  display_order: number;
  is_active: boolean;
  created_at: string;
}

export default function CategoryManagement() {
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalVisible, setModalVisible] = useState(false);
  const [editingCategory, setEditingCategory] = useState<Category | null>(null);
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    icon: '',
    display_order: 0,
    is_active: true,
  });
  const { showToast } = useToast();

  useEffect(() => {
    fetchCategories();
  }, []);

  const fetchCategories = async () => {
    try {
      const { data, error } = await supabase
        .from('categories')
        .select('*')
        .order('display_order', { ascending: true });

      if (error) throw error;
      setCategories(data || []);
    } catch (error: any) {
      showToast(error.message || 'Failed to fetch categories', 'error');
    } finally {
      setLoading(false);
    }
  };

  const openAddModal = () => {
    setEditingCategory(null);
    setFormData({
      name: '',
      description: '',
      icon: '',
      display_order: categories.length,
      is_active: true,
    });
    setModalVisible(true);
  };

  const openEditModal = (category: Category) => {
    setEditingCategory(category);
    setFormData({
      name: category.name,
      description: category.description || '',
      icon: category.icon || '',
      display_order: category.display_order,
      is_active: category.is_active,
    });
    setModalVisible(true);
  };

  const handleSubmit = async () => {
    if (!formData.name.trim()) {
      showToast('Category name is required', 'error');
      return;
    }

    try {
      if (editingCategory) {
        const { error } = await supabase
          .from('categories')
          .update({
            name: formData.name.trim(),
            description: formData.description.trim() || null,
            icon: formData.icon.trim() || null,
            display_order: formData.display_order,
            is_active: formData.is_active,
          })
          .eq('id', editingCategory.id);

        if (error) throw error;
        showToast('Category updated successfully', 'success');
      } else {
        const { error } = await supabase
          .from('categories')
          .insert({
            name: formData.name.trim(),
            description: formData.description.trim() || null,
            icon: formData.icon.trim() || null,
            display_order: formData.display_order,
            is_active: formData.is_active,
          });

        if (error) throw error;
        showToast('Category added successfully', 'success');
      }

      setModalVisible(false);
      fetchCategories();
    } catch (error: any) {
      showToast(error.message || 'Failed to save category', 'error');
    }
  };

  const handleDelete = async (category: Category) => {
    Alert.alert(
      'Delete Category',
      `Are you sure you want to delete "${category.name}"?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              const { error } = await supabase
                .from('categories')
                .delete()
                .eq('id', category.id);

              if (error) throw error;
              showToast('Category deleted successfully', 'success');
              fetchCategories();
            } catch (error: any) {
              showToast(error.message || 'Failed to delete category', 'error');
            }
          },
        },
      ]
    );
  };

  const toggleActive = async (category: Category) => {
    try {
      const { error } = await supabase
        .from('categories')
        .update({ is_active: !category.is_active })
        .eq('id', category.id);

      if (error) throw error;
      showToast(
        `Category ${!category.is_active ? 'activated' : 'deactivated'}`,
        'success'
      );
      fetchCategories();
    } catch (error: any) {
      showToast(error.message || 'Failed to update category', 'error');
    }
  };

  const renderCategory = ({ item }: { item: Category }) => (
    <View style={styles.tableRow}>
      <View style={styles.iconCell}>
        {item.icon ? (
          <Text style={styles.iconText}>{item.icon}</Text>
        ) : (
          <Package size={20} color="#9ca3af" />
        )}
      </View>

      <View style={styles.nameCell}>
        <Text style={styles.categoryName}>{item.name}</Text>
        {item.description && (
          <Text style={styles.categoryDescription} numberOfLines={1}>
            {item.description}
          </Text>
        )}
      </View>

      <View style={styles.orderCell}>
        <Text style={styles.orderText}>{item.display_order}</Text>
      </View>

      <View style={styles.statusCell}>
        <Switch
          value={item.is_active}
          onValueChange={() => toggleActive(item)}
          trackColor={{ false: '#d1d5db', true: '#86efac' }}
          thumbColor={item.is_active ? '#16a34a' : '#9ca3af'}
        />
      </View>

      <View style={styles.actionsCell}>
        <TouchableOpacity
          style={styles.editButton}
          onPress={() => openEditModal(item)}
        >
          <Pencil size={18} color="#2563eb" />
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.deleteButton}
          onPress={() => handleDelete(item)}
        >
          <Trash2 size={18} color="#dc2626" />
        </TouchableOpacity>
      </View>
    </View>
  );

  if (loading) {
    return (
      <View style={[styles.container, styles.loadingContainer]}>
        <ActivityIndicator size="large" color="#ff8c00" />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <View style={styles.statsRow}>
          <View style={styles.statCard}>
            <Text style={styles.statValue}>{categories.length}</Text>
            <Text style={styles.statLabel}>Total Categories</Text>
          </View>
          <View style={styles.statCard}>
            <Text style={styles.statValue}>
              {categories.filter((c) => c.is_active).length}
            </Text>
            <Text style={styles.statLabel}>Active</Text>
          </View>
        </View>

        <TouchableOpacity style={styles.addButton} onPress={openAddModal}>
          <Plus size={20} color="#ffffff" />
          <Text style={styles.addButtonText}>Add Category</Text>
        </TouchableOpacity>
      </View>

      {categories.length > 0 ? (
        <>
          <View style={styles.tableHeader}>
            <View style={styles.iconCell}>
              <Text style={styles.headerText}>Icon</Text>
            </View>
            <View style={styles.nameCell}>
              <Text style={styles.headerText}>Name</Text>
            </View>
            <View style={styles.orderCell}>
              <Text style={styles.headerText}>Order</Text>
            </View>
            <View style={styles.statusCell}>
              <Text style={styles.headerText}>Active</Text>
            </View>
            <View style={styles.actionsCell}>
              <Text style={styles.headerText}>Actions</Text>
            </View>
          </View>

          <FlatList
            data={categories}
            renderItem={renderCategory}
            keyExtractor={(item) => item.id}
            contentContainerStyle={styles.tableContent}
          />
        </>
      ) : (
        <View style={styles.emptyContainer}>
          <Package size={64} color="#d1d5db" />
          <Text style={styles.emptyText}>No categories yet</Text>
          <Text style={styles.emptySubtext}>
            Add your first category to organize products
          </Text>
          <TouchableOpacity
            style={styles.emptyButton}
            onPress={openAddModal}
          >
            <Plus size={20} color="#ff8c00" />
            <Text style={styles.emptyButtonText}>Add Category</Text>
          </TouchableOpacity>
        </View>
      )}

      <Modal
        visible={modalVisible}
        animationType="slide"
        transparent
        onRequestClose={() => setModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContainer}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>
                {editingCategory ? 'Edit Category' : 'Add Category'}
              </Text>
              <TouchableOpacity onPress={() => setModalVisible(false)}>
                <X size={24} color="#6b7280" />
              </TouchableOpacity>
            </View>

            <ScrollView
              style={styles.modalContent}
              showsVerticalScrollIndicator={false}
              keyboardShouldPersistTaps="handled"
            >
              <View style={styles.formGroup}>
                <Text style={styles.label}>
                  Category Name <Text style={styles.required}>*</Text>
                </Text>
                <TextInput
                  style={styles.input}
                  value={formData.name}
                  onChangeText={(text) =>
                    setFormData({ ...formData, name: text })
                  }
                  placeholder="e.g., Fresh Fruits, Vegetables"
                  placeholderTextColor="#9ca3af"
                />
              </View>

              <View style={styles.formGroup}>
                <Text style={styles.label}>Description</Text>
                <TextInput
                  style={[styles.input, styles.textArea]}
                  value={formData.description}
                  onChangeText={(text) =>
                    setFormData({ ...formData, description: text })
                  }
                  placeholder="Brief description of the category"
                  placeholderTextColor="#9ca3af"
                  multiline
                  numberOfLines={3}
                />
              </View>

              <View style={styles.formGroup}>
                <Text style={styles.label}>Icon (Emoji)</Text>
                <TextInput
                  style={styles.input}
                  value={formData.icon}
                  onChangeText={(text) =>
                    setFormData({ ...formData, icon: text })
                  }
                  placeholder="e.g., 🍎, 🥕, 🍞"
                  placeholderTextColor="#9ca3af"
                  maxLength={2}
                />
              </View>

              <View style={styles.formGroup}>
                <Text style={styles.label}>Display Order</Text>
                <TextInput
                  style={styles.input}
                  value={formData.display_order.toString()}
                  onChangeText={(text) =>
                    setFormData({
                      ...formData,
                      display_order: parseInt(text) || 0,
                    })
                  }
                  placeholder="0"
                  placeholderTextColor="#9ca3af"
                  keyboardType="numeric"
                />
              </View>

              <View style={styles.formGroup}>
                <View style={styles.switchRow}>
                  <Text style={styles.label}>Active</Text>
                  <Switch
                    value={formData.is_active}
                    onValueChange={(value) =>
                      setFormData({ ...formData, is_active: value })
                    }
                    trackColor={{ false: '#d1d5db', true: '#86efac' }}
                    thumbColor={formData.is_active ? '#16a34a' : '#9ca3af'}
                  />
                </View>
                <Text style={styles.helperText}>
                  Inactive categories won't be visible to customers
                </Text>
              </View>
            </ScrollView>

            <View style={styles.modalFooter}>
              <TouchableOpacity
                style={styles.cancelButton}
                onPress={() => setModalVisible(false)}
              >
                <Text style={styles.cancelButtonText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.submitButton}
                onPress={handleSubmit}
              >
                <Text style={styles.submitButtonText}>
                  {editingCategory ? 'Update' : 'Add'}
                </Text>
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
    justifyContent: 'center',
    alignItems: 'center',
  },
  header: {
    backgroundColor: '#ffffff',
    paddingHorizontal: 16,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
  },
  statsRow: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 16,
  },
  statCard: {
    flex: 1,
    backgroundColor: '#f3f4f6',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 8,
    alignItems: 'center',
  },
  statValue: {
    fontSize: 24,
    fontWeight: '700',
    color: '#ff8c00',
    marginBottom: 4,
  },
  statLabel: {
    fontSize: 12,
    color: '#6b7280',
    fontWeight: '500',
  },
  addButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#ff8c00',
    paddingVertical: 12,
    borderRadius: 8,
    gap: 6,
  },
  addButtonText: {
    color: '#ffffff',
    fontWeight: '600',
    fontSize: 15,
  },
  tableHeader: {
    flexDirection: 'row',
    backgroundColor: '#ffffff',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderBottomWidth: 2,
    borderBottomColor: '#e5e7eb',
  },
  headerText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#6b7280',
    textTransform: 'uppercase',
  },
  tableContent: {
    paddingBottom: 16,
  },
  tableRow: {
    flexDirection: 'row',
    backgroundColor: '#ffffff',
    paddingVertical: 16,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#f3f4f6',
    alignItems: 'center',
  },
  iconCell: {
    width: 60,
    alignItems: 'center',
    marginRight: 8,
  },
  iconText: {
    fontSize: 24,
  },
  nameCell: {
    flex: 2,
    paddingRight: 12,
    minWidth: 120,
  },
  categoryName: {
    fontSize: 15,
    fontWeight: '600',
    color: '#111827',
    marginBottom: 2,
  },
  categoryDescription: {
    fontSize: 13,
    color: '#6b7280',
  },
  orderCell: {
    width: 50,
    alignItems: 'center',
    marginRight: 8,
  },
  orderText: {
    fontSize: 14,
    fontWeight: '500',
    color: '#374151',
  },
  statusCell: {
    width: 50,
    alignItems: 'center',
    marginRight: 8,
  },
  actionsCell: {
    width: 70,
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 6,
  },
  editButton: {
    width: 32,
    height: 32,
    borderRadius: 6,
    backgroundColor: '#eff6ff',
    justifyContent: 'center',
    alignItems: 'center',
  },
  deleteButton: {
    width: 32,
    height: 32,
    borderRadius: 6,
    backgroundColor: '#fef2f2',
    justifyContent: 'center',
    alignItems: 'center',
  },
  emptyContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60,
    paddingHorizontal: 20,
  },
  emptyText: {
    fontSize: 20,
    fontWeight: '600',
    color: '#6b7280',
    marginTop: 20,
  },
  emptySubtext: {
    fontSize: 14,
    color: '#9ca3af',
    marginTop: 8,
    textAlign: 'center',
  },
  emptyButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff7ed',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 8,
    marginTop: 24,
    gap: 8,
    borderWidth: 1,
    borderColor: '#ff8c00',
  },
  emptyButtonText: {
    color: '#ff8c00',
    fontWeight: '600',
    fontSize: 15,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  modalContainer: {
    backgroundColor: '#ffffff',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
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
    color: '#111827',
  },
  modalContent: {
    padding: 20,
    flexShrink: 1,
  },
  formGroup: {
    marginBottom: 20,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: '#374151',
    marginBottom: 8,
  },
  required: {
    color: '#dc2626',
  },
  input: {
    borderWidth: 1,
    borderColor: '#d1d5db',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 12,
    fontSize: 15,
    color: '#111827',
    backgroundColor: '#ffffff',
  },
  textArea: {
    minHeight: 80,
    textAlignVertical: 'top',
  },
  switchRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  helperText: {
    fontSize: 12,
    color: '#6b7280',
    marginTop: 6,
  },
  modalFooter: {
    flexDirection: 'row',
    gap: 12,
    padding: 20,
    borderTopWidth: 1,
    borderTopColor: '#e5e7eb',
  },
  cancelButton: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#d1d5db',
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
    borderRadius: 8,
    backgroundColor: '#ff8c00',
    alignItems: 'center',
  },
  submitButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#ffffff',
  },
});
