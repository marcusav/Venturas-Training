"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const I = {
  hoje: <path d="M4 11.5 12 5l8 6.5V20a1 1 0 0 1-1 1h-4v-6H9v6H5a1 1 0 0 1-1-1z" />,
  plano: (
    <>
      <rect x="4" y="5" width="16" height="16" rx="2" />
      <path d="M4 10h16M9 3v4M15 3v4" />
    </>
  ),
  corridas: <path d="M3 17h4l3-9 4 12 3-7h4" />,
  ajustes: (
    <>
      <path d="M4 7h10M18 7h2M4 17h4M12 17h8" />
      <circle cx="16" cy="7" r="2" />
      <circle cx="10" cy="17" r="2" />
    </>
  ),
};

const TABS = [
  { href: "/", label: "Hoje", icon: I.hoje },
  { href: "/plano", label: "Plano", icon: I.plano },
  { href: "/corridas", label: "Corridas", icon: I.corridas },
  { href: "/ajustes", label: "Ajustes", icon: I.ajustes },
];

export function TabBar() {
  const path = usePathname() ?? "/";
  if (path.startsWith("/login")) return null;
  const active = (href: string) =>
    href === "/" ? path === "/" : path.startsWith(href) || (href === "/plano" && path.startsWith("/treino"));
  return (
    <nav className="tabbar" aria-label="Navegação">
      {TABS.map((t) => (
        <Link key={t.href} href={t.href} className={active(t.href) ? "on" : ""} aria-current={active(t.href) ? "page" : undefined}>
          <svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            {t.icon}
          </svg>
          <span>{t.label}</span>
        </Link>
      ))}
    </nav>
  );
}
