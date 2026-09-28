import React, { useEffect, useState, useCallback } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  RefreshControl,
  StyleSheet,
  ActivityIndicator,
  Modal,
  Alert,
  TextInput,
  ScrollView,
} from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import {
  mobileGetProjectMembers,
  mobileGetAvailableProjectMembers,
  mobileAssignProjectMember,
  mobileUpdateProjectMemberRole,
  mobileRemoveProjectMember,
} from '../../src/api-client';

export default function TeamScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ projectId?: string }>();
  const projectId = params.projectId || '';

  const [members, setMembers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Modal states
  const [assignModalVisible, setAssignModalVisible] = useState(false);
  const [availableMembers, setAvailableMembers] = useState<any[]>([]);
  const [selectedUserId, setSelectedUserId] = useState<string>('');
  const [selectedRole, setSelectedRole] = useState<string>('developer');
  const [submitting, setSubmitting] = useState(false);

  // Role Edit Modal state
  const [editMember, setEditMember] = useState<any | null>(null);
  const [newRole, setNewRole] = useState<string>('developer');

  const fetchMembers = useCallback(async () => {
    if (!projectId) {
      setLoading(false);
      return;
    }
    setError(null);
    try {
      const data = await mobileGetProjectMembers(projectId);
      setMembers(data);
    } catch (err: any) {
      setError(err.message || 'Failed to load project team');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [projectId]);

  useEffect(() => {
    fetchMembers();
  }, [fetchMembers]);

  const onRefresh = () => {
    setRefreshing(true);
    fetchMembers();
  };

  const handleOpenAssign = async () => {
    try {
      const avail = await mobileGetAvailableProjectMembers(projectId);
      setAvailableMembers(avail);
      if (avail.length > 0) {
        setSelectedUserId(avail[0].userId);
      } else {
        setSelectedUserId('');
      }
      setAssignModalVisible(true);
    } catch (err: any) {
      Alert.alert('Error', err.message || 'Failed to load available members');
    }
  };

  const handleAssignMember = async () => {
    if (!selectedUserId) {
      Alert.alert('Selection Error', 'Please select an organization member');
      return;
    }
    setSubmitting(true);
    try {
      await mobileAssignProjectMember(projectId, selectedUserId, selectedRole);
      setAssignModalVisible(false);
      fetchMembers();
    } catch (err: any) {
      Alert.alert('Assignment Failed', err.message || 'Could not assign member');
    } finally {
      setSubmitting(false);
    }
  };

  const handleUpdateRole = async () => {
    if (!editMember) return;
    setSubmitting(true);
    try {
      await mobileUpdateProjectMemberRole(projectId, editMember.id, newRole);
      setEditMember(null);
      fetchMembers();
    } catch (err: any) {
      Alert.alert('Update Failed', err.message || 'Could not update role');
    } finally {
      setSubmitting(false);
    }
  };

  const handleRemoveMember = (member: any) => {
    Alert.alert(
      'Remove Team Member',
      `Are you sure you want to remove ${member.name} from this project?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Remove',
          style: 'destructive',
          onPress: async () => {
            try {
              await mobileRemoveProjectMember(projectId, member.id);
              fetchMembers();
            } catch (err: any) {
              Alert.alert('Removal Failed', err.message || 'Could not remove member');
            }
          },
        },
      ]
    );
  };

  const renderRoleBadge = (role: string) => {
    let color = '#94a3b8';
    let bg = '#1e293b';

    if (role === 'client') {
      color = '#34d399';
      bg = 'rgba(52, 211, 153, 0.15)';
    } else if (role === 'developer') {
      color = '#818cf8';
      bg = 'rgba(129, 140, 248, 0.15)';
    } else if (role === 'manager') {
      color = '#c084fc';
      bg = 'rgba(192, 132, 252, 0.15)';
    }

    return (
      <View style={[styles.roleBadge, { backgroundColor: bg }]}>
        <Text style={[styles.roleBadgeText, { color }]}>{role.toUpperCase()}</Text>
      </View>
    );
  };

  const renderMemberItem = ({ item }: { item: any }) => {
    const initials = item.name
      ? item.name
          .split(' ')
          .map((n: string) => n[0])
          .join('')
          .toUpperCase()
          .slice(0, 2)
      : '??';

    return (
      <View style={styles.card}>
        <View style={styles.cardHeader}>
          <View style={styles.avatarContainer}>
            <Text style={styles.avatarText}>{initials}</Text>
          </View>
          <View style={styles.headerDetails}>
            <Text style={styles.memberName}>{item.name}</Text>
            <Text style={styles.memberEmail}>{item.email}</Text>
          </View>
        </View>

        <View style={styles.cardDivider} />

        <View style={styles.roleRow}>
          <View style={styles.roleColumn}>
            <Text style={styles.roleLabel}>ORG ROLE</Text>
            <Text style={styles.orgRoleText}>{item.organizationRole}</Text>
          </View>

          <View style={styles.roleColumn}>
            <Text style={styles.roleLabel}>PROJECT ROLE</Text>
            {renderRoleBadge(item.projectRole)}
          </View>
        </View>

        <View style={styles.cardFooter}>
          <TouchableOpacity
            style={styles.actionButton}
            onPress={() => {
              setEditMember(item);
              setNewRole(item.projectRole);
            }}
          >
            <Text style={styles.actionButtonText}>Change Role</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.actionButton, styles.removeButton]}
            onPress={() => handleRemoveMember(item)}
          >
            <Text style={styles.removeButtonText}>Remove</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  };

  return (
    <View style={styles.container}>
      {/* Top Header */}
      <View style={styles.topHeader}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <Text style={styles.backButtonText}>← Back</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Project Team</Text>
        <TouchableOpacity onPress={handleOpenAssign} style={styles.assignButton}>
          <Text style={styles.assignButtonText}>+ Assign</Text>
        </TouchableOpacity>
      </View>

      {error ? (
        <View style={styles.errorBox}>
          <Text style={styles.errorText}>{error}</Text>
        </View>
      ) : null}

      {loading ? (
        <View style={styles.centerContainer}>
          <ActivityIndicator size="large" color="#6366f1" />
          <Text style={styles.loadingText}>Loading Project Team...</Text>
        </View>
      ) : (
        <FlatList
          data={members}
          keyExtractor={(item) => item.id}
          renderItem={renderMemberItem}
          contentContainerStyle={styles.listContent}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#6366f1" />
          }
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <Text style={styles.emptyTitle}>No Team Members</Text>
              <Text style={styles.emptyText}>
                No team members are assigned to this project yet. Tap "+ Assign" above to assign members.
              </Text>
            </View>
          }
        />
      )}

      {/* Assign Member Modal */}
      <Modal visible={assignModalVisible} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Assign Team Member</Text>

            {availableMembers.length === 0 ? (
              <Text style={styles.emptyText}>No unassigned organization members available.</Text>
            ) : (
              <ScrollView style={{ maxHeight: 200, marginVertical: 10 }}>
                {availableMembers.map((m) => (
                  <TouchableOpacity
                    key={m.userId}
                    style={[
                      styles.selectableMember,
                      selectedUserId === m.userId && styles.selectableMemberActive,
                    ]}
                    onPress={() => setSelectedUserId(m.userId)}
                  >
                    <Text style={styles.memberName}>{m.name}</Text>
                    <Text style={styles.memberEmail}>{m.email}</Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            )}

            <Text style={styles.fieldLabel}>Select Project Role:</Text>
            <View style={styles.rolePickerRow}>
              {['client', 'developer', 'manager', 'viewer'].map((role) => (
                <TouchableOpacity
                  key={role}
                  style={[
                    styles.roleChip,
                    selectedRole === role && styles.roleChipActive,
                  ]}
                  onPress={() => setSelectedRole(role)}
                >
                  <Text style={[styles.roleChipText, selectedRole === role && styles.roleChipTextActive]}>
                    {role}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            <View style={styles.modalActions}>
              <TouchableOpacity
                style={styles.cancelBtn}
                onPress={() => setAssignModalVisible(false)}
              >
                <Text style={styles.cancelBtnText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.submitBtn}
                onPress={handleAssignMember}
                disabled={submitting || availableMembers.length === 0}
              >
                <Text style={styles.submitBtnText}>{submitting ? 'Assigning...' : 'Assign'}</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Edit Role Modal */}
      <Modal visible={!!editMember} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Change Member Role</Text>
            <Text style={styles.memberEmail}>{editMember?.name}</Text>

            <Text style={styles.fieldLabel}>Select New Role:</Text>
            <View style={styles.rolePickerRow}>
              {['client', 'developer', 'manager', 'viewer'].map((role) => (
                <TouchableOpacity
                  key={role}
                  style={[
                    styles.roleChip,
                    newRole === role && styles.roleChipActive,
                  ]}
                  onPress={() => setNewRole(role)}
                >
                  <Text style={[styles.roleChipText, newRole === role && styles.roleChipTextActive]}>
                    {role}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            <View style={styles.modalActions}>
              <TouchableOpacity style={styles.cancelBtn} onPress={() => setEditMember(null)}>
                <Text style={styles.cancelBtnText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.submitBtn} onPress={handleUpdateRole} disabled={submitting}>
                <Text style={styles.submitBtnText}>{submitting ? 'Saving...' : 'Save Role'}</Text>
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
    backgroundColor: '#0f172a',
  },
  topHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: 48,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#1e293b',
    backgroundColor: '#0f172a',
  },
  backButton: {
    padding: 6,
  },
  backButtonText: {
    color: '#818cf8',
    fontSize: 14,
  },
  headerTitle: {
    color: '#f8fafc',
    fontSize: 16,
    fontWeight: 'bold',
  },
  assignButton: {
    backgroundColor: '#4f46e5',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
  },
  assignButtonText: {
    color: '#ffffff',
    fontSize: 12,
    fontWeight: 'bold',
  },
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    color: '#94a3b8',
    marginTop: 12,
    fontSize: 13,
  },
  errorBox: {
    margin: 16,
    padding: 12,
    backgroundColor: 'rgba(244, 63, 94, 0.1)',
    borderColor: 'rgba(244, 63, 94, 0.3)',
    borderWidth: 1,
    borderRadius: 8,
  },
  errorText: {
    color: '#fb7185',
    fontSize: 12,
  },
  listContent: {
    padding: 16,
  },
  card: {
    backgroundColor: '#1e293b',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#334155',
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  avatarContainer: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#312e81',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  avatarText: {
    color: '#a5b4fc',
    fontWeight: 'bold',
    fontSize: 14,
  },
  headerDetails: {
    flex: 1,
  },
  memberName: {
    color: '#f8fafc',
    fontSize: 15,
    fontWeight: 'bold',
  },
  memberEmail: {
    color: '#94a3b8',
    fontSize: 12,
    marginTop: 2,
  },
  cardDivider: {
    height: 1,
    backgroundColor: '#334155',
    marginVertical: 12,
  },
  roleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  roleColumn: {
    flex: 1,
  },
  roleLabel: {
    color: '#64748b',
    fontSize: 10,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  orgRoleText: {
    color: '#cbd5e1',
    fontSize: 12,
    fontWeight: '600',
    textTransform: 'uppercase',
  },
  roleBadge: {
    alignSelf: 'flex-start',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  roleBadgeText: {
    fontSize: 10,
    fontWeight: 'bold',
  },
  cardFooter: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 8,
  },
  actionButton: {
    backgroundColor: '#334155',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
  },
  actionButtonText: {
    color: '#cbd5e1',
    fontSize: 12,
    fontWeight: '600',
  },
  removeButton: {
    backgroundColor: 'rgba(239, 68, 68, 0.15)',
  },
  removeButtonText: {
    color: '#f87171',
    fontSize: 12,
    fontWeight: '600',
  },
  emptyContainer: {
    padding: 32,
    alignItems: 'center',
  },
  emptyTitle: {
    color: '#f8fafc',
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 8,
  },
  emptyText: {
    color: '#94a3b8',
    fontSize: 13,
    textAlign: 'center',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.7)',
    justifyContent: 'center',
    padding: 20,
  },
  modalCard: {
    backgroundColor: '#1e293b',
    borderRadius: 16,
    padding: 20,
    borderWidth: 1,
    borderColor: '#334155',
  },
  modalTitle: {
    color: '#f8fafc',
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 12,
  },
  selectableMember: {
    padding: 10,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#334155',
    marginBottom: 6,
  },
  selectableMemberActive: {
    borderColor: '#6366f1',
    backgroundColor: 'rgba(99, 102, 241, 0.15)',
  },
  fieldLabel: {
    color: '#cbd5e1',
    fontSize: 12,
    fontWeight: '600',
    marginTop: 12,
    marginBottom: 8,
  },
  rolePickerRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  roleChip: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#334155',
    backgroundColor: '#0f172a',
  },
  roleChipActive: {
    borderColor: '#6366f1',
    backgroundColor: '#4f46e5',
  },
  roleChipText: {
    color: '#94a3b8',
    fontSize: 11,
    fontWeight: '600',
    textTransform: 'capitalize',
  },
  roleChipTextActive: {
    color: '#ffffff',
  },
  modalActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 12,
    marginTop: 20,
  },
  cancelBtn: {
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  cancelBtnText: {
    color: '#94a3b8',
    fontSize: 13,
  },
  submitBtn: {
    backgroundColor: '#4f46e5',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
  },
  submitBtnText: {
    color: '#ffffff',
    fontSize: 13,
    fontWeight: 'bold',
  },
});
