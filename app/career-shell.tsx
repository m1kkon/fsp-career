"use client";
import { useEffect } from 'react';
export default function CareerShell() {
  useEffect(() => {
    if (document.getElementById('career-client')) return;
    const script = document.createElement('script');
    script.id = 'career-client';
    script.src = '/mvp.js';
    document.body.appendChild(script);
  }, []);
  return <><div id="app"><div className="boot-screen">ФСП Карьера<span>Загружаем сервис…</span></div></div><div id="overlay-root"/><div id="toast" className="toast" role="status" aria-live="polite"/></>;
}
