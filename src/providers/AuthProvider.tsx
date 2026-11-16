import { useQuery, useQueryClient } from "@tanstack/react-query";
import { router } from "expo-router";
import { createContext, useCallback, useContext, useEffect, useMemo, type ReactNode } from "react";
import { api, ApiError, onUnauthorized } from "@/lib/api";
import { unregisterPush, usePushNotifications } from "@/lib/push";
import type { Me } from "@/lib/types";

type AuthValue = {
  me: Me | null;
  loading: boolean;
  can: (perm: string) => boolean;
  /** Permission that is only usable through /api/super-admin (needs the super admin area too). */
  canSA: (perm: string) => boolean;
  refresh: () => Promise<unknown>;
  logout: () => Promise<void>;
};

const AuthContext = createContext<AuthValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const qc = useQueryClient();
  const { data, isLoading, refetch } = useQuery({
    queryKey: ["me"],
    queryFn: async () => {
      try {
        return await api<Me>("/auth/me");
      } catch (e) {
        if (e instanceof ApiError && e.status === 401) return null;
        throw e;
      }
    },
    staleTime: 5 * 60_000,
    retry: 1,
  });

  useEffect(() => onUnauthorized(() => qc.setQueryData(["me"], null)), [qc]);
  usePushNotifications(!!data);

  /**
   * Sign out locally first so the UI switches to the login screen immediately, then tell the server.
   * Note: never `qc.clear()` here. It drops the ["me"] query this provider observes, so setting it to null
   * afterwards never reaches the screen and the app stays "signed in".
   */
  const logout = useCallback(async () => {
    const withTimeout = (p: Promise<unknown>) => Promise.race([p, new Promise((r) => setTimeout(r, 5000))]);
    // Server calls need the session cookie, so start them before the local state is wiped.
    const server = withTimeout(unregisterPush().catch(() => {})).then(() => withTimeout(api("/auth/logout", { method: "POST" }).catch(() => {})));
    await qc.cancelQueries();
    qc.setQueryData(["me"], null);
    qc.removeQueries({ predicate: (q) => q.queryKey[0] !== "me" });
    // Stack.Protected redirects once `me` is null; this is a fallback after that render settles.
    setTimeout(() => { try { router.replace("/login"); } catch { /* already there */ } }, 50);
    await server;
    qc.setQueryData(["me"], null); // in case a request in flight re-filled it
  }, [qc]);

  const value = useMemo<AuthValue>(() => {
    const perms = new Set(data?.permissions ?? []);
    return { me: data ?? null, loading: isLoading, can: (p) => perms.has(p), canSA: (p) => perms.has("area.super_admin") && perms.has(p), refresh: refetch, logout };
  }, [data, isLoading, refetch, logout]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside AuthProvider");
  return ctx;
}
