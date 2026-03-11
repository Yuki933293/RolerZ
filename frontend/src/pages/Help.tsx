import { useState } from 'react';
import { useConfig } from '../stores/useConfig';
import { useT } from '../i18n';

interface FaqItem {
  q: string;
  a: string;
}

export default function Help() {
  const lang = useConfig(s => s.language);
  const t = useT(lang);
  const isZh = lang === 'zh' || lang === 'zh-Hant';
  const [openFaq, setOpenFaq] = useState<number | null>(null);

  const steps = [
    {
      icon: (
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
          <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z" />
          <polyline points="3.27 6.96 12 12.01 20.73 6.96" />
          <line x1="12" y1="22.08" x2="12" y2="12" />
        </svg>
      ),
      title: t('helpStep1Title') as string,
      desc: t('helpStep1Desc') as string,
    },
    {
      icon: (
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
          <path d="M12 2a5 5 0 1 0 0 10 5 5 0 0 0 0-10z" />
          <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
          <path d="M16 3l1 2.5L19.5 7l-2.5 1L16 10.5 14.5 8 12 7l2.5-1z" />
        </svg>
      ),
      title: t('helpStep2Title') as string,
      desc: t('helpStep2Desc') as string,
    },
    {
      icon: (
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
          <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
          <line x1="3" y1="9" x2="21" y2="9" />
          <line x1="9" y1="21" x2="9" y2="9" />
        </svg>
      ),
      title: t('helpStep3Title') as string,
      desc: t('helpStep3Desc') as string,
    },
  ];

  const faqs: FaqItem[] = isZh ? [
    { q: '支持哪些 AI 模型？', a: '目前支持 Claude (Anthropic)、OpenAI (GPT)、DeepSeek，以及任何 OpenAI 兼容接口的自定义模型。' },
    { q: '什么是灵感卡？', a: '灵感卡是预设的角色特质模板，涵盖性格、表达方式、情感模式、外貌风格、场景设定、独特习惯等 11 个维度。选择灵感卡可以引导 AI 生成更符合你期望的角色。登录后还可以编辑和自定义灵感卡内容。' },
    { q: '自由创作和引导式构建有什么区别？', a: '自由创作：输入角色概念 + 选择灵感卡，一键生成角色卡。适合有明确想法的用户。\n引导式构建：AI 会逐步提问，帮你完善外貌、背景、性格等维度，适合从零开始构思角色。' },
    { q: '生成的角色卡包含什么？', a: '每张角色卡包含：角色名、性格特征、背景故事、外貌描述、说话方式、开场白、内心冲突等维度，以及一段自然语言的角色描述文本。支持一键复制文本或 JSON 格式。' },
    { q: '我的数据安全吗？', a: '你的 API 密钥和生成历史都保存在你部署的服务器上，不会发送到第三方。密码使用 PBKDF2 加盐哈希存储。' },
    { q: '候选数量有什么作用？', a: '候选数量决定每次生成几个不同的角色方案（最多 10 个）。多个候选可以让你比较不同的角色诠释，选择最满意的一个。' },
    { q: '自定义供应商无法获取模型列表？', a: '部分中转站或自定义 API 接口不对外开放模型列表查询接口（/v1/models），这属于正常情况。\n\n解决方法：直接在「模型名称」输入框中手动填写模型名称（例如 gpt-4o、claude-sonnet-4-20250514），然后点击「保存配置」即可正常使用，无需获取模型列表。' },
    { q: '生成时提示 401 / API Key 无效，怎么处理？', a: '401 错误表示 API 密钥验证失败，请按以下步骤排查：\n\n1. 检查密钥是否完整复制（首尾无空格）\n2. 确认密钥与所选供应商匹配（例如 Anthropic 密钥不能用于 OpenAI）\n3. 确认该密钥尚未过期或被吊销\n4. 如使用中转站，检查中转站是否更换了接口地址或密钥格式\n\n修改后在「模型设置」页重新填写并保存配置即可。' },
    { q: '请求超时或长时间无响应，怎么处理？', a: '超时通常由以下原因引起：\n\n• 候选数量设置过高：减少候选数量（建议 1–3 个）可显著缩短响应时间\n• 网络连接不稳定：检查本地网络或使用代理\n• 模型服务繁忙：稍后重试，或切换到响应更快的模型（如 GPT-4o Mini、DeepSeek Chat）\n• Base URL 配置错误：确认接口地址末尾是否需要 /v1' },
    { q: '出现 429 Too Many Requests，如何解决？', a: '429 表示触发了供应商的请求频率限制（Rate Limit）：\n\n• 等待片刻（通常 10–60 秒）后重试\n• 减少候选数量，降低单次请求的 token 消耗\n• 如果频繁出现，考虑升级供应商的套餐或切换到有更高限额的账号\n• OpenAI 免费层 / 新账号的 Rate Limit 较低，建议使用付费账号' },
    { q: '生成结果为空或内容残缺，怎么处理？', a: '内容残缺通常是 max_tokens 不足或 LLM 输出格式异常导致的：\n\n• 尝试减少候选数量，给每个角色留出更多 token 空间\n• 切换到上下文窗口更大的模型（如 claude-haiku-4-5、gpt-4o）\n• 如果反复出现，可在 GitHub 提交 issue 并附上报错信息，帮助我们排查' },
  ] : [
    { q: 'Which AI models are supported?', a: 'Currently supports Claude (Anthropic), OpenAI (GPT), DeepSeek, and any custom model with an OpenAI-compatible API.' },
    { q: 'What are Inspiration Cards?', a: 'Inspiration cards are preset character trait templates covering 11 dimensions: personality, expression, emotion, relationship, background, behavior, motivation, conflict, appearance, scenario, and quirk. Selecting them guides the AI to generate characters matching your expectations. Logged-in users can also edit and customize card content.' },
    { q: 'What\'s the difference between Free Create and Guided Build?', a: 'Free Create: Enter a concept + select inspiration cards, generate in one click. Great for users with clear ideas.\nGuided Build: AI asks step-by-step questions about appearance, background, personality, etc. Ideal for building characters from scratch.' },
    { q: 'What does a generated character card include?', a: 'Each card includes: name, personality, background story, appearance, speech style, opening line, inner conflicts, and a natural language description. Supports one-click copy as text or JSON.' },
    { q: 'Is my data secure?', a: 'Your API keys and generation history are stored on your deployed server and never sent to third parties. Passwords use PBKDF2 salted hashing.' },
    { q: 'What does candidate count do?', a: 'Candidate count determines how many different character variants are generated per request (up to 10). Multiple candidates let you compare different interpretations and pick your favorite.' },
    { q: 'Custom provider can\'t fetch model list?', a: 'Some proxy services or custom API endpoints do not expose the model listing endpoint (/v1/models). This is normal.\n\nSolution: Simply type the model name manually in the "Model Name" field (e.g. gpt-4o, claude-sonnet-4-20250514), then click "Save Config". The model will work without needing to fetch the list.' },
    { q: 'Getting 401 / Invalid API Key error?', a: 'A 401 error means API key authentication failed. Try these steps:\n\n1. Check the key was copied in full (no leading/trailing spaces)\n2. Make sure the key matches the selected provider (e.g. an Anthropic key won\'t work for OpenAI)\n3. Verify the key hasn\'t expired or been revoked\n4. If using a proxy service, check whether the endpoint URL or key format has changed\n\nRe-enter and save your config in the Model Settings page after fixing.' },
    { q: 'Request times out or hangs indefinitely?', a: 'Timeouts are usually caused by:\n\n• High candidate count: reducing to 1–3 candidates significantly cuts response time\n• Unstable network: check your connection or use a proxy\n• Model service overloaded: wait and retry, or switch to a faster model (e.g. GPT-4o Mini, DeepSeek Chat)\n• Incorrect Base URL: verify whether the endpoint requires a /v1 suffix' },
    { q: 'Getting 429 Too Many Requests?', a: 'A 429 error means you\'ve hit the provider\'s rate limit:\n\n• Wait 10–60 seconds and retry\n• Reduce candidate count to lower per-request token usage\n• If it happens frequently, consider upgrading your plan or switching to an account with higher limits\n• OpenAI free tier / new accounts have low rate limits — a paid account is recommended' },
    { q: 'Generated result is empty or incomplete?', a: 'Missing content usually means the response hit a token limit or the LLM output was malformed:\n\n• Reduce candidate count to give each character more token budget\n• Switch to a model with a larger context window (e.g. claude-haiku-4-5, gpt-4o)\n• If it happens repeatedly, open a GitHub issue with the error details so we can investigate' },
  ];

  return (
    <div>
      {/* Header */}
      <div className="mb-6 pb-4 border-b border-border">
        <div className="flex items-center gap-3.5 mb-1.5">
          <h1 className="text-[1.75rem] font-light tracking-wide" style={{ fontFamily: "'Noto Serif SC', 'Inter', serif" }}>
            {t('helpTitle') as string}
          </h1>
          <span className="bg-gradient-to-r from-green-50 to-emerald-50 text-emerald-600 font-mono text-[0.62rem] tracking-widest px-3 py-1 rounded-full font-semibold border border-emerald-200">
            GUIDE
          </span>
        </div>
        <p className="text-text-dim text-[0.88rem]">{t('helpDesc') as string}</p>
      </div>

      {/* Quick start steps */}
      <div className="mb-8">
        <h2 className="text-[0.92rem] font-semibold text-text-primary mb-4">{t('helpQuickStart') as string}</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {steps.map((step, i) => (
            <div key={i} className="bg-white border border-border rounded-xl p-5 relative">
              <div className="absolute -top-3 -left-1 w-7 h-7 rounded-lg bg-gradient-to-br from-blue-500 to-cyan-500 flex items-center justify-center text-white text-[0.75rem] font-bold shadow-sm">
                {i + 1}
              </div>
              <div className="flex items-center gap-2.5 mb-2.5 mt-1">
                <span className="text-accent">{step.icon}</span>
                <span className="text-[0.88rem] font-semibold text-text-primary">{step.title}</span>
              </div>
              <p className="text-[0.82rem] text-text-dim leading-relaxed">{step.desc}</p>
            </div>
          ))}
        </div>
      </div>

      {/* FAQ */}
      <div>
        <h2 className="text-[0.92rem] font-semibold text-text-primary mb-4">{t('helpFaq') as string}</h2>
        <div className="space-y-2">
          {faqs.map((faq, i) => (
            <div key={i} className="bg-white border border-border rounded-xl overflow-hidden">
              <button
                onClick={() => setOpenFaq(openFaq === i ? null : i)}
                className="w-full text-left px-5 py-3.5 flex items-center justify-between hover:bg-surface-2/50 transition-colors"
              >
                <span className="text-[0.88rem] font-medium text-text-primary">{faq.q}</span>
                <svg
                  width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
                  className={`text-text-faint transition-transform shrink-0 ml-3 ${openFaq === i ? 'rotate-90' : ''}`}
                >
                  <polyline points="9 18 15 12 9 6" />
                </svg>
              </button>
              {openFaq === i && (
                <div className="px-5 pb-4 text-[0.84rem] text-text-dim leading-relaxed border-t border-border pt-3 whitespace-pre-line">
                  {faq.a}
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Footer note */}
      <div className="mt-8 p-4 bg-surface-2 border border-border rounded-xl text-center">
        <p className="text-[0.82rem] text-text-dim">
          {t('helpFooter') as string}
        </p>
      </div>
    </div>
  );
}
