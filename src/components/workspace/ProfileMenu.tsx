"use client";

import { useCallback, useId, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Bell, ChevronDown, CircleHelp, IdCard, LogOut, Settings, UserRound } from "lucide-react";
import { useAuth } from "@/lib/auth-store";
import { can } from "@/lib/capabilities";
import { holdsStudio } from "@/lib/roles";
import { PersonAvatar, cx } from "./kit";
import { useDismiss } from "./useDismiss";
import { useTour } from "@/components/tour/TourProvider";

/**
 * Who is signed in, and the things only they do: their account, their HR
 * record, their notification switches, signing out.
 *
 * The line under the name is what they *do* here, not their platform role -
 * their broadest role ("HR Management Lead", "PMO Lead") - because that is
 * what decides what they can see, and the thing somebody is most often
 * confused about.
 */
export function standingOf(user: ReturnType<typeof useAuth>["user"]): string {
  if (!user) return "";
  if (user.role === "super_admin") return "Platform owner";
  if (user.role === "platform_staff") return "Platform staff";
  const broadest = (user.roleNames ?? [])[0];
  if (broadest) return broadest;
  if (user.role === "admin") return "Admin";
  if (holdsStudio(user)) return "Instructor";
  if (can(user, "hrmEmployed")) return "Team member";
  return "User";
}

export function ProfileMenu() {
  const { user, logout } = useAuth();
  const { currentTour, replay } = useTour();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const panelId = useId();

  const close = useCallback((returnFocus: boolean) => {
    setOpen(false);
    if (returnFocus) triggerRef.current?.focus();
  }, []);
  useDismiss(open, close, [triggerRef, panelRef]);

  if (!user) return null;

  const signOut = async () => {
    setOpen(false);
    await logout();
    router.replace("/login");
  };

  const employed = Boolean(user.organisationId) && (can(user, "hrmEmployed") || can(user, "hrmManage"));

  const item =
    "flex w-full cursor-pointer items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-neutral-700 transition hover:bg-neutral-50 hover:text-neutral-900";

  return (
    <div className="relative" data-tour="profile-menu">
      <button
        ref={triggerRef}
        type="button"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={panelId}
        aria-label="Your account"
        onClick={() => setOpen((v) => !v)}
        className="flex h-10 cursor-pointer items-center gap-2.5 rounded-xl pl-1 pr-2 transition hover:bg-neutral-100"
      >
        <PersonAvatar name={user.name} src={user.avatar} size={34} />
        <span className="hidden min-w-0 text-left leading-tight md:block">
          <span className="block max-w-[160px] truncate text-sm font-semibold text-neutral-900">{user.name}</span>
          <span className="block max-w-[160px] truncate text-[11px] text-neutral-500">{standingOf(user)}</span>
        </span>
        <ChevronDown size={15} className={cx("hidden text-neutral-500 transition-transform md:block", open && "rotate-180")} aria-hidden />
      </button>

      {open && (
        <div
          ref={panelRef}
          id={panelId}
          role="menu"
          className="absolute right-0 z-50 mt-2 w-72 overflow-hidden rounded-2xl border border-neutral-200 bg-white shadow-2xl shadow-neutral-900/10 animate-fade-in"
        >
          <div className="flex items-center gap-3 border-b border-neutral-100 bg-gradient-to-br from-primary-50 to-white px-4 py-4">
            <PersonAvatar name={user.name} src={user.avatar} size={44} />
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold text-neutral-900">{user.name}</p>
              <p className="truncate text-xs text-neutral-500">{user.email}</p>
              <p className="mt-1 truncate text-[11px] font-semibold text-primary-700">
                {standingOf(user)}
                {user.organisationName ? ` · ${user.organisationName}` : ""}
              </p>
            </div>
          </div>
          <div className="p-1.5">
            <Link href="/account" role="menuitem" onClick={() => setOpen(false)} className={item}>
              <UserRound size={17} className="text-neutral-500" aria-hidden />
              My account
            </Link>
            {employed && (
              <Link href="/suite/hrm/me" role="menuitem" onClick={() => setOpen(false)} className={item}>
                <IdCard size={17} className="text-neutral-500" aria-hidden />
                My employment
              </Link>
            )}
            {employed && (
              <Link href="/suite/hrm/me/notifications" role="menuitem" onClick={() => setOpen(false)} className={item}>
                <Bell size={17} className="text-neutral-500" aria-hidden />
                Notification settings
              </Link>
            )}
            {/*
              O3: the Settings page is the platform's, and saving it needs the
              platform owner. An organisation admin's own settings start with
              its name, logo and colours (Branding); the owner gets theirs.
            */}
            {user.role === "admin" && (
              <Link href="/suite/org/branding" role="menuitem" onClick={() => setOpen(false)} className={item}>
                <Settings size={17} className="text-neutral-500" aria-hidden />
                Organisation settings
              </Link>
            )}
            {user.role === "super_admin" && (
              <Link href="/suite/platform/settings" role="menuitem" onClick={() => setOpen(false)} className={item}>
                <Settings size={17} className="text-neutral-500" aria-hidden />
                Platform settings
              </Link>
            )}
            {currentTour && (
              <button
                type="button"
                role="menuitem"
                onClick={() => {
                  setOpen(false);
                  replay(currentTour.key);
                }}
                className={item}
              >
                <CircleHelp size={17} className="text-neutral-500" aria-hidden />
                Take the tour
              </button>
            )}
          </div>
          <div className="border-t border-neutral-100 p-1.5">
            <button type="button" role="menuitem" onClick={signOut} className={cx(item, "text-error-700 hover:bg-error-500/5 hover:text-error-700")}>
              <LogOut size={17} aria-hidden />
              Sign out
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
