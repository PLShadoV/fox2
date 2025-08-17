"use client";
import { useEffect, useState } from "react";

export default function ThemeToggle(){
  const [dark, setDark] = useState(false);
  useEffect(()=>{
    const root = document.documentElement;
    const saved = localStorage.getItem("theme") === "dark";
    if (saved) { root.classList.add("dark"); setDark(true); }
  }, []);
  return (
    <button
      className="card px-3 py-2 text-sm hover:shadow"
      onClick={()=>{
        const root = document.documentElement;
        const nowDark = !root.classList.contains("dark");
        root.classList.toggle("dark");
        localStorage.setItem("theme", nowDark ? "dark" : "light");
        setDark(nowDark);
      }}
      aria-label="Przełącz motyw"
      title="Przełącz motyw"
    >
      {dark ? "☀️ Jasny" : "🌙 Ciemny"}
    </button>
  );
}
