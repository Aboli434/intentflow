import React, { useEffect, useState } from 'react';
import {
  StyleSheet,
  Text,
  View,
  ScrollView,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
} from 'react-native';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import {
  mobileGetProjectDetail,
  mobileGetProjectConversations,
  mobileCreateConversation,
} from '../../../src/api-client';
import { Project, Conversation } from '@intentflow/types';

export default function MobileProjectDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const [project, setProject] = useState<Project | null>(null);
  const [conversations, setConversations] = useState<(Conversation & { unread?: boolean })[]>([]);
  const [newTitle, setNewTitle] = useState('');
  const [showNewModal, setShowNewModal] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (id) {
      loadData();
    }
  }, [id]);

  const loadData = async () => {
    if (!id) return;
    try {
      const [p, convs] = await Promise.all([
        mobileGetProjectDetail(id),
        mobileGetProjectConversations(id),
      ]);
      setProject(p);
      setConversations(convs);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load project details');
    } finally {
      setLoading(false);
    }
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
      </View>

      {/* Conversations Section */}
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
              placeholder="Conversation title (e.g. Homepage Changes)"
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
    padding: 16,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: '#1e293b',
  },
  orgTag: {
    color: '#38bdf8',
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
  },
  metaLabel: {
    color: '#64748b',
    fontSize: 12,
    width: 60,
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
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  sectionTitle: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  newBtn: {
    backgroundColor: '#0284c7',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
  },
  newBtnText: {
    color: '#ffffff',
    fontSize: 12,
    fontWeight: 'bold',
  },
  newModal: {
    backgroundColor: '#0f172a',
    padding: 12,
    borderRadius: 10,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#1e293b',
  },
  input: {
    backgroundColor: '#020617',
    color: '#ffffff',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    fontSize: 13,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: '#1e293b',
  },
  createBtn: {
    backgroundColor: '#0284c7',
    paddingVertical: 8,
    borderRadius: 8,
    alignItems: 'center',
  },
  btnDisabled: {
    opacity: 0.5,
  },
  createBtnText: {
    color: '#ffffff',
    fontSize: 12,
    fontWeight: 'bold',
  },
  convCard: {
    backgroundColor: '#0f172a',
    borderRadius: 10,
    padding: 14,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: '#1e293b',
  },
  convRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  convTitle: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '600',
  },
  unreadDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#38bdf8',
  },
  convPreview: {
    color: '#94a3b8',
    fontSize: 12,
    marginBottom: 6,
  },
  convMeta: {
    color: '#64748b',
    fontSize: 10,
    fontFamily: 'Courier',
  },
  emptyText: {
    color: '#64748b',
    fontSize: 12,
  },
});
