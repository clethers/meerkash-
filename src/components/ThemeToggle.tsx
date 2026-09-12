'use client';

import { useEffect, useState } from 'react';
import { Moon, Sun } from 'lucide-react';

type Theme = 'light' | 'dark';

function applyTheme(theme: Theme) {
  document.documentElement.classList.toggle('dark', theme === 'dark');
  localStorage.setItem('theme', theme);
}

/**
 * Toggle only — there is no dark palette defined anywhere in the app yet, so
 * this just flips the `dark` class on <html> and persists the choice.
 * Components pick up dark: variants once that follow-up work lands.
 */
export function ThemeToggle() {
  const [theme, setTheme] = useState<Theme | null>(null);

  useEffect(() => {
    setTheme(document.documentElement.classList.contains('dark') ? 'dark' : 'light');
  }, []);

  function toggle() {
    const next: Theme = theme === 'dark' ? 'light' : 'dark';
    applyTheme(next);
    setTheme(next);
  }

  return (
    <button
      onClick={toggle}
      aria-label={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
      className={[
        'flex h-11 w-11 items-center justify-center rounded-full text-slate-600 dark:text-slate-300',
        'transition-[background-color,transform] duration-200 ease-out',
        'hover:scale-110 hover:bg-slate-100 dark:hover:bg-white/10 active:scale-95 motion-reduce:hover:scale-100',
      ].join(' ')}
    >
      {theme === 'dark' ? <Sun size={20} /> : <Moon size={20} />}
    </button>
  );
}
