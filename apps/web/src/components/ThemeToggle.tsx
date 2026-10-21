'use client';

import { MonitorIcon, MoonIcon, SunIcon } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';

type Theme = 'system' | 'light' | 'dark';

const STORAGE_KEY = 'theme';
const ORDER: Theme[] = ['system', 'light', 'dark'];
const LABELS: Record<Theme, string> = { system: 'System', light: 'Light', dark: 'Dark' };
const ICONS = { system: MonitorIcon, light: SunIcon, dark: MoonIcon };

/**
 * Runs inline in <head> before the page paints, so a saved dark theme never flashes light.
 * Kept as a string because it can't wait for React to load.
 */
export const themeInitScript = `(() => {
  try {
    const saved = localStorage.getItem('${STORAGE_KEY}');
    const dark = saved === 'dark' || (saved !== 'light' && matchMedia('(prefers-color-scheme: dark)').matches);
    document.documentElement.classList.toggle('dark', dark);
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
  document.documentElement.classList.toggle('dark', dark);
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

  const current = theme ?? 'system';
  const next = ORDER[(ORDER.indexOf(current) + 1) % ORDER.length];
  const Icon = ICONS[current];

  return (
    <Button
      type="button"
      variant="outline"
      size="sm"
      title={`Theme: ${LABELS[current]} (click for ${LABELS[next]})`}
      aria-label={`Theme: ${LABELS[current]}. Switch to ${LABELS[next]}.`}
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
      {theme && <Icon />}
      <span className="min-w-[3.25rem] text-left">{theme ? LABELS[theme] : ''}</span>
    </Button>
  );
}
