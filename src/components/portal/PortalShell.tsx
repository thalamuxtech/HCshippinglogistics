"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import type { LucideIcon } from "lucide-react";
import { Menu, X, LogOut, ChevronDown, PanelLeftClose, PanelLeft } from "lucide-react";
import { useAuth } from "@/components/providers/AuthProvider";
import { LogoMark } from "@/components/brand/Logo";
import { cn, initialsOf } from "@/lib/utils";

export interface PortalNavItem {
  href: string;
  label: string;
  icon: LucideIcon;
}

export interface PortalShellProps {
  nav: PortalNavItem[];
  title: string;
  roleLabel: string;
  children: React.ReactNode;
}

function isActive(pathname: string, href: string): boolean {
  if (href === "/admin" || href === "/office" || href === "/dispatch" || href === "/portal") {
    return pathname === href;
  }
  return pathname === href || pathname.startsWith(href + "/");
}

function NavLinks({
  nav,
  pathname,
  onNavigate,
  collapsed,
}: {
  nav: PortalNavItem[];
  pathname: string;
  onNavigate?: () => void;
  collapsed?: boolean;
}) {
  return (
    <nav className="flex flex-1 flex-col gap-1 px-3 py-4" aria-label="Portal navigation">
      {nav.map((item) => {
        const active = isActive(pathname, item.href);
        const Icon = item.icon;
        return (
          <Link
            key={item.href}
            href={item.href}
            onClick={onNavigate}
            aria-current={active ? "page" : undefined}
            title={collapsed ? item.label : undefined}
            className={cn(
              "group flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors focus-ring",
              collapsed && "justify-center px-0",
              active
                ? "bg-gold-gradient text-navy shadow-gold"
                : "text-white/70 hover:bg-white/10 hover:text-white"
            )}
          >
            <Icon
              className={cn("h-[18px] w-[18px] shrink-0", active ? "text-navy" : "text-gold")}
              aria-hidden
            />
            {!collapsed && <span className="truncate">{item.label}</span>}
          </Link>
        );
      })}
    </nav>
  );
}

// Brand block is a link to the portal home; collapses to just the mark.
function SidebarBrand({
  roleLabel,
  homeHref,
  collapsed,
}: {
  roleLabel: string;
  homeHref: string;
  collapsed?: boolean;
}) {
  return (
    <Link
      href={homeHref}
      className={cn(
        "flex items-center gap-3 border-b border-white/10 px-5 py-5 transition-colors hover:bg-white/5 focus-ring",
        collapsed && "justify-center px-0"
      )}
      aria-label="Portal home"
    >
      <LogoMark className="h-9 w-9 shrink-0" />
      {!collapsed && (
        <div className="min-w-0">
          <p className="truncate text-sm font-bold leading-tight text-white">Highclass Shipping</p>
          <p className="text-[11px] font-medium uppercase tracking-[0.12em] text-gold-200">
            {roleLabel}
          </p>
        </div>
      )}
    </Link>
  );
}

