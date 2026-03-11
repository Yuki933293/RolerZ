import { useCallback, useRef } from 'react';
import { useConfig } from '../stores/useConfig';
import { useT } from '../i18n';

/* ── Announcement feed data ── */
type AnnouncementType = 'feature' | 'improvement' | 'fix';

interface Announcement {
  id: string;
  date: string;
  type: AnnouncementType;
  titleZh: string;
  titleEn: string;
  bodyZh: string;
  bodyEn: string;
}

const ANNOUNCEMENTS: Announcement[] = [
  {
    id: 'ann-2026-03-c',
    date: '2026-03-11',
    type: 'feature',
    titleZh: '候选卡片新增收藏功能',
    titleEn: 'Candidate Card Favorites',
    bodyZh: '在生成的候选角色卡片上，点击星标按钮即可将其收藏，收藏后卡片将高亮显示金色边框，方便对比与筛选。',
    bodyEn: 'Click the star button on any generated candidate card to mark it as a favorite. Favorited cards are highlighted with a gold border for easy comparison.',
  },
  {
    id: 'ann-2026-03-b',
    date: '2026-03-11',
    type: 'improvement',
    titleZh: '引导向导可选维度支持跳过',
    titleEn: 'Guided Wizard — Skip Optional Fields',
    bodyZh: '引导式构建中，"目标"和"内心冲突"两个维度现在支持跳过。当前问题为可选项时，输入框旁会出现"跳过"按钮。',
    bodyEn: 'In Guided Build, the "Goals" and "Conflicts" dimensions can now be skipped. A "Skip" button appears next to the input when the current question is optional.',
  },
  {
    id: 'ann-2026-03-a',
    date: '2026-03-11',
    type: 'feature',
    titleZh: '帮助页新增故障排查 FAQ',
    titleEn: 'Help Page — Troubleshooting FAQ',
    bodyZh: '帮助页面新增 4 条常见故障排查：401 API Key 错误、请求超时、429 频率限制、生成内容残缺，每条均附有具体解决步骤。',
    bodyEn: 'Added 4 troubleshooting FAQ items to the Help page: 401 API key errors, request timeouts, 429 rate limits, and incomplete generation output — each with step-by-step solutions.',
  },
  {
    id: 'ann-2026-02-b',
    date: '2026-02-28',
    type: 'feature',
    titleZh: '灵感卡分类扩展至 11 类',
    titleEn: 'Inspiration Cards Expanded to 11 Categories',
    bodyZh: '灵感卡由原来的 8 类扩展为 11 类，新增「外貌」「场景」「癖好」三个维度，涵盖更多角色塑造角度。卡片总数也随之增加至 50 张。',
    bodyEn: 'Inspiration cards have been expanded from 8 to 11 categories, adding Appearance, Scenario, and Quirk dimensions. The total card count has grown to 50.',
  },
  {
    id: 'ann-2026-02-a',
    date: '2026-02-20',
    type: 'feature',
    titleZh: '深色模式上线',
    titleEn: 'Dark Mode Released',
    bodyZh: '支持浅色/深色主题切换，设置入口在右上角用户菜单中，偏好会自动保存。',
    bodyEn: 'Light and dark theme switching is now available. Toggle in the top-right user menu — your preference is saved automatically.',
  },
  {
    id: 'ann-2026-01-a',
    date: '2026-01-15',
    type: 'improvement',
    titleZh: '模型供应商配置全面优化',
    titleEn: 'Model Provider Config Improvements',
    bodyZh: '支持多 API Key 轮换、查看和管理已配置的供应商列表、一键切换供应商，配置项同步至服务器，登录后自动恢复。',
    bodyEn: 'Multiple API key rotation, a "My Configs" panel to view and manage all configured providers, one-click provider switching, and server-synced config restoration after login.',
  },
];

const TYPE_STYLE: Record<AnnouncementType, { label: string; labelEn: string; cls: string }> = {
  feature:     { label: '新功能', labelEn: 'Feature',     cls: 'bg-blue-50 text-blue-600 border-blue-200' },
  improvement: { label: '改进',   labelEn: 'Improvement', cls: 'bg-emerald-50 text-emerald-600 border-emerald-200' },
  fix:         { label: '修复',   labelEn: 'Fix',         cls: 'bg-amber-50 text-amber-600 border-amber-200' },
};

/* ── Tier config ── */
const TIER_CONFIG = [
  { tier: 'normal',    threshold: 0,      label: 'tierNormal',    bg: ['#f5f6f8', '#f5f6f8'] as [string, string] },
  { tier: 'rare',      threshold: 500,    label: 'tierRare',      bg: ['#eef4ff', '#dce6f9'] as [string, string] },
  { tier: 'epic',      threshold: 5000,   label: 'tierEpic',      bg: ['#eef4ff', '#dce6f9'] as [string, string] },
  { tier: 'legendary', threshold: 50000,  label: 'tierLegendary', bg: ['#fef9ef', '#eedbb0'] as [string, string] },
  { tier: 'mythic',    threshold: 100000, label: 'tierMythic',    bg: ['#fef9ef', '#eedbb0'] as [string, string] },
];

