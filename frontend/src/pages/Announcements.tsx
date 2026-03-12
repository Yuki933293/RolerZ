import { useCallback, useEffect, useRef, useState } from 'react';
import { useConfig } from '../stores/useConfig';
import { useAuth } from '../stores/useAuth';
import { useT } from '../i18n';
import {
  getAnnouncements,
  createAnnouncement,
  updateAnnouncement,
  deleteAnnouncement,
  type Announcement as ApiAnnouncement,
} from '../api/client';

/* ── Type style mapping ── */
type AnnouncementType = 'feature' | 'improvement' | 'fix';

const TYPE_STYLE: Record<AnnouncementType, { label: string; labelEn: string; cls: string }> = {
  feature:     { label: '新功能', labelEn: 'Feature',     cls: 'bg-blue-50 text-blue-600 border-blue-200' },
  improvement: { label: '改进',   labelEn: 'Improvement', cls: 'bg-emerald-50 text-emerald-600 border-emerald-200' },
  fix:         { label: '修复',   labelEn: 'Fix',         cls: 'bg-amber-50 text-amber-600 border-amber-200' },
};

/* ── Tier config ── */
const TIER_CONFIG = [
  { tier: 'normal',    threshold: 0,      label: 'tierNormal',    bg: ['#f3f4f6', '#e5e7eb'] as [string, string] },
  { tier: 'rare',      threshold: 500,    label: 'tierRare',      bg: ['#edeaf2', '#ccc8d8'] as [string, string] },
  { tier: 'epic',      threshold: 5000,   label: 'tierEpic',      bg: ['#e8f2ff', '#c8ddf5'] as [string, string] },
  { tier: 'legendary', threshold: 50000,  label: 'tierLegendary', bg: ['#f3eae4', '#dfc8b4'] as [string, string] },
  { tier: 'mythic',    threshold: 100000, label: 'tierMythic',    bg: ['#1a1a2e', '#0f3460'] as [string, string] },
];

/* Per-tier feature descriptions */
const TIER_FEATURES: Record<string, { zh: string; en: string }[]> = {
  normal: [],
  rare: [
    { zh: '银紫渐变', en: 'Silver lavender gradient' },
  ],
  epic: [
    { zh: '3D 倾斜', en: '3D tilt effect' },
    { zh: '冰蓝渐变', en: 'Ice blue gradient' },
  ],
  legendary: [
    { zh: '3D 倾斜', en: '3D tilt effect' },
    { zh: '全息虹彩', en: 'Holographic layer' },
    { zh: '香槟渐层', en: 'Champagne gold gradient' },
  ],
  mythic: [
    { zh: '3D 倾斜', en: '3D tilt effect' },
    { zh: '暗金背景', en: 'Dark gold background' },
    { zh: '金色流光', en: 'Gold sweep shimmer' },
    { zh: '粒子飘浮', en: 'Gold luminous particles' },
  ],
};