export function PortalShell({ nav, title, roleLabel, children }: PortalShellProps) {
  const pathname = usePathname();
  const { user, signOut } = useAuth();
  const [mobileOpen, setMobileOpen] = React.useState(false);
  const [menuOpen, setMenuOpen] = React.useState(false);
  const [collapsed, setCollapsed] = React.useState(false);
  const menuRef = React.useRef<HTMLDivElement>(null);
  const homeHref = nav[0]?.href ?? "/";

  // Restore collapse preference.
  React.useEffect(() => {
    try {
      setCollapsed(localStorage.getItem("hc_sidebar_collapsed") === "1");
    } catch {
      /* ignore */
    }
  }, []);
  function toggleCollapsed() {
    setCollapsed((v) => {
      const next = !v;
      try {
        localStorage.setItem("hc_sidebar_collapsed", next ? "1" : "0");
      } catch {
        /* ignore */
      }
      return next;
    });
  }

  // Close mobile slide-over on route change.
  React.useEffect(() => {
    setMobileOpen(false);
  }, [pathname]);

  // Close user menu on outside click.
  React.useEffect(() => {
    if (!menuOpen) return;
    const onClick = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setMenuOpen(false);
    };
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, [menuOpen]);

  const initials = initialsOf(user?.full_name);

  return (
    <div className="min-h-screen bg-surface">
      {/* ─── Desktop fixed sidebar ─────────────────────────── */}
      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-30 hidden flex-col bg-navy-gradient transition-[width] duration-200 lg:flex",
          collapsed ? "w-[76px]" : "w-64"
        )}
      >
        <SidebarBrand roleLabel={roleLabel} homeHref={homeHref} collapsed={collapsed} />
        <NavLinks nav={nav} pathname={pathname} collapsed={collapsed} />
        <div className="space-y-1 border-t border-white/10 px-3 py-4">
          <button
            onClick={() => void signOut()}
            title={collapsed ? "Sign out" : undefined}
            className={cn(
              "flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-white/70 transition-colors hover:bg-white/10 hover:text-white focus-ring cursor-pointer",
              collapsed && "justify-center px-0"
            )}
          >
            <LogOut className="h-[18px] w-[18px] shrink-0 text-gold" aria-hidden />
            {!collapsed && "Sign out"}
          </button>
          <button
            onClick={toggleCollapsed}
            title={collapsed ? "Expand sidebar" : "Collapse sidebar"}
            className={cn(
              "flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-white/50 transition-colors hover:bg-white/10 hover:text-white focus-ring cursor-pointer",
              collapsed && "justify-center px-0"
            )}
            aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
          >
            {collapsed ? (
              <PanelLeft className="h-[18px] w-[18px] shrink-0" aria-hidden />
            ) : (
              <>
                <PanelLeftClose className="h-[18px] w-[18px] shrink-0" aria-hidden /> Collapse
              </>
            )}
          </button>
        </div>
      </aside>

      {/* ─── Mobile slide-over ─────────────────────────────── */}
      {mobileOpen && (
        <div className="fixed inset-0 z-40 lg:hidden">
          <div
            className="absolute inset-0 bg-navy-950/60 backdrop-blur-sm animate-fade-up"
            onClick={() => setMobileOpen(false)}
            aria-hidden
          />
          <aside className="absolute inset-y-0 left-0 flex w-72 max-w-[80%] flex-col bg-navy-gradient shadow-premium animate-fade-up">
            <div className="flex items-center justify-between border-b border-white/10 pr-3">
              <SidebarBrand roleLabel={roleLabel} homeHref={homeHref} />
              <button
                onClick={() => setMobileOpen(false)}
                className="rounded-lg p-2 text-white/70 hover:bg-white/10 hover:text-white focus-ring cursor-pointer"
                aria-label="Close menu"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <NavLinks nav={nav} pathname={pathname} onNavigate={() => setMobileOpen(false)} />
            <div className="border-t border-white/10 px-3 py-4">
              <button
                onClick={() => void signOut()}
                className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-white/70 transition-colors hover:bg-white/10 hover:text-white focus-ring cursor-pointer"
              >
                <LogOut className="h-[18px] w-[18px] text-gold" aria-hidden />
                Sign out
              </button>
            </div>
          </aside>
        </div>
      )}

      {/* ─── Main column ───────────────────────────────────── */}
      <div className={cn("transition-[padding] duration-200", collapsed ? "lg:pl-[76px]" : "lg:pl-64")}>
        {/* Top bar */}
        <header className="sticky top-0 z-20 border-b border-border bg-white/85 backdrop-blur">
          <div className="flex h-16 items-center gap-3 px-4 sm:px-6">
            <button
              onClick={() => setMobileOpen(true)}
              className="rounded-lg p-2 text-navy hover:bg-navy/5 focus-ring lg:hidden cursor-pointer"
              aria-label="Open menu"
            >
              <Menu className="h-5 w-5" />
            </button>
            <h1 className="flex-1 truncate text-lg font-bold tracking-tight text-navy">{title}</h1>

            <div className="relative" ref={menuRef}>
              <button
                onClick={() => setMenuOpen((v) => !v)}
                className="flex items-center gap-2.5 rounded-full py-1 pl-1 pr-2 transition-colors hover:bg-navy/5 focus-ring cursor-pointer"
                aria-haspopup="menu"
                aria-expanded={menuOpen}
                aria-label="Account menu"
              >
                <span className="flex h-9 w-9 items-center justify-center rounded-full bg-navy text-sm font-bold text-gold shadow-premium">
                  {initials}
                </span>
                <span className="hidden text-left sm:block">
                  <span className="block max-w-[140px] truncate text-sm font-semibold text-navy">
                    {user?.full_name ?? "Account"}
                  </span>
                  <span className="block text-[11px] text-ink-muted">{roleLabel}</span>
                </span>
                <ChevronDown className="hidden h-4 w-4 text-ink-muted sm:block" aria-hidden />
              </button>

              {menuOpen && (
                <div
                  role="menu"
                  className="absolute right-0 mt-2 w-56 overflow-hidden rounded-xl border border-border bg-white shadow-premium animate-fade-up"
                >
                  <div className="border-b border-border px-4 py-3">
                    <p className="truncate text-sm font-semibold text-navy">
                      {user?.full_name ?? "Account"}
                    </p>
                    <p className="truncate text-xs text-ink-muted">{user?.email}</p>
                  </div>
                  <button
                    role="menuitem"
                    onClick={() => {
                      setMenuOpen(false);
                      void signOut();
                    }}
                    className="flex w-full items-center gap-2 px-4 py-3 text-sm font-medium text-navy transition-colors hover:bg-secondary focus-ring cursor-pointer"
                  >
                    <LogOut className="h-4 w-4 text-gold" aria-hidden />
                    Sign out
                  </button>
                </div>
              )}
            </div>
          </div>
        </header>

        <main className="px-4 py-6 sm:px-6 lg:px-8 lg:py-8">{children}</main>
      </div>
    </div>
  );
}
