'use client';

import { useEffect, useState } from 'react';

type Theme = 'system' | 'light' | 'dark';

const STORAGE_KEY = 'theme';
const ORDER: Theme[] = ['system', 'light', 'dark'];
const LABELS: Record<Theme, string> = { system: 'System', light: 'Light', dark: 'Dark' };

/**
 * Runs inline in <head> before the page paints, so a saved dark theme never flashes light.
 * Kept as a string because it can't wait for React to load.
 */
export const themeInitScript = `(() => {
  try {
    const saved = localStorage.getItem('${STORAGE_KEY}');
    const dark = saved === 'dark' || (saved !== 'light' && matchMedia('(prefers-color-scheme: dark)').matches);
    document.documentElement.dataset.theme = dark ? 'dark' : 'light';
  } catch {}
})();`;

function readSaved(): Theme {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    return saved === 'light' || saved === 'dark' ? saved : 'system';
  } catch {
    return 'system';
  }
}

function apply(theme: Theme) {
  const dark = theme === 'dark' || (theme === 'system' && matchMedia('(prefers-color-scheme: dark)').matches);
  document.documentElement.dataset.theme = dark ? 'dark' : 'light';
}

export function ThemeToggle() {
  const [theme, setTheme] = useState<Theme | null>(null);

  useEffect(() => setTheme(readSaved()), []);

  // While on "System", follow the OS when it switches between light and dark.
  useEffect(() => {
    if (theme !== 'system') return;
    const media = matchMedia('(prefers-color-scheme: dark)');
    const onChange = () => apply('system');
    media.addEventListener('change', onChange);
    return () => media.removeEventListener('change', onChange);
  }, [theme]);

  const next = ORDER[(ORDER.indexOf(theme ?? 'system') + 1) % ORDER.length];

  return (
    <button
      type="button"
      className="btn btn-sm"
      title={`Theme: ${LABELS[theme ?? 'system']} (click for ${LABELS[next]})`}
      aria-label={`Theme: ${LABELS[theme ?? 'system']}. Switch to ${LABELS[next]}.`}
      onClick={() => {
        try {
          if (next === 'system') localStorage.removeItem(STORAGE_KEY);
          else localStorage.setItem(STORAGE_KEY, next);
        } catch {
          // storage blocked: the choice still applies for this page view
        }
        apply(next);
        setTheme(next);
      }}
    >
      {/* Rendered only after mount: the saved choice isn't known on the server. */}
      {theme && <ThemeIcon theme={theme} />}
      <span className="min-w-[3.25rem] text-left">{theme ? LABELS[theme] : ''}</span>
    </button>
  );
}

function ThemeIcon({ theme }: { theme: Theme }) {
  const common = {
    width: 14,
    height: 14,
    viewBox: '0 0 24 24',
    fill: 'none',
    stroke: 'currentColor',
    strokeWidth: 2,
    strokeLinecap: 'round' as const,
    strokeLinejoin: 'round' as const,
    'aria-hidden': true,
  };
  if (theme === 'light') {
    return (
      <svg {...common}>
        <circle cx="12" cy="12" r="4" />
        <path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" />
      </svg>
    );
  }
  if (theme === 'dark') {
    return (
      <svg {...common}>
        <path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z" />
      </svg>
    );
  }
  return (
    <svg {...common}>
      <rect x="2" y="4" width="20" height="13" rx="2" />
      <path d="M8 21h8M12 17v4" />
    </svg>
  );
}
