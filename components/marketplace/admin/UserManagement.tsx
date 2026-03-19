import { useState, useEffect, useCallback, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  Modal,
  TextInput,
  Alert,
  ScrollView,
  Platform,
} from 'react-native';
import { Shield, ShoppingBag, CircleUser as UserCircle, Bike, CreditCard as Edit3, Trash2, X, ArrowLeft, Lock, Clock as Unlock, Search, Mail, Phone, Calendar, User } from 'lucide-react-native';
import { supabase } from '@/lib/marketplace/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { Fonts } from '@/constants/fonts';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

interface UserProfile {
  id: string;
  full_name: string;
  email: string;
  phone: string | null;
  role: 'customer' | 'vendor' | 'rider' | 'admin';
  created_at: string;
  is_suspended: boolean;
  suspended_at: string | null;
}

interface UserManagementProps {
  onBack?: () => void;
}

interface RoleCounts {
  all: number;
  customer: number;
  vendor: number;
  rider: number;
  admin: number;
  suspended: number;
}

const roleIcons: Record<string, any> = {
  admin: Shield,
  vendor: ShoppingBag,
  rider: Bike,
  customer: UserCircle,
};

const roleColors: Record<string, string> = {
  admin: '#ef4444',
  vendor: '#ff8c00',
  rider: '#06b6d4',
  customer: '#3b82f6',
};

const roleBgColors: Record<string, string> = {
  admin: '#fef2f2',
  vendor: '#fff7ed',
  rider: '#ecfeff',
  customer: '#eff6ff',
};

const roleLabels: Record<string, string> = {
  admin: 'Admin',
  vendor: 'Vendor',
  rider: 'Rider',
  customer: 'Customer',
};

const FILTER_TABS = [
  { key: 'all', label: 'All' },
  { key: 'customer', label: 'Customers' },
  { key: 'vendor', label: 'Vendors' },
  { key: 'rider', label: 'Riders' },
  { key: 'admin', label: 'Admins' },
  { key: 'suspended', label: 'Suspended' },
];

const PAGE_SIZE = 20;

