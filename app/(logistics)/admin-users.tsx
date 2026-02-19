import { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, RefreshControl, TouchableOpacity, Modal, TextInput } from 'react-native';
import { Users, Mail, Phone, Shield, Edit2, Trash2, X, Search, UserCheck, UserX, ChevronRight } from 'lucide-react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { supabase, Profile } from '@/lib/supabase';
import { Toast } from '@/components/Toast';
import { ConfirmDialog } from '@/components/ConfirmDialog';
import { Fonts } from '@/constants/fonts';

const ROLE_CONFIG: Record<string, { bg: string; text: string; border: string; label: string }> = {
  admin:    { bg: '#fef3c7', text: '#92400e', border: '#fcd34d', label: 'Admin' },
  rider:    { bg: '#dbeafe', text: '#1e40af', border: '#93c5fd', label: 'Rider' },
  customer: { bg: '#dcfce7', text: '#166534', border: '#86efac', label: 'Customer' },
};

const roleOptions: Array<'customer' | 'rider' | 'admin'> = ['customer', 'rider', 'admin'];

export default function AdminUsers() {
  const insets = useSafeAreaInsets();
  const [users, setUsers] = useState<Profile[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [refreshing, setRefreshing] = useState(false);
  const [editModalVisible, setEditModalVisible] = useState(false);
  const [selectedUser, setSelectedUser] = useState<Profile | null>(null);
  const [toast, setToast] = useState<{ visible: boolean; message: string; type: 'success' | 'error' | 'info' | 'warning' }>({ visible: false, message: '', type: 'success' });
  const [confirmDialog, setConfirmDialog] = useState<{ visible: boolean; title: string; message: string; onConfirm: () => void }>({ visible: false, title: '', message: '', onConfirm: () => {} });

  const showToast = (message: string, type: 'success' | 'error' | 'info' | 'warning' = 'success') => setToast({ visible: true, message, type });

  useEffect(() => { loadUsers(); }, []);

  const loadUsers = async () => {
    try {
      const { data, error } = await supabase.from('profiles').select('*').order('created_at', { ascending: false });
      if (error) throw error;
      setUsers(data || []);
    } catch (error) {
      console.error('Error loading users:', error);
    } finally {
      setRefreshing(false);
    }
  };

  const handleEdit = (user: Profile) => { setSelectedUser(user); setEditModalVisible(true); };

  const handleUpdate = async () => {
    if (!selectedUser) return;
    try {
      const oldRole = users.find(u => u.id === selectedUser.id)?.role;
      const { error: profileError } = await supabase.from('profiles').update({ full_name: selectedUser.full_name, phone: selectedUser.phone, role: selectedUser.role }).eq('id', selectedUser.id);
      if (profileError) throw profileError;

      if (oldRole !== 'rider' && selectedUser.role === 'rider') {
        const { data: existingRider } = await supabase.from('riders').select('id').eq('user_id', selectedUser.id).maybeSingle();
        if (!existingRider) {
          const { error: riderError } = await supabase.from('riders').insert({ user_id: selectedUser.id, vehicle_type: 'bike', vehicle_number: 'N/A', license_number: 'N/A', status: 'offline', rating: 5.0, total_deliveries: 0 });
          if (riderError) throw riderError;
        }
      }
      if (oldRole === 'rider' && selectedUser.role !== 'rider') {
        const { error: deleteRiderError } = await supabase.from('riders').delete().eq('user_id', selectedUser.id);
        if (deleteRiderError) throw deleteRiderError;
      }

      setEditModalVisible(false);
      setSelectedUser(null);
      showToast('User updated successfully!', 'success');
      loadUsers();
    } catch (error) {
      console.error('Error updating user:', error);
      showToast('Failed to update user', 'error');
    }
  };

  const handleDelete = (userId: string) => {
    setConfirmDialog({
      visible: true,
      title: 'Delete User',
      message: 'Are you sure you want to delete this user? This action cannot be undone.',
      onConfirm: async () => {
        try {
          const { error } = await supabase.from('profiles').delete().eq('id', userId);
          if (error) throw error;
          showToast('User deleted successfully', 'success');
          loadUsers();
        } catch (error) {
          console.error('Error deleting user:', error);
          showToast('Failed to delete user', 'error');
        }
      },
    });
  };

  const filteredUsers = users.filter(user => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase();
    return user.full_name.toLowerCase().includes(q) || user.email.toLowerCase().includes(q) || (user.phone?.toLowerCase().includes(q) ?? false) || user.role.toLowerCase().includes(q);
  });

  const counts = { total: users.length, admin: users.filter(u => u.role === 'admin').length, rider: users.filter(u => u.role === 'rider').length, customer: users.filter(u => u.role === 'customer').length };

  return (
    <View style={styles.container}>
      <View style={[styles.header, { paddingTop: insets.top + 16 }]}>
        <View style={styles.headerLeft}>
          <View style={styles.headerIconWrap}>
            <Users size={22} color="#3b82f6" />
          </View>
          <View>
            <Text style={styles.headerTitle}>Users</Text>
            <Text style={styles.headerSubtitle}>Manage accounts & roles</Text>
          </View>
        </View>
        <View style={styles.totalBadge}>
          <Text style={styles.totalBadgeText}>{counts.total}</Text>
        </View>
      </View>

      <View style={styles.statsRow}>
        {(['admin', 'rider', 'customer'] as const).map((role) => {
          const cfg = ROLE_CONFIG[role];
          return (
            <View key={role} style={[styles.statCard, { borderTopColor: cfg.border }]}>
              <Text style={[styles.statValue, { color: cfg.text }]}>{counts[role]}</Text>
              <Text style={styles.statLabel}>{cfg.label}s</Text>
            </View>
          );
        })}
      </View>

      <View style={styles.searchBar}>
        <Search size={16} color="#9ca3af" />
        <TextInput
          style={styles.searchInput}
          value={searchQuery}
          onChangeText={setSearchQuery}
          placeholder="Search by name, email, phone, or role..."
          placeholderTextColor="#9ca3af"
          underlineColorAndroid="transparent"
        />
        {searchQuery.length > 0 && (
          <TouchableOpacity onPress={() => setSearchQuery('')}>
            <X size={15} color="#9ca3af" />
          </TouchableOpacity>
        )}
      </View>

      <ScrollView
        style={styles.content}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: Math.max(insets.bottom, 24) }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); loadUsers(); }} tintColor="#3b82f6" />}>

        {filteredUsers.length === 0 ? (
          <View style={styles.emptyState}>
            <View style={styles.emptyIconWrap}>
              {users.length === 0 ? <Users size={36} color="#d1d5db" /> : <Search size={36} color="#d1d5db" />}
            </View>
            <Text style={styles.emptyTitle}>{users.length === 0 ? 'No users yet' : 'No results found'}</Text>
            <Text style={styles.emptySubtitle}>{users.length === 0 ? 'Users will appear here once registered' : 'Try adjusting your search'}</Text>
          </View>
        ) : (
          filteredUsers.map((user) => {
            const cfg = ROLE_CONFIG[user.role] ?? { bg: '#f3f4f6', text: '#374151', border: '#d1d5db', label: user.role };
            const initials = user.full_name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
            return (
              <View key={user.id} style={styles.userCard}>
                <View style={styles.cardTop}>
                  <View style={styles.avatarWrap}>
                    <Text style={styles.avatarText}>{initials}</Text>
                  </View>
                  <View style={styles.cardInfo}>
                    <Text style={styles.userName}>{user.full_name}</Text>
                    <View style={[styles.rolePill, { backgroundColor: cfg.bg, borderColor: cfg.border }]}>
                      <Shield size={11} color={cfg.text} />
                      <Text style={[styles.rolePillText, { color: cfg.text }]}>{cfg.label.toUpperCase()}</Text>
                    </View>
                  </View>
                  <View style={styles.cardActions}>
                    <TouchableOpacity style={styles.actionBtnBlue} onPress={() => handleEdit(user)}>
                      <Edit2 size={15} color="#3b82f6" />
                    </TouchableOpacity>
                    <TouchableOpacity style={styles.actionBtnRed} onPress={() => handleDelete(user.id)}>
                      <Trash2 size={15} color="#ef4444" />
                    </TouchableOpacity>
                  </View>
                </View>

                <View style={styles.cardDivider} />

                <View style={styles.cardDetails}>
                  <View style={styles.detailRow}>
                    <View style={styles.detailIconWrap}>
                      <Mail size={13} color="#6b7280" />
                    </View>
                    <Text style={styles.detailText} numberOfLines={1}>{user.email}</Text>
                  </View>
                  {user.phone && (
                    <View style={styles.detailRow}>
                      <View style={styles.detailIconWrap}>
                        <Phone size={13} color="#6b7280" />
                      </View>
                      <Text style={styles.detailText}>{user.phone}</Text>
                    </View>
                  )}
                </View>

                <View style={styles.cardFooter}>
                  <Text style={styles.dateText}>Joined {new Date(user.created_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}</Text>
                </View>
              </View>
            );
          })
        )}
        <View style={{ height: 32 }} />
      </ScrollView>

      <Modal visible={editModalVisible} animationType="slide" transparent onRequestClose={() => setEditModalVisible(false)}>
        <View style={styles.sheetOverlay}>
          <View style={styles.sheet}>
            <View style={styles.sheetHandle} />
            <View style={styles.sheetHeader}>
              <View style={styles.sheetHeaderLeft}>
                <View style={styles.sheetAvatarWrap}>
                  <Text style={styles.sheetAvatarText}>
                    {selectedUser?.full_name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2)}
                  </Text>
                </View>
                <View>
                  <Text style={styles.sheetTitle}>Edit User</Text>
                  <Text style={styles.sheetSubtitle}>{selectedUser?.email}</Text>
                </View>
              </View>
              <TouchableOpacity style={styles.sheetClose} onPress={() => setEditModalVisible(false)}>
                <X size={18} color="#6b7280" />
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.sheetBody} showsVerticalScrollIndicator={false}>
              <Text style={styles.inputLabel}>Full Name</Text>
              <TextInput
                style={styles.input}
                value={selectedUser?.full_name}
                onChangeText={(text) => setSelectedUser(prev => prev ? { ...prev, full_name: text } : null)}
                placeholder="Enter full name"
                placeholderTextColor="#9ca3af"
              />

              <Text style={styles.inputLabel}>Email (Read-only)</Text>
              <TextInput
                style={[styles.input, styles.inputDisabled]}
                value={selectedUser?.email}
                editable={false}
              />

              <Text style={styles.inputLabel}>Phone</Text>
              <TextInput
                style={styles.input}
                value={selectedUser?.phone || ''}
                onChangeText={(text) => setSelectedUser(prev => prev ? { ...prev, phone: text } : null)}
                placeholder="Enter phone number"
                placeholderTextColor="#9ca3af"
                keyboardType="phone-pad"
              />

              <Text style={styles.inputLabel}>Role</Text>
              <View style={styles.roleGrid}>
                {roleOptions.map((role) => {
                  const cfg = ROLE_CONFIG[role];
                  const isActive = selectedUser?.role === role;
                  return (
                    <TouchableOpacity
                      key={role}
                      style={[styles.roleChip, isActive && { backgroundColor: cfg.bg, borderColor: cfg.border }]}
                      onPress={() => setSelectedUser(prev => prev ? { ...prev, role } : null)}
                      activeOpacity={0.8}>
                      <Shield size={14} color={isActive ? cfg.text : '#9ca3af'} />
                      <Text style={[styles.roleChipText, isActive && { color: cfg.text }]}>{cfg.label}</Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
              <View style={{ height: 8 }} />
            </ScrollView>

            <View style={styles.sheetFooter}>
              <TouchableOpacity style={styles.cancelBtn} onPress={() => setEditModalVisible(false)}>
                <Text style={styles.cancelBtnText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.saveBtn} onPress={handleUpdate}>
                <UserCheck size={16} color="#fff" />
                <Text style={styles.saveBtnText}>Save Changes</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      <Toast visible={toast.visible} message={toast.message} type={toast.type} duration={5000} onDismiss={() => setToast({ ...toast, visible: false })} />
      <ConfirmDialog visible={confirmDialog.visible} title={confirmDialog.title} message={confirmDialog.message} onConfirm={confirmDialog.onConfirm} onCancel={() => setConfirmDialog({ ...confirmDialog, visible: false })} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f1f5f9' },

  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingBottom: 16,
    backgroundColor: '#1a1a2e',
  },
  headerLeft: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  headerIconWrap: {
    width: 44, height: 44, borderRadius: 14,
    backgroundColor: 'rgba(59,130,246,0.15)',
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 1, borderColor: 'rgba(59,130,246,0.25)',
  },
  headerTitle: { fontSize: 22, fontFamily: Fonts.bold, color: '#ffffff', letterSpacing: 0.1 },
  headerSubtitle: { fontSize: 12, fontFamily: Fonts.regular, color: 'rgba(255,255,255,0.45)', marginTop: 2 },
  totalBadge: {
    backgroundColor: '#3b82f6',
    width: 36, height: 36, borderRadius: 12,
    alignItems: 'center', justifyContent: 'center',
  },
  totalBadgeText: { fontSize: 15, fontFamily: Fonts.bold, color: '#ffffff' },

  statsRow: {
    flexDirection: 'row',
    gap: 10,
    paddingHorizontal: 16,
    paddingVertical: 14,
    backgroundColor: '#ffffff',
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
  },
  statCard: {
    flex: 1,
    backgroundColor: '#f9fafb',
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: 'center',
    borderTopWidth: 3,
    borderTopColor: '#d1d5db',
  },
  statValue: { fontSize: 22, fontFamily: Fonts.bold },
  statLabel: { fontSize: 11, fontFamily: Fonts.semiBold, color: '#9ca3af', marginTop: 2, textTransform: 'uppercase', letterSpacing: 0.4 },

  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#ffffff',
    marginHorizontal: 16,
    marginTop: 14,
    marginBottom: 4,
    paddingHorizontal: 14,
    paddingVertical: 11,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  searchInput: {
    flex: 1,
    fontSize: 14,
    fontFamily: Fonts.regular,
    color: '#111827',
    padding: 0,
    outlineStyle: 'none',
  } as any,

  content: { flex: 1, paddingHorizontal: 16, paddingTop: 12 },

  emptyState: { alignItems: 'center', paddingVertical: 72, gap: 10 },
  emptyIconWrap: {
    width: 80, height: 80, borderRadius: 24,
    backgroundColor: '#f3f4f6', alignItems: 'center', justifyContent: 'center', marginBottom: 4,
  },
  emptyTitle: { fontSize: 17, fontFamily: Fonts.bold, color: '#374151' },
  emptySubtitle: { fontSize: 13, fontFamily: Fonts.regular, color: '#9ca3af', textAlign: 'center' },

  userCard: {
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
  cardTop: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 14,
    paddingBottom: 12,
  },
  avatarWrap: {
    width: 44, height: 44, borderRadius: 14,
    backgroundColor: '#eff6ff',
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 1, borderColor: '#bfdbfe',
  },
  avatarText: { fontSize: 15, fontFamily: Fonts.bold, color: '#1d4ed8' },
  cardInfo: { flex: 1, gap: 4 },
  userName: { fontSize: 15, fontFamily: Fonts.bold, color: '#111827' },
  rolePill: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
    borderWidth: 1,
  },
  rolePillText: { fontSize: 10, fontFamily: Fonts.bold, letterSpacing: 0.5 },
  cardActions: { flexDirection: 'row', gap: 8 },
  actionBtnBlue: {
    width: 34, height: 34, borderRadius: 10,
    backgroundColor: '#eff6ff', alignItems: 'center', justifyContent: 'center',
  },
  actionBtnRed: {
    width: 34, height: 34, borderRadius: 10,
    backgroundColor: '#fff1f2', alignItems: 'center', justifyContent: 'center',
  },

  cardDivider: { height: 1, backgroundColor: '#f3f4f6', marginHorizontal: 14 },

  cardDetails: { padding: 14, paddingVertical: 10, gap: 7 },
  detailRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  detailIconWrap: {
    width: 24, height: 24, borderRadius: 6,
    backgroundColor: '#f3f4f6', alignItems: 'center', justifyContent: 'center',
  },
  detailText: { flex: 1, fontSize: 13, fontFamily: Fonts.regular, color: '#6b7280' },

  cardFooter: {
    paddingHorizontal: 14, paddingBottom: 12, paddingTop: 4,
    borderTopWidth: 1, borderTopColor: '#f3f4f6',
  },
  dateText: { fontSize: 11, fontFamily: Fonts.regular, color: '#9ca3af' },

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
  sheetHeaderLeft: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  sheetAvatarWrap: {
    width: 44, height: 44, borderRadius: 14,
    backgroundColor: '#eff6ff', alignItems: 'center', justifyContent: 'center',
    borderWidth: 1, borderColor: '#bfdbfe',
  },
  sheetAvatarText: { fontSize: 16, fontFamily: Fonts.bold, color: '#1d4ed8' },
  sheetTitle: { fontSize: 18, fontFamily: Fonts.bold, color: '#111827' },
  sheetSubtitle: { fontSize: 12, fontFamily: Fonts.regular, color: '#9ca3af', marginTop: 2 },
  sheetClose: {
    width: 36, height: 36, borderRadius: 10,
    backgroundColor: '#f3f4f6', alignItems: 'center', justifyContent: 'center',
  },
  sheetBody: { paddingHorizontal: 24, paddingTop: 20 },

  inputLabel: { fontSize: 12, fontFamily: Fonts.bold, color: '#374151', marginBottom: 6, textTransform: 'uppercase', letterSpacing: 0.5 },
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
  inputDisabled: { backgroundColor: '#f3f4f6', color: '#9ca3af' },

  roleGrid: { flexDirection: 'row', gap: 10, marginBottom: 16 },
  roleChip: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 12,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: '#e5e7eb',
    backgroundColor: '#f9fafb',
  },
  roleChipText: { fontSize: 13, fontFamily: Fonts.semiBold, color: '#9ca3af' },

  sheetFooter: {
    flexDirection: 'row',
    paddingHorizontal: 24,
    paddingVertical: 16,
    gap: 12,
    borderTopWidth: 1,
    borderTopColor: '#f3f4f6',
  },
  cancelBtn: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 14,
    backgroundColor: '#f3f4f6',
    alignItems: 'center',
  },
  cancelBtnText: { fontSize: 15, fontFamily: Fonts.semiBold, color: '#374151' },
  saveBtn: {
    flex: 2,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 14,
    borderRadius: 14,
    backgroundColor: '#3b82f6',
  },
  saveBtnText: { fontSize: 15, fontFamily: Fonts.bold, color: '#ffffff' },
});
