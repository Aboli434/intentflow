import React, { useEffect, useState, useRef } from 'react';
import {
  StyleSheet,
  Text,
  View,
  FlatList,
  TextInput,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
} from 'react-native';
import { Stack, useLocalSearchParams } from 'expo-router';
import {
  mobileGetConversationMessages,
  mobileSendMessage,
  mobileMarkConversationRead,
  connectMobileConversationWebSocket,
  mobileGetMe,
} from '../../../src/api-client';
import { Message, User, RealtimeMessageEvent } from '@intentflow/types';

export default function MobileConversationScreen() {
  const { conversationId, title } = useLocalSearchParams<{ conversationId: string; title?: string }>();
  const [user, setUser] = useState<User | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [body, setBody] = useState('');
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const flatListRef = useRef<FlatList>(null);

  useEffect(() => {
    mobileGetMe().then((res: { user: User }) => setUser(res.user)).catch(() => {});

    if (conversationId) {
      loadMessages();

      const cleanupWs = connectMobileConversationWebSocket(conversationId, (event: RealtimeMessageEvent) => {
        if ('type' in event && event.type === 'conversation.message.created') {
          setMessages((prev) => {
            if (prev.some((m) => m.id === event.message.id)) return prev;
            return [...prev, event.message];
          });
        }
      });

      return () => {
        cleanupWs();
      };
    }
  }, [conversationId]);

  const loadMessages = async () => {
    if (!conversationId) return;
    try {
      const data = await mobileGetConversationMessages(conversationId, 50);
      setMessages(data);
      mobileMarkConversationRead(conversationId).catch(() => {});
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load messages');
    } finally {
      setLoading(false);
    }
  };

  const handleSend = async () => {
    if (!conversationId || !body.trim()) return;
    setSending(true);
    setError(null);
    try {
      const sent = await mobileSendMessage(conversationId, body.trim());
      setMessages((prev) => {
        if (prev.some((m) => m.id === sent.id)) return prev;
        return [...prev, sent];
      });
      setBody('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to send message');
    } finally {
      setSending(false);
    }
  };

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color="#38bdf8" />
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}
    >
      <Stack.Screen options={{ title: title || 'Conversation' }} />

      {error ? (
        <View style={styles.errorContainer}>
          <Text style={styles.errorText}>{error}</Text>
        </View>
      ) : null}

      {/* Client-safe workflow status indicator */}
      <View style={styles.statusBanner}>
        <Text style={styles.statusBannerText}>✨ Your project communication is organized & reviewed by your team</Text>
      </View>

      <FlatList
        ref={flatListRef}
        data={messages}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.messageList}
        onContentSizeChange={() => flatListRef.current?.scrollToEnd({ animated: true })}
        renderItem={({ item }) => {
          const isMine = item.senderId === user?.id;
          return (
            <View style={[styles.msgContainer, isMine ? styles.msgMine : styles.msgOther]}>
              <Text style={styles.senderText}>
                {isMine ? 'You' : item.senderName || 'Member'} •{' '}
                {new Date(item.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
              </Text>
              <View style={[styles.bubble, isMine ? styles.bubbleMine : styles.bubbleOther]}>
                <Text style={styles.msgBody}>{item.body}</Text>
              </View>
            </View>
          );
        }}
      />

      {/* Touch-optimized Composer */}
      <View style={styles.composer}>
        <TextInput
          style={styles.input}
          value={body}
          onChangeText={setBody}
          placeholder="Type a message..."
          placeholderTextColor="#64748b"
          multiline
        />
        <TouchableOpacity
          style={[styles.sendBtn, (!body.trim() || sending) && styles.sendBtnDisabled]}
          onPress={handleSend}
          disabled={!body.trim() || sending}
        >
          <Text style={styles.sendBtnText}>{sending ? '...' : 'Send'}</Text>
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#020617',
  },
  center: {
    flex: 1,
    backgroundColor: '#020617',
    justifyContent: 'center',
    alignItems: 'center',
  },
  errorContainer: {
    backgroundColor: 'rgba(239, 68, 68, 0.1)',
    padding: 8,
    borderBottomWidth: 1,
    borderColor: 'rgba(239, 68, 68, 0.2)',
  },
  errorText: {
    color: '#f87171',
    fontSize: 12,
    textAlign: 'center',
  },
  statusBanner: {
    backgroundColor: 'rgba(56, 189, 248, 0.08)',
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderBottomWidth: 1,
    borderColor: 'rgba(56, 189, 248, 0.15)',
  },
  statusBannerText: {
    color: '#38bdf8',
    fontSize: 11,
    textAlign: 'center',
    fontWeight: '500',
  },
  messageList: {
    padding: 16,
  },
  msgContainer: {
    marginBottom: 12,
    maxWidth: '82%',
  },
  msgMine: {
    alignSelf: 'flex-end',
  },
  msgOther: {
    alignSelf: 'flex-start',
  },
  senderText: {
    color: '#64748b',
    fontSize: 10,
    marginBottom: 4,
    fontFamily: 'Courier',
  },
  bubble: {
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 16,
  },
  bubbleMine: {
    backgroundColor: '#0284c7',
    borderBottomRightRadius: 2,
  },
  bubbleOther: {
    backgroundColor: '#0f172a',
    borderWidth: 1,
    borderColor: '#1e293b',
    borderBottomLeftRadius: 2,
  },
  msgBody: {
    color: '#ffffff',
    fontSize: 14,
    lineHeight: 20,
  },
  composer: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderTopWidth: 1,
    borderColor: '#1e293b',
    backgroundColor: '#0f172a',
  },
  input: {
    flex: 1,
    backgroundColor: '#020617',
    color: '#ffffff',
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 10,
    fontSize: 14,
    maxHeight: 100,
    borderWidth: 1,
    borderColor: '#1e293b',
  },
  sendBtn: {
    backgroundColor: '#0284c7',
    borderRadius: 20,
    paddingHorizontal: 18,
    paddingVertical: 10,
    marginLeft: 8,
  },
  sendBtnDisabled: {
    opacity: 0.5,
  },
  sendBtnText: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: 'bold',
  },
});
