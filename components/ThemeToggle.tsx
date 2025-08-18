"use client";

import { useEffect, useState } from "react";

export default function ThemeToggle(){
  const [theme, setTheme] = useState<"dark"|"light">("dark");

  useEffect(()=>{
    const saved = (localStorage.getItem("pv-theme") as "dark"|"light") || "dark";
    setTheme(saved);
    document.documentElement.classList.toggle("theme-light", saved === "light");
  }, []);

  function toggle(){
    const next = theme === "dark" ? "light" : "dark";
    setTheme(next);
    localStorage.setItem("pv-theme", next);
    document.documentElement.classList.toggle("theme-light", next === "light");
  }

  return (
    <button onClick={toggle} className="px-3 py-2 rounded-2xl bg-white/10 border border-white/15 text-slate-100 hover:bg-white/15 transition">
      {theme === "dark" ? "Jasny" : "Ciemny"}
    </button>
  );
}