export default function UserManagement({ onBack }: UserManagementProps) {
  const { profile: currentUser } = useAuth();
  const insets = useSafeAreaInsets();
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [totalCount, setTotalCount] = useState(0);
  const [page, setPage] = useState(0);
  const [hasMore, setHasMore] = useState(true);
  const [roleCounts, setRoleCounts] = useState<RoleCounts>({ all: 0, customer: 0, vendor: 0, rider: 0, admin: 0, suspended: 0 });
  const [selectedUser, setSelectedUser] = useState<UserProfile | null>(null);
  const [showEditModal, setShowEditModal] = useState(false);
  const [editForm, setEditForm] = useState({
    full_name: '',
    phone: '',
    role: 'customer' as 'customer' | 'vendor' | 'rider' | 'admin',
  });
  const [updating, setUpdating] = useState(false);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeFilter, setActiveFilter] = useState('all');
  const [showSuspendModal, setShowSuspendModal] = useState(false);
  const [userToSuspend, setUserToSuspend] = useState<UserProfile | null>(null);

  const searchRef = useRef(searchQuery);
  const filterRef = useRef(activeFilter);
  searchRef.current = searchQuery;
  filterRef.current = activeFilter;

  const buildQuery = useCallback((search: string, filter: string, from: number, to: number) => {
    let q = supabase
      .from('profiles')
      .select('id, full_name, email, phone, role, created_at, is_suspended, suspended_at', { count: 'exact' })
      .order('created_at', { ascending: false })
      .range(from, to);

    if (filter === 'suspended') {
      q = q.eq('is_suspended', true);
    } else if (filter !== 'all') {
      q = q.eq('role', filter);
    }

    if (search.trim()) {
      q = q.or(`full_name.ilike.%${search.trim()}%,email.ilike.%${search.trim()}%,phone.ilike.%${search.trim()}%`);
    }

    return q;
  }, []);

  const fetchRoleCounts = useCallback(async () => {
    const roles = ['customer', 'vendor', 'rider', 'admin'] as const;
    const [allRes, suspendedRes, ...roleRes] = await Promise.all([
      supabase.from('profiles').select('*', { count: 'exact', head: true }),
      supabase.from('profiles').select('*', { count: 'exact', head: true }).eq('is_suspended', true),
      ...roles.map((r) => supabase.from('profiles').select('*', { count: 'exact', head: true }).eq('role', r)),
    ]);

    setRoleCounts({
      all: allRes.count ?? 0,
      suspended: suspendedRes.count ?? 0,
      customer: roleRes[0].count ?? 0,
      vendor: roleRes[1].count ?? 0,
      rider: roleRes[2].count ?? 0,
      admin: roleRes[3].count ?? 0,
    });
  }, []);

  const fetchUsers = useCallback(async (search: string, filter: string) => {
    setLoading(true);
    setPage(0);
    try {
      const { data, error, count } = await buildQuery(search, filter, 0, PAGE_SIZE - 1);
      if (error) throw error;
      setUsers(data || []);
      setTotalCount(count ?? 0);
      setHasMore((data?.length ?? 0) === PAGE_SIZE);
    } catch (error) {
      console.error('Error fetching users:', error);
    } finally {
      setLoading(false);
    }
  }, [buildQuery]);

  const loadMore = useCallback(async () => {
    if (loadingMore || !hasMore) return;
    setLoadingMore(true);
    const nextPage = page + 1;
    const from = nextPage * PAGE_SIZE;
    const to = from + PAGE_SIZE - 1;
    try {
      const { data, error } = await buildQuery(searchRef.current, filterRef.current, from, to);
      if (error) throw error;
      setUsers((prev) => [...prev, ...(data || [])]);
      setPage(nextPage);
      setHasMore((data?.length ?? 0) === PAGE_SIZE);
    } catch (error) {
      console.error('Error loading more users:', error);
    } finally {
      setLoadingMore(false);
    }
  }, [loadingMore, hasMore, page, buildQuery]);

  useEffect(() => {
    fetchUsers(searchQuery, activeFilter);
    fetchRoleCounts();
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => {
      fetchUsers(searchQuery, activeFilter);
    }, 350);
    return () => clearTimeout(timer);
  }, [searchQuery, activeFilter]);

  useEffect(() => {
    const channel = supabase
      .channel('user-management-changes')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'profiles' }, (payload) => {
        const newUser = payload.new as UserProfile;
        setUsers((prev) => [newUser, ...prev]);
        setTotalCount((c) => c + 1);
        fetchRoleCounts();
      })
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'profiles' }, (payload) => {
        const updated = payload.new as UserProfile;
        setUsers((prev) => prev.map((u) => (u.id === updated.id ? updated : u)));
        fetchRoleCounts();
      })
      .on('postgres_changes', { event: 'DELETE', schema: 'public', table: 'profiles' }, (payload) => {
        const deleted = payload.old as UserProfile;
        setUsers((prev) => prev.filter((u) => u.id !== deleted.id));
        setTotalCount((c) => Math.max(0, c - 1));
        fetchRoleCounts();
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [fetchRoleCounts]);

  const openEditModal = (user: UserProfile) => {
    setSelectedUser(user);
    setEditForm({
      full_name: user.full_name,
      phone: user.phone || '',
      role: user.role,
    });
    setShowEditModal(true);
  };

  const closeEditModal = () => {
    setShowEditModal(false);
    setSelectedUser(null);
    setEditForm({ full_name: '', phone: '', role: 'customer' });
  };

  const updateUser = async () => {
    if (!selectedUser) return;
    if (!editForm.full_name.trim()) {
      Alert.alert('Validation Error', 'Full name is required');
      return;
    }

    try {
      setUpdating(true);
      const { error } = await supabase
        .from('profiles')
        .update({
          full_name: editForm.full_name.trim(),
          phone: editForm.phone.trim() || null,
          role: editForm.role,
        })
        .eq('id', selectedUser.id);

      if (error) throw error;
      Alert.alert('Success', 'User updated successfully');
      closeEditModal();
    } catch (error: any) {
      console.error('Error updating user:', error);
      Alert.alert('Error', error.message || 'Failed to update user');
    } finally {
      setUpdating(false);
    }
  };

  const deleteUser = async (userId: string, userName: string) => {
    if (userId === currentUser?.id) {
      Alert.alert('Error', 'You cannot delete your own account');
      return;
    }

    Alert.alert(
      'Delete User',
      `Are you sure you want to delete ${userName}? This action cannot be undone.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              setActionLoading(userId);
              const { error } = await supabase
                .from('profiles')
                .delete()
                .eq('id', userId)
                .select();

              if (error) throw error;
              Alert.alert('Success', 'User deleted successfully');
            } catch (error: any) {
              console.error('Error deleting user:', error);
              Alert.alert('Error', error.message || 'Failed to delete user');
            } finally {
              setActionLoading(null);
            }
          },
        },
      ]
    );
  };

  const toggleSuspension = async (user: UserProfile) => {
    if (user.id === currentUser?.id) {
      Alert.alert('Error', 'You cannot suspend your own account');
      return;
    }

    if (Platform.OS === 'web') {
      setUserToSuspend(user);
      setShowSuspendModal(true);
    } else {
      const action = user.is_suspended ? 'unsuspend' : 'suspend';
      const actionTitle = user.is_suspended ? 'Unsuspend' : 'Suspend';
      Alert.alert(
        `${actionTitle} User`,
        `Are you sure you want to ${action} ${user.full_name}?`,
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: actionTitle,
            style: user.is_suspended ? 'default' : 'destructive',
            onPress: () => performSuspension(user),
          },
        ]
      );
    }
  };

  const performSuspension = async (user: UserProfile) => {
    const action = user.is_suspended ? 'unsuspend' : 'suspend';
    try {
      setActionLoading(user.id);
      const updateData: any = { is_suspended: !user.is_suspended };
      if (!user.is_suspended) {
        updateData.suspended_at = new Date().toISOString();
        updateData.suspended_by = currentUser?.id;
      } else {
        updateData.suspended_at = null;
        updateData.suspended_by = null;
      }

      const { error } = await supabase
        .from('profiles')
        .update(updateData)
        .eq('id', user.id)
        .select();

      if (error) throw error;
      Alert.alert('Success', `User ${action}ed successfully`);
    } catch (error: any) {
      console.error(`Error ${action}ing user:`, error);
      Alert.alert('Error', error.message || `Failed to ${action} user`);
    } finally {
      setActionLoading(null);
      setShowSuspendModal(false);
      setUserToSuspend(null);
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  };

  const handleFilterChange = (key: string) => {
    setActiveFilter(key);
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
      <View style={[styles.header, { paddingTop: insets.top + 16 }]}>
        <View style={styles.headerTop}>
          {onBack && (
            <TouchableOpacity style={styles.backButton} onPress={onBack}>
              <ArrowLeft size={22} color="#ffffff" />
            </TouchableOpacity>
          )}
          <View style={styles.headerTextContainer}>
            <Text style={styles.title}>Users</Text>
            <Text style={styles.subtitle}>
              {users.length} of {totalCount.toLocaleString()} users
            </Text>
          </View>
        </View>

        <View style={styles.searchContainer}>
          <Search size={18} color="#8b909a" />
          <TextInput
            style={styles.searchInput}
            placeholder="Search users..."
            placeholderTextColor="#8b909a"
            value={searchQuery}
            onChangeText={setSearchQuery}
          />
          {searchQuery.length > 0 && (
            <TouchableOpacity onPress={() => setSearchQuery('')}>
              <X size={18} color="#8b909a" />
            </TouchableOpacity>
          )}
        </View>

        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.filterRow}
        >
          {FILTER_TABS.map((tab) => {
            const count = roleCounts[tab.key as keyof RoleCounts] ?? 0;
            const isActive = activeFilter === tab.key;
            return (
              <TouchableOpacity
                key={tab.key}
                style={[styles.filterTab, isActive && styles.filterTabActive]}
                onPress={() => handleFilterChange(tab.key)}
                activeOpacity={0.7}
              >
                <Text style={[styles.filterTabText, isActive && styles.filterTabTextActive]}>
                  {tab.label}
                </Text>
                <View style={[styles.filterBadge, isActive && styles.filterBadgeActive]}>
                  <Text style={[styles.filterBadgeText, isActive && styles.filterBadgeTextActive]}>
                    {count.toLocaleString()}
                  </Text>
                </View>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      </View>

      <View style={styles.statsRow}>
        {(['admin', 'vendor', 'rider', 'customer'] as const).map((role) => {
          const Icon = roleIcons[role];
          const color = roleColors[role];
          const bg = roleBgColors[role];
          return (
            <View key={role} style={[styles.statCard, { backgroundColor: bg }]}>
              <View style={[styles.statIconWrap, { backgroundColor: color + '20' }]}>
                <Icon size={18} color={color} />
              </View>
              <Text style={[styles.statNumber, { color }]}>
                {(roleCounts[role] ?? 0).toLocaleString()}
              </Text>
              <Text style={styles.statLabel}>{roleLabels[role]}s</Text>
            </View>
          );
        })}
      </View>

      <FlatList
        data={users}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.list}
        showsVerticalScrollIndicator={false}
        onEndReached={loadMore}
        onEndReachedThreshold={0.3}
        ListFooterComponent={
          loadingMore ? (
            <View style={styles.footerLoader}>
              <ActivityIndicator size="small" color="#ff8c00" />
            </View>
          ) : null
        }
        ListEmptyComponent={
          <View style={styles.emptyState}>
            <User size={48} color="#d1d5db" />
            <Text style={styles.emptyTitle}>No users found</Text>
            <Text style={styles.emptySubtitle}>Try a different search or filter</Text>
          </View>
        }
        renderItem={({ item }) => {
          const RoleIcon = roleIcons[item.role];
          const roleColor = roleColors[item.role];
          const isCurrentUser = item.id === currentUser?.id;
          const isLoading = actionLoading === item.id;

          return (
            <View style={[styles.userCard, item.is_suspended && styles.suspendedCard]}>
              <View style={styles.cardTop}>
                <View style={styles.cardNameRow}>
                  <Text style={styles.userName} numberOfLines={1}>{item.full_name}</Text>
                  {isCurrentUser && (
                    <View style={styles.youBadge}>
                      <Text style={styles.youBadgeText}>You</Text>
                    </View>
                  )}
                </View>
                <View style={styles.badgesRow}>
                  <View style={[styles.roleBadge, { backgroundColor: roleColor + '14' }]}>
                    <RoleIcon size={12} color={roleColor} />
                    <Text style={[styles.roleText, { color: roleColor }]}>
                      {roleLabels[item.role]}
                    </Text>
                  </View>
                  {item.is_suspended && (
                    <View style={styles.suspendedBadge}>
                      <Lock size={10} color="#ef4444" />
                      <Text style={styles.suspendedText}>Suspended</Text>
                    </View>
                  )}
                </View>
              </View>

              <View style={styles.cardDivider} />

              <View style={styles.detailRow}>
                <View style={styles.detailIconWrap}>
                  <Mail size={13} color="#8b909a" />
                </View>
                <Text style={styles.detailText} numberOfLines={1}>{item.email}</Text>
              </View>

              {item.phone && (
                <View style={styles.detailRow}>
                  <View style={styles.detailIconWrap}>
                    <Phone size={13} color="#8b909a" />
                  </View>
                  <Text style={styles.detailText}>{item.phone}</Text>
                </View>
              )}

              <View style={styles.detailRow}>
                <View style={styles.detailIconWrap}>
                  <Calendar size={13} color="#8b909a" />
                </View>
                <Text style={styles.detailText}>Joined {formatDate(item.created_at)}</Text>
              </View>

              {item.is_suspended && item.suspended_at && (
                <View style={styles.detailRow}>
                  <View style={styles.detailIconWrap}>
                    <Lock size={13} color="#ef4444" />
                  </View>
                  <Text style={[styles.detailText, { color: '#ef4444' }]}>
                    Suspended {formatDate(item.suspended_at)}
                  </Text>
                </View>
              )}

              <View style={styles.cardActions}>
                <TouchableOpacity
                  style={styles.actionBtn}
                  onPress={() => openEditModal(item)}
                  disabled={isLoading}
                >
                  <Edit3 size={14} color="#ff8c00" />
                  <Text style={styles.actionBtnTextEdit}>Edit</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[styles.actionBtn, item.is_suspended ? styles.actionBtnUnsuspend : styles.actionBtnSuspend]}
                  onPress={() => toggleSuspension(item)}
                  disabled={isLoading || isCurrentUser}
                >
                  {isLoading ? (
                    <ActivityIndicator size="small" color={item.is_suspended ? '#059669' : '#f59e0b'} />
                  ) : (
                    <>
                      {item.is_suspended ? (
                        <Unlock size={14} color="#059669" />
                      ) : (
                        <Lock size={14} color="#f59e0b" />
                      )}
                      <Text style={item.is_suspended ? styles.actionBtnTextUnsuspend : styles.actionBtnTextSuspend}>
                        {item.is_suspended ? 'Unsuspend' : 'Suspend'}
                      </Text>
                    </>
                  )}
                </TouchableOpacity>

                <TouchableOpacity
                  style={[styles.actionBtn, styles.actionBtnDelete]}
                  onPress={() => deleteUser(item.id, item.full_name)}
                  disabled={isLoading || isCurrentUser}
                >
                  {isLoading ? (
                    <ActivityIndicator size="small" color="#ef4444" />
                  ) : (
                    <>
                      <Trash2 size={14} color="#ef4444" />
                      <Text style={styles.actionBtnTextDelete}>Delete</Text>
                    </>
                  )}
                </TouchableOpacity>
              </View>
            </View>
          );
        }}
      />

      <Modal visible={showEditModal} transparent animationType="slide" onRequestClose={closeEditModal}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHandle} />
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Edit User</Text>
              <TouchableOpacity onPress={closeEditModal} style={styles.closeBtn}>
                <X size={22} color="#8b909a" />
              </TouchableOpacity>
            </View>

            <ScrollView showsVerticalScrollIndicator={false}>
              <View style={styles.form}>
                <View style={styles.formGroup}>
                  <Text style={styles.formLabel}>Full Name</Text>
                  <TextInput
                    style={styles.formInput}
                    value={editForm.full_name}
                    onChangeText={(text) => setEditForm({ ...editForm, full_name: text })}
                    placeholder="Enter full name"
                    placeholderTextColor="#8b909a"
                  />
                </View>

                <View style={styles.formGroup}>
                  <Text style={styles.formLabel}>Phone Number</Text>
                  <TextInput
                    style={styles.formInput}
                    value={editForm.phone}
                    onChangeText={(text) => setEditForm({ ...editForm, phone: text })}
                    placeholder="Enter phone number"
                    placeholderTextColor="#8b909a"
                    keyboardType="phone-pad"
                  />
                </View>

                <View style={styles.formGroup}>
                  <Text style={styles.formLabel}>Role</Text>
                  <View style={styles.roleOptions}>
                    {(['customer', 'vendor', 'rider', 'admin'] as const).map((role) => {
                      const Icon = roleIcons[role];
                      const color = roleColors[role];
                      const isSelected = editForm.role === role;

                      return (
                        <TouchableOpacity
                          key={role}
                          style={[
                            styles.roleOption,
                            isSelected && { backgroundColor: color + '14', borderColor: color },
                          ]}
                          onPress={() => setEditForm({ ...editForm, role })}
                          disabled={updating}
                          activeOpacity={0.6}
                        >
                          <View style={[styles.roleOptionIconWrap, { backgroundColor: color + '14' }]}>
                            <Icon size={18} color={color} />
                          </View>
                          <Text style={[styles.roleOptionText, isSelected && { color }]}>
                            {roleLabels[role]}
                          </Text>
                          {isSelected && (
                            <View style={[styles.selectedDot, { backgroundColor: color }]} />
                          )}
                        </TouchableOpacity>
                      );
                    })}
                  </View>
                </View>

                <TouchableOpacity
                  style={[styles.saveButton, updating && styles.saveButtonDisabled]}
                  onPress={updateUser}
                  disabled={updating}
                  activeOpacity={0.7}
                >
                  {updating ? (
                    <ActivityIndicator size="small" color="#ffffff" />
                  ) : (
                    <Text style={styles.saveButtonText}>Save Changes</Text>
                  )}
                </TouchableOpacity>
              </View>
            </ScrollView>
          </View>
        </View>
      </Modal>

      <Modal
        visible={showSuspendModal}
        transparent
        animationType="fade"
        onRequestClose={() => {
          setShowSuspendModal(false);
          setUserToSuspend(null);
        }}
      >
        <View style={styles.confirmOverlay}>
          <View style={styles.confirmModal}>
            <View style={styles.confirmIcon}>
              {userToSuspend?.is_suspended ? (
                <Unlock size={28} color="#059669" />
              ) : (
                <Lock size={28} color="#f59e0b" />
              )}
            </View>
            <Text style={styles.confirmTitle}>
              {userToSuspend?.is_suspended ? 'Unsuspend User' : 'Suspend User'}
            </Text>
            <Text style={styles.confirmMessage}>
              Are you sure you want to {userToSuspend?.is_suspended ? 'unsuspend' : 'suspend'}{' '}
              <Text style={styles.confirmBold}>{userToSuspend?.full_name}</Text>?
            </Text>
            <View style={styles.confirmButtons}>
              <TouchableOpacity
                style={styles.confirmCancelBtn}
                onPress={() => {
                  setShowSuspendModal(false);
                  setUserToSuspend(null);
                }}
              >
                <Text style={styles.confirmCancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[
                  styles.confirmActionBtn,
                  userToSuspend?.is_suspended
                    ? { backgroundColor: '#059669' }
                    : { backgroundColor: '#f59e0b' },
                ]}
                onPress={() => {
                  if (userToSuspend) performSuspension(userToSuspend);
                }}
              >
                <Text style={styles.confirmActionText}>
                  {userToSuspend?.is_suspended ? 'Unsuspend' : 'Suspend'}
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
    backgroundColor: '#f8f9fb',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f8f9fb',
  },

  header: {
    backgroundColor: '#1a1d23',
    paddingHorizontal: 20,
    paddingBottom: 16,
    borderBottomLeftRadius: 24,
    borderBottomRightRadius: 24,
  },
  headerTop: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 16,
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: 'rgba(255, 140, 0, 0.12)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerTextContainer: {
    flex: 1,
  },
  title: {
    fontSize: 26,
    fontFamily: Fonts.headingBold,
    color: '#ffffff',
    letterSpacing: -0.3,
  },
  subtitle: {
    fontSize: 13,
    fontFamily: Fonts.regular,
    color: '#8b909a',
    marginTop: 2,
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    borderRadius: 14,
    paddingHorizontal: 14,
    gap: 10,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.06)',
  },
  searchInput: {
    flex: 1,
    fontSize: 14,
    fontFamily: Fonts.regular,
    color: '#ffffff',
    paddingVertical: 12,
    outlineStyle: 'none',
  } as any,

  filterRow: {
    gap: 8,
    paddingBottom: 2,
  },
  filterTab: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.06)',
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: 10,
    gap: 6,
  },
  filterTabActive: {
    backgroundColor: '#ff8c00',
  },
  filterTabText: {
    fontFamily: Fonts.medium,
    fontSize: 13,
    color: '#8b909a',
  },
  filterTabTextActive: {
    color: '#ffffff',
  },
  filterBadge: {
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 8,
    minWidth: 22,
    alignItems: 'center',
  },
  filterBadgeActive: {
    backgroundColor: 'rgba(255, 255, 255, 0.25)',
  },
  filterBadgeText: {
    fontFamily: Fonts.groteskMedium,
    fontSize: 11,
    color: '#8b909a',
  },
  filterBadgeTextActive: {
    color: '#ffffff',
  },

  statsRow: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    paddingTop: 16,
    gap: 10,
  },
  statCard: {
    flex: 1,
    borderRadius: 14,
    padding: 14,
    alignItems: 'center',
    gap: 6,
  },
  statIconWrap: {
    width: 36,
    height: 36,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
  },
  statNumber: {
    fontSize: 22,
    fontFamily: Fonts.groteskBold,
    letterSpacing: -0.3,
  },
  statLabel: {
    fontSize: 11,
    fontFamily: Fonts.medium,
    color: '#6b7280',
  },

  list: {
    padding: 16,
    paddingBottom: 32,
  },
  footerLoader: {
    paddingVertical: 16,
    alignItems: 'center',
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: 60,
    gap: 8,
  },
  emptyTitle: {
    fontFamily: Fonts.heading,
    fontSize: 17,
    color: '#6b7280',
    marginTop: 8,
  },
  emptySubtitle: {
    fontFamily: Fonts.regular,
    fontSize: 13,
    color: '#9ca3af',
  },

  userCard: {
    backgroundColor: '#ffffff',
    borderRadius: 18,
    padding: 18,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 8,
    elevation: 2,
  },
  suspendedCard: {
    backgroundColor: '#fffbfb',
    borderWidth: 1,
    borderColor: '#fee2e2',
  },
  cardTop: {
    marginBottom: 12,
  },
  cardNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 8,
  },
  userName: {
    fontSize: 16,
    fontFamily: Fonts.semiBold,
    color: '#1a1d23',
    flex: 1,
  },
  youBadge: {
    backgroundColor: '#ff8c00',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
  },
  youBadgeText: {
    fontFamily: Fonts.semiBold,
    fontSize: 10,
    color: '#ffffff',
  },
  badgesRow: {
    flexDirection: 'row',
    gap: 6,
    flexWrap: 'wrap',
  },
  roleBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 20,
    gap: 5,
  },
  roleText: {
    fontSize: 11,
    fontFamily: Fonts.semiBold,
  },
  suspendedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 20,
    gap: 4,
    backgroundColor: '#fef2f2',
  },
  suspendedText: {
    fontSize: 11,
    fontFamily: Fonts.semiBold,
    color: '#ef4444',
  },
  cardDivider: {
    height: 1,
    backgroundColor: '#f0f1f3',
    marginBottom: 10,
  },

  detailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 6,
    gap: 8,
  },
  detailIconWrap: {
    width: 26,
    height: 26,
    borderRadius: 7,
    backgroundColor: '#f8f9fb',
    justifyContent: 'center',
    alignItems: 'center',
  },
  detailText: {
    fontSize: 13,
    fontFamily: Fonts.regular,
    color: '#6b7280',
    flex: 1,
  },

  cardActions: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 10,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#f0f1f3',
  },
  actionBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 5,
    paddingVertical: 9,
    borderRadius: 10,
    backgroundColor: '#fff7ed',
  },
  actionBtnSuspend: {
    backgroundColor: '#fffbeb',
  },
  actionBtnUnsuspend: {
    backgroundColor: '#ecfdf5',
  },
  actionBtnDelete: {
    backgroundColor: '#fef2f2',
  },
  actionBtnTextEdit: {
    fontSize: 12,
    fontFamily: Fonts.semiBold,
    color: '#ff8c00',
  },
  actionBtnTextSuspend: {
    fontSize: 12,
    fontFamily: Fonts.semiBold,
    color: '#f59e0b',
  },
  actionBtnTextUnsuspend: {
    fontSize: 12,
    fontFamily: Fonts.semiBold,
    color: '#059669',
  },
  actionBtnTextDelete: {
    fontSize: 12,
    fontFamily: Fonts.semiBold,
    color: '#ef4444',
  },

  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: '#ffffff',
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    paddingHorizontal: 24,
    paddingBottom: 32,
    maxHeight: '82%',
    flexShrink: 1,
  },
  modalHandle: {
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#e5e7eb',
    alignSelf: 'center',
    marginTop: 12,
    marginBottom: 16,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  modalTitle: {
    fontSize: 20,
    fontFamily: Fonts.headingBold,
    color: '#1a1d23',
  },
  closeBtn: {
    padding: 4,
  },

  form: {
    gap: 18,
    paddingBottom: 20,
  },
  formGroup: {
    gap: 8,
  },
  formLabel: {
    fontSize: 14,
    fontFamily: Fonts.semiBold,
    color: '#374151',
  },
  formInput: {
    backgroundColor: '#f8f9fb',
    borderRadius: 14,
    padding: 14,
    fontSize: 15,
    fontFamily: Fonts.regular,
    color: '#1a1d23',
    borderWidth: 1,
    borderColor: '#f0f1f3',
  },
  roleOptions: {
    gap: 8,
  },
  roleOption: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 14,
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: '#f0f1f3',
    backgroundColor: '#ffffff',
  },
  roleOptionIconWrap: {
    width: 36,
    height: 36,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
  },
  roleOptionText: {
    fontSize: 15,
    fontFamily: Fonts.semiBold,
    color: '#374151',
    flex: 1,
  },
  selectedDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },

  saveButton: {
    backgroundColor: '#ff8c00',
    paddingVertical: 16,
    borderRadius: 14,
    alignItems: 'center',
    shadowColor: '#ff8c00',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 4,
  },
  saveButtonDisabled: {
    opacity: 0.6,
  },
  saveButtonText: {
    fontSize: 16,
    fontFamily: Fonts.semiBold,
    color: '#ffffff',
  },

  confirmOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  confirmModal: {
    backgroundColor: '#ffffff',
    borderRadius: 24,
    padding: 28,
    width: '85%',
    maxWidth: 400,
    alignItems: 'center',
  },
  confirmIcon: {
    width: 64,
    height: 64,
    borderRadius: 20,
    backgroundColor: '#fffbeb',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  confirmTitle: {
    fontSize: 20,
    fontFamily: Fonts.headingBold,
    color: '#1a1d23',
    marginBottom: 8,
  },
  confirmMessage: {
    fontSize: 14,
    fontFamily: Fonts.regular,
    color: '#6b7280',
    textAlign: 'center',
    marginBottom: 24,
    lineHeight: 20,
  },
  confirmBold: {
    fontFamily: Fonts.semiBold,
    color: '#1a1d23',
  },
  confirmButtons: {
    flexDirection: 'row',
    gap: 12,
    width: '100%',
  },
  confirmCancelBtn: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 14,
    alignItems: 'center',
    backgroundColor: '#f8f9fb',
  },
  confirmCancelText: {
    fontSize: 15,
    fontFamily: Fonts.semiBold,
    color: '#6b7280',
  },
  confirmActionBtn: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 14,
    alignItems: 'center',
  },
  confirmActionText: {
    fontSize: 15,
    fontFamily: Fonts.semiBold,
    color: '#ffffff',
  },
});
