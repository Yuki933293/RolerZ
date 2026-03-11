import { useState, useRef, useEffect } from 'react';
import { useConfig } from '../stores/useConfig';
import {
  wizardStart,
  wizardAnswer,
  wizardFinish,
  type Candidate,
  type WizardQuestion,
} from '../api/client';
import CandidateCard from './CandidateCard';
import { useT } from '../i18n';

interface Message {
  role: 'ai' | 'user';
  content: string;
  field?: string;
}

export default function ChatWizard() {
  const config = useConfig();
  const t = useT(config.language);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [sessionId, setSessionId] = useState('');
  const [currentQuestions, setCurrentQuestions] = useState<WizardQuestion[]>([]);
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<Candidate[] | null>(null);
  const [error, setError] = useState('');
  const [started, setStarted] = useState(false);
  const [conceptInput, setConceptInput] = useState('');

  const FIELD_LABELS: Record<string, string> = {
    appearance: t('fieldAppearance') as string,
    background: t('fieldBackground') as string,
    personality: t('fieldPersonality') as string,
    voice: t('fieldVoice') as string,
    goals: t('fieldGoals') as string,
    conflicts: t('fieldConflicts') as string,
  };

  // Answered fields for progress
  const [answeredFields, setAnsweredFields] = useState<string[]>([]);
  const totalFields = 6;

  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
  }, [messages, loading]);

  const buildConcept = t('buildConcept') as (c: string) => string;
  const generatedCount = t('generatedCount') as (n: number) => string;

  const handleStart = async () => {
    if (!conceptInput.trim()) return;
    setLoading(true);
    setError('');
    setResults(null);
    const introMsg = buildConcept(conceptInput.trim());
    setMessages([{ role: 'ai', content: introMsg }]);
    try {
      const res = await wizardStart({
        concept: conceptInput.trim(),
        provider: config.provider,
        model: config.modelName || config.modelId || undefined,
        api_key: config.apiKey || undefined,
        base_url: config.baseUrl || undefined,
        count: config.count,
        language: config.language,
      });
      setSessionId(res.session_id);
      setCurrentQuestions(res.questions);
      setStarted(true);

      const newMsgs: Message[] = [{ role: 'ai', content: introMsg }];
      for (const q of res.questions) {
        const label = FIELD_LABELS[q.field] || q.field;
        newMsgs.push({ role: 'ai', content: `📋 **${label}**\n${q.text}`, field: q.field });
      }
      setMessages(newMsgs);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : t('startFailed') as string);
    } finally {
      setLoading(false);
    }
  };

  const OPTIONAL_FIELDS = new Set(['goals', 'conflicts']);

  const handleSend = async (skipField = false) => {
    if (currentQuestions.length === 0) return;
    const field = currentQuestions[0].field;
    const isOptional = OPTIONAL_FIELDS.has(field);
    const answer = skipField ? '' : input.trim();
    if (!answer && !isOptional) return;
    setInput('');
    setLoading(true);
    setError('');

    const isZh = config.language === 'zh' || config.language === 'zh-Hant';
    const userMsg: Message = { role: 'user', content: answer || (isZh ? '（跳过）' : '(skipped)') };
    setMessages(prev => [...prev, userMsg]);
    setAnsweredFields(prev => [...prev, field]);

    try {
      const res = await wizardAnswer(sessionId, field, answer);
      setCurrentQuestions(res.questions);

      if (res.questions.length > 0) {
        const newAiMsgs: Message[] = [];
        newAiMsgs.push({ role: 'ai', content: t('received') as string });
        for (const q of res.questions) {
          const label = FIELD_LABELS[q.field] || q.field;
          newAiMsgs.push({ role: 'ai', content: `📋 **${label}**\n${q.text}`, field: q.field });
        }
        setMessages(prev => [...prev, ...newAiMsgs]);
      } else {
        setMessages(prev => [
          ...prev,
          { role: 'ai', content: t('allDimensionsDone') as string },
        ]);
      }
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : t('submitFailed') as string);
    } finally {
      setLoading(false);
    }
  };

  const handleFinish = async () => {
    setLoading(true);
    setError('');
    setMessages(prev => [
      ...prev,
      { role: 'ai', content: t('generatingCard') as string },
    ]);
    try {
      const res = await wizardFinish(sessionId);
      setResults(res.candidates);
      setCurrentQuestions([]);
      setMessages(prev => [
        ...prev.slice(0, -1),
        { role: 'ai', content: generatedCount(res.candidates.length) },
      ]);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : t('generateFailed') as string);
    } finally {
      setLoading(false);
    }
  };

  const handleReset = () => {
    setMessages([]);
    setSessionId('');
    setCurrentQuestions([]);
    setResults(null);
    setStarted(false);
    setConceptInput('');
    setAnsweredFields([]);
    setError('');
  };

  const progress = Math.round((answeredFields.length / totalFields) * 100);
  const isOptionalField = currentQuestions.length > 0 && OPTIONAL_FIELDS.has(currentQuestions[0]?.field);

  // ── Not started yet ──
  if (!started) {
    return (
      <div className="flex flex-col items-center justify-center py-16">
        <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-blue-500 to-cyan-500 flex items-center justify-center text-white text-2xl font-bold shadow-lg mb-6">
          ⚙
        </div>
        <h2 className="text-lg font-semibold mb-2">{t('guidedTitle') as string}</h2>
        <p className="text-text-dim text-[0.88rem] mb-6 text-center max-w-md">
          {t('guidedDesc') as string}
        </p>
        <div className="w-full max-w-md">
          <input
            type="text"
            value={conceptInput}
            onChange={e => setConceptInput(e.target.value)}
            placeholder={t('conceptInputPlaceholder') as string}
            className="w-full px-4 py-3 text-[0.88rem] border border-border rounded-xl focus:border-accent focus:ring-2 focus:ring-accent/25 outline-none mb-3 shadow-xs"
            onKeyDown={e => e.key === 'Enter' && handleStart()}
          />
          <button
            onClick={handleStart}
            disabled={loading || !conceptInput.trim()}
            className="w-full bg-gradient-to-r from-blue-500 to-cyan-500 hover:from-blue-600 hover:to-cyan-600 disabled:opacity-40 text-white text-[0.88rem] font-semibold py-3 rounded-xl transition-all shadow-md"
          >
            {loading ? t('starting') as string : t('startBuild') as string}
          </button>
        </div>
      </div>
    );
  }

  // ── Chat interface ──
  return (
    <div className="flex flex-col h-[calc(100vh-220px)]">
      {/* Progress bar */}
      <div className="mb-3 flex items-center gap-3">
        <div className="flex-1 h-2 bg-surface-3 rounded-full overflow-hidden">
          <div
            className="h-full bg-gradient-to-r from-blue-500 to-cyan-500 rounded-full transition-all duration-500"
            style={{ width: `${progress}%` }}
          />
        </div>
        <span className="text-[0.72rem] text-text-faint flex-shrink-0">
          {answeredFields.length}/{totalFields} {t('dimensions') as string}
        </span>
        <button
          onClick={handleReset}
          className="text-[0.72rem] text-text-dim border border-border px-2.5 py-1 rounded-md hover:bg-surface-3 transition-colors flex-shrink-0"
        >
          {t('restart') as string}
        </button>
      </div>

      {/* Messages */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto space-y-3 mb-3 pr-1">
        {messages.map((msg, i) => (
          <div
            key={i}
            className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
          >
            <div
              className={`max-w-[75%] px-4 py-3 rounded-2xl text-[0.86rem] leading-relaxed ${
                msg.role === 'user'
                  ? 'bg-accent text-white rounded-br-md'
                  : 'bg-white border border-border rounded-bl-md shadow-xs'
              }`}
            >
              {msg.content.split('\n').map((line, j) => (
                <p key={j} className={j > 0 ? 'mt-1' : ''}>
                  {line.startsWith('📋 **')
                    ? <>
                        <span className="mr-1">📋</span>
                        <strong>{line.replace('📋 **', '').replace('**', '')}</strong>
                      </>
                    : line
                  }
                </p>
              ))}
            </div>
          </div>
        ))}

        {loading && (
          <div className="flex justify-start">
            <div className="bg-white border border-border rounded-2xl rounded-bl-md px-4 py-3 shadow-xs">
              <div className="flex gap-1.5">
                <span className="w-2 h-2 bg-text-muted rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                <span className="w-2 h-2 bg-text-muted rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                <span className="w-2 h-2 bg-text-muted rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
              </div>
            </div>
          </div>
        )}
      </div>

      {error && (
        <div className="mb-2 px-3 py-2 bg-error/5 border border-error/20 rounded-lg text-[0.78rem] text-error">
          {error}
        </div>
      )}

      {/* Input area */}
      {currentQuestions.length > 0 ? (
        <div className="flex gap-2">
          <input
            type="text"
            value={input}
            onChange={e => setInput(e.target.value)}
            placeholder={t('inputPlaceholder') as string}
            className="flex-1 px-4 py-3 text-[0.86rem] border border-border rounded-xl focus:border-accent focus:ring-2 focus:ring-accent/25 outline-none"
            onKeyDown={e => e.key === 'Enter' && !e.shiftKey && handleSend()}
            disabled={loading}
          />
          <button
            onClick={() => handleSend()}
            disabled={loading || (!input.trim() && !isOptionalField)}
            className="bg-accent hover:bg-accent-hover disabled:opacity-40 text-white px-5 py-3 rounded-xl font-semibold text-[0.85rem] transition-colors flex-shrink-0"
          >
            {t('send') as string}
          </button>
          {isOptionalField && (
            <button
              onClick={() => handleSend(true)}
              disabled={loading}
              className="border border-border text-text-dim hover:bg-surface-3 disabled:opacity-40 px-4 py-3 rounded-xl text-[0.85rem] transition-colors flex-shrink-0"
            >
              {t('skip') as string}
            </button>
          )}
        </div>
      ) : started && !results ? (
        <button
          onClick={handleFinish}
          disabled={loading}
          className="w-full bg-gradient-to-r from-blue-500 to-cyan-500 hover:from-blue-600 hover:to-cyan-600 disabled:opacity-40 text-white text-[0.88rem] font-semibold py-3 rounded-xl transition-all shadow-md"
        >
          {loading ? t('generating') as string : t('generateCard') as string}
        </button>
      ) : null}

      {/* Results */}
      {results && results.length > 0 && (
        <div className="mt-4 overflow-y-auto">
          <div className="text-[0.82rem] font-semibold text-text-dim mb-3">
            {t('generateResult') as string} · {results.length} {t('candidateUnit') as string}
          </div>
          {results.map((c, i) => (
            <CandidateCard key={c.id} candidate={c} index={i} language={config.language} />
          ))}
        </div>
      )}
    </div>
  );
}
