'use client';

import { useEffect, useState } from 'react';

/**
 * Simple theme toggle that stores preference in localStorage
 * and applies `data-theme="dark|light"` on <html>. Default = dark.
 */
export default function ThemeToggle() {
  const [theme, setTheme] = useState<'dark' | 'light'>('dark');

  useEffect(() => {
    // Load pref
    const saved = typeof window !== 'undefined' ? (localStorage.getItem('pv.theme') as 'dark' | 'light' | null) : null;
    const initial = saved ?? 'dark';
    setTheme(initial);
    if (typeof document !== 'undefined') {
      document.documentElement.setAttribute('data-theme', initial);
    }
  }, []);

  const toggle = () => {
    const next = theme === 'dark' ? 'light' : 'dark';
    setTheme(next);
    if (typeof document !== 'undefined') {
      document.documentElement.setAttribute('data-theme', next);
    }
    if (typeof window !== 'undefined') {
      localStorage.setItem('pv.theme', next);
    }
  };

  return (
    <button
      type="button"
      aria-label="Przełącz motyw"
      onClick={toggle}
      className={`pv-chip ${theme === 'dark' ? 'pv-chip--active' : ''}`}
      title={theme === 'dark' ? 'Ciemny (aktywny)' : 'Jasny (kliknij aby przełączyć)'}
    >
      {theme === 'dark' ? 'Ciemny' : 'Jasny'}
    </button>
  );
}
