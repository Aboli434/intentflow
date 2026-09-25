import React, { useEffect, useState } from 'react';
import { StyleSheet, Text, View, TouchableOpacity, ScrollView, ActivityIndicator } from 'react-native';
import { Stack, useRouter } from 'expo-router';
import { mobileGetProjects } from '../../src/api-client';
import { Project } from '@intentflow/types';

export default function MobileProjectsScreen() {
  const router = useRouter();
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchProjects = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await mobileGetProjects();
      setProjects(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch projects');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchProjects();
  }, []);

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Stack.Screen
        options={{
          title: 'IntentFlow Projects',
          headerRight: () => (
            <TouchableOpacity onPress={() => router.push('/(app)/profile')}>
              <Text style={styles.headerLink}>Profile</Text>
            </TouchableOpacity>
          ),
        }}
      />

      <View style={styles.headerBox}>
        <Text style={styles.phaseBadge}>Phase 2 Mobile</Text>
        <Text style={styles.title}>Your Projects</Text>
        <Text style={styles.subtitle}>Real projects retrieved from PostgreSQL API</Text>
      </View>

      {loading && (
        <View style={styles.center}>
          <ActivityIndicator size="large" color="#38bdf8" />
        </View>
      )}

      {error && (
        <View style={styles.errorCard}>
          <Text style={styles.errorText}>{error}</Text>
          <TouchableOpacity style={styles.retryButton} onPress={fetchProjects}>
            <Text style={styles.retryText}>Retry</Text>
          </TouchableOpacity>
        </View>
      )}

      {!loading && !error && projects.length === 0 && (
        <View style={styles.emptyCard}>
          <Text style={styles.emptyText}>No projects yet.</Text>
        </View>
      )}

      {!loading &&
        projects.map((item) => (
          <TouchableOpacity
            key={item.id}
            style={styles.card}
            onPress={() => router.push(`/(app)/projects/${item.id}` as any)}
          >
            <View style={styles.cardHeader}>
              <Text style={styles.orgName}>{item.organizationName}</Text>
              <Text style={styles.statusBadge}>{item.status}</Text>
            </View>
            <Text style={styles.cardTitle}>{item.name}</Text>
            <Text style={styles.cardDesc} numberOfLines={2}>
              {item.description || 'No description provided'}
            </Text>
            <Text style={styles.cardDate}>
              Updated: {new Date(item.updatedAt).toLocaleDateString()}
            </Text>
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
  headerLink: {
    color: '#38bdf8',
    fontSize: 14,
    fontWeight: '600',
  },
  headerBox: {
    marginBottom: 16,
  },
  phaseBadge: {
    color: '#38bdf8',
    backgroundColor: 'rgba(56, 189, 248, 0.1)',
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
    color: '#38bdf8',
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
  cardDate: {
    color: '#64748b',
    fontSize: 10,
    fontFamily: 'Courier',
  },
});
