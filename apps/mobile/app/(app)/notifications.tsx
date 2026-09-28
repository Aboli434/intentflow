import React, { useEffect, useState, useCallback } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  RefreshControl,
  StyleSheet,
  ActivityIndicator,
  ScrollView,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Notification } from '@intentflow/types';
import {
  mobileGetNotifications,
  mobileMarkNotificationRead,
  mobileMarkAllNotificationsRead,
} from '../../src/api-client';

type FilterType = 'All' | 'Unread' | 'Projects' | 'Organization';

export default function NotificationsScreen() {
  const router = useRouter();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activeFilter, setActiveFilter] = useState<FilterType>('All');

  const loadNotifications = useCallback(async () => {
    try {
      setError(null);
      const list = await mobileGetNotifications();
      setNotifications(list);
    } catch (err: any) {
      setError(err.message || 'Failed to load notifications');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    loadNotifications();
  }, [loadNotifications]);

  const onRefresh = () => {
    setRefreshing(true);
    loadNotifications();
  };

  const handleMarkRead = async (id: string) => {
    try {
      await mobileMarkNotificationRead(id);
      setNotifications((prev) =>
        prev.map((n) => (n.id === id ? { ...n, readAt: new Date().toISOString() } : n))
      );
    } catch (err) {
      console.error('Failed to mark read', err);
    }
  };

  const handleMarkAllRead = async () => {
    try {
      await mobileMarkAllNotificationsRead();
      setNotifications((prev) =>
        prev.map((n) => ({ ...n, readAt: n.readAt || new Date().toISOString() }))
      );
    } catch (err) {
      console.error('Failed to mark all read', err);
    }
  };

  const handleNotificationPress = async (n: Notification) => {
    if (!n.readAt) {
      handleMarkRead(n.id);
    }
    if (n.projectId) {
      router.push(`/(app)/projects/${n.projectId}` as any);
    }
  };

  const filteredNotifications = notifications.filter((n) => {
    if (activeFilter === 'Unread') return !n.readAt;
    if (activeFilter === 'Projects') return Boolean(n.projectId);
    if (activeFilter === 'Organization') return n.type.startsWith('organization_');
    return true;
  });

  const unreadCount = notifications.filter((n) => !n.readAt).length;

  if (loading && !refreshing) {
    return (
      <View style={styles.centerContainer}>
        <ActivityIndicator size="large" color="#6366f1" />
        <Text style={styles.loadingText}>Loading notifications...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerTitleRow}>
          <Text style={styles.headerTitle}>Notifications</Text>
          {unreadCount > 0 && (
            <View style={styles.badge}>
              <Text style={styles.badgeText}>{unreadCount}</Text>
            </View>
          )}
        </View>

        {unreadCount > 0 && (
          <TouchableOpacity onPress={handleMarkAllRead}>
            <Text style={styles.markAllText}>Mark all read</Text>
          </TouchableOpacity>
        )}
      </View>

      {/* Filter Tabs */}
      <View style={styles.filterContainer}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filterScroll}>
          {(['All', 'Unread', 'Projects', 'Organization'] as FilterType[]).map((tab) => {
            const isActive = activeFilter === tab;
            return (
              <TouchableOpacity
                key={tab}
                onPress={() => setActiveFilter(tab)}
                style={[styles.filterPill, isActive && styles.activeFilterPill]}
              >
                <Text style={[styles.filterText, isActive && styles.activeFilterText]}>
                  {tab}
                </Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      </View>

      {error ? (
        <View style={styles.errorBox}>
          <Text style={styles.errorText}>{error}</Text>
        </View>
      ) : null}

      {/* List */}
      <FlatList
        data={filteredNotifications}
        keyExtractor={(item) => item.id}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#6366f1" />
        }
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyTitle}>
              {activeFilter === 'Unread' ? "You're All Caught Up!" : 'No Notifications'}
            </Text>
            <Text style={styles.emptySubtitle}>
              {activeFilter === 'Unread'
                ? 'No unread notifications to review right now.'
                : "We'll let you know when something needs your attention."}
            </Text>
          </View>
        }
        renderItem={({ item }) => {
          const isUnread = !item.readAt;
          return (
            <TouchableOpacity
              style={[styles.card, isUnread && styles.unreadCard]}
              onPress={() => handleNotificationPress(item)}
              activeOpacity={0.7}
            >
              <View style={styles.cardHeader}>
                {item.projectName ? (
                  <Text style={styles.projectName}>{item.projectName}</Text>
                ) : null}
                <Text style={styles.timeText}>
                  {new Date(item.createdAt).toLocaleTimeString([], {
                    hour: '2-digit',
                    minute: '2-digit',
                  })}
                </Text>
              </View>

              <Text style={styles.titleText}>{item.title}</Text>
              <Text style={styles.bodyText} numberOfLines={2}>
                {item.body}
              </Text>

              {isUnread && (
                <TouchableOpacity
                  style={styles.readDotBtn}
                  onPress={() => handleMarkRead(item.id)}
                >
                  <View style={styles.readDot} />
                </TouchableOpacity>
              )}
            </TouchableOpacity>
          );
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#020617',
    padding: 16,
  },
  centerContainer: {
    flex: 1,
    backgroundColor: '#020617',
    alignItems: 'center',
    justifyContent: 'center',
  },
  loadingText: {
    color: '#94a3b8',
    fontSize: 12,
    marginTop: 8,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
    paddingBottom: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#1e293b',
  },
  headerTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  headerTitle: {
    color: '#f8fafc',
    fontSize: 18,
    fontWeight: '700',
  },
  badge: {
    backgroundColor: '#e11d48',
    borderRadius: 12,
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  badgeText: {
    color: '#ffffff',
    fontSize: 10,
    fontWeight: '700',
  },
  markAllText: {
    color: '#818cf8',
    fontSize: 12,
    fontWeight: '600',
  },
  filterContainer: {
    marginBottom: 14,
  },
  filterScroll: {
    gap: 8,
  },
  filterPill: {
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 20,
    backgroundColor: '#0f172a',
    borderWidth: 1,
    borderColor: '#1e293b',
  },
  activeFilterPill: {
    backgroundColor: '#6366f1',
    borderColor: '#6366f1',
  },
  filterText: {
    color: '#94a3b8',
    fontSize: 12,
    fontWeight: '600',
  },
  activeFilterText: {
    color: '#ffffff',
  },
  errorBox: {
    backgroundColor: 'rgba(244, 63, 94, 0.1)',
    borderColor: 'rgba(244, 63, 94, 0.3)',
    borderWidth: 1,
    padding: 12,
    borderRadius: 8,
    marginBottom: 12,
  },
  errorText: {
    color: '#f43f5e',
    fontSize: 12,
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 48,
  },
  emptyTitle: {
    color: '#f8fafc',
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 4,
  },
  emptySubtitle: {
    color: '#64748b',
    fontSize: 12,
    textAlign: 'center',
  },
  card: {
    backgroundColor: '#0f172a',
    borderColor: '#1e293b',
    borderWidth: 1,
    borderRadius: 12,
    padding: 14,
    marginBottom: 10,
  },
  unreadCard: {
    backgroundColor: 'rgba(99, 102, 241, 0.08)',
    borderColor: '#6366f1',
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  projectName: {
    color: '#94a3b8',
    fontSize: 10,
    fontWeight: '600',
    backgroundColor: '#1e293b',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  timeText: {
    color: '#64748b',
    fontSize: 10,
  },
  titleText: {
    color: '#f8fafc',
    fontSize: 13,
    fontWeight: '700',
    marginBottom: 4,
  },
  bodyText: {
    color: '#cbd5e1',
    fontSize: 12,
    lineHeight: 16,
  },
  readDotBtn: {
    position: 'absolute',
    top: 12,
    right: 12,
  },
  readDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#6366f1',
  },
});
