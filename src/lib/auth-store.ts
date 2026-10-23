"use client";

import {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  useMemo,
  type ReactNode,
} from "react";
import React from "react";
import type { Capabilities } from "@/lib/capabilities";
import type { AnySessionRole } from "@/lib/roles";
import type { SessionModule } from "@/lib/module-access";

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

export interface AuthUser {
  id: string;
  name: string;
  email: string;
  /**
   * `super_admin` is the platform owner and belongs to no organisation;
   * `admin` runs exactly one institution. Every pre-existing admin check
   * should accept both — tenant isolation, not the role, is what separates
   * one institution from another.
   */
  role: AnySessionRole;
  /** Null for the platform owner and for self-serve marketplace users. */
  organisationId?: string | null;
  organisationName?: string | null;
  /**
   * Branding travels with the session so a shell can paint it on first render,
   * rather than flashing the platform's own look and then swapping.
   * `organisationAccentForeground` is black or white, computed server-side from
   * the accent's contrast — see `App\Support\Branding`.
   */
  organisationLogoUrl?: string | null;
  organisationAccentColor?: string | null;
  organisationAccentForeground?: string | null;
  avatar: string | null;
  emailVerified: boolean;
  /**
   * Still on the password that was generated for this account.
   *
   * Provisioned learners are emailed a temporary password, and a password that
   * has been through an inbox is not a secret — so the API refuses every route
   * except the one that changes it. The client reads this to send them
   * straight there instead of letting them walk into a wall of 403s.
   */
  mustChangePassword: boolean;
  /** The names of the roles they hold here, the broadest first (the line under their name). */
  roleNames?: string[];
  /**
   * What their roles add up to, computed by the API - e.g. `lmsAdmin`,
   * `hrmLeadsTeam`. Read it with `can()`; do not re-derive it from `role`.
   * Optional for sessions stored before it existed. See `@/lib/capabilities`.
   */
  capabilities?: Capabilities;
  /**
   * Every permission key this person holds (`module.feature.action`), computed
   * by the API from the built-in User role and the roles they hold. Read it with
   * `holdsFeature()` from `@/lib/permissions`. Presentation only; optional for
   * older sessions.
   */
  permissions?: string[];
  /** On any live project's team; decides the sign-in landing (X4). */
  onProjectTeam?: boolean;
  /**
   * Which suite modules this person's organisation has switched on; a module
   * not active is a preview. Read it with `moduleStatus()` from
   * `@/lib/module-access`, never directly. Optional for older sessions.
   */
  modules?: SessionModule[];
}

export { can, NO_CAPABILITIES } from "@/lib/capabilities";
export type { Capabilities, Capability } from "@/lib/capabilities";

interface AuthState {
  user: AuthUser | null;
  loading: boolean;
  isAuthenticated: boolean;
  login: (email: string, password: string) => Promise<AuthUser>;
  register: (input: {
    name: string;
    email: string;
    password: string;
    password_confirmation: string;
  }) => Promise<void>;
  logout: () => Promise<void>;
  refresh: () => Promise<void>;
}

/* ------------------------------------------------------------------ */
/*  Error                                                              */
/* ------------------------------------------------------------------ */

export class AuthError extends Error {
  constructor(
    message: string,
    public readonly errors?: Record<string, string[]>,
  ) {
    super(message);
    this.name = "AuthError";
  }
}

async function postJson(url: string, body?: unknown) {
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new AuthError(data?.message ?? "Request failed.", data?.errors);
  }
  return data;
}

/* ------------------------------------------------------------------ */
/*  Context                                                            */
/* ------------------------------------------------------------------ */

const AuthContext = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    try {
      const res = await fetch("/api/auth/me", { cache: "no-store" });
      const data = await res.json();
      setUser(data?.user ?? null);
    } catch {
      setUser(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  /*
    Returns the signed-in user as well as storing it. The caller needs to know
    about `mustChangePassword` in the same tick to decide where to send them,
    and reading it back off state would be a render too late.
  */
  const login = useCallback(async (email: string, password: string) => {
    const data = await postJson("/api/auth/login", { email, password });
    const signedIn = data.user as AuthUser;

    setUser(signedIn);

    return signedIn;
  }, []);

  const register = useCallback(
    async (input: {
      name: string;
      email: string;
      password: string;
      password_confirmation: string;
    }) => {
      const data = await postJson("/api/auth/register", input);
      setUser(data.user as AuthUser);
    },
    [],
  );

  const logout = useCallback(async () => {
    await postJson("/api/auth/logout").catch(() => null);
    setUser(null);
  }, []);

  const value = useMemo<AuthState>(
    () => ({
      user,
      loading,
      isAuthenticated: user !== null,
      login,
      register,
      logout,
      refresh,
    }),
    [user, loading, login, register, logout, refresh],
  );

  return React.createElement(AuthContext.Provider, { value }, children);
}

export function useAuth(): AuthState {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within an <AuthProvider>");
  return ctx;
}

/**
 * The admin-managed revenue split, as it applies right now.
 *
 * Never hardcode 70/30: an admin can change the fee from the settings page, and
 * a dashboard that assumed 30% would confidently show the wrong money. Both
 * values are null until `/auth/me` has answered.
 */
