import { useState, useRef, useEffect } from 'react';
import { chatPreview, type ChatMessage } from '../api/client';
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

  const [messages, setMessages] = useState<ChatMessage[]>(
    openingLine ? [{ role: 'assistant', content: openingLine }] : []
  );
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const handleSend = async () => {
    const text = input.trim();
    if (!text || loading) return;

    const userMsg: ChatMessage = { role: 'user', content: text };
    const newMessages = [...messages, userMsg];
    setMessages(newMessages);
    setInput('');
    setLoading(true);

    try {
      const res = await chatPreview({
        messages: newMessages,
        system_prompt: buildSystemPrompt(candidate, language),
        provider: config.provider,
        model: config.modelName || config.modelId || undefined,
        api_key: config.apiKey || undefined,
        base_url: config.baseUrl || undefined,
      });
      setMessages(prev => [...prev, { role: 'assistant', content: res.reply }]);
    } catch (e) {
      setMessages(prev => [...prev, {
        role: 'assistant',
        content: `[Error] ${e instanceof Error ? e.message : String(e)}`,
      }]);
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

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm" onClick={onClose}>
      <div
        className="bg-white rounded-2xl shadow-2xl w-full max-w-lg mx-4 flex flex-col overflow-hidden"
        style={{ height: 'min(680px, 85vh)' }}
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-border bg-gradient-to-r from-blue-50/50 to-cyan-50/50">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-full bg-gradient-to-br from-blue-500 to-cyan-500 flex items-center justify-center text-white text-sm font-bold flex-shrink-0">
              {charName[0].toUpperCase()}
            </div>
            <div>
              <div className="font-semibold text-[0.9rem] text-text-primary">{charName}</div>
              <div className="text-[0.68rem] text-text-faint">{t('exportChatPreview') as string}</div>
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
        <div className="px-4 pb-4 pt-2 border-t border-border">
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
  );
}
