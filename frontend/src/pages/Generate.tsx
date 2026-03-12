import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useConfig } from '../stores/useConfig';
import { useAuth } from '../stores/useAuth';
import { useGenerateSession } from '../stores/useGenerateSession';
import { generate } from '../api/client';
import CandidateCard from '../components/CandidateCard';
import InspirationPicker from '../components/InspirationPicker';
import ChatWizard from '../components/ChatWizard';
import LoginPrompt from '../components/LoginPrompt';
import { useT } from '../i18n';

export default function Generate() {
  const config = useConfig();
  const navigate = useNavigate();
  const token = useAuth(s => s.token);
  const t = useT(config.language);
  const [activeTab, setActiveTab] = useState<'create' | 'chat'>('create');

  const [concept, setConcept] = useState('');
  const [selectedCards, setSelectedCards] = useState<string[]>([]);

  // Use session store for generation state (persists across navigation)
  const session = useGenerateSession();

  const handleGenerate = async () => {
    if (!concept.trim()) return;
    const controller = new AbortController();
    session.startGeneration(concept.trim(), controller);
    try {
      const res = await generate({
        concept: concept.trim(),
        count: config.count,
        language: config.language,
        provider: config.provider,
        model: config.modelName || config.modelId || undefined,
        api_key: config.apiKey || undefined,
        base_url: config.baseUrl || undefined,
        selected_inspirations: selectedCards.length > 0 ? selectedCards : undefined,
        temperature: config.advanced.temperature,
        top_p: config.advanced.topP,
        max_tokens: config.advanced.maxTokens,
        frequency_penalty: config.advanced.frequencyPenalty,
        presence_penalty: config.advanced.presencePenalty,
      }, controller.signal);
      session.finishGeneration(res.candidates);
    } catch (e: unknown) {
      if (e instanceof DOMException && e.name === 'AbortError') return;
      session.failGeneration(e instanceof Error ? e.message : t('generateFailed') as string);
    }
  };

  const handleCancel = () => {
    session.cancelGeneration();
  };

  const tabs = [
    { id: 'create' as const, label: t('freeCreate') as string, desc: t('freeCreateDesc') as string },
    { id: 'chat' as const, label: t('guidedCreate') as string, desc: t('guidedCreateDesc') as string },
  ];

  const isZh = config.language === 'zh' || config.language === 'zh-Hant';

  if (!token) {
    return <LoginPrompt titleKey="loginToCreate" descKey="loginToCreateDesc" />;
  }

  return (
    <div>
      {/* Page header */}
      <div className="mb-6 pb-4 border-b border-border">
        <div className="flex items-center gap-3.5 mb-1.5">
          <h1 className="text-[1.75rem] font-light tracking-wide" style={{ fontFamily: "'Noto Serif SC', 'Inter', serif" }}>
            {t('pageTitle') as string}
          </h1>
          <span className="bg-gradient-to-r from-blue-50 to-indigo-50 text-accent font-mono text-[0.62rem] tracking-widest px-3 py-1 rounded-full font-semibold border border-blue-200">
            PERSONA FORGE
          </span>
        </div>
        <p className="text-text-dim text-[0.88rem]">{t('pageSubtitle') as string}</p>
      </div>

      {/* Not configured warning */}
      {!config.configured && (
        <div className="mb-5 px-4 py-3.5 bg-amber-50 border border-amber-200 rounded-xl flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#D97706" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
              <line x1="12" y1="9" x2="12" y2="13" /><line x1="12" y1="17" x2="12.01" y2="17" />
            </svg>
            <span className="text-[0.84rem] text-amber-800">{t('notConfiguredWarning') as string}</span>
          </div>
          <button
            onClick={() => navigate('/model')}
            className="flex-shrink-0 text-[0.8rem] font-semibold text-amber-700 bg-amber-100 hover:bg-amber-200 border border-amber-300 px-4 py-1.5 rounded-lg transition-colors"
          >
            {t('goConfig') as string}
          </button>
        </div>
      )}

      {/* Tab switcher */}
      <div className="flex gap-3 mb-6">
        {tabs.map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`flex-1 max-w-[240px] text-left px-4 py-3 rounded-xl border transition-all ${
              activeTab === tab.id
                ? 'bg-white border-accent/30 shadow-sm'
                : 'bg-surface-2 border-border hover:bg-surface-3'
            }`}
          >
            <div className={`text-[0.84rem] font-semibold ${activeTab === tab.id ? 'text-accent' : 'text-text-primary'}`}>
              {tab.id === 'create' ? '✦ ' : '⚙ '}
              {tab.label}
            </div>
            <div className="text-[0.72rem] text-text-faint mt-0.5">{tab.desc}</div>
          </button>
        ))}
      </div>

      {/* ── Free creation tab ── */}
      {activeTab === 'create' && (
        <div>
          <div className="bg-white border border-border rounded-xl p-5 mb-4 shadow-xs">
            <div className="text-[0.82rem] font-semibold mb-2">{t('conceptLabel') as string}</div>
            <textarea
              value={concept}
              onChange={e => setConcept(e.target.value)}
              placeholder={t('conceptPlaceholder') as string}
              rows={3}
              disabled={session.isGenerating}
              className="w-full px-3 py-2.5 text-[0.88rem] border border-border rounded-lg focus:border-accent focus:ring-2 focus:ring-accent/25 outline-none resize-none placeholder:text-text-muted disabled:opacity-50 disabled:cursor-not-allowed"
            />
          </div>

          {/* Inspiration card picker */}
          <div className="mb-4">
            <InspirationPicker
              language={config.language}
              selected={selectedCards}
              onSelectionChange={setSelectedCards}
            />
          </div>

          {/* Generate controls */}
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-2">
              <label className="text-[0.78rem] text-text-dim">{t('candidates') as string}</label>
              <div className="flex items-center border border-border rounded-lg overflow-hidden">
                <button
                  onClick={() => { if (config.count > 1) config.setCount(config.count - 1); }}
                  disabled={config.count <= 1 || session.isGenerating}
                  className="w-8 h-8 flex items-center justify-center text-text-dim hover:bg-surface-2 disabled:opacity-30 disabled:cursor-not-allowed transition-colors text-sm"
                >
                  −
                </button>
                <input
                  type="text"
                  inputMode="numeric"
                  value={config.count}
                  onChange={e => {
                    const v = e.target.value.replace(/\D/g, '');
                    if (v === '') return;
                    const n = Math.min(10, Math.max(1, parseInt(v, 10)));
                    config.setCount(n);
                  }}
                  onBlur={() => { if (config.count < 1) config.setCount(1); if (config.count > 10) config.setCount(10); }}
                  disabled={session.isGenerating}
                  className="w-10 text-center text-[0.84rem] font-semibold text-text-primary outline-none bg-transparent border-x border-border py-1 disabled:opacity-50"
                />
                <button
                  onClick={() => { if (config.count < 10) config.setCount(config.count + 1); }}
                  disabled={config.count >= 10 || session.isGenerating}
                  className="w-8 h-8 flex items-center justify-center text-text-dim hover:bg-surface-2 disabled:opacity-30 disabled:cursor-not-allowed transition-colors text-sm"
                >
                  +
                </button>
              </div>
              <span className="text-[0.72rem] text-text-faint">max 10</span>
            </div>

            <div className="flex items-center gap-3">
              {session.isGenerating && (
                <button
                  onClick={handleCancel}
                  className="text-[0.84rem] font-medium text-error border border-error/30 bg-error/5 hover:bg-error/10 px-5 py-2.5 rounded-xl transition-all"
                >
                  {isZh ? '取消生成' : 'Cancel'}
                </button>
              )}
              <button
                onClick={handleGenerate}
                disabled={session.isGenerating || !concept.trim() || !config.configured}
                className="bg-gradient-to-r from-blue-500 to-cyan-500 hover:from-blue-600 hover:to-cyan-600 disabled:opacity-40 disabled:cursor-not-allowed text-white text-[0.85rem] font-semibold px-7 py-2.5 rounded-xl transition-all shadow-md hover:shadow-lg"
              >
                {session.isGenerating ? (
                  <span className="flex items-center gap-2">
                    <span className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" />
                    {t('generating') as string}
                  </span>
                ) : (
                  <>{t('generateBtn') as string} {selectedCards.length > 0 && <span className="text-white/70 ml-1">({selectedCards.length} {t('inspirationSuffix') as string})</span>}</>
                )}
              </button>
            </div>
          </div>

          {/* Generating indicator */}
          {session.isGenerating && (
            <div className="mb-6 px-5 py-4 bg-accent/5 border border-accent/20 rounded-xl">
              <div className="flex items-center gap-3">
                <span className="w-5 h-5 border-2 border-accent/30 border-t-accent rounded-full animate-spin" />
                <div>
                  <div className="text-[0.84rem] font-medium text-accent">
                    {isZh ? '正在生成角色...' : 'Generating character...'}
                  </div>
                  <div className="text-[0.72rem] text-text-faint mt-0.5">
                    {isZh ? `概念：${session.currentConcept}` : `Concept: ${session.currentConcept}`}
                  </div>
                </div>
              </div>
            </div>
          )}

          {session.error && (
            <div className="mb-4 px-4 py-3 bg-error/5 border border-error/20 rounded-lg text-[0.84rem] text-error">
              {session.error}
            </div>
          )}

          {/* Session history: all generation runs from this login */}
          {session.runs.map((run) => (
            <div key={run.id} className="mb-6">
              <div className="flex items-center gap-2 mb-3">
                <div className="text-[0.82rem] font-semibold text-text-dim">
                  {run.concept}
                </div>
                <span className="text-[0.7rem] text-text-faint">
                  · {run.candidates.length} {isZh ? '个候选' : 'candidates'}
                </span>
                <span className="text-[0.66rem] text-text-muted ml-auto">
                  {new Date(run.timestamp).toLocaleTimeString()}
                </span>
              </div>
              {run.candidates.map((c, i) => (
                <CandidateCard key={c.id} candidate={c} index={i} language={config.language} />
              ))}
            </div>
          ))}
        </div>
      )}

      {/* ── Guided wizard tab ── */}
      {activeTab === 'chat' && <ChatWizard />}
    </div>
  );
}
