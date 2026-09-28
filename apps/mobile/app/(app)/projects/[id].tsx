import React, { useEffect, useState, useCallback } from 'react';
import {
  StyleSheet,
  Text,
  View,
  ScrollView,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
  RefreshControl,
} from 'react-native';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import {
  mobileGetProjectDetail,
  mobileGetProjectConversations,
  mobileCreateConversation,
  mobileGetProjectWork,
  mobileGetProjectDeliverables,
  mobileGetProjectMembers,
} from '../../../src/api-client';
import { Project, Conversation } from '@intentflow/types';

export default function MobileProjectDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();

  const [project, setProject] = useState<Project | null>(null);
  const [conversations, setConversations] = useState<(Conversation & { unread?: boolean })[]>([]);
  const [workMetrics, setWorkMetrics] = useState<any>(null);
  const [deliverablesCount, setDeliverablesCount] = useState<number>(0);
  const [membersCount, setMembersCount] = useState<number>(0);

  const [activeTab, setActiveTab] = useState<
    'overview' | 'conversations' | 'work' | 'deliverables' | 'completion' | 'team'
  >('overview');

  const [newTitle, setNewTitle] = useState('');
  const [showNewModal, setShowNewModal] = useState(false);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadData = useCallback(async () => {
    if (!id) return;
    setError(null);
    try {
      const [p, convs, wData, delivs, mems] = await Promise.all([
        mobileGetProjectDetail(id).catch(() => null),
        mobileGetProjectConversations(id).catch(() => []),
        mobileGetProjectWork(id).catch(() => ({ workItems: [], metrics: {} })),
        mobileGetProjectDeliverables(id).catch(() => []),
        mobileGetProjectMembers(id).catch(() => []),
      ]);

      setProject(p);
      setConversations(convs);
      setWorkMetrics(wData.metrics);
      setDeliverablesCount(delivs.length);
      setMembersCount(mems.length);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load project details');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [id]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const onRefresh = () => {
    setRefreshing(true);
    loadData();
  };

  const handleCreateConversation = async () => {
    if (!id || !newTitle.trim()) return;
    try {
      const created = await mobileCreateConversation(id, newTitle.trim());
      setNewTitle('');
      setShowNewModal(false);
      await loadData();
      router.push({
        pathname: '/(app)/conversations/[conversationId]',
        params: { conversationId: created.id, title: created.title },
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create conversation');
    }
  };

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color="#6366f1" />
        <Text style={styles.loadingText}>Loading Project Workspace...</Text>
      </View>
    );
  }

  if (error || !project) {
    return (
      <View style={styles.center}>
        <Text style={styles.errorText}>{error || 'Project workspace not found'}</Text>
        <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
          <Text style={styles.backButtonText}>← Back to Projects</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={styles.screen}>
      <Stack.Screen options={{ title: project.name }} />

      {/* Horizontal Tabs Navigation */}
      <View style={styles.tabsContainer}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.tabsScroll}>
          {[
            { key: 'overview', label: '🏠 Overview' },
            { key: 'conversations', label: '💬 Conversations' },
            { key: 'work', label: '⚡ Work' },
            { key: 'deliverables', label: '📦 Deliverables' },
            { key: 'completion', label: '✅ Completion' },
            { key: 'team', label: '👥 Team' },
          ].map((tab) => (
            <TouchableOpacity
              key={tab.key}
              style={[styles.tabChip, activeTab === tab.key && styles.tabChipActive]}
              onPress={() => {
                if (tab.key === 'deliverables') {
                  router.push({ pathname: '/(app)/deliverables', params: { projectId: id } });
                } else if (tab.key === 'completion') {
                  router.push({ pathname: '/(app)/completion', params: { projectId: id } });
                } else if (tab.key === 'team') {
                  router.push({ pathname: '/(app)/team', params: { projectId: id } });
                } else {
                  setActiveTab(tab.key as any);
                }
              }}
            >
              <Text style={[styles.tabText, activeTab === tab.key && styles.tabTextActive]}>
                {tab.label}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>

      <ScrollView
        contentContainerStyle={styles.container}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#6366f1" />}
      >
        {/* Project Header Banner */}
        <View style={styles.card}>
          <Text style={styles.orgTag}>{project.organizationName}</Text>
          <Text style={styles.title}>{project.name}</Text>
          <Text style={styles.desc}>{project.description || 'No description provided'}</Text>

          <View style={styles.metaRow}>
            <Text style={styles.metaLabel}>STATUS:</Text>
            <View style={styles.badge}>
              <Text style={styles.statusBadge}>{project.status.toUpperCase()}</Text>
            </View>
          </View>
        </View>

        {activeTab === 'overview' ? (
          <View style={styles.overviewSection}>
            {/* Top Metrics Grid */}
            <View style={styles.metricsGrid}>
              <View style={styles.metricCard}>
                <Text style={styles.metricLabel}>WORK</Text>
                <Text style={styles.metricValue}>{workMetrics?.completed || 0} / {workMetrics?.total || 0}</Text>
              </View>
              <View style={styles.metricCard}>
                <Text style={styles.metricLabel}>DELIVERABLES</Text>
                <Text style={styles.metricValue}>{deliverablesCount}</Text>
              </View>
              <View style={styles.metricCard}>
                <Text style={styles.metricLabel}>TEAM</Text>
                <Text style={styles.metricValue}>{membersCount}</Text>
              </View>
            </View>

            {/* Quick Workspace Shortcuts */}
            <Text style={styles.sectionHeaderTitle}>Workspace Hub</Text>
            <View style={styles.shortcutGrid}>
              <TouchableOpacity
                style={styles.shortcutCard}
                onPress={() => setActiveTab('conversations')}
              >
                <Text style={styles.shortcutIcon}>💬</Text>
                <Text style={styles.shortcutTitle}>Conversations</Text>
                <Text style={styles.shortcutSub}>{conversations.length} Threads</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.shortcutCard}
                onPress={() => router.push({ pathname: '/(app)/deliverables', params: { projectId: id } })}
              >
                <Text style={styles.shortcutIcon}>📦</Text>
                <Text style={styles.shortcutTitle}>Deliverables</Text>
                <Text style={styles.shortcutSub}>{deliverablesCount} Items</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.shortcutCard}
                onPress={() => router.push({ pathname: '/(app)/completion', params: { projectId: id } })}
              >
                <Text style={styles.shortcutIcon}>✅</Text>
                <Text style={styles.shortcutTitle}>Completion</Text>
                <Text style={styles.shortcutSub}>Sign-off & Handoff</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.shortcutCard}
                onPress={() => router.push({ pathname: '/(app)/team', params: { projectId: id } })}
              >
                <Text style={styles.shortcutIcon}>👥</Text>
                <Text style={styles.shortcutTitle}>Project Team</Text>
                <Text style={styles.shortcutSub}>{membersCount} Members</Text>
              </TouchableOpacity>
            </View>
          </View>
        ) : activeTab === 'conversations' ? (
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>Conversations</Text>
              <TouchableOpacity
                style={styles.newBtn}
                onPress={() => setShowNewModal(!showNewModal)}
              >
                <Text style={styles.newBtnText}>+ New</Text>
              </TouchableOpacity>
            </View>

            {showNewModal && (
              <View style={styles.newModal}>
                <TextInput
                  style={styles.input}
                  value={newTitle}
                  onChangeText={setNewTitle}
                  placeholder="Conversation title (e.g. Design Feedback)"
                  placeholderTextColor="#64748b"
                />
                <TouchableOpacity
                  style={[styles.createBtn, !newTitle.trim() && styles.btnDisabled]}
                  onPress={handleCreateConversation}
                  disabled={!newTitle.trim()}
                >
                  <Text style={styles.createBtnText}>Create Thread</Text>
                </TouchableOpacity>
              </View>
            )}

            {conversations.length > 0 ? (
              conversations.map((conv) => (
                <TouchableOpacity
                  key={conv.id}
                  style={styles.convCard}
                  onPress={() =>
                    router.push({
                      pathname: '/(app)/conversations/[conversationId]',
                      params: { conversationId: conv.id, title: conv.title },
                    })
                  }
                >
                  <View style={styles.convRow}>
                    <Text style={styles.convTitle}>{conv.title}</Text>
                    {conv.unread && <View style={styles.unreadDot} />}
                  </View>
                  {conv.lastMessage && (
                    <Text style={styles.convPreview} numberOfLines={1}>
                      {conv.lastMessage.senderName}: {conv.lastMessage.body}
                    </Text>
                  )}
                  <Text style={styles.convMeta}>{conv.participantCount || 1} participant(s)</Text>
                </TouchableOpacity>
              ))
            ) : (
              <Text style={styles.emptyText}>No conversations yet. Start a discussion for this project.</Text>
            )}
          </View>
        ) : null}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: '#0f172a',
  },
  container: {
    padding: 16,
    flexGrow: 1,
  },
  center: {
    flex: 1,
    backgroundColor: '#0f172a',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  loadingText: {
    color: '#94a3b8',
    marginTop: 12,
    fontSize: 13,
  },
  errorText: {
    color: '#f87171',
    fontSize: 14,
    marginBottom: 16,
  },
  backButton: {
    backgroundColor: '#334155',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
  },
  backButtonText: {
    color: '#ffffff',
    fontSize: 13,
    fontWeight: 'bold',
  },
  tabsContainer: {
    backgroundColor: '#020617',
    borderBottomWidth: 1,
    borderBottomColor: '#1e293b',
    paddingVertical: 8,
  },
  tabsScroll: {
    paddingHorizontal: 16,
    gap: 8,
  },
  tabChip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    backgroundColor: '#1e293b',
    borderWidth: 1,
    borderColor: '#334155',
  },
  tabChipActive: {
    backgroundColor: '#4f46e5',
    borderColor: '#6366f1',
  },
  tabText: {
    color: '#94a3b8',
    fontSize: 12,
    fontWeight: '600',
  },
  tabTextActive: {
    color: '#ffffff',
    fontWeight: 'bold',
  },
  card: {
    backgroundColor: '#1e293b',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#334155',
  },
  orgTag: {
    color: '#818cf8',
    fontSize: 12,
    fontFamily: 'Courier',
    marginBottom: 4,
  },
  title: {
    color: '#ffffff',
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 6,
  },
  desc: {
    color: '#cbd5e1',
    fontSize: 13,
    marginBottom: 12,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  metaLabel: {
    color: '#64748b',
    fontSize: 11,
    fontWeight: 'bold',
  },
  badge: {
    backgroundColor: 'rgba(52, 211, 153, 0.15)',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 4,
  },
  statusBadge: {
    color: '#34d399',
    fontSize: 11,
    fontWeight: 'bold',
  },
  overviewSection: {
    gap: 16,
  },
  metricsGrid: {
    flexDirection: 'row',
    gap: 10,
  },
  metricCard: {
    flex: 1,
    backgroundColor: '#1e293b',
    borderRadius: 10,
    padding: 12,
    borderWidth: 1,
    borderColor: '#334155',
  },
  metricLabel: {
    color: '#64748b',
    fontSize: 9,
    fontWeight: 'bold',
  },
  metricValue: {
    color: '#f8fafc',
    fontSize: 15,
    fontWeight: 'bold',
    marginTop: 4,
  },
  sectionHeaderTitle: {
    color: '#f8fafc',
    fontSize: 15,
    fontWeight: 'bold',
    marginTop: 8,
  },
  shortcutGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  shortcutCard: {
    width: '48%',
    backgroundColor: '#1e293b',
    borderRadius: 12,
    padding: 14,
    borderWidth: 1,
    borderColor: '#334155',
  },
  shortcutIcon: {
    fontSize: 22,
    marginBottom: 8,
  },
  shortcutTitle: {
    color: '#f8fafc',
    fontSize: 14,
    fontWeight: 'bold',
  },
  shortcutSub: {
    color: '#94a3b8',
    fontSize: 11,
    marginTop: 2,
  },
  section: {
    backgroundColor: '#1e293b',
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: '#334155',
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  sectionTitle: {
    color: '#f8fafc',
    fontSize: 16,
    fontWeight: 'bold',
  },
  newBtn: {
    backgroundColor: '#4f46e5',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 6,
  },
  newBtnText: {
    color: '#ffffff',
    fontSize: 12,
    fontWeight: 'bold',
  },
  newModal: {
    marginBottom: 12,
    gap: 8,
  },
  input: {
    backgroundColor: '#0f172a',
    borderWidth: 1,
    borderColor: '#334155',
    borderRadius: 8,
    padding: 10,
    color: '#ffffff',
    fontSize: 13,
  },
  createBtn: {
    backgroundColor: '#4f46e5',
    padding: 10,
    borderRadius: 8,
    alignItems: 'center',
  },
  createBtnText: {
    color: '#ffffff',
    fontWeight: 'bold',
    fontSize: 13,
  },
  btnDisabled: {
    opacity: 0.5,
  },
  convCard: {
    backgroundColor: '#0f172a',
    borderRadius: 8,
    padding: 12,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: '#334155',
  },
  convRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  convTitle: {
    color: '#f8fafc',
    fontSize: 14,
    fontWeight: '600',
  },
  unreadDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#818cf8',
  },
  convPreview: {
    color: '#94a3b8',
    fontSize: 12,
    marginTop: 4,
  },
  convMeta: {
    color: '#64748b',
    fontSize: 10,
    marginTop: 6,
  },
  emptyText: {
    color: '#94a3b8',
    fontSize: 13,
    textAlign: 'center',
    paddingVertical: 12,
  },
});