/* ── Interactive tier card with mouse tracking ── */
function TierCard({ tier, threshold, label, bg, isZh, lang, features, onOpen }: {
  tier: string;
  threshold: number;
  label: string;
  bg: [string, string];
  isZh: boolean;
  lang: string;
  features: { zh: string; en: string }[];
  onOpen: () => void;
}) {
  const t = useT(lang);
  const ref = useRef<HTMLDivElement>(null);
  const hasMouseTracking = tier === 'epic' || tier === 'legendary' || tier === 'mythic';

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    if (!hasMouseTracking) return;
    const el = ref.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const x = (e.clientX - rect.left) / rect.width;
    const y = (e.clientY - rect.top) / rect.height;
    const rx = (y - 0.5) * 2;
    const ry = (x - 0.5) * 2;
    el.style.setProperty('--rx', String(rx));
    el.style.setProperty('--ry', String(ry));
    el.style.setProperty('--mx', `${x * 100}%`);
    el.style.setProperty('--my', `${y * 100}%`);
  }, [hasMouseTracking]);

  const handleMouseLeave = useCallback(() => {
    if (!hasMouseTracking) return;
    const el = ref.current;
    if (!el) return;
    el.style.setProperty('--rx', '0');
    el.style.setProperty('--ry', '0');
    el.style.setProperty('--mx', '50%');
    el.style.setProperty('--my', '50%');
  }, [hasMouseTracking]);

  const glowColor = tier === 'mythic'
    ? 'rgba(212,175,55,0.25)'
    : tier === 'legendary'
      ? 'rgba(255,128,0,0.25)'
      : tier === 'epic'
        ? 'rgba(0,112,221,0.25)'
        : tier === 'rare'
          ? 'rgba(140,120,180,0.25)'
          : 'rgba(0,112,221,0.25)';

  return (
    <div className="flex gap-5 items-start">
      {/* Card preview */}
      <div
        ref={ref}
        className={`holo-card card-tier-${tier} shrink-0`}
        onClick={onOpen}
        style={{
          width: 200,
          aspectRatio: '3 / 4',
          '--card-bg1': bg[0],
          '--card-bg2': bg[1],
          '--glow-color': glowColor,
        } as React.CSSProperties}
        onMouseMove={handleMouseMove}
        onMouseLeave={handleMouseLeave}
      >
        <div className="holo-card-inner">
          <div className="card-base" />
          <div className="holo-layer" />
          <div className="holo-lines" />
          <div className="holo-spot" />
          {tier === 'mythic' && <div className="gold-sweep" />}
          {tier === 'mythic' && (
            <div className="mythic-particles">
              <span /><span /><span /><span /><span /><span />
            </div>
          )}
          <div className="card-content h-full flex flex-col items-center justify-center p-3 text-center">
            <div className="text-[0.9rem] font-bold text-text-primary mb-1">
              {t(label as 'tierNormal') as string}
            </div>
            {threshold > 0 && (
              <div className="text-[0.62rem] text-text-faint">
                {`${threshold.toLocaleString()}+ ${isZh ? '次使用' : 'uses'}`}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Feature description (skip for normal tier) */}
      {tier !== 'normal' && (
        <div className="flex-1 pt-2">
          <div className="text-[0.92rem] font-bold text-text-primary mb-1">
            {t(label as 'tierNormal') as string}
          </div>
          <div className="text-[0.72rem] text-text-faint mb-3">
            {`${threshold.toLocaleString()}+ ${isZh ? '次使用解锁' : 'uses to unlock'}`}
          </div>
          <div className="space-y-1.5">
            {features.map((f, i) => (
              <div key={i} className="flex items-center gap-2 text-[0.78rem] text-text-dim">
                <span className="w-1.5 h-1.5 rounded-full bg-accent/40 shrink-0" />
                {isZh ? f.zh : f.en}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

/* ── Card flip modal ── */
function TierCardModal({ config, isZh, lang, onClose }: {
  config: typeof TIER_CONFIG[0];
  isZh: boolean;
  lang: string;
  onClose: () => void;
}) {
  const { tier, threshold, label, bg } = config;
  const features = TIER_FEATURES[tier];
  const t = useT(lang);
  const [flipped, setFlipped] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const hasMouseTracking = tier === 'epic' || tier === 'legendary' || tier === 'mythic';
  const isMythic = tier === 'mythic';

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    if (!hasMouseTracking) return;
    const container = containerRef.current;
    if (!container) return;
    const rect = container.getBoundingClientRect();
    const x = (e.clientX - rect.left) / rect.width;
    const y = (e.clientY - rect.top) / rect.height;
    const rx = (y - 0.5) * 2;
    const ry = (x - 0.5) * 2;
    container.style.transform = `rotateY(${ry * 12}deg) rotateX(${rx * -12}deg)`;
    container.querySelectorAll<HTMLElement>('.holo-card').forEach((el) => {
      el.style.setProperty('--rx', String(rx));
      el.style.setProperty('--ry', String(ry));
      el.style.setProperty('--mx', `${x * 100}%`);
      el.style.setProperty('--my', `${y * 100}%`);
    });
  }, [hasMouseTracking]);

  const resetEffects = useCallback((resetTilt: boolean) => {
    if (!hasMouseTracking) return;
    const container = containerRef.current;
    if (container) {
      if (resetTilt) container.style.transform = '';
      container.querySelectorAll<HTMLElement>('.holo-card').forEach((el) => {
        el.style.setProperty('--rx', '0');
        el.style.setProperty('--ry', '0');
        el.style.setProperty('--mx', '50%');
        el.style.setProperty('--my', '50%');
      });
    }
  }, [hasMouseTracking]);

  const handleMouseLeave = useCallback(() => resetEffects(true), [resetEffects]);
  const handleFlip = useCallback(() => { setFlipped(f => !f); resetEffects(true); }, [resetEffects]);

  const glowColor = tier === 'mythic'
    ? 'rgba(212,175,55,0.25)'
    : tier === 'legendary'
      ? 'rgba(255,128,0,0.25)'
      : tier === 'epic'
        ? 'rgba(0,112,221,0.25)'
        : tier === 'rare'
          ? 'rgba(140,120,180,0.25)'
          : 'rgba(0,112,221,0.25)';

  return (
    <div
      className="fixed inset-0 z-50 flex flex-col items-center justify-center card-expand-overlay"
      style={{ backgroundColor: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(8px)' }}
      onClick={onClose}
    >
      <div
        ref={containerRef}
        className="card-flip-container card-modal-pop"
        style={{ width: 340, aspectRatio: '3 / 4', transition: 'transform 0.15s ease-out' }}
        onClick={(e) => { e.stopPropagation(); handleFlip(); }}
        onMouseMove={handleMouseMove}
        onMouseLeave={handleMouseLeave}
      >
        <div className={`card-flip-inner ${flipped ? 'flipped' : ''}`}>
          {/* Front */}
          <div className="card-flip-face">
            <div
              className={`holo-card card-tier-${tier}`}
              style={{
                width: '100%',
                height: '100%',
                '--card-bg1': bg[0],
                '--card-bg2': bg[1],
                '--glow-color': glowColor,
              } as React.CSSProperties}
            >
              <div className="holo-card-inner" style={{ transform: 'none' }}>
                <div className="card-base" />
                <div className="holo-layer" />
                <div className="holo-lines" />
                <div className="holo-spot" />
                {isMythic && <div className="gold-sweep" />}
                {isMythic && (
                  <div className="mythic-particles">
                    <span /><span /><span /><span /><span /><span />
                  </div>
                )}
                <div className="card-content h-full flex flex-col items-center justify-center p-4 text-center">
                  <div className="text-xl font-bold text-text-primary mb-1">
                    {t(label as 'tierNormal') as string}
                  </div>
                  {threshold > 0 && (
                    <div className="text-xs text-text-faint">
                      {`${threshold.toLocaleString()}+ ${isZh ? '次使用' : 'uses'}`}
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Back */}
          <div className="card-flip-face card-flip-back">
            <div className={`holo-card card-tier-${tier}`} style={{ width: '100%', height: '100%' }}>
              <div className="holo-card-inner" style={{ transform: 'none' }}>
                <div className="card-base" />
                {tier === 'legendary' && <><div className="holo-layer" /><div className="holo-spot" /></>}
                {isMythic && (
                  <>
                    <div className="gold-sweep" />
                    <div className="mythic-particles"><span /><span /><span /><span /><span /><span /></div>
                  </>
                )}
                <div className="card-content h-full flex flex-col items-center justify-center p-6 text-center">
                  <div className={`text-xl font-bold mb-1 ${isMythic ? 'text-amber-200' : 'text-text-primary'}`}>
                    {t(label as 'tierNormal') as string}
                  </div>
                  {threshold > 0 && (
                    <div className={`text-xs mb-5 ${isMythic ? 'text-amber-200/60' : 'text-text-faint'}`}>
                      {`${threshold.toLocaleString()}+ ${isZh ? '次使用解锁' : 'uses to unlock'}`}
                    </div>
                  )}
                  <div className={`w-12 h-px mb-5 ${isMythic ? 'bg-amber-400/30' : 'bg-black/10'}`} />
                  <div className="space-y-2.5">
                    {features.map((f, i) => (
                      <div key={i} className={`flex items-center gap-2.5 text-sm ${isMythic ? 'text-amber-100/80' : 'text-text-dim'}`}>
                        <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${isMythic ? 'bg-amber-400/50' : 'bg-accent/40'}`} />
                        {isZh ? f.zh : f.en}
                      </div>
                    ))}
                  </div>
                  <div className={`mt-6 text-[0.62rem] ${isMythic ? 'text-amber-200/30' : 'text-text-faint/50'}`}>
                    {isZh ? '点击翻回正面' : 'Click to flip back'}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="mt-4 text-white/40 text-xs">
        {isZh ? '点击卡片翻转 · 点击空白处关闭' : 'Click card to flip · Click outside to close'}
      </div>
    </div>
  );
}

/* ── Announcement form modal (admin only) ── */
function AnnouncementFormModal({ ann, lang, onSave, onClose }: {
  ann: ApiAnnouncement | null;
  lang: string;
  onSave: (data: ApiAnnouncement) => Promise<void>;
  onClose: () => void;
}) {
  const t = useT(lang);
  const isEdit = !!ann;
  const [form, setForm] = useState<ApiAnnouncement>(() =>
    ann ?? {
      id: `ann-${Date.now()}`,
      date: new Date().toISOString().split('T')[0],
      type: 'feature',
      title_zh: '',
      title_en: '',
      body_zh: '',
      body_en: '',
      sort_order: 0,
    }
  );
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const handleSubmit = async () => {
    if (!form.title_zh.trim() && !form.title_en.trim()) return;
    setSaving(true);
    try {
      await onSave(form);
      onClose();
    } catch {
      /* handled by parent */
    } finally {
      setSaving(false);
    }
  };

  const set = (key: keyof ApiAnnouncement, val: string | number) =>
    setForm(prev => ({ ...prev, [key]: val }));

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden"
        onClick={e => e.stopPropagation()}
      >
        <div className="px-6 pt-5 pb-3 border-b border-border flex items-center justify-between">
          <h3 className="text-lg font-bold text-text-primary">
            {isEdit ? t('annEditAnnouncement') as string : t('annNewAnnouncement') as string}
          </h3>
          <button onClick={onClose} className="text-text-faint hover:text-text-primary text-xl leading-none p-1">
            ×
          </button>
        </div>

        <div className="px-6 py-4 space-y-3 max-h-[70vh] overflow-y-auto">
          {/* Date + Type row */}
          <div className="flex gap-3">
            <div className="flex-1">
              <label className="text-[0.75rem] text-text-dim mb-1 block">{t('annDate') as string}</label>
              <input
                type="date"
                value={form.date}
                onChange={e => set('date', e.target.value)}
                className="w-full px-3 py-2 text-[0.84rem] border border-border rounded-lg focus:border-accent focus:ring-2 focus:ring-accent/25 outline-none"
              />
            </div>
            <div className="flex-1">
              <label className="text-[0.75rem] text-text-dim mb-1 block">{t('annType') as string}</label>
              <select
                value={form.type}
                onChange={e => set('type', e.target.value)}
                className="w-full px-3 py-2 text-[0.84rem] border border-border rounded-lg focus:border-accent focus:ring-2 focus:ring-accent/25 outline-none bg-white"
              >
                <option value="feature">{t('annFeature') as string}</option>
                <option value="improvement">{t('annImprovement') as string}</option>
                <option value="fix">{t('annFix') as string}</option>
              </select>
            </div>
            <div className="w-20">
              <label className="text-[0.75rem] text-text-dim mb-1 block">{t('annSortOrder') as string}</label>
              <input
                type="number"
                value={form.sort_order}
                onChange={e => set('sort_order', parseInt(e.target.value) || 0)}
                className="w-full px-3 py-2 text-[0.84rem] border border-border rounded-lg focus:border-accent focus:ring-2 focus:ring-accent/25 outline-none"
              />
            </div>
          </div>

          {/* Title zh */}
          <div>
            <label className="text-[0.75rem] text-text-dim mb-1 block">{t('annTitleZh') as string}</label>
            <input
              type="text"
              value={form.title_zh}
              onChange={e => set('title_zh', e.target.value)}
              className="w-full px-3 py-2 text-[0.84rem] border border-border rounded-lg focus:border-accent focus:ring-2 focus:ring-accent/25 outline-none"
            />
          </div>

          {/* Title en */}
          <div>
            <label className="text-[0.75rem] text-text-dim mb-1 block">{t('annTitleEn') as string}</label>
            <input
              type="text"
              value={form.title_en}
              onChange={e => set('title_en', e.target.value)}
              className="w-full px-3 py-2 text-[0.84rem] border border-border rounded-lg focus:border-accent focus:ring-2 focus:ring-accent/25 outline-none"
            />
          </div>

          {/* Body zh */}
          <div>
            <label className="text-[0.75rem] text-text-dim mb-1 block">{t('annBodyZh') as string}</label>
            <textarea
              value={form.body_zh}
              onChange={e => set('body_zh', e.target.value)}
              rows={3}
              className="w-full px-3 py-2 text-[0.84rem] border border-border rounded-lg focus:border-accent focus:ring-2 focus:ring-accent/25 outline-none resize-none"
            />
          </div>

          {/* Body en */}
          <div>
            <label className="text-[0.75rem] text-text-dim mb-1 block">{t('annBodyEn') as string}</label>
            <textarea
              value={form.body_en}
              onChange={e => set('body_en', e.target.value)}
              rows={3}
              className="w-full px-3 py-2 text-[0.84rem] border border-border rounded-lg focus:border-accent focus:ring-2 focus:ring-accent/25 outline-none resize-none"
            />
          </div>

          {/* ID (read-only for edit) */}
          {!isEdit && (
            <div>
              <label className="text-[0.75rem] text-text-dim mb-1 block">ID</label>
              <input
                type="text"
                value={form.id}
                onChange={e => set('id', e.target.value)}
                className="w-full px-3 py-2 text-[0.84rem] border border-border rounded-lg focus:border-accent focus:ring-2 focus:ring-accent/25 outline-none font-mono"
              />
            </div>
          )}
        </div>

        <div className="px-6 py-4 border-t border-border flex justify-end gap-2">
          <button
            onClick={onClose}
            className="px-4 py-2 text-[0.84rem] border border-border rounded-lg text-text-dim hover:bg-surface-2 transition-colors"
          >
            {t('cancel') as string}
          </button>
          <button
            onClick={handleSubmit}
            disabled={saving || (!form.title_zh.trim() && !form.title_en.trim())}
            className="px-5 py-2 text-[0.84rem] bg-gradient-to-r from-blue-500 to-cyan-500 hover:from-blue-600 hover:to-cyan-600 disabled:opacity-40 text-white font-semibold rounded-lg transition-all shadow-md"
          >
            {saving
              ? (t('saving') as string)
              : isEdit
                ? (t('annUpdate') as string)
                : (t('annPublish') as string)}
          </button>
        </div>
      </div>
    </div>
  );
}

/* ── Main Page ── */
export default function Announcements() {
  const lang = useConfig(s => s.language);
  const isZh = lang === 'zh' || lang === 'zh-Hant';
  const t = useT(lang);
  const { isAdmin, token } = useAuth();

  const [activeTier, setActiveTier] = useState<string | null>(null);
  const activeConfig = activeTier ? TIER_CONFIG.find(c => c.tier === activeTier) : null;

  // Announcement state
  const [announcements, setAnnouncements] = useState<ApiAnnouncement[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingAnn, setEditingAnn] = useState<ApiAnnouncement | null | 'new'>(null);

  useEffect(() => {
    setLoading(true);
    getAnnouncements()
      .then(setAnnouncements)
      .catch(() => setAnnouncements([]))
      .finally(() => setLoading(false));
  }, []);

  const handleSave = async (data: ApiAnnouncement) => {
    const existing = announcements.find(a => a.id === data.id);
    if (existing) {
      await updateAnnouncement(data.id, data);
    } else {
      await createAnnouncement(data);
    }
    const fresh = await getAnnouncements();
    setAnnouncements(fresh);
  };

  const handleDelete = async (annId: string) => {
    if (!confirm(t('annDeleteConfirm') as string)) return;
    await deleteAnnouncement(annId);
    setAnnouncements(prev => prev.filter(a => a.id !== annId));
  };

  return (
    <div>
      {/* Header */}
      <div className="mb-8 pb-4 border-b border-border">
        <div className="flex items-center gap-3.5 mb-1.5">
          <h1 className="text-[1.75rem] font-light tracking-wide" style={{ fontFamily: "'Noto Serif SC', 'Inter', serif" }}>
            {t('announcements') as string}
          </h1>
          <span className="bg-gradient-to-r from-blue-50 to-cyan-50 text-cyan-600 font-mono text-[0.62rem] tracking-widest px-3 py-1 rounded-full font-semibold border border-cyan-200">
            LATEST
          </span>
        </div>
        <p className="text-text-dim text-[0.88rem]">{t('announcementsDesc') as string}</p>
      </div>

      {/* Announcement feed */}
      <div className="mb-10">
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-[0.92rem] font-semibold text-text-primary">
            {t('annWhatsNew') as string}
          </h2>
          {isAdmin && token && (
            <button
              onClick={() => setEditingAnn('new')}
              className="flex items-center gap-1.5 px-3 py-1.5 text-[0.78rem] font-semibold text-white bg-gradient-to-r from-blue-500 to-cyan-500 hover:from-blue-600 hover:to-cyan-600 rounded-lg transition-all shadow-sm"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <line x1="12" y1="5" x2="12" y2="19" />
                <line x1="5" y1="12" x2="19" y2="12" />
              </svg>
              {t('annNewAnnouncement') as string}
            </button>
          )}
        </div>

        {loading ? (
          <div className="text-center py-8 text-text-faint text-[0.84rem]">{t('loading') as string}</div>
        ) : announcements.length === 0 ? (
          <div className="text-center py-8 text-text-faint text-[0.84rem]">{t('annNoAnnouncements') as string}</div>
        ) : (
          <div>
            {announcements.map((ann, i) => {
              const style = TYPE_STYLE[ann.type as AnnouncementType] || TYPE_STYLE.feature;
              return (
                <div key={ann.id} className="flex gap-4">
                  {/* Timeline spine */}
                  <div className="flex flex-col items-center pt-1 shrink-0">
                    <div className="w-2.5 h-2.5 rounded-full bg-accent ring-4 ring-accent/10 shrink-0" />
                    {i < announcements.length - 1 && (
                      <div className="w-px flex-1 bg-border mt-1.5 mb-0" />
                    )}
                  </div>
                  {/* Content */}
                  <div className="pb-7 flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1.5 flex-wrap">
                      <span className={`text-[0.65rem] font-semibold px-2 py-0.5 rounded-full border ${style.cls}`}>
                        {isZh ? style.label : style.labelEn}
                      </span>
                      <span className="text-[0.72rem] text-text-faint">{ann.date}</span>
                      {/* Admin actions */}
                      {isAdmin && token && (
                        <span className="flex items-center gap-1 ml-auto">
                          <button
                            onClick={() => setEditingAnn(ann)}
                            className="text-text-faint hover:text-accent transition-colors p-0.5"
                            title={t('edit') as string}
                          >
                            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                              <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                              <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
                            </svg>
                          </button>
                          <button
                            onClick={() => handleDelete(ann.id)}
                            className="text-text-faint hover:text-error transition-colors p-0.5"
                            title={t('delete') as string}
                          >
                            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                              <polyline points="3 6 5 6 21 6" />
                              <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                            </svg>
                          </button>
                        </span>
                      )}
                    </div>
                    <div className="text-[0.92rem] font-semibold text-text-primary mb-1">
                      {isZh ? ann.title_zh : ann.title_en}
                    </div>
                    <p className="text-[0.82rem] text-text-dim leading-relaxed">
                      {isZh ? ann.body_zh : ann.body_en}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Card Tier System */}
      <div className="mb-10">
        <div className="flex items-center gap-2.5 mb-2">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-accent">
            <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
          </svg>
          <h2 className="text-[1.1rem] font-semibold text-text-primary">{t('tierShowcaseTitle') as string}</h2>
        </div>
        <p className="text-[0.82rem] text-text-dim mb-6 ml-[30px]">{t('tierShowcaseDesc') as string}</p>

        <div className="space-y-6 ml-[30px]">
          {TIER_CONFIG.map(({ tier, threshold, label, bg }) => (
            <div key={tier}>
              <TierCard
                tier={tier}
                threshold={threshold}
                label={label}
                bg={bg}
                isZh={isZh}
                lang={lang}
                features={TIER_FEATURES[tier]}
                onOpen={() => setActiveTier(tier)}
              />
              {tier !== 'mythic' && (
                <div className="flex items-center gap-2 ml-[96px] mt-4 mb-2">
                  <div className="w-[2px] h-5 bg-border" />
                  <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="text-text-faint">
                    <polyline points="6 9 12 15 18 9" />
                  </svg>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Card preview modal */}
      {activeConfig && (
        <TierCardModal
          config={activeConfig}
          isZh={isZh}
          lang={lang}
          onClose={() => setActiveTier(null)}
        />
      )}

      {/* Announcement form modal */}
      {editingAnn !== null && (
        <AnnouncementFormModal
          ann={editingAnn === 'new' ? null : editingAnn}
          lang={lang}
          onSave={handleSave}
          onClose={() => setEditingAnn(null)}
        />
      )}
    </div>
  );
}
