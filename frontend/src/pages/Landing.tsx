import { useConfig } from '../stores/useConfig';
import { useT, type TranslationKey } from '../i18n';

interface LandingProps {
  onOpenAuth: () => void;
}

export default function Landing({ onOpenAuth }: LandingProps) {
  const lang = useConfig(s => s.language);
  const t = useT(lang);
  const isZh = lang === 'zh' || lang === 'zh-Hant';

  return (
    <div className="min-h-[calc(100vh-48px)] flex flex-col">
      {/* ── Hero ── */}
      <section className="relative overflow-hidden pt-20 pb-24 px-6">
        {/* Background decoration */}
        <div className="absolute inset-0 -z-10">
          <div className="absolute top-[-20%] left-[-10%] w-[600px] h-[600px] rounded-full bg-accent/[0.06] blur-3xl" />
          <div className="absolute bottom-[-10%] right-[-5%] w-[500px] h-[500px] rounded-full bg-blue-400/[0.05] blur-3xl" />
        </div>

        <div className="max-w-3xl mx-auto text-center">
          {/* Badge */}
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-accent/8 border border-accent/15 mb-8">
            <span className="w-1.5 h-1.5 rounded-full bg-accent animate-pulse" />
            <span className="text-[0.74rem] font-medium text-accent">
              {t('landingBadge') as string}
            </span>
          </div>

          {/* Headline */}
          <h1 className="text-4xl sm:text-5xl font-extrabold text-text-primary leading-tight tracking-tight mb-5">
            {isZh ? (
              <>
                用 AI 锻造
                <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-500 to-cyan-500"> 有灵魂的角色</span>
              </>
            ) : (
              <>
                Forge Characters
                <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-500 to-cyan-500"> with Soul</span>
              </>
            )}
          </h1>

          {/* Subheadline */}
          <p className="text-lg text-text-dim leading-relaxed max-w-xl mx-auto mb-10">
            {t('landingSubheadline') as string}
          </p>

          {/* CTA */}
          <div className="flex items-center justify-center gap-4">
            <button
              onClick={onOpenAuth}
              className="px-7 py-3 bg-gradient-to-r from-blue-500 to-cyan-500 hover:from-blue-600 hover:to-cyan-600 text-white text-[0.92rem] font-semibold rounded-xl shadow-lg shadow-accent/25 transition-all hover:shadow-xl hover:shadow-accent/30 hover:-translate-y-0.5"
            >
              {t('landingCta') as string}
            </button>
            <a
              href="#features"
              className="px-6 py-3 border border-border rounded-xl text-[0.92rem] font-medium text-text-dim hover:bg-surface-2 transition-colors"
            >
              {t('landingLearnMore') as string}
            </a>
          </div>
        </div>
      </section>

      {/* ── Features ── */}
      <section id="features" className="py-20 px-6 bg-surface-2/50">
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-14">
            <h2 className="text-2xl sm:text-3xl font-bold text-text-primary mb-3">
              {t('landingFeaturesTitle') as string}
            </h2>
            <p className="text-text-dim text-[0.92rem] max-w-lg mx-auto">
              {t('landingFeaturesSubtitle') as string}
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
            {FEATURES(t).map((feat, i) => (
              <div
                key={i}
                className="group p-6 rounded-2xl bg-white border border-border hover:border-accent/30 hover:shadow-lg hover:shadow-accent/5 transition-all duration-300"
              >
                <div className={`w-11 h-11 rounded-xl ${feat.bgClass} flex items-center justify-center mb-4 group-hover:scale-110 transition-transform`}>
                  {feat.icon}
                </div>
                <h3 className="text-[1rem] font-semibold text-text-primary mb-2">{feat.title}</h3>
                <p className="text-[0.84rem] text-text-dim leading-relaxed">{feat.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── How it works ── */}
      <section className="py-20 px-6">
        <div className="max-w-4xl mx-auto">
          <div className="text-center mb-14">
            <h2 className="text-2xl sm:text-3xl font-bold text-text-primary mb-3">
              {t('landingHowTitle') as string}
            </h2>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-8">
            {STEPS(t).map((step, i) => (
              <div key={i} className="text-center">
                <div className="w-12 h-12 rounded-full bg-accent/10 text-accent text-lg font-bold flex items-center justify-center mx-auto mb-4">
                  {i + 1}
                </div>
                <h3 className="text-[0.95rem] font-semibold text-text-primary mb-2">{step.title}</h3>
                <p className="text-[0.82rem] text-text-dim leading-relaxed">{step.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Bottom CTA ── */}
      <section className="py-16 px-6">
        <div className="max-w-2xl mx-auto text-center">
          <div className="p-10 rounded-3xl bg-gradient-to-br from-accent/5 to-blue-400/5 border border-accent/10">
            <h2 className="text-2xl font-bold text-text-primary mb-3">
              {t('landingBottomTitle') as string}
            </h2>
            <p className="text-text-dim text-[0.88rem] mb-7 max-w-md mx-auto">
              {t('landingBottomDesc') as string}
            </p>
            <button
              onClick={onOpenAuth}
              className="px-8 py-3 bg-gradient-to-r from-blue-500 to-cyan-500 hover:from-blue-600 hover:to-cyan-600 text-white text-[0.92rem] font-semibold rounded-xl shadow-lg shadow-accent/25 transition-all hover:shadow-xl hover:-translate-y-0.5"
            >
              {t('landingCtaBottom') as string}
            </button>
          </div>
        </div>
      </section>

      {/* ── Footer ── */}
      <footer className="py-8 px-6 border-t border-border mt-auto">
        <div className="max-w-5xl mx-auto flex items-center justify-between text-[0.72rem] text-text-faint">
          <span>{isZh ? '角色锻造台 · Persona Forge' : 'Persona Forge · Character Creation Engine'}</span>
          <a
            href="https://github.com/Yuki933293/RolerZ"
            target="_blank"
            rel="noopener noreferrer"
            className="hover:text-text-dim transition-colors"
          >
            GitHub
          </a>
        </div>
      </footer>
    </div>
  );
}

/* ── Feature cards data ── */
function FEATURES(t: (k: TranslationKey) => unknown) {
  return [
    {
      icon: (
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className="text-blue-500">
          <path d="M12 2a5 5 0 1 0 0 10 5 5 0 0 0 0-10z" />
          <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
          <path d="M16 3l1 2.5L19.5 7l-2.5 1L16 10.5 14.5 8 12 7l2.5-1z" />
        </svg>
      ),
      bgClass: 'bg-blue-50',
      title: t('landingFeat1Title') as string,
      desc: t('landingFeat1Desc') as string,
    },
    {
      icon: (
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className="text-purple-500">
          <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83" />
        </svg>
      ),
      bgClass: 'bg-purple-50',
      title: t('landingFeat2Title') as string,
      desc: t('landingFeat2Desc') as string,
    },
    {
      icon: (
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className="text-emerald-500">
          <circle cx="12" cy="12" r="10" />
          <polygon points="16.24 7.76 14.12 14.12 7.76 16.24 9.88 9.88 16.24 7.76" />
        </svg>
      ),
      bgClass: 'bg-emerald-50',
      title: t('landingFeat3Title') as string,
      desc: t('landingFeat3Desc') as string,
    },
    {
      icon: (
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className="text-orange-500">
          <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z" />
          <polyline points="3.27 6.96 12 12.01 20.73 6.96" />
          <line x1="12" y1="22.08" x2="12" y2="12" />
        </svg>
      ),
      bgClass: 'bg-orange-50',
      title: t('landingFeat4Title') as string,
      desc: t('landingFeat4Desc') as string,
    },
  ];
}

/* ── Steps data ── */
function STEPS(t: (k: TranslationKey) => unknown) {
  return [
    { title: t('landingStep1Title') as string, desc: t('landingStep1Desc') as string },
    { title: t('landingStep2Title') as string, desc: t('landingStep2Desc') as string },
    { title: t('landingStep3Title') as string, desc: t('landingStep3Desc') as string },
  ];
}
