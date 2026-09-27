import React, { useEffect, useState, useCallback } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  RefreshControl,
  StyleSheet,
  ActivityIndicator,
} from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { Deliverable, ProjectMilestone } from '@intentflow/types';
import {
  mobileGetProjectDeliverables,
  mobileGetProjectMilestones,
} from '../../src/api-client';

export default function DeliverablesScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ projectId?: string }>();
  const projectId = params.projectId || '';

  const [deliverables, setDeliverables] = useState<Deliverable[]>([]);
  const [milestones, setMilestones] = useState<ProjectMilestone[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchDeliverables = useCallback(async () => {
    if (!projectId) {
      setLoading(false);
      return;
    }
    setError(null);
    try {
      const [delivList, mList] = await Promise.all([
        mobileGetProjectDeliverables(projectId),
        mobileGetProjectMilestones(projectId),
      ]);
      setDeliverables(delivList);
      setMilestones(mList);
    } catch (err: any) {
      setError(err.message || 'Failed to load deliverables');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [projectId]);

  useEffect(() => {
    fetchDeliverables();
  }, [fetchDeliverables]);

  const onRefresh = () => {
    setRefreshing(true);
    fetchDeliverables();
  };

  const renderStatusBadge = (status: string) => {
    let color = '#94a3b8';
    let bg = '#1e293b';
    let label = status;

    if (status === 'approved') {
      color = '#34d399';
      bg = 'rgba(52, 211, 153, 0.15)';
      label = '✓ Approved';
    } else if (status === 'ready_for_review') {
      color = '#38bdf8';
      bg = 'rgba(56, 189, 248, 0.15)';
      label = '🔍 Ready for Review';
    } else if (status === 'changes_requested') {
      color = '#fbbf24';
      bg = 'rgba(251, 191, 36, 0.15)';
      label = '↻ Changes Requested';
    }

    return (
      <View style={[styles.badge, { backgroundColor: bg }]}>
        <Text style={[styles.badgeText, { color }]}>{label}</Text>
      </View>
    );
  };

  const renderDeliverableItem = ({ item }: { item: Deliverable }) => (
    <TouchableOpacity
      style={styles.card}
      activeOpacity={0.7}
      onPress={() => router.push({ pathname: '/(app)/deliverables/[id]', params: { id: item.id } })}
    >
      <View style={styles.cardHeader}>
        <Text style={styles.cardTitle}>{item.title}</Text>
        {renderStatusBadge(item.status)}
      </View>

      {item.description ? (
        <Text style={styles.cardDescription} numberOfLines={2}>
          {item.description}
        </Text>
      ) : null}

      {item.milestone ? (
        <View style={styles.milestoneTag}>
          <Text style={styles.milestoneText}>🚩 {item.milestone.title}</Text>
        </View>
      ) : null}
    </TouchableOpacity>
  );

  return (
    <View style={styles.container}>
      {/* Top Header */}
      <View style={styles.header}>
        <Text style={styles.title}>📦 Deliverables & Approval</Text>
        <Text style={styles.subtitle}>Review and approve client project packages</Text>
      </View>

      {/* Milestones Horizontal Bar */}
      {milestones.length > 0 ? (
        <View style={styles.milestonesContainer}>
          <Text style={styles.sectionHeader}>MILESTONE PROGRESSION</Text>
          <FlatList
            horizontal
            showsHorizontalScrollIndicator={false}
            data={milestones}
            keyExtractor={(m) => m.id}
            renderItem={({ item }) => (
              <View style={styles.milestonePill}>
                <Text style={styles.milestonePillTitle}>{item.title}</Text>
                <Text style={styles.milestonePillStatus}>{item.status}</Text>
              </View>
            )}
          />
        </View>
      ) : null}

      {error ? (
        <View style={styles.errorBanner}>
          <Text style={styles.errorText}>{error}</Text>
        </View>
      ) : null}

      {loading && !refreshing ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="small" color="#38bdf8" />
          <Text style={styles.loadingText}>Loading deliverables...</Text>
        </View>
      ) : (
        <FlatList
          data={deliverables}
          keyExtractor={(item) => item.id}
          renderItem={renderDeliverableItem}
          contentContainerStyle={styles.listContent}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              tintColor="#38bdf8"
            />
          }
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <Text style={styles.emptyText}>No deliverables found for this project.</Text>
            </View>
          }
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#020617',
  },
  header: {
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#1e293b',
    backgroundColor: '#0f172a',
  },
  title: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#f8fafc',
  },
  subtitle: {
    fontSize: 12,
    color: '#94a3b8',
    marginTop: 2,
  },
  milestonesContainer: {
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#1e293b',
  },
  sectionHeader: {
    fontSize: 10,
    fontWeight: 'bold',
    color: '#64748b',
    letterSpacing: 1,
    marginBottom: 6,
  },
  milestonePill: {
    backgroundColor: '#1e293b',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    marginRight: 8,
    borderWidth: 1,
    borderColor: '#334155',
  },
  milestonePillTitle: {
    fontSize: 11,
    fontWeight: 'bold',
    color: '#f1f5f9',
  },
  milestonePillStatus: {
    fontSize: 9,
    color: '#38bdf8',
    marginTop: 1,
  },
  listContent: {
    padding: 16,
  },
  card: {
    backgroundColor: '#0f172a',
    borderRadius: 12,
    padding: 14,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#1e293b',
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  cardTitle: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#f8fafc',
    flex: 1,
    marginRight: 8,
  },
  cardDescription: {
    fontSize: 12,
    color: '#94a3b8',
    marginTop: 6,
  },
  badge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  badgeText: {
    fontSize: 10,
    fontWeight: 'bold',
  },
  milestoneTag: {
    marginTop: 8,
    alignSelf: 'flex-start',
    backgroundColor: '#1e293b',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 4,
  },
  milestoneText: {
    fontSize: 10,
    color: '#cbd5e1',
  },
  errorBanner: {
    margin: 16,
    padding: 12,
    backgroundColor: 'rgba(239, 68, 68, 0.2)',
    borderRadius: 8,
  },
  errorText: {
    fontSize: 12,
    color: '#fca5a5',
  },
  loadingContainer: {
    padding: 24,
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 8,
    fontSize: 12,
    color: '#64748b',
  },
  emptyContainer: {
    padding: 24,
    alignItems: 'center',
  },
  emptyText: {
    fontSize: 12,
    color: '#64748b',
  },
});
