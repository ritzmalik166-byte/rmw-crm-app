import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";

export type Role = { id: number; code: string; name: string; description: string | null; level: number; is_system: number; user_count: number; permissions: string[] | string | null };
export type Permission = { id: number; code: string; group_name: string; description: string | null };
export type Department = { id: number; name: string; description: string | null; is_active: number; team_count: number; user_count: number };
export type Team = { id: number; name: string; description: string | null; department_id: number; department_name: string; website_id: number | null; website_code: string | null; is_active: number; member_count: number };
export type Website = { id: number; code: string; name: string; domain: string | null; is_active: number };

const stale = { staleTime: 5 * 60_000 };
export const useRoles = (enabled = true) => useQuery({ queryKey: ["admin", "roles"], queryFn: () => api<Role[]>("/admin/roles"), enabled, ...stale });
export const useDepartments = () => useQuery({ queryKey: ["admin", "departments"], queryFn: () => api<Department[]>("/admin/departments"), ...stale });
export const useTeams = () => useQuery({ queryKey: ["admin", "teams"], queryFn: () => api<Team[]>("/admin/teams"), ...stale });
export const useWebsites = () => useQuery({ queryKey: ["admin", "websites"], queryFn: () => api<Website[]>("/admin/websites"), ...stale });

export const rolePerms = (r: Role): string[] => {
  if (Array.isArray(r.permissions)) return r.permissions.filter(Boolean);
  try { return (JSON.parse(r.permissions || "[]") as string[]).filter(Boolean); } catch { return []; }
};

/** Same rules as the backend password schema. */
export const PASSWORD_RULES: [string, (p: string) => boolean][] = [
  ["At least 10 characters", (p) => p.length >= 10 && p.length <= 128],
  ["An uppercase letter", (p) => /[A-Z]/.test(p)],
  ["A lowercase letter", (p) => /[a-z]/.test(p)],
  ["A number", (p) => /\d/.test(p)],
];
export const strongPassword = (p: string) => PASSWORD_RULES.every(([, ok]) => ok(p));
