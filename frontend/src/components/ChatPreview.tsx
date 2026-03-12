import { useState, useRef, useEffect, useCallback } from 'react';
import {
  chatPreview, listChatSessions, createChatSession,
  getChatSession, updateChatSession, deleteChatSession,
  type ChatMessage, type ChatSession,
} from '../api/client';
import { useConfig } from '../stores/useConfig';
import { useT } from '../i18n';
import type { Candidate } from '../api/client';

interface Props {
  candidate: Candidate;
  language: string;
  onClose: () => void;
}

function buildSystemPrompt(candidate: Candidate, language: string): string {
  const spec = candidate.spec_long as Record<string, string>;
  const name = spec.identity || spec.name || 'Character';

  const parts: string[] = [];

  if (language === 'zh' || language === 'zh-Hant') {
    parts.push(`你是「${name}」，一个虚构角色。请完全以该角色的身份回复，保持角色一致性。`);
  } else {
    parts.push(`You are "${name}", a fictional character. Respond entirely in character, maintaining consistency.`);
  }

  if (candidate.natural_long) {
    parts.push(`\n[Character Description]\n${candidate.natural_long}`);
  }

  const fields = [
    ['personality', 'Personality'], ['background', 'Background'],
    ['voice', 'Speech Style'], ['catchphrases', 'Catchphrases'],
    ['goals', 'Goals'], ['conflicts', 'Inner Conflicts'],
    ['values', 'Values'], ['habits', 'Habits'],
    ['relationships', 'Relationships'], ['taboos', 'Taboos'],
  ];

  for (const [key, label] of fields) {
    if (spec[key]) parts.push(`[${label}]\n${spec[key]}`);
  }

  if (spec.system_constraints) {
    parts.push(`\n[System Constraints]\n${spec.system_constraints}`);
  }

  if (spec.opening_line) {
    parts.push(`\n[Opening Line (for reference)]\n${spec.opening_line}`);
  }

  if (spec.dialogue_examples) {
    parts.push(`\n[Example Dialogue]\n${spec.dialogue_examples}`);
  }

  return parts.join('\n\n');
}