/* Per-tier feature descriptions */
const TIER_FEATURES: Record<string, { zh: string; en: string }[]> = {
  normal: [
    { zh: '静态卡片', en: 'Static card' },
    { zh: '纯色背景', en: 'Flat background' },
  ],
  rare: [
    { zh: '静态卡片', en: 'Static card' },
    { zh: '银色边框光晕', en: 'Silver border glow' },
  ],
  epic: [
    { zh: '3D 倾斜效果', en: '3D tilt effect' },
    { zh: '银色边框光晕', en: 'Silver border glow' },
  ],
  legendary: [
    { zh: '3D 倾斜效果', en: '3D tilt effect' },
    { zh: '全息虹彩层', en: 'Holographic layer' },
    { zh: '金色渐变背景', en: 'Gold gradient' },
  ],
  mythic: [
    { zh: '3D 倾斜效果', en: '3D tilt effect' },
    { zh: '全息虹彩层', en: 'Holographic layer' },
    { zh: '金色渐变背景', en: 'Gold gradient' },
    { zh: '金光扫过动画', en: 'Gold sweep shimmer' },
    { zh: '彩虹流动边框', en: 'Rainbow border' },
    { zh: '金色粒子飘浮', en: 'Gold particles' },
  ],
};

/* ── Interactive tier card with mouse tracking ── */
function TierCard({ tier, threshold, label, bg, isZh, lang, features }: {
  tier: string;
  threshold: number;
  label: string;
  bg: [string, string];
  isZh: boolean;
  lang: string;
  features: { zh: string; en: string }[];
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

  const glowColor = tier === 'legendary' || tier === 'mythic'
    ? 'rgba(212,175,55,0.25)'
    : 'rgba(160,180,230,0.25)';

  return (
    <div className="flex gap-5 items-start">
      {/* Card preview */}
      <div
        ref={ref}
        className={`holo-card card-tier-${tier} shrink-0`}
        style={{
          width: 160,
          aspectRatio: '3 / 4',
          '--card-bg1': bg[0],
          '--card-bg2': bg[1],
          '--glow-color': glowColor,
        } as React.CSSProperties}
        onMouseMove={handleMouseMove}
        onMouseLeave={handleMouseLeave}
      >
        {tier === 'mythic' && <div className="mythic-rainbow" />}
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
            <div className="text-[0.62rem] text-text-faint">
              {threshold === 0
                ? (isZh ? '默认' : 'Default')
                : `${threshold.toLocaleString()}+ ${isZh ? '次使用' : 'uses'}`
              }
            </div>
          </div>
        </div>
      </div>

      {/* Feature description */}
      <div className="flex-1 pt-2">
        <div className="text-[0.92rem] font-bold text-text-primary mb-1">
          {t(label as 'tierNormal') as string}
        </div>
        <div className="text-[0.72rem] text-text-faint mb-3">
          {threshold === 0
            ? (isZh ? '默认等级' : 'Default tier')
            : `${threshold.toLocaleString()}+ ${isZh ? '次使用解锁' : 'uses to unlock'}`
          }
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
    </div>
  );
}

/* ── Main Page ── */
export default function Announcements() {
  const lang = useConfig(s => s.language);
  const isZh = lang === 'zh' || lang === 'zh-Hant';
  const t = useT(lang);

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
        <h2 className="text-[0.92rem] font-semibold text-text-primary mb-5">
          {isZh ? '最新动态' : "What's New"}
        </h2>
        <div>
          {ANNOUNCEMENTS.map((ann, i) => {
            const style = TYPE_STYLE[ann.type];
            return (
              <div key={ann.id} className="flex gap-4">
                {/* Timeline spine */}
                <div className="flex flex-col items-center pt-1 shrink-0">
                  <div className="w-2.5 h-2.5 rounded-full bg-accent ring-4 ring-accent/10 shrink-0" />
                  {i < ANNOUNCEMENTS.length - 1 && (
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
                  </div>
                  <div className="text-[0.92rem] font-semibold text-text-primary mb-1">
                    {isZh ? ann.titleZh : ann.titleEn}
                  </div>
                  <p className="text-[0.82rem] text-text-dim leading-relaxed">
                    {isZh ? ann.bodyZh : ann.bodyEn}
                  </p>
                </div>
              </div>
            );
          })}
        </div>
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
              />
              {tier !== 'mythic' && (
                <div className="flex items-center gap-2 ml-[76px] mt-4 mb-2">
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
    </div>
  );
}
