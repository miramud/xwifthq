"use client";

import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ArrowLeft, ChevronRight, Menu, PanelLeftClose, PanelLeftOpen, Search, X, type LucideIcon } from "lucide-react";
import NotificationBell from "@/components/shared/NotificationBell";
import NeedsOrganisation from "@/components/shared/NeedsOrganisation";
import { useAuth, type AuthUser } from "@/lib/auth-store";
import { useBranding } from "@/lib/branding";
import { cx, initialsOf } from "./kit";
import { HUE, moduleByKey, type WorkspaceModuleKey } from "./modules";
import { ProfileMenu } from "./ProfileMenu";
import { ApprovalsButton } from "./ApprovalsButton";
import { SuiteSwitcher } from "./SuiteSwitcher";
import { TourHelpButton } from "@/components/tour/TourHelpButton";

/*
  The one chrome every signed-in suite surface wears.

  A white sidebar with the module's pages in named groups, and a top bar with
  where you are, the suite switcher, notifications and your account. Each
  module supplies only its navigation; everything else — the collapse, the
  mobile drawer, the search over the nav, the active state — is here once, so
  moving from HR to Projects never changes where anything is.
*/

export interface WsNavItem {
  label: string;
  href: string;
  icon: LucideIcon;
  badge?: number | string;
  /** "count" (default) is a filled pill; "preview" marks a module the organisation hasn't switched on. */
  badgeTone?: "count" | "preview";
  /** Only this exact path lights it (for hrefs that prefix their siblings). */
  exact?: boolean;
  /** Presentation only: whether to offer it. The API refuses regardless. */
  show?: (user: AuthUser | null) => boolean;
}

export interface WsNavGroup {
  heading: string;
  items: WsNavItem[];
}

export interface WsTitle {
  match: string;
  title: string;
  exact?: boolean;
  /** Also require the path to contain this (a page under a dynamic segment, e.g. `/reconciliation/`). */
  contains?: string;
}

function isActive(pathname: string, item: WsNavItem): boolean {
  if (item.exact) return pathname === item.href;
  return pathname === item.href || pathname.startsWith(item.href + "/");
}

/** The most specific nav item containing this path. */
function activeItem(pathname: string, groups: WsNavGroup[]): WsNavItem | undefined {
  let best: WsNavItem | undefined;
  for (const g of groups) {
    for (const it of g.items) {
      if (isActive(pathname, it) && (!best || it.href.length > best.href.length)) best = it;
    }
  }
  return best;
}

const COLLAPSE_KEY = "ws-sidebar-collapsed";

function readCollapsed(): boolean {
  try {
    return window.localStorage.getItem(COLLAPSE_KEY) === "1";
  } catch {
    return false; /* storage blocked: start expanded */
  }
}

function subscribeStorage(onChange: () => void): () => void {
  window.addEventListener("storage", onChange);
  return () => window.removeEventListener("storage", onChange);
}

