import { useQuery, useQueryClient } from "@tanstack/react-query";
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

  const logout = useCallback(async () => {
    await unregisterPush();
    await api("/auth/logout", { method: "POST" }).catch(() => {});
    qc.clear();
    qc.setQueryData(["me"], null);
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