export default function ChatPreview({ candidate, language, onClose }: Props) {
  const config = useConfig();
  const t = useT(language);
  const spec = candidate.spec_long as Record<string, string>;
  const charName = spec.identity || spec.name || 'Character';
  const openingLine = spec.opening_line || '';
  const systemPrompt = buildSystemPrompt(candidate, language);

  const [messages, setMessages] = useState<ChatMessage[]>(
    openingLine ? [{ role: 'assistant', content: openingLine }] : []
  );
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [sessionId, setSessionId] = useState<number | null>(null);
  const [sessions, setSessions] = useState<ChatSession[]>([]);
  const [sessionsLoading, setSessionsLoading] = useState(true);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  const isZh = language === 'zh' || language === 'zh-Hant';

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  // Load sessions on mount
  useEffect(() => {
    listChatSessions()
      .then(setSessions)
      .catch(() => {})
      .finally(() => setSessionsLoading(false));
  }, []);

  // Auto-save messages to current session
  const saveToSession = useCallback(async (msgs: ChatMessage[]) => {
    if (sessionId && msgs.length > 0) {
      await updateChatSession(sessionId, msgs).catch(() => {});
    }
  }, [sessionId]);

  const handleSend = async () => {
    const text = input.trim();
    if (!text || loading) return;

    const userMsg: ChatMessage = { role: 'user', content: text };
    const newMessages = [...messages, userMsg];
    setMessages(newMessages);
    setInput('');
    setLoading(true);

    // Create session on first user message if no session yet
    let currentSessionId = sessionId;
    if (!currentSessionId) {
      try {
        const res = await createChatSession({
          char_name: charName,
          system_prompt: systemPrompt,
          messages: newMessages,
        });
        currentSessionId = res.id;
        setSessionId(res.id);
        listChatSessions().then(setSessions).catch(() => {});
      } catch { /* ignore */ }
    }

    try {
      const res = await chatPreview({
        messages: newMessages,
        system_prompt: systemPrompt,
        provider: config.provider,
        model: config.modelName || config.modelId || undefined,
        api_key: config.apiKey || undefined,
        base_url: config.baseUrl || undefined,
      });
      const updated = [...newMessages, { role: 'assistant' as const, content: res.reply }];
      setMessages(updated);
      if (currentSessionId) {
        updateChatSession(currentSessionId, updated).catch(() => {});
      }
    } catch (e) {
      const errorMsg = [...newMessages, {
        role: 'assistant' as const,
        content: `[Error] ${e instanceof Error ? e.message : String(e)}`,
      }];
      setMessages(errorMsg);
      if (currentSessionId) {
        updateChatSession(currentSessionId, errorMsg).catch(() => {});
      }
    } finally {
      setLoading(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleLoadSession = async (sid: number) => {
    try {
      const detail = await getChatSession(sid);
      setMessages(detail.messages);
      setSessionId(sid);
    } catch { /* ignore */ }
  };

  const handleNewChat = () => {
    if (sessionId && messages.length > 0) {
      saveToSession(messages);
    }
    setSessionId(null);
    setMessages(openingLine ? [{ role: 'assistant', content: openingLine }] : []);
    inputRef.current?.focus();
  };

  const handleDeleteSession = async (sid: number, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!confirm(t('deleteSessionConfirm') as string)) return;
    try {
      await deleteChatSession(sid);
      setSessions(prev => prev.filter(s => s.id !== sid));
      if (sessionId === sid) {
        handleNewChat();
      }
    } catch { /* ignore */ }
  };

  const formatTime = (dateStr: string) => {
    const d = new Date(dateStr + 'Z');
    const now = new Date();
    const diff = now.getTime() - d.getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return isZh ? '刚刚' : 'Just now';
    if (mins < 60) return isZh ? `${mins} 分钟前` : `${mins}m ago`;
    const hours = Math.floor(mins / 60);
    if (hours < 24) return isZh ? `${hours} 小时前` : `${hours}h ago`;
    const days = Math.floor(hours / 24);
    if (days < 7) return isZh ? `${days} 天前` : `${days}d ago`;
    return d.toLocaleDateString();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm" onClick={onClose}>
      <div
        className="bg-white rounded-2xl shadow-2xl flex overflow-hidden"
        style={{ width: 'min(880px, 92vw)', height: 'min(680px, 85vh)' }}
        onClick={e => e.stopPropagation()}
      >
        {/* Sidebar — session list */}
        <div
          className={`border-r border-border bg-surface-1 flex flex-col transition-all duration-200 ${
            sidebarOpen ? 'w-56' : 'w-0'
          } overflow-hidden flex-shrink-0`}
        >
          {/* Sidebar header */}
          <div className="px-3 py-3 border-b border-border flex items-center justify-between flex-shrink-0">
            <span className="text-[0.78rem] font-semibold text-text-secondary truncate">
              {t('chatSessions') as string}
            </span>
            <button
              onClick={handleNewChat}
              className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-surface-3 text-text-dim transition-colors"
              title={t('newChat') as string}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" />
              </svg>
            </button>
          </div>

          {/* Session list */}
          <div className="flex-1 overflow-y-auto" style={{ scrollbarWidth: 'thin' }}>
            {sessionsLoading ? (
              <div className="text-center py-6 text-text-faint text-[0.72rem]">
                {t('loading') as string}
              </div>
            ) : sessions.length === 0 ? (
              <div className="text-center py-6 text-text-faint text-[0.72rem] px-3">
                {t('noSessions') as string}
              </div>
            ) : (
              <div className="py-1">
                {sessions.map(s => {
                  const isActive = sessionId === s.id;
                  return (
                    <div
                      key={s.id}
                      onClick={() => handleLoadSession(s.id)}
                      className={`group px-3 py-2.5 cursor-pointer transition-colors ${
                        isActive
                          ? 'bg-accent/8 border-r-2 border-accent'
                          : 'hover:bg-surface-2'
                      }`}
                    >
                      <div className="flex items-center justify-between mb-0.5">
                        <span className={`text-[0.78rem] font-medium truncate ${
                          isActive ? 'text-accent' : 'text-text-primary'
                        }`}>
                          {s.char_name}
                        </span>
                        <button
                          onClick={(e) => handleDeleteSession(s.id, e)}
                          className="opacity-0 group-hover:opacity-100 w-5 h-5 flex items-center justify-center rounded text-text-faint hover:text-error hover:bg-error/10 transition-all flex-shrink-0"
                        >
                          <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
                          </svg>
                        </button>
                      </div>
                      <div className="text-[0.66rem] text-text-faint truncate">
                        {s.last_message || (isZh ? '暂无消息' : 'No messages')}
                      </div>
                      <div className="flex items-center gap-2 mt-0.5">
                        <span className="text-[0.6rem] text-text-muted">
                          {(t('messagesCount') as (n: number) => string)(s.message_count)}
                        </span>
                        <span className="text-[0.6rem] text-text-muted">
                          {formatTime(s.updated_at)}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* Main chat area */}
        <div className="flex-1 flex flex-col min-w-0">
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-border bg-gradient-to-r from-blue-50/50 to-cyan-50/50 flex-shrink-0">
            <div className="flex items-center gap-2.5">
              <button
                onClick={() => setSidebarOpen(v => !v)}
                className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-white/60 text-text-dim transition-colors"
                title={t('chatSessions') as string}
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="3" y1="6" x2="21" y2="6" /><line x1="3" y1="12" x2="21" y2="12" /><line x1="3" y1="18" x2="21" y2="18" />
                </svg>
              </button>
              <div className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-500 to-cyan-500 flex items-center justify-center text-white text-sm font-bold flex-shrink-0">
                {charName[0].toUpperCase()}
              </div>
              <div className="min-w-0">
                <div className="font-semibold text-[0.88rem] text-text-primary truncate">{charName}</div>
                <div className="text-[0.66rem] text-text-faint">{t('exportChatPreview') as string}</div>
              </div>
            </div>
            <button
              onClick={onClose}
              className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-surface-3 text-text-dim transition-colors"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            </button>
          </div>

          {/* Messages */}
          <div className="flex-1 overflow-y-auto px-5 py-4 space-y-3">
            {messages.length === 0 && (
              <div className="text-center text-text-faint text-[0.82rem] py-8">
                {language === 'zh' ? `向「${charName}」说些什么吧...` : language === 'zh-Hant' ? `向「${charName}」說些什麼吧...` : `Say something to "${charName}"...`}
              </div>
            )}
            {messages.map((msg, i) => (
              <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                <div className={`max-w-[80%] rounded-2xl px-4 py-2.5 text-[0.86rem] leading-relaxed ${
                  msg.role === 'user'
                    ? 'bg-gradient-to-r from-blue-500 to-cyan-500 text-white rounded-br-md'
                    : 'bg-surface-2 text-text-secondary border border-border rounded-bl-md'
                }`}>
                  {msg.content.startsWith('[Error]') ? (
                    <span className="text-error text-[0.8rem]">{msg.content}</span>
                  ) : (
                    <span className="whitespace-pre-wrap">{msg.content}</span>
                  )}
                </div>
              </div>
            ))}
            {loading && (
              <div className="flex justify-start">
                <div className="bg-surface-2 border border-border rounded-2xl rounded-bl-md px-4 py-3">
                  <div className="flex gap-1.5">
                    <div className="w-2 h-2 bg-text-faint rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                    <div className="w-2 h-2 bg-text-faint rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                    <div className="w-2 h-2 bg-text-faint rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                  </div>
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Input */}
          <div className="px-4 pb-4 pt-2 border-t border-border flex-shrink-0">
            <div className="flex items-end gap-2">
              <textarea
                ref={inputRef}
                value={input}
                onChange={e => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder={language === 'zh' ? '输入消息...' : language === 'zh-Hant' ? '輸入訊息...' : 'Type a message...'}
                rows={1}
                className="flex-1 px-4 py-2.5 text-[0.86rem] border border-border rounded-xl focus:border-accent focus:ring-2 focus:ring-accent/20 outline-none resize-none max-h-24 overflow-y-auto"
                style={{ minHeight: '42px' }}
              />
              <button
                onClick={handleSend}
                disabled={!input.trim() || loading}
                className="w-10 h-10 flex items-center justify-center rounded-xl bg-gradient-to-r from-blue-500 to-cyan-500 text-white disabled:opacity-30 transition-opacity flex-shrink-0"
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="22" y1="2" x2="11" y2="13" />
                  <polygon points="22 2 15 22 11 13 2 9 22 2" />
                </svg>
              </button>
            </div>
            <div className="text-[0.66rem] text-text-muted mt-1.5 text-center">
              {language === 'zh' ? 'Enter 发送，Shift+Enter 换行' : language === 'zh-Hant' ? 'Enter 發送，Shift+Enter 換行' : 'Enter to send, Shift+Enter for new line'}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}