export default function WorkspaceShell({
  module: moduleKey,
  nav,
  titles = [],
  requiresOrganisation,
  children,
}: {
  module: WorkspaceModuleKey;
  nav: WsNavGroup[];
  /** Page titles for paths the nav does not name (detail pages). */
  titles?: WsTitle[];
  /** For modules that only exist inside an institution: "HR", "Projects". */
  requiresOrganisation?: string;
  children: React.ReactNode;
}) {
  const pathname = usePathname() ?? "";
  const { user } = useAuth();
  const branding = useBranding();
  const mod = moduleByKey(moduleKey);
  const ModIcon = mod.icon;

  const [drawer, setDrawer] = useState(false);
  const [filter, setFilter] = useState("");

  // Remembered on the client only; the server renders it expanded.
  const storedCollapsed = useSyncExternalStore(subscribeStorage, readCollapsed, () => false);
  const [chosenCollapsed, setChosenCollapsed] = useState<boolean | null>(null);
  const collapsed = chosenCollapsed ?? storedCollapsed;

  const toggleCollapsed = () => {
    const next = !collapsed;
    setChosenCollapsed(next);
    try {
      window.localStorage.setItem(COLLAPSE_KEY, next ? "1" : "0");
    } catch {
      /* not remembered, still toggles */
    }
  };

  // Close the drawer when the route changes — during render, not in an
  // effect, so the new page never paints with the drawer still open.
  const [drawerPath, setDrawerPath] = useState(pathname);
  if (drawerPath !== pathname) {
    setDrawerPath(pathname);
    setDrawer(false);
  }

  const visible = useMemo(
    () =>
      nav
        .map((g) => ({ ...g, items: g.items.filter((it) => !it.show || it.show(user)) }))
        .filter((g) => g.items.length > 0),
    [nav, user],
  );

  const filtered = useMemo(() => {
    const q = filter.trim().toLowerCase();
    if (!q) return visible;
    return visible
      .map((g) => ({ ...g, items: g.items.filter((it) => it.label.toLowerCase().includes(q)) }))
      .filter((g) => g.items.length > 0);
  }, [visible, filter]);

  const current = activeItem(pathname, visible);
  const title =
    titles.find((t) => (t.exact ? pathname === t.match : pathname.startsWith(t.match)) && (!t.contains || pathname.includes(t.contains)) && (!current || t.match.length > current.href.length))
      ?.title ??
    current?.label ??
    mod.name;

  return (
    <div className="ws fixed inset-0 z-[60] flex">
      {/* Desktop sidebar */}
      <aside
        data-tour="sidebar"
        className={cx(
          "hidden shrink-0 border-r border-neutral-200/80 bg-white transition-[width] duration-200 lg:block",
          collapsed ? "w-[84px]" : "w-[268px]",
        )}
      >
        <Sidebar
          groups={filtered}
          pathname={pathname}
          collapsed={collapsed}
          onToggleCollapsed={toggleCollapsed}
          filter={filter}
          onFilter={setFilter}
          orgName={branding.organisationName}
          logoUrl={branding.logoUrl}
          moduleName={mod.name}
          ModIcon={ModIcon}
          tile={HUE[mod.hue].tile}
        />
      </aside>

      {/* Mobile drawer */}
      {drawer && (
        <MobileDrawer onClose={() => setDrawer(false)}>
          <Sidebar
            groups={filtered}
            pathname={pathname}
            collapsed={false}
            filter={filter}
            onFilter={setFilter}
            orgName={branding.organisationName}
            logoUrl={branding.logoUrl}
            moduleName={mod.name}
            ModIcon={ModIcon}
            tile={HUE[mod.hue].tile}
            onNavigate={() => setDrawer(false)}
          />
        </MobileDrawer>
      )}

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-30 flex h-[68px] shrink-0 items-center gap-3 border-b border-neutral-200/80 bg-white/85 px-4 backdrop-blur sm:px-6">
          <button
            type="button"
            aria-label="Open menu"
            data-tour="menu-button"
            onClick={() => setDrawer(true)}
            className="flex h-10 w-10 cursor-pointer items-center justify-center rounded-xl text-neutral-600 hover:bg-neutral-100 lg:hidden"
          >
            <Menu size={20} aria-hidden />
          </button>

          <div className="min-w-0 flex-1">
            <nav aria-label="Breadcrumb" className="hidden items-center gap-1 text-xs text-neutral-500 sm:flex">
              <Link href={mod.href} className="hover:text-neutral-800">
                {mod.name}
              </Link>
              {title !== mod.name && (
                <>
                  <ChevronRight size={12} aria-hidden />
                  <span className="truncate text-neutral-700">{title}</span>
                </>
              )}
            </nav>
            <p className="truncate text-[17px] font-bold tracking-tight text-neutral-900" data-tour="page-title">
              {title}
            </p>
          </div>

          <div className="flex items-center gap-1.5 sm:gap-2.5">
            <TourHelpButton />
            <SuiteSwitcher current={moduleKey} />
            <span className="hidden h-6 w-px bg-neutral-200 sm:block" aria-hidden />
            <ApprovalsButton />
            <span data-tour="notifications" className="inline-flex">
              <NotificationBell />
            </span>
            <ProfileMenu />
          </div>
        </header>

        {/*
          A <div>, not a <main>: the root layout already wraps every route in
          one (`SiteChrome`), and a second main landmark inside it is invalid.
        */}
        <div id="main" data-tour="main" className="min-h-0 flex-1 overflow-y-auto">
          <div className="mx-auto w-full max-w-[1480px] px-4 py-6 sm:px-6 lg:px-8 lg:py-8">
            {requiresOrganisation ? (
              <NeedsOrganisation area={requiresOrganisation}>{children}</NeedsOrganisation>
            ) : (
              children
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function Sidebar({
  groups,
  pathname,
  collapsed,
  onToggleCollapsed,
  filter,
  onFilter,
  orgName,
  logoUrl,
  moduleName,
  ModIcon,
  tile,
  onNavigate,
}: {
  groups: WsNavGroup[];
  pathname: string;
  collapsed: boolean;
  onToggleCollapsed?: () => void;
  filter: string;
  onFilter: (v: string) => void;
  orgName: string | null;
  logoUrl: string | null;
  moduleName: string;
  ModIcon: LucideIcon;
  tile: string;
  onNavigate?: () => void;
}) {
  const current = activeItem(pathname, groups);

  return (
    <div className="flex h-full flex-col">
      {/* Brand */}
      <div className={cx("flex h-[68px] shrink-0 items-center gap-3 border-b border-neutral-100", collapsed ? "justify-center px-2" : "px-5")}>
        {logoUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={logoUrl} alt="" className="h-9 w-9 shrink-0 rounded-xl object-contain" />
        ) : (
          <span className={cx("flex h-9 w-9 shrink-0 items-center justify-center rounded-xl", tile)}>
            <ModIcon size={18} aria-hidden />
          </span>
        )}
        {!collapsed && (
          <div className="min-w-0 flex-1 leading-tight">
            <p className="truncate text-[15px] font-bold tracking-tight text-neutral-900">{orgName ?? "Elevate"}</p>
            <p className="truncate text-xs font-medium text-neutral-500">{moduleName}</p>
          </div>
        )}
        {onToggleCollapsed && !collapsed && (
          <button
            type="button"
            onClick={onToggleCollapsed}
            aria-label="Collapse sidebar"
            className="flex h-8 w-8 cursor-pointer items-center justify-center rounded-lg border border-neutral-200 text-neutral-500 hover:bg-neutral-50 hover:text-neutral-800"
          >
            <PanelLeftClose size={16} aria-hidden />
          </button>
        )}
      </div>

      {collapsed && onToggleCollapsed && (
        <button
          type="button"
          onClick={onToggleCollapsed}
          aria-label="Expand sidebar"
          className="mx-auto mt-3 flex h-9 w-9 cursor-pointer items-center justify-center rounded-lg border border-neutral-200 text-neutral-500 hover:bg-neutral-50"
        >
          <PanelLeftOpen size={16} aria-hidden />
        </button>
      )}

      {/* Nav search */}
      {!collapsed && (
        <div className="px-4 pt-4">
          <label className="relative block" data-tour="nav-search">
            <span className="sr-only">Find a page</span>
            <Search size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-neutral-400" aria-hidden />
            <input
              type="search"
              value={filter}
              onChange={(e) => onFilter(e.target.value)}
              placeholder="Find a page"
              className="h-10 w-full rounded-xl border border-neutral-200 bg-neutral-50/60 pl-9 pr-3 text-sm outline-none transition placeholder:text-neutral-400 focus:border-primary-300 focus:bg-white focus:ring-4 focus:ring-primary-100"
            />
          </label>
        </div>
      )}

      <nav aria-label={`${moduleName} pages`} className={cx("min-h-0 flex-1 overflow-y-auto pb-4", collapsed ? "px-3" : "px-4")}>
        {groups.length === 0 && !collapsed && (
          <p className="px-2 pt-6 text-sm text-neutral-500">No page called that.</p>
        )}
        {groups.map((g) => (
          <div key={g.heading} className="pt-5">
            {collapsed ? (
              <div className="mx-auto mb-2 h-px w-8 bg-neutral-200" aria-hidden />
            ) : (
              <p className="px-3 pb-2 text-[11px] font-semibold uppercase tracking-[0.08em] text-neutral-400">{g.heading}</p>
            )}
            <ul className="space-y-0.5">
              {g.items.map((it) => {
                const on = current?.href === it.href;
                const Icon = it.icon;
                return (
                  <li key={it.href}>
                    <Link
                      href={it.href}
                      onClick={onNavigate}
                      data-tour={`nav:${it.href}`}
                      aria-current={on ? "page" : undefined}
                      title={collapsed ? it.label : undefined}
                      className={cx(
                        "group relative flex items-center gap-3 rounded-xl text-sm font-medium transition-colors outline-none focus-visible:ring-2 focus-visible:ring-primary-300",
                        collapsed ? "h-11 justify-center" : "h-10 px-3",
                        on ? "bg-primary-50 text-primary-700" : "text-neutral-600 hover:bg-neutral-100 hover:text-neutral-900",
                      )}
                    >
                      {on && !collapsed && <span className="absolute -left-4 top-2 bottom-2 w-1 rounded-r-full bg-primary-600" aria-hidden />}
                      <Icon size={18} className={cx("shrink-0", on ? "text-primary-600" : "text-neutral-400 group-hover:text-neutral-600")} aria-hidden />
                      {!collapsed && <span className="flex-1 truncate">{it.label}</span>}
                      {!collapsed && it.badge != null && it.badge !== 0 && (
                        <span
                          className={cx(
                            "rounded-full px-1.5 py-0.5 text-[10px] font-bold tabular-nums",
                            it.badgeTone === "preview"
                              ? "border border-info-500/30 bg-info-500/10 uppercase tracking-wide text-info-700"
                              : "bg-primary-600 text-white",
                          )}
                        >
                          {it.badge}
                        </span>
                      )}
                      {collapsed && <span className="sr-only">{it.label}</span>}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </nav>

      <div className={cx("shrink-0 border-t border-neutral-100 p-3", collapsed && "flex justify-center")}>
        <Link
          href="/suite"
          onClick={onNavigate}
          data-tour="all-modules"
          title={collapsed ? "All modules" : undefined}
          className={cx(
            "flex items-center gap-2.5 rounded-xl text-sm font-medium text-neutral-500 transition hover:bg-neutral-100 hover:text-neutral-900",
            collapsed ? "h-10 w-10 justify-center" : "h-10 px-3",
          )}
        >
          <ArrowLeft size={16} aria-hidden />
          {!collapsed && "All modules"}
          {collapsed && <span className="sr-only">All modules</span>}
        </Link>
      </div>
    </div>
  );
}

function MobileDrawer({ onClose, children }: { onClose: () => void; children: React.ReactNode }) {
  const panelRef = useRef<HTMLDivElement>(null);

  const onKey = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      // Keep Tab inside the drawer while it is open.
      if (e.key === "Tab" && panelRef.current) {
        const focusable = panelRef.current.querySelectorAll<HTMLElement>("a[href],button,input");
        if (focusable.length === 0) return;
        const first = focusable[0];
        const last = focusable[focusable.length - 1];
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    },
    [onClose],
  );

  useEffect(() => {
    document.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    panelRef.current?.querySelector<HTMLElement>("a[href],button")?.focus();
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [onKey]);

  return (
    <div className="fixed inset-0 z-50 lg:hidden" role="dialog" aria-modal="true" aria-label="Menu">
      <button type="button" aria-label="Close menu" onClick={onClose} className="absolute inset-0 bg-neutral-900/40 backdrop-blur-sm" />
      <div ref={panelRef} className="absolute inset-y-0 left-0 w-[288px] bg-white shadow-2xl animate-fade-in">
        <button
          type="button"
          onClick={onClose}
          aria-label="Close menu"
          className="absolute right-3 top-4 z-10 flex h-9 w-9 cursor-pointer items-center justify-center rounded-lg text-neutral-500 hover:bg-neutral-100"
        >
          <X size={18} aria-hidden />
        </button>
        {children}
      </div>
    </div>
  );
}

export { initialsOf };
