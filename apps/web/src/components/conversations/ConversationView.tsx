'use client';

import { useEffect, useState, useRef } from 'react';
import {
  apiGetProjectConversations,
  apiCreateConversation,
  apiGetConversationMessages,
  apiSendMessage,
  apiMarkConversationRead,
  apiUploadAttachment,
  apiGetConversationIntents,
  apiAnalyzeIntent,
  getAttachmentDownloadUrl,
  connectConversationWebSocket,
  apiGetMe,
} from '@/lib/api-client';
import { Conversation, Message, MessageAttachment, User, Intent } from '@intentflow/types';
import { IntentPanel } from '../intents/IntentPanel';

interface ConversationViewProps {
  projectId: string;
  onNavigateToWorkTab?: () => void;
}

export function ConversationView({ projectId, onNavigateToWorkTab }: ConversationViewProps) {
  const [user, setUser] = useState<User | null>(null);
  const [conversations, setConversations] = useState<(Conversation & { unread?: boolean })[]>([]);
  const [activeConvId, setActiveConvId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [loadingConvs, setLoadingConvs] = useState(true);
  const [loadingMsgs, setLoadingMsgs] = useState(false);
  const [isWsConnected, setIsWsConnected] = useState(false);

  // Form states
  const [newTitle, setNewTitle] = useState('');
  const [showNewModal, setShowNewModal] = useState(false);
  const [messageBody, setMessageBody] = useState('');
  const [sending, setSending] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [pendingAttachments, setPendingAttachments] = useState<MessageAttachment[]>([]);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Load User & Conversations
  useEffect(() => {
    apiGetMe().then((res) => setUser(res.user)).catch(() => {});
    loadConversations();
  }, [projectId]);

  const loadConversations = async () => {
    setLoadingConvs(true);
    try {
      const convs = await apiGetProjectConversations(projectId);
      setConversations(convs);
      if (convs.length > 0 && !activeConvId) {
        setActiveConvId(convs[0].id);
      }
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Failed to load conversations');
    } finally {
      setLoadingConvs(false);
    }
  };

  // Load Messages & Setup WebSocket when Active Conversation changes
  useEffect(() => {
    if (!activeConvId) return;

    setLoadingMsgs(true);
    apiGetConversationMessages(activeConvId, 50)
      .then((res) => {
        setMessages(res.data);
        apiMarkConversationRead(activeConvId).catch(() => {});
      })
      .catch((err) => setErrorMsg(err instanceof Error ? err.message : 'Failed to load messages'))
      .finally(() => setLoadingMsgs(false));

    // Fetch active intent for conversation
    apiGetConversationIntents(activeConvId)
      .then((intentsList) => {
        if (intentsList.length > 0) {
          setCurrentIntent(intentsList[0]);
        } else {
          setCurrentIntent(null);
        }
      })
      .catch(() => setCurrentIntent(null));

    // Connect WebSocket
    const cleanupWs = connectConversationWebSocket(
      activeConvId,
      (event) => {
        if ('type' in event) {
          if (event.type === 'conversation.message.created') {
            setMessages((prev) => {
              if (prev.some((m) => m.id === event.message.id)) return prev;
              return [...prev, event.message];
            });
            loadConversations();
          } else if (event.type === 'intent.processing') {
            setIsAnalyzing(true);
          } else if (event.type === 'intent.ready' || event.type === 'intent.updated' || event.type === 'intent.confirmed') {
            setIsAnalyzing(false);
            setCurrentIntent(event.intent);
          } else if (event.type === 'intent.rejected') {
            setIsAnalyzing(false);
            setCurrentIntent((prev) => (prev ? { ...prev, status: 'rejected' } : null));
          }
        }
      },
      (connected) => setIsWsConnected(connected)
    );

    return () => {
      cleanupWs();
    };
  }, [activeConvId]);

  const [currentIntent, setCurrentIntent] = useState<Intent | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);

  const handleAnalyzeIntent = async () => {
    if (!activeConvId) return;
    setIsAnalyzing(true);
    setErrorMsg(null);
    try {
      const intentResult = await apiAnalyzeIntent(activeConvId);
      setCurrentIntent(intentResult);
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to analyze conversation intent');
    } finally {
      setIsAnalyzing(false);
    }
  };

  // Scroll to bottom when messages update
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleCreateConversation = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTitle.trim()) return;

    try {
      const created = await apiCreateConversation(projectId, { title: newTitle.trim() });
      setNewTitle('');
      setShowNewModal(false);
      await loadConversations();
      setActiveConvId(created.id);
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Failed to create conversation');
    }
  };

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeConvId) return;
    if (!messageBody.trim() && pendingAttachments.length === 0) return;

    setSending(true);
    setErrorMsg(null);
    try {
      const attachmentIds = pendingAttachments.map((a) => a.id);
      const sent = await apiSendMessage(activeConvId, {
        body: messageBody.trim(),
        attachmentIds,
      });

      setMessages((prev) => {
        if (prev.some((m) => m.id === sent.id)) return prev;
        return [...prev, sent];
      });

      setMessageBody('');
      setPendingAttachments([]);
      loadConversations();
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Failed to send message');
    } finally {
      setSending(false);
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploading(true);
    setErrorMsg(null);
    try {
      const att = await apiUploadAttachment(projectId, file);
      setPendingAttachments((prev) => [...prev, att]);
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Failed to upload attachment');
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const activeConv = conversations.find((c) => c.id === activeConvId);

  return (
    <div className="flex h-[calc(100vh-180px)] min-h-[500px] w-full overflow-hidden rounded-xl border border-slate-800 bg-slate-900/80 shadow-2xl">
      {/* Left Sidebar — Conversations List */}
      <div className="flex w-72 flex-col border-r border-slate-800 bg-slate-950/60">
        <div className="flex items-center justify-between border-b border-slate-800 p-4">
          <h2 className="text-sm font-semibold text-slate-100">Conversations</h2>
          <button
            onClick={() => setShowNewModal(true)}
            className="rounded-lg bg-sky-600 px-2.5 py-1 text-xs font-semibold text-white transition hover:bg-sky-500"
          >
            + New
          </button>
        </div>

        {loadingConvs ? (
          <div className="p-4 text-xs text-slate-500 animate-pulse">Loading threads...</div>
        ) : conversations.length === 0 ? (
          <div className="p-6 text-center text-xs text-slate-400">
            No conversations yet.<br />Start a discussion for this project.
          </div>
        ) : (
          <div className="flex-1 overflow-y-auto divide-y divide-slate-800/40">
            {conversations.map((c) => {
              const isActive = c.id === activeConvId;
              return (
                <button
                  key={c.id}
                  onClick={() => setActiveConvId(c.id)}
                  className={`w-full p-3.5 text-left transition ${
                    isActive ? 'bg-sky-500/10 border-l-2 border-sky-400' : 'hover:bg-slate-800/50'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold text-slate-200 truncate">{c.title}</span>
                    {c.unread && (
                      <span className="h-2 w-2 rounded-full bg-sky-400 animate-pulse" />
                    )}
                  </div>
                  {c.lastMessage && (
                    <p className="mt-1 line-clamp-1 text-[11px] text-slate-400">
                      {c.lastMessage.senderName}: {c.lastMessage.body}
                    </p>
                  )}
                  <div className="mt-2 flex items-center justify-between text-[10px] text-slate-500">
                    <span>{c.participantCount || 1} participant(s)</span>
                    <span>
                      {c.updatedAt ? new Date(c.updatedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : ''}
                    </span>
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* Main Conversation Pane */}
      {activeConv ? (
        <div className="flex flex-1 flex-col bg-slate-900/40">
          {/* Conversation Header */}
          <div className="flex items-center justify-between border-b border-slate-800 px-6 py-3.5 bg-slate-900/80">
            <div>
              <h3 className="text-sm font-semibold text-white">{activeConv.title}</h3>
              <p className="text-[11px] text-slate-400">Project Discussion Thread</p>
            </div>
            <div className="flex items-center gap-3 text-xs">
              <button
                type="button"
                onClick={handleAnalyzeIntent}
                disabled={isAnalyzing}
                className="bg-indigo-600 hover:bg-indigo-500 text-white font-semibold px-3 py-1.5 rounded-lg border border-indigo-500/30 text-xs shadow transition flex items-center gap-1.5 disabled:opacity-50"
              >
                {isAnalyzing ? (
                  <>
                    <span className="w-2 h-2 rounded-full bg-white animate-ping"></span>
                    Analyzing...
                  </>
                ) : (
                  <>
                    <span>⚡</span>
                    Analyze Intent
                  </>
                )}
              </button>
              <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 font-mono text-[10px] ${
                isWsConnected ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' : 'bg-amber-500/10 text-amber-400 border border-amber-500/20'
              }`}>
                <span className={`h-1.5 w-1.5 rounded-full ${isWsConnected ? 'bg-emerald-400' : 'bg-amber-400'}`} />
                {isWsConnected ? 'Live Connection' : 'Connecting...'}
              </span>
            </div>
          </div>

          {/* Messages Feed */}
          <div className="flex-1 overflow-y-auto p-6 space-y-4">
            {loadingMsgs ? (
              <div className="text-center text-xs text-slate-500 animate-pulse">Loading message history...</div>
            ) : messages.length === 0 ? (
              <div className="py-12 text-center text-xs text-slate-400">
                No messages yet. Start the conversation below.
              </div>
            ) : (
              messages.map((m) => {
                const isMine = m.senderId === user?.id;
                return (
                  <div
                    key={m.id}
                    className={`flex flex-col ${isMine ? 'items-end' : 'items-start'}`}
                  >
                    <div className="flex items-center gap-2 mb-1 text-[11px]">
                      <span className="font-semibold text-slate-300">{isMine ? 'You' : m.sender?.name || (m as any).senderName || 'Member'}</span>
                      <span className="text-slate-500">{new Date(m.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                    </div>

                    <div
                      className={`max-w-xl rounded-xl px-4 py-2.5 text-xs shadow-md ${
                        isMine
                          ? 'bg-sky-600 text-white rounded-tr-none'
                          : 'bg-slate-800 text-slate-100 border border-slate-700/50 rounded-tl-none'
                      }`}
                    >
                      <p className="whitespace-pre-wrap leading-relaxed">{m.body}</p>

                      {/* Attachments */}
                      {m.attachments && m.attachments.length > 0 && (
                        <div className="mt-2.5 space-y-1.5 border-t border-white/10 pt-2">
                          {m.attachments.map((att) => (
                            <a
                              key={att.id}
                              href={getAttachmentDownloadUrl(att.id)}
                              target="_blank"
                              rel="noreferrer"
                              className="flex items-center gap-2 rounded bg-black/20 px-2.5 py-1 text-[11px] font-mono hover:bg-black/30 transition text-sky-200"
                            >
                              <span>📎</span>
                              <span className="truncate">{att.fileName}</span>
                              <span className="opacity-60">({Math.round(att.size / 1024)}KB)</span>
                            </a>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                );
              })
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Pending attachments preview */}
          {pendingAttachments.length > 0 && (
            <div className="flex gap-2 px-6 py-2 border-t border-slate-800/60 bg-slate-950/40">
              {pendingAttachments.map((att) => (
                <span key={att.id} className="inline-flex items-center gap-1 rounded bg-slate-800 px-2 py-1 text-[10px] text-sky-300 border border-slate-700">
                  📎 {att.fileName}
                </span>
              ))}
            </div>
          )}

          {/* Error Banner */}
          {errorMsg && (
            <div className="bg-rose-500/10 px-6 py-2 text-xs text-rose-400 border-t border-rose-500/20">
              {errorMsg}
            </div>
          )}

          {/* Message Composer */}
          <form onSubmit={handleSendMessage} className="border-t border-slate-800 p-4 bg-slate-900/80">
            <div className="flex items-center gap-3">
              <input
                type="file"
                ref={fileInputRef}
                onChange={handleFileUpload}
                className="hidden"
              />
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                disabled={uploading}
                className="rounded-lg border border-slate-700 bg-slate-800 p-2.5 text-xs font-semibold text-slate-300 hover:bg-slate-700 transition"
                title="Attach file"
              >
                {uploading ? '⏳' : '📎'}
              </button>

              <input
                type="text"
                value={messageBody}
                onChange={(e) => setMessageBody(e.target.value)}
                placeholder="Type a message..."
                className="flex-1 rounded-lg border border-slate-800 bg-slate-950 px-4 py-2.5 text-xs text-white placeholder-slate-500 focus:border-sky-500 focus:outline-none"
              />

              <button
                type="submit"
                disabled={sending || (!messageBody.trim() && pendingAttachments.length === 0)}
                className="rounded-lg bg-sky-600 px-4 py-2.5 text-xs font-semibold text-white transition hover:bg-sky-500 disabled:opacity-50"
              >
                {sending ? 'Sending...' : 'Send'}
              </button>
            </div>
          </form>
        </div>
      ) : (
        <div className="flex flex-1 items-center justify-center text-xs text-slate-500">
          Select or create a conversation thread to view messages.
        </div>
      )}

      {/* Right Sidebar — Intent Intelligence & Human Review Panel */}
      {activeConv && (
        <div className="w-96 border-l border-slate-800 bg-slate-950/80 p-4 overflow-y-auto">
          <IntentPanel
            intent={currentIntent}
            projectId={projectId}
            isProcessing={isAnalyzing}
            onIntentUpdated={(updated) => setCurrentIntent(updated)}
            onDraftClarification={(draftMessage) => setMessageBody(draftMessage)}
            onNavigateToWorkTab={onNavigateToWorkTab}
          />
        </div>
      )}

      {/* New Conversation Modal */}
      {showNewModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
          <div className="w-full max-w-sm rounded-xl border border-slate-800 bg-slate-900 p-6 shadow-2xl space-y-4">
            <h3 className="text-sm font-bold text-white">Create Conversation Thread</h3>
            <form onSubmit={handleCreateConversation} className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">Title</label>
                <input
                  type="text"
                  value={newTitle}
                  onChange={(e) => setNewTitle(e.target.value)}
                  placeholder="e.g. Homepage Redesign"
                  className="w-full rounded-lg border border-slate-800 bg-slate-950 px-3 py-2 text-xs text-white placeholder-slate-500 focus:border-sky-500 focus:outline-none"
                  autoFocus
                />
              </div>

              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowNewModal(false)}
                  className="rounded-lg px-3 py-1.5 text-xs font-semibold text-slate-400 hover:text-white"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={!newTitle.trim()}
                  className="rounded-lg bg-sky-600 px-4 py-1.5 text-xs font-semibold text-white hover:bg-sky-500 disabled:opacity-50"
                >
                  Create
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
