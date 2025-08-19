
"use client";

import { useEffect, useState } from "react";

/**
 * Przełącznik motywu. Używa atrybutu data-theme na <html>.
 * Domyślnie "dark". Stan zapisywany w localStorage.
 */
export default function ThemeToggle() {
  const [theme, setTheme] = useState<"dark"|"light">("dark");

  useEffect(() => {
    const saved = (localStorage.getItem("pv-theme") as "dark"|"light" | null) || "dark";
    setTheme(saved);
    document.documentElement.setAttribute("data-theme", saved);
  }, []);

  const toggle = () => {
    const next = theme === "dark" ? "light" : "dark";
    setTheme(next);
    document.documentElement.setAttribute("data-theme", next);
    localStorage.setItem("pv-theme", next);
  };

  return (
    <button onClick={toggle} className="pv-chip" aria-label="Zmień motyw">
      {theme === "dark" ? "Jasny" : "Ciemny"}
    </button>
  );
}
