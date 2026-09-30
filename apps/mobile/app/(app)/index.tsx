import React, { useEffect, useState } from 'react';
import { StyleSheet, Text, View, TouchableOpacity, ScrollView, ActivityIndicator } from 'react-native';
import { Stack, useRouter } from 'expo-router';
import { mobileGetProjects, mobileGetNotifications, mobileGetMe, getMobileDemoRole } from '../../src/api-client';
import { Project, Notification, User } from '@intentflow/types';

export default function MobileProjectsScreen() {
  const router = useRouter();
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [demoRole, setDemoRole] = useState<string | null>(null);
  const [projects, setProjects] = useState<Project[]>([]);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchData = async () => {
    setLoading(true);
    setError(null);
    try {
      setDemoRole(getMobileDemoRole());
      const meRes = await mobileGetMe().catch(() => null);
      if (meRes) setCurrentUser(meRes.user);

      const projData = await mobileGetProjects();
      setProjects(projData);

      const notifData = await mobileGetNotifications();
      setNotifications(notifData);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch dashboard data');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const unreadCount = notifications.filter((n) => !n.readAt).length;
  const actionRequiredCount = notifications.filter((n) => !n.readAt && (n.type.includes('deliverable') || n.type.includes('closure') || n.type.includes('work'))).length;

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Stack.Screen
        options={{
          title: 'IntentFlow Workspace',
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
        <View style={styles.demoBadgeRow}>
          <View style={styles.demoPill}>
            <View style={styles.demoGreenDot} />
            <Text style={styles.demoPillText}>
              {demoRole ? `Demo Mode · ${demoRole.toUpperCase()}` : 'Live Workspace'}
            </Text>
          </View>
          {currentUser && (
            <Text style={styles.userNameText}>{currentUser.name}</Text>
          )}
        </View>
        <Text style={styles.title}>Projects & Workspace</Text>
        <Text style={styles.subtitle}>
          {demoRole === 'client' && 'Review deliverables, request revisions, and track progress.'}
          {demoRole === 'developer' && 'Review AI intents, confirm scope, and deliver tasks.'}
          {demoRole === 'admin' && 'Agency oversight, team management, and project tracking.'}
          {!demoRole && 'Real-time client collaboration & structured delivery.'}
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
            You have items requiring immediate review or action in your projects.
          </Text>
          <Text style={styles.actionCardLink}>Review Pending Actions →</Text>
        </TouchableOpacity>
      )}

      {loading && (
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
          <Text style={styles.emptyText}>No active projects found.</Text>
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
              <Text style={styles.orgName}>{item.organizationName}</Text>
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
  demoBadgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 8,
  },
  demoPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#1E293B',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  demoGreenDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#10B981',
  },
  demoPillText: {
    color: '#818CF8',
    fontSize: 11,
    fontWeight: '800',
  },
  userNameText: {
    color: '#94A3B8',
    fontSize: 12,
    fontWeight: '600',
  },
  phaseBadge: {
    color: '#818cf8',
    backgroundColor: 'rgba(99, 102, 241, 0.1)',
    fontSize: 11,
    fontFamily: 'Courier',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 4,
    alignSelf: 'flex-start',
    marginBottom: 6,
  },
  title: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#ffffff',
  },
  subtitle: {
    fontSize: 12,
    color: '#94a3b8',
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
  },
  emptyText: {
    color: '#94a3b8',
    fontSize: 14,
  },
  errorCard: {
    backgroundColor: 'rgba(248, 113, 113, 0.1)',
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: 'rgba(248, 113, 113, 0.3)',
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
