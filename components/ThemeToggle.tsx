'use client';
import { useEffect, useState } from 'react';

export default function ThemeToggle() {
  const [theme, setTheme] = useState<'dark' | 'light'>('dark');

  useEffect(() => {
    const stored = (localStorage.getItem('pv-theme') as 'dark'|'light'|null) || 'dark';
    setTheme(stored);
    document.documentElement.setAttribute('data-theme', stored === 'dark' ? 'dark' : 'light');
  }, []);

  function toggle() {
    const next = theme === 'dark' ? 'light' : 'dark';
    setTheme(next);
    localStorage.setItem('pv-theme', next);
    document.documentElement.setAttribute('data-theme', next === 'dark' ? 'dark' : 'light');
  }

  return (
    <button className="chip" onClick={toggle} aria-label="Przełącz motyw">
      {theme === 'dark' ? 'Jasny' : 'Ciemny'}
    </button>
  );
}
