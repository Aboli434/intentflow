import React, { useEffect, useState } from 'react';
import { StyleSheet, Text, View, ScrollView, ActivityIndicator } from 'react-native';
import { Stack, useLocalSearchParams } from 'expo-router';
import { mobileGetProjectDetail } from '../../../src/api-client';
import { Project } from '@intentflow/types';

export default function MobileProjectDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const [project, setProject] = useState<Project | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (id) {
      mobileGetProjectDetail(id)
        .then(setProject)
        .catch((err) => setError(err instanceof Error ? err.message : 'Failed to load project details'))
        .finally(() => setLoading(false));
    }
  }, [id]);

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color="#38bdf8" />
      </View>
    );
  }

  if (error || !project) {
    return (
      <View style={styles.center}>
        <Text style={styles.errorText}>{error || 'Project not found'}</Text>
      </View>
    );
  }

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Stack.Screen options={{ title: project.name }} />

      <View style={styles.card}>
        <Text style={styles.orgTag}>{project.organizationName}</Text>
        <Text style={styles.title}>{project.name}</Text>
        <Text style={styles.desc}>{project.description || 'No description provided'}</Text>

        <View style={styles.metaRow}>
          <Text style={styles.metaLabel}>Status:</Text>
          <Text style={styles.statusBadge}>{project.status}</Text>
        </View>

        <View style={styles.metaRow}>
          <Text style={styles.metaLabel}>Created:</Text>
          <Text style={styles.metaVal}>{new Date(project.createdAt).toLocaleDateString()}</Text>
        </View>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Project Members</Text>

        {project.members && project.members.length > 0 ? (
          project.members.map((pm) => (
            <View key={pm.id} style={styles.memberCard}>
              <View>
                <Text style={styles.memberName}>{pm.user?.name}</Text>
                <Text style={styles.memberEmail}>{pm.user?.email}</Text>
              </View>
              <Text style={styles.roleTag}>{pm.role}</Text>
            </View>
          ))
        ) : (
          <Text style={styles.emptyMembers}>No members assigned to this project yet.</Text>
        )}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: 16,
    backgroundColor: '#020617',
    flexGrow: 1,
  },
  center: {
    flex: 1,
    backgroundColor: '#020617',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  errorText: {
    color: '#f87171',
    fontSize: 14,
  },
  card: {
    backgroundColor: '#0f172a',
    borderRadius: 12,
    padding: 20,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: '#1e293b',
  },
  orgTag: {
    color: '#38bdf8',
    fontSize: 12,
    fontFamily: 'Courier',
    marginBottom: 6,
  },
  title: {
    color: '#ffffff',
    fontSize: 22,
    fontWeight: 'bold',
    marginBottom: 8,
  },
  desc: {
    color: '#cbd5e1',
    fontSize: 14,
    marginBottom: 16,
    lineHeight: 20,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  metaLabel: {
    color: '#64748b',
    fontSize: 12,
    width: 70,
  },
  metaVal: {
    color: '#94a3b8',
    fontSize: 12,
    fontFamily: 'Courier',
  },
  statusBadge: {
    color: '#34d399',
    backgroundColor: 'rgba(52, 211, 153, 0.1)',
    fontSize: 11,
    fontFamily: 'Courier',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 4,
    textTransform: 'uppercase',
  },
  section: {
    marginTop: 4,
  },
  sectionTitle: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 12,
  },
  memberCard: {
    backgroundColor: '#0f172a',
    borderRadius: 10,
    padding: 14,
    marginBottom: 8,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#1e293b',
  },
  memberName: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '600',
  },
  memberEmail: {
    color: '#64748b',
    fontSize: 11,
    fontFamily: 'Courier',
  },
  roleTag: {
    color: '#38bdf8',
    backgroundColor: 'rgba(56, 189, 248, 0.1)',
    fontSize: 11,
    fontFamily: 'Courier',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 4,
    textTransform: 'uppercase',
  },
  emptyMembers: {
    color: '#64748b',
    fontSize: 12,
  },
});
