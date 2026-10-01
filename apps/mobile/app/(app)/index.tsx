import React, { useEffect, useState } from 'react';
import { StyleSheet, Text, View, TouchableOpacity, ScrollView, ActivityIndicator, RefreshControl } from 'react-native';
import { Stack, useRouter } from 'expo-router';
import { mobileGetProjects, mobileGetNotifications, mobileGetMe } from '../../src/api-client';
import { Project, Notification, User } from '@intentflow/types';

export default function MobileProjectsScreen() {
  const router = useRouter();
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [projects, setProjects] = useState<Project[]>([]);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchData = async () => {
    setError(null);
    try {
      const [meRes, projData, notifData] = await Promise.all([
        mobileGetMe().catch(() => null),
        mobileGetProjects().catch(() => []),
        mobileGetNotifications().catch(() => []),
      ]);

      if (meRes) setCurrentUser(meRes.user);
      setProjects(projData);
      setNotifications(notifData);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch workspace data');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const onRefresh = () => {
    setRefreshing(true);
    fetchData();
  };

  const unreadCount = notifications.filter((n) => !n.readAt).length;
  const actionRequiredCount = notifications.filter(
    (n) => !n.readAt && (n.type.includes('deliverable') || n.type.includes('closure') || n.type.includes('work'))
  ).length;

  return (
    <ScrollView
      contentContainerStyle={styles.container}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#6366F1" />}
    >
      <Stack.Screen
        options={{
          title: 'Intent',
          headerRight: () => (
            <View style={styles.headerRightRow}>
              <TouchableOpacity
                onPress={() => router.push('/(app)/notifications' as any)}
                style={styles.notifBellBtn}
              >
                <Text style={styles.bellIcon}>🔔</Text>
                {unreadCount > 0 && (
                  <View style={styles.notifBadge}>
                    <Text style={styles.notifBadgeText}>{unreadCount > 9 ? '9+' : unreadCount}</Text>
                  </View>
                )}
              </TouchableOpacity>

              <TouchableOpacity onPress={() => router.push('/(app)/profile' as any)}>
                <Text style={styles.headerLink}>Profile</Text>
              </TouchableOpacity>
            </View>
          ),
        }}
      />

      {/* Header Info */}
      <View style={styles.headerBox}>
        <View style={styles.badgeRow}>
          <View style={styles.statusPill}>
            <View style={styles.greenDot} />
            <Text style={styles.statusPillText}>Live Workspace</Text>
          </View>
          {currentUser && (
            <Text style={styles.userNameText}>{currentUser.name}</Text>
          )}
        </View>
        <Text style={styles.title}>Projects & Workspaces</Text>
        <Text style={styles.subtitle}>
          Real-time client collaboration, structured deliverables, and AI-assisted workflows.
        </Text>
      </View>

      {/* Action Required Card */}
      {actionRequiredCount > 0 && (
        <TouchableOpacity
          style={styles.actionCard}
          onPress={() => router.push('/(app)/notifications' as any)}
          activeOpacity={0.8}
        >
          <View style={styles.actionCardHeader}>
            <View style={styles.actionPingDot} />
            <Text style={styles.actionCardTitle}>Action Required</Text>
            <View style={styles.actionBadge}>
              <Text style={styles.actionBadgeText}>{actionRequiredCount} pending</Text>
            </View>
          </View>
          <Text style={styles.actionCardBody}>
            You have deliverables or project updates requiring your review.
          </Text>
          <Text style={styles.actionCardLink}>Review Pending Actions →</Text>
        </TouchableOpacity>
      )}

      {loading && !refreshing && (
        <View style={styles.center}>
          <ActivityIndicator size="large" color="#6366f1" />
        </View>
      )}

      {error && (
        <View style={styles.errorCard}>
          <Text style={styles.errorText}>{error}</Text>
          <TouchableOpacity style={styles.retryButton} onPress={fetchData}>
            <Text style={styles.retryText}>Retry</Text>
          </TouchableOpacity>
        </View>
      )}

      {!loading && !error && projects.length === 0 && (
        <View style={styles.emptyCard}>
          <Text style={styles.emptyTitle}>No Projects Yet</Text>
          <Text style={styles.emptyText}>You haven't been assigned to any project workspace yet.</Text>
        </View>
      )}

      {!loading &&
        projects.map((item) => (
          <TouchableOpacity
            key={item.id}
            style={styles.card}
            onPress={() => router.push(`/(app)/projects/${item.id}` as any)}
            activeOpacity={0.7}
          >
            <View style={styles.cardHeader}>
              <Text style={styles.orgName}>{item.organizationName || 'WORKSPACE'}</Text>
              <Text style={styles.statusBadge}>{item.status}</Text>
            </View>
            <Text style={styles.cardTitle}>{item.name}</Text>
            <Text style={styles.cardDesc} numberOfLines={2}>
              {item.description || 'No description provided'}
            </Text>
            <View style={styles.cardFooter}>
              <Text style={styles.cardDate}>
                Updated: {new Date(item.updatedAt).toLocaleDateString()}
              </Text>
              <Text style={styles.cardOpenLink}>Open Workspace →</Text>
            </View>
          </TouchableOpacity>
        ))}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: 16,
    backgroundColor: '#020617',
    flexGrow: 1,
  },
  headerRightRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
  },
  notifBellBtn: {
    position: 'relative',
    padding: 4,
  },
  bellIcon: {
    fontSize: 16,
  },
  notifBadge: {
    position: 'absolute',
    top: -2,
    right: -6,
    backgroundColor: '#e11d48',
    borderRadius: 10,
    minWidth: 16,
    height: 16,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 3,
  },
  notifBadgeText: {
    color: '#ffffff',
    fontSize: 9,
    fontWeight: '700',
  },
  headerLink: {
    color: '#38bdf8',
    fontSize: 14,
    fontWeight: '600',
  },
  headerBox: {
    marginBottom: 16,
  },
  badgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 8,
  },
  statusPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#1E293B',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  greenDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#10B981',
  },
  statusPillText: {
    color: '#818CF8',
    fontSize: 11,
    fontWeight: '800',
  },
  userNameText: {
    color: '#94A3B8',
    fontSize: 12,
    fontWeight: '600',
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#ffffff',
  },
  subtitle: {
    fontSize: 13,
    color: '#94a3b8',
    marginTop: 2,
    lineHeight: 18,
  },
  actionCard: {
    backgroundColor: 'rgba(99, 102, 241, 0.1)',
    borderColor: '#6366f1',
    borderWidth: 1,
    borderRadius: 12,
    padding: 14,
    marginBottom: 16,
  },
  actionCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 6,
  },
  actionPingDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#f43f5e',
  },
  actionCardTitle: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '700',
    flex: 1,
  },
  actionBadge: {
    backgroundColor: 'rgba(244, 63, 94, 0.2)',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 10,
  },
  actionBadgeText: {
    color: '#f43f5e',
    fontSize: 10,
    fontWeight: '700',
  },
  actionCardBody: {
    color: '#cbd5e1',
    fontSize: 12,
    lineHeight: 16,
    marginBottom: 8,
  },
  actionCardLink: {
    color: '#818cf8',
    fontSize: 12,
    fontWeight: '600',
  },
  center: {
    padding: 40,
    alignItems: 'center',
  },
  emptyCard: {
    backgroundColor: '#0f172a',
    borderRadius: 12,
    padding: 30,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#1e293b',
    marginTop: 20,
  },
  emptyTitle: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 6,
  },
  emptyText: {
    color: '#94a3b8',
    fontSize: 13,
    textAlign: 'center',
  },
  errorCard: {
    backgroundColor: 'rgba(248, 113, 113, 0.1)',
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: 'rgba(248, 113, 113, 0.3)',
    marginBottom: 16,
  },
  errorText: {
    color: '#f87171',
    fontSize: 13,
    marginBottom: 10,
  },
  retryButton: {
    backgroundColor: '#0284c7',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 6,
    alignSelf: 'flex-start',
  },
  retryText: {
    color: '#ffffff',
    fontSize: 12,
    fontWeight: '600',
  },
  card: {
    backgroundColor: '#0f172a',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#1e293b',
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  orgName: {
    color: '#818cf8',
    fontSize: 11,
    fontFamily: 'Courier',
  },
  statusBadge: {
    color: '#34d399',
    backgroundColor: 'rgba(52, 211, 153, 0.1)',
    fontSize: 10,
    fontFamily: 'Courier',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    textTransform: 'uppercase',
  },
  cardTitle: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  cardDesc: {
    color: '#94a3b8',
    fontSize: 12,
    marginBottom: 10,
  },
  cardFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderTopWidth: 1,
    borderTopColor: '#1e293b',
    paddingTop: 8,
  },
  cardDate: {
    color: '#64748b',
    fontSize: 10,
    fontFamily: 'Courier',
  },
  cardOpenLink: {
    color: '#38bdf8',
    fontSize: 11,
    fontWeight: '600',
  },
});
