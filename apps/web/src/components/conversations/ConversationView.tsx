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
  WsConnectionState,
  apiGetMe,
} from '@/lib/api-client';
import { Conversation, Message, MessageAttachment, User, Intent } from '@intentflow/types';
import { IntentPanel } from '../intents/IntentPanel';
import { EmptyState } from '../common/EmptyState';
import { formatRelativeTime } from '@/lib/notification-utils';

interface ConversationViewProps {
  projectId: string;
  onNavigateToWorkTab?: () => void;
}

export function ConversationView({ projectId, onNavigateToWorkTab }: ConversationViewProps) {
  const [user, setUser] = useState<User | null>(null);
  const [conversations, setConversations] = useState<(Conversation & { unread?: boolean })[]>([]);
  const [activeConvId, setActiveConvId] = useState<string | null>(null);
  const [messages, setMessages] = useState<(Message & { sendStatus?: 'sending' | 'failed' | 'sent' })[]>([]);
  const [loadingConvs, setLoadingConvs] = useState(true);
  const [loadingMsgs, setLoadingMsgs] = useState(false);
  const [wsState, setWsState] = useState<WsConnectionState>('connecting');
  const [showMobileChat, setShowMobileChat] = useState(false);
  const [threadSearch, setThreadSearch] = useState('');
  const [hasUnreadBelow, setHasUnreadBelow] = useState(false);

  // Form states
  const [newTitle, setNewTitle] = useState('');
  const [showNewModal, setShowNewModal] = useState(false);
  const [messageBody, setMessageBody] = useState('');
  const [sending, setSending] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [pendingAttachments, setPendingAttachments] = useState<MessageAttachment[]>([]);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const messagesContainerRef = useRef<HTMLDivElement>(null);
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

  // Scroll tracking to show floating 'new messages' pill
  const handleScroll = () => {
    const container = messagesContainerRef.current;
    if (!container) return;
    const isNearBottom = container.scrollHeight - container.scrollTop - container.clientHeight < 120;
    if (isNearBottom) {
      setHasUnreadBelow(false);
    }
  };

  const scrollToBottom = (smooth = true) => {
    messagesEndRef.current?.scrollIntoView({ behavior: smooth ? 'smooth' : 'auto' });
    setHasUnreadBelow(false);
  };

  // Load Messages & Setup WebSocket when Active Conversation changes
  useEffect(() => {
    if (!activeConvId) return;

    setLoadingMsgs(true);
    apiGetConversationMessages(activeConvId, 50)
      .then((res) => {
        setMessages(res.data.map((m) => ({ ...m, sendStatus: 'sent' })));
        apiMarkConversationRead(activeConvId).catch(() => {});
        setTimeout(() => scrollToBottom(false), 50);
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

    // Connect WebSocket with robust auto-reconnect backoff
    const cleanupWs = connectConversationWebSocket(
      activeConvId,
      (event) => {
        if ('type' in event) {
          if (event.type === 'conversation.message.created') {
            setMessages((prev) => {
              if (prev.some((m) => m.id === event.message.id)) return prev;
              return [...prev, { ...event.message, sendStatus: 'sent' }];
            });
            loadConversations();

            const container = messagesContainerRef.current;
            if (container) {
              const isNearBottom = container.scrollHeight - container.scrollTop - container.clientHeight < 150;
              if (isNearBottom) {
                setTimeout(() => scrollToBottom(true), 50);
              } else {
                setHasUnreadBelow(true);
              }
            }
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
      (connected) => {
        setWsState(connected ? 'connected' : 'offline');
      },
      (state) => {
        setWsState(state);
      }
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

  const handleCreateConversation = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTitle.trim()) return;

    try {
      const created = await apiCreateConversation(projectId, { title: newTitle.trim() });
      setNewTitle('');
      setShowNewModal(false);
      await loadConversations();
      setActiveConvId(created.id);
      setShowMobileChat(true);
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Failed to create conversation');
    }
  };

  const executeSendMessage = async (bodyText: string, attachmentsList: MessageAttachment[], tempMsgId?: string) => {
    if (!activeConvId) return;

    const optId = tempMsgId || `opt_${Date.now()}`;
    const draftMsg: Message & { sendStatus?: 'sending' | 'failed' | 'sent' } = {
      id: optId,
      conversationId: activeConvId,
      senderId: user?.id || 'temp',
      sender: user || undefined,
      body: bodyText,
      attachments: attachmentsList,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      type: 'text',
      sendStatus: 'sending',
    };

    if (!tempMsgId) {
      setMessages((prev) => [...prev, draftMsg]);
      setMessageBody('');
      setPendingAttachments([]);
      setTimeout(() => scrollToBottom(true), 50);
    } else {
      setMessages((prev) =>
        prev.map((m) => (m.id === tempMsgId ? { ...m, sendStatus: 'sending' } : m))
      );
    }

    setSending(true);
    setErrorMsg(null);

    try {
      const attachmentIds = attachmentsList.map((a) => a.id);
      const sent = await apiSendMessage(activeConvId, {
        body: bodyText,
        attachmentIds,
      });

      setMessages((prev) =>
        prev.map((m) => (m.id === optId ? { ...sent, sendStatus: 'sent' } : m))
      );
      loadConversations();
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to send message. Click retry.');
      setMessages((prev) =>
        prev.map((m) => (m.id === optId ? { ...m, sendStatus: 'failed' } : m))
      );
    } finally {
      setSending(false);
    }
  };

  const handleSendMessage = (e: React.FormEvent) => {
    e.preventDefault();
    if (!messageBody.trim() && pendingAttachments.length === 0) return;
    executeSendMessage(messageBody.trim(), pendingAttachments);
  };

  const handleRetryMessage = (msg: Message & { sendStatus?: 'sending' | 'failed' | 'sent' }) => {
    executeSendMessage(msg.body, msg.attachments || [], msg.id);
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploading(true);
    setErrorMsg(null);
    try {
      const att = await apiUploadAttachment(file, projectId);
      setPendingAttachments((prev) => [...prev, att]);
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Failed to upload attachment');
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleSelectConv = (id: string) => {
    setActiveConvId(id);
    setShowMobileChat(true);
  };

  const filteredConvs = conversations.filter((c) => {
    if (!threadSearch.trim()) return true;
    return c.title.toLowerCase().includes(threadSearch.toLowerCase().trim());
  });

  const activeConv = conversations.find((c) => c.id === activeConvId);

  const getWsBadge = () => {
    switch (wsState) {
      case 'connected':
        return (
          <span className="hidden sm:inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 font-mono text-[10px] font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/30">
            ● Live
          </span>
        );
      case 'reconnecting':
        return (
          <span className="hidden sm:inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 font-mono text-[10px] font-bold bg-amber-500/10 text-amber-400 border border-amber-500/30 animate-pulse">
            ● Reconnecting...
          </span>
        );
      case 'connecting':
        return (
          <span className="hidden sm:inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 font-mono text-[10px] font-bold bg-amber-500/10 text-amber-400 border border-amber-500/30">
            ● Connecting...
          </span>
        );
      default:
        return (
          <span className="hidden sm:inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 font-mono text-[10px] font-bold bg-slate-800 text-slate-400 border border-slate-700">
            ● Offline
          </span>
        );
    }
  };

  if (!loadingConvs && conversations.length === 0) {
    return (
      <div className="space-y-4">
        <EmptyState
          icon="💬"
          title="No conversations yet"
          description="Start a project discussion thread with your team and clients."
          actionLabel="+ New Conversation"
          onAction={() => setShowNewModal(true)}
        />

        {showNewModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm">
            <div className="w-full max-w-sm rounded-2xl border border-[#1F2937] bg-[#111827] p-6 shadow-2xl space-y-4 text-[#F8FAFC]">
              <h3 className="text-sm font-extrabold text-[#F8FAFC]">Create Conversation Thread</h3>
              <form onSubmit={handleCreateConversation} className="space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-[#94A3B8] mb-1">Title</label>
                  <input
                    type="text"
                    value={newTitle}
                    onChange={(e) => setNewTitle(e.target.value)}
                    placeholder="e.g. Website Feedback"
                    className="w-full rounded-xl border border-[#1F2937] bg-[#0B0F19] px-3.5 py-2 text-xs text-[#F8FAFC] placeholder:text-[#64748B] focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 focus:outline-none"
                    autoFocus
                  />
                </div>

                <div className="flex justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => setShowNewModal(false)}
                    className="rounded-xl px-3.5 py-1.5 text-xs font-semibold text-[#94A3B8] hover:bg-[#151D2E] hover:text-[#F8FAFC]"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={!newTitle.trim()}
                    className="rounded-xl bg-indigo-600 px-4 py-1.5 text-xs font-bold text-white hover:bg-indigo-500 disabled:opacity-50 shadow-sm"
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

  return (
    <div className="flex flex-col lg:flex-row h-[calc(100vh-190px)] min-h-[500px] w-full overflow-hidden rounded-2xl border border-[#1F2937] bg-[#111827] shadow-lg">
      {/* Left Sidebar — Conversation List (Hidden on mobile if chat view open) */}
      <div
        className={`flex w-full lg:w-80 flex-col border-r border-[#1F2937] bg-[#0B0F19]/50 ${
          showMobileChat ? 'hidden lg:flex' : 'flex'
        }`}
      >
        <div className="flex flex-col border-b border-[#1F2937] p-3.5 bg-[#111827] gap-2.5">
          <div className="flex items-center justify-between">
            <h2 className="text-xs font-extrabold text-[#F8FAFC] uppercase tracking-wider">Conversations</h2>
            <button
              onClick={() => setShowNewModal(true)}
              className="rounded-xl bg-indigo-600 px-3 py-1.5 text-xs font-bold text-white shadow-sm hover:bg-indigo-500 transition min-h-[34px] cursor-pointer"
            >
              + New Thread
            </button>
          </div>

          <div className="relative">
            <input
              type="text"
              value={threadSearch}
              onChange={(e) => setThreadSearch(e.target.value)}
              placeholder="Search threads..."
              className="w-full rounded-xl border border-[#1F2937] bg-[#0B0F19] pl-3 pr-7 py-1.5 text-xs text-[#F8FAFC] placeholder:text-[#64748B] focus:border-indigo-500 focus:outline-none"
            />
            {threadSearch && (
              <button
                onClick={() => setThreadSearch('')}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-xs text-[#94A3B8] hover:text-[#F8FAFC]"
              >
                ✕
              </button>
            )}
          </div>
        </div>

        {loadingConvs ? (
          <div className="p-4 text-xs text-[#94A3B8] font-medium animate-pulse">Loading threads...</div>
        ) : filteredConvs.length === 0 ? (
          <div className="p-4 text-xs text-[#94A3B8] text-center">
            {threadSearch ? 'No threads match your search.' : 'No threads yet.'}
          </div>
        ) : (
          <div className="flex-1 overflow-y-auto divide-y divide-[#1F2937]/50">
            {filteredConvs.map((c) => {
              const isActive = c.id === activeConvId;
              const lastMsgText = c.lastMessage
                ? `${c.lastMessage.senderName}: ${c.lastMessage.body}`
                : 'No messages yet';
              const relTime = c.updatedAt ? formatRelativeTime(c.updatedAt) : '';

              return (
                <button
                  key={c.id}
                  onClick={() => handleSelectConv(c.id)}
                  className={`w-full p-4 text-left transition cursor-pointer ${
                    isActive
                      ? 'bg-indigo-950/40 border-l-4 border-indigo-500 text-[#F8FAFC]'
                      : 'hover:bg-[#151D2E]/60 text-[#94A3B8]'
                  }`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className={`text-xs font-bold truncate ${isActive ? 'text-indigo-400' : 'text-[#F8FAFC]'}`}>
                      {c.title}
                    </span>
                    <span className="text-[10px] font-mono text-[#64748B] shrink-0 font-medium">{relTime}</span>
                  </div>

                  <p className="mt-1 line-clamp-1 text-xs text-[#94A3B8] font-medium">{lastMsgText}</p>

                  <div className="mt-2 flex items-center justify-between text-[10px] font-mono text-[#64748B] font-medium">
                    <span>{c.participantCount || 1} participant(s)</span>
                    {c.unread && (
                      <span className="h-2 w-2 rounded-full bg-indigo-500 animate-pulse" />
                    )}
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* Main Conversation Chat Pane */}
      {activeConv ? (
        <div
          className={`flex flex-1 flex-col bg-[#0B0F19]/30 relative ${
            !showMobileChat ? 'hidden lg:flex' : 'flex'
          }`}
        >
          {/* Header */}
          <div className="flex items-center justify-between border-b border-[#1F2937] px-4 sm:px-6 py-3.5 bg-[#111827] gap-2">
            <div className="flex items-center gap-3 min-w-0">
              <button
                onClick={() => setShowMobileChat(false)}
                className="lg:hidden text-xs font-bold text-indigo-400 hover:text-indigo-300 p-1"
              >
                ← Threads
              </button>
              <div className="min-w-0">
                <h3 className="text-xs sm:text-sm font-extrabold text-[#F8FAFC] truncate">{activeConv.title}</h3>
                <p className="text-[10px] text-[#94A3B8] font-medium">Project Discussion</p>
              </div>
            </div>

            <div className="flex items-center gap-2.5 text-xs shrink-0">
              <button
                type="button"
                onClick={handleAnalyzeIntent}
                disabled={isAnalyzing}
                className="bg-indigo-600 hover:bg-indigo-500 text-white font-bold px-3 py-1.5 rounded-xl border border-indigo-500 text-xs shadow-sm transition flex items-center gap-1.5 disabled:opacity-50 min-h-[36px] cursor-pointer"
              >
                {isAnalyzing ? 'Analyzing...' : '⚡ Intent'}
              </button>
              {getWsBadge()}
            </div>
          </div>

          {/* Messages Feed */}
          <div
            ref={messagesContainerRef}
            onScroll={handleScroll}
            className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-4 relative"
          >
            {loadingMsgs ? (
              <div className="text-center text-xs text-[#94A3B8] font-medium animate-pulse">Loading message history...</div>
            ) : messages.length === 0 ? (
              <div className="py-12 text-center text-xs text-[#94A3B8] space-y-1">
                <p className="text-base">💬</p>
                <p className="font-bold text-[#F8FAFC]">No messages in this thread yet.</p>
                <p className="text-[#94A3B8] font-medium">Send your first message below.</p>
              </div>
            ) : (
              messages.map((m) => {
                const isMine = m.senderId === user?.id;
                return (
                  <div key={m.id} className={`flex flex-col ${isMine ? 'items-end' : 'items-start'}`}>
                    <div className="flex items-center gap-2 mb-1 text-[11px]">
                      <span className="font-bold text-[#F8FAFC]">
                        {isMine ? 'You' : m.sender?.name || (m as any).senderName || 'Member'}
                      </span>
                      <span className="text-[#64748B] font-mono">
                        {new Date(m.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </span>
                      {m.sendStatus === 'sending' && (
                        <span className="text-[10px] text-amber-400 font-mono animate-pulse">sending...</span>
                      )}
                      {m.sendStatus === 'failed' && (
                        <span className="text-[10px] text-rose-400 font-mono flex items-center gap-1">
                          failed
                          <button
                            onClick={() => handleRetryMessage(m)}
                            className="underline font-bold hover:text-rose-300"
                          >
                            [Retry]
                          </button>
                        </span>
                      )}
                    </div>

                    <div
                      className={`max-w-xl rounded-2xl px-4 py-2.5 text-xs shadow-sm ${
                        isMine
                          ? m.sendStatus === 'failed'
                            ? 'bg-rose-950/80 text-white border border-rose-500/40 rounded-tr-none'
                            : 'bg-indigo-600 text-white rounded-tr-none'
                          : 'bg-[#151D2E] text-[#F8FAFC] border border-[#1F2937] rounded-tl-none font-medium'
                      }`}
                    >
                      <p className="whitespace-pre-wrap leading-relaxed">{m.body}</p>

                      {m.attachments && m.attachments.length > 0 && (
                        <div className="mt-2.5 space-y-1.5 border-t border-white/10 pt-2">
                          {m.attachments.map((att) => (
                            <a
                              key={att.id}
                              href={getAttachmentDownloadUrl(att.id)}
                              target="_blank"
                              rel="noreferrer"
                              className={`flex items-center gap-2 rounded-lg px-2.5 py-1 text-[11px] font-mono transition ${
                                isMine
                                  ? 'bg-indigo-700 text-indigo-100 hover:bg-indigo-800'
                                  : 'bg-[#0B0F19] text-indigo-400 hover:bg-[#111827]'
                              }`}
                            >
                              <span>📎</span>
                              <span className="truncate">{att.fileName}</span>
                              <span className="opacity-75">({Math.round(att.size / 1024)}KB)</span>
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

          {/* Floating 'New Messages' scroll indicator */}
          {hasUnreadBelow && (
            <button
              onClick={() => scrollToBottom(true)}
              className="absolute bottom-16 left-1/2 -translate-x-1/2 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold px-4 py-1.5 rounded-full shadow-xl border border-indigo-400 transition-all animate-bounce z-20 cursor-pointer"
            >
              ↓ New messages below
            </button>
          )}

          {/* Pending Attachments Bar */}
          {pendingAttachments.length > 0 && (
            <div className="flex gap-2 px-4 sm:px-6 py-2 border-t border-[#1F2937] bg-[#0B0F19]">
              {pendingAttachments.map((att) => (
                <span
                  key={att.id}
                  className="inline-flex items-center gap-1 rounded-lg bg-indigo-500/10 px-2.5 py-1 text-[10px] text-indigo-400 border border-indigo-500/30 font-bold"
                >
                  📎 {att.fileName}
                </span>
              ))}
            </div>
          )}

          {errorMsg && (
            <div className="bg-rose-500/10 px-4 py-2 text-xs font-semibold text-rose-400 border-t border-rose-500/30">
              {errorMsg}
            </div>
          )}

          {/* Message Input Form */}
          <form onSubmit={handleSendMessage} className="border-t border-[#1F2937] p-3 sm:p-4 bg-[#111827]">
            <div className="flex items-center gap-2 sm:gap-3">
              <input type="file" ref={fileInputRef} onChange={handleFileUpload} className="hidden" />
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                disabled={uploading}
                className="rounded-xl border border-[#1F2937] bg-[#0B0F19] p-2.5 text-xs text-[#94A3B8] hover:bg-[#151D2E] hover:text-[#F8FAFC] transition shrink-0 min-h-[44px] cursor-pointer"
                title="Attach file"
              >
                {uploading ? '⏳' : '📎'}
              </button>

              <input
                type="text"
                value={messageBody}
                onChange={(e) => setMessageBody(e.target.value)}
                placeholder="Write a message..."
                className="flex-1 rounded-xl border border-[#1F2937] bg-[#0B0F19] px-4 py-2.5 text-xs text-[#F8FAFC] placeholder:text-[#64748B] focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 focus:outline-none min-h-[44px]"
              />

              <button
                type="submit"
                disabled={sending || (!messageBody.trim() && pendingAttachments.length === 0)}
                className="rounded-xl bg-indigo-600 hover:bg-indigo-500 px-4 py-2.5 text-xs font-bold text-white shadow-sm transition disabled:opacity-50 shrink-0 min-h-[44px] cursor-pointer"
              >
                {sending ? '...' : 'Send ➤'}
              </button>
            </div>
          </form>
        </div>
      ) : (
        <div className="flex flex-1 items-center justify-center p-8 text-xs text-[#94A3B8] font-medium">
          Select a thread to view conversation.
        </div>
      )}

      {/* Right Sidebar — Intent Panel (Desktop only) */}
      {activeConv && (
        <div className="hidden xl:block w-80 border-l border-[#1F2937] bg-[#0B0F19]/50 p-4 overflow-y-auto">
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

      {/* Modal */}
      {showNewModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm">
          <div className="w-full max-w-sm rounded-2xl border border-[#1F2937] bg-[#111827] p-6 shadow-2xl space-y-4 text-[#F8FAFC]">
            <h3 className="text-sm font-extrabold text-[#F8FAFC]">Create Conversation Thread</h3>
            <form onSubmit={handleCreateConversation} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-[#94A3B8] mb-1">Title</label>
                <input
                  type="text"
                  value={newTitle}
                  onChange={(e) => setNewTitle(e.target.value)}
                  placeholder="e.g. Homepage Feedback"
                  className="w-full rounded-xl border border-[#1F2937] bg-[#0B0F19] px-3.5 py-2 text-xs text-[#F8FAFC] placeholder:text-[#64748B] focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 focus:outline-none"
                  autoFocus
                />
              </div>

              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowNewModal(false)}
                  className="rounded-xl px-3.5 py-1.5 text-xs font-semibold text-[#94A3B8] hover:bg-[#151D2E] hover:text-[#F8FAFC]"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={!newTitle.trim()}
                  className="rounded-xl bg-indigo-600 px-4 py-1.5 text-xs font-bold text-white hover:bg-indigo-500 disabled:opacity-50 shadow-sm"
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

