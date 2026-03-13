import { useNavigate, useParams } from 'react-router-dom';
import { useCallback } from 'react';

const VALID_LANGS = ['zh', 'zh-Hant', 'en'];

export function useLangNavigate() {
  const navigate = useNavigate();
  const { lang } = useParams<{ lang: string }>();
  const currentLang = lang && VALID_LANGS.includes(lang) ? lang : 'zh';

  return useCallback(
    (path: string) => {
      const cleanPath = path.startsWith('/') ? path : `/${path}`;
      navigate(`/${currentLang}${cleanPath}`);
    },
    [navigate, currentLang],
  );
}

/** Strip /:lang prefix from pathname for active-state comparison */
export function stripLangPrefix(pathname: string): string {
  for (const lang of VALID_LANGS) {
    const prefix = `/${lang}`;
    if (pathname === prefix || pathname.startsWith(`${prefix}/`)) {
      const rest = pathname.slice(prefix.length);
      return rest || '/';
    }
  }
  return pathname;
}
