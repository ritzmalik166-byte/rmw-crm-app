import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";

/** Mirrors backend config/leadSources.js. */
export const LEAD_SOURCE_TYPES = { MANUAL: "MANUAL", WEBSITE: "WEBSITE", META: "META", GOOGLE_ADS: "GOOGLE_ADS", WHATSAPP: "WHATSAPP", OTHER: "OTHER" } as const;
export type LeadSourceType = (typeof LEAD_SOURCE_TYPES)[keyof typeof LEAD_SOURCE_TYPES];

/** MPF leads are split by where they came from. */
export type Channel = "website" | "meta";

export type MetaForm = {
  formId: string; name: string; status: string | null; pageName: string | null;
  total: number; newLeads: number; unassigned: number; converted: number; inRange: number | null; lastLeadAt: string | null;
};

/** Meta lead forms with lead counts (GET /crm/meta/forms). Pass from/to for the in-range count. */
export function useMetaForms(range?: { from: string; to: string } | null, enabled = true) {
  const qs = range ? `?from=${range.from}&to=${range.to}` : "";
  return useQuery({ queryKey: ["meta-forms", range?.from ?? "all", range?.to ?? "all"], queryFn: () => api<MetaForm[]>(`/crm/meta/forms${qs}`), staleTime: 60_000, enabled });
}

export type MetaStatus = {
  configured: boolean;
  missingConfig?: string[];
  webhookConfigured?: boolean;
  apiVersion?: string;
  state: "NOT_CONFIGURED" | "NOT_CONNECTED" | "SETUP_REQUIRED" | "CONNECTED" | "ERROR";
  connection: null | {
    metaUserName: string | null;
    connectedAt?: string | null;
    connectedBy?: string | null;
    business?: { id: string; name: string } | null;
    page: { id?: string; name: string; webhookSubscribed: boolean } | null;
    instagram?: { id: string; name: string } | null;
    adAccount: { id?: string; name: string } | null;
    website: { id?: number; code: string; name?: string } | null;
    assignmentTeam?: { id: number; name: string } | null;
    formsCount: number;
  };
  health?: {
    token: { valid: boolean | null; expiresAt?: string | null; missingScopes?: string[] };
    api: { ok: boolean | null; error?: string | null };
    webhook: { subscribed: boolean; lastReceivedAt: string | null };
    leads: { total: number; last24h: number };
    lastLeadAt?: string | null;
    events?: { failed: number; pending: number; last24h: number };
  };
  sync?: { running: boolean; lastSyncAt: string | null; status: string | null; stats: SyncStats | null };
  error: { message: string } | null;
};

export type MetaAssets = {
  selected?: { businessId?: string; pageId?: string; instagramId?: string; adAccountId?: string; websiteId?: number; assignmentTeamId?: number } | null;
  businesses: { id: string; name: string }[];
  pages: { id: string; name: string; businessId?: string | null; instagram?: { id: string; username?: string | null } | null }[];
  adAccounts: { id: string; name: string; currency?: string | null; businessId?: string | null }[];
  warnings?: string[];
};

export type MetaEvent = { id: number; leadgen_id: string; source: string; status: string; lead_id: number | null; error: string | null; created_at: string };
export type MetaLog = { id: number; level: "info" | "warn" | "error"; message: string; created_at: string };

export const fmtNum = (v: number | null | undefined) => Number(v || 0).toLocaleString("en-IN");
export const fmtMoney = (v: number | null | undefined, currency?: string | null) => {
  if (v == null) return "—";
  try { return new Intl.NumberFormat("en-IN", { style: "currency", currency: currency || "INR", maximumFractionDigits: 0 }).format(v); } catch { return `${currency || "₹"} ${Math.round(v)}`; }
};

export type SyncStats = {
  imported: number; duplicatesSkipped: number; errors: number; stopped?: boolean;
  inProgress?: boolean; phase?: "forms" | "leads" | "spend" | "done"; forms?: number; formsDone?: number; currentForm?: string | null; startedAt?: string;
};

export function fmtDuration(ms: number | null) {
  if (ms == null || !Number.isFinite(ms) || ms < 0) return null;
  const s = Math.round(ms / 1000);
  if (s < 60) return `${s} s`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m} min ${s % 60} s`;
  return `${Math.floor(m / 60)} h ${m % 60} min`;
}

/** Progress % and time left from the live sync stats (same formula as the web). */
export function syncEstimate(stats: SyncStats | null | undefined, now = Date.now()) {
  if (!stats?.inProgress || !stats.startedAt) return { pct: null as number | null, elapsed: null as number | null, left: null as number | null };
  const elapsed = now - new Date(stats.startedAt).getTime();
  if (stats.phase === "forms" || !stats.forms) return { pct: null, elapsed, left: null };
  if (stats.phase === "spend") return { pct: 98, elapsed, left: null };
  const frac = Math.min(1, (stats.formsDone ?? 0) / stats.forms);
  const left = frac >= 0.02 && elapsed > 4000 ? (elapsed * (1 - frac)) / frac : null;
  return { pct: Math.max(2, Math.round(frac * 100)), elapsed, left };
}

export const parseJson =<T,>(v: unknown, fallback: T): T => {
  if (v == null) return fallback;
  if (typeof v !== "string") return v as T;
  try { return (JSON.parse(v) as T) ?? fallback; } catch { return fallback; }
};
