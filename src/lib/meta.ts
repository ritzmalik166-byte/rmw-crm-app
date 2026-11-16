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
export function useMetaForms(range?: { from: string; to: string } | null) {
  const qs = range ? `?from=${range.from}&to=${range.to}` : "";
  return useQuery({ queryKey: ["meta-forms", range?.from ?? "all", range?.to ?? "all"], queryFn: () => api<MetaForm[]>(`/crm/meta/forms${qs}`), staleTime: 60_000 });
}

export type MetaStatus = {
  configured: boolean;
  state: "NOT_CONFIGURED" | "NOT_CONNECTED" | "SETUP_REQUIRED" | "CONNECTED" | "ERROR";
  connection: null | {
    metaUserName: string | null;
    page: { name: string; webhookSubscribed: boolean } | null;
    adAccount: { name: string } | null;
    website: { code: string } | null;
    formsCount: number;
  };
  health?: {
    token: { valid: boolean | null };
    api: { ok: boolean | null };
    webhook: { subscribed: boolean; lastReceivedAt: string | null };
    leads: { total: number; last24h: number };
  };
  sync?: { running: boolean; lastSyncAt: string | null; status: string | null; stats: SyncStats | null };
  error: { message: string } | null;
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
