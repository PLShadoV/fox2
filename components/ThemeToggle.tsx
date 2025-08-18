// components/ThemeToggle.tsx
"use client";

import { useEffect, useState } from "react";

const KEY = "pv-theme"; // "dark" | "light"

function applyTheme(t: "dark" | "light") {
  const el = document.documentElement;
  el.dataset.theme = t;
  try { localStorage.setItem(KEY, t); } catch {}
}

export default function ThemeToggle() {
  const [theme, setTheme] = useState<"dark" | "light">("dark");

  useEffect(() => {
    // domyślnie ciemny
    let t: "dark" | "light" = "dark";
    try {
      const saved = localStorage.getItem(KEY) as "dark" | "light" | null;
      if (saved === "light" || saved === "dark") t = saved;
    } catch {}
    setTheme(t);
    applyTheme(t);
  }, []);

  const flip = () => {
    const t = theme === "dark" ? "light" : "dark";
    setTheme(t);
    applyTheme(t);
  };

  return (
    <button
      onClick={flip}
      className="pv-chip"
      aria-label="Przełącz motyw"
      title="Przełącz motyw"
      type="button"
    >
      {theme === "dark" ? "Jasny" : "Ciemny"}
    </button>
  );
}
