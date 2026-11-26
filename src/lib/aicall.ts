import { File, Paths } from "expo-file-system";
import { api, CRM_URL } from "@/lib/api";
import { colors } from "@/lib/theme";
import type { IconName } from "@/components/ui";

/** One AI call, as returned by /crm/leads/:id/ai-calls and /super-admin/ai-call-recordings. */
export type AiCall = {
  id: number;
  lead_id: number;
  attempt: number;
  status: string;
  trigger_type?: string;
  provider?: string;
  scheduled_at?: string | null;
  started_at?: string | null;
  ended_at?: string | null;
  created_at?: string | null;
  duration_seconds?: number | null;
  outcome?: string | null;
  outcome_label?: string | null;
  summary?: string | null;
  transcript?: string | null;
  answers?: Record<string, unknown> | null;
  has_recording?: boolean;
  skip_label?: string | null;
  error?: string | null;
  created_by_name?: string | null;
  // recordings list only
  to_phone?: string;
  lead_name?: string | null;
  website_code?: string;
  website_name?: string;
};

export type AiCallsForLead = { calls: AiCall[]; doNotCall?: boolean; canCall?: boolean; provider?: string };

export type AiProvider = { id: string; label: string; configured: boolean; missing: string[] };
export type AiProfile = { agentId?: string; openingLine?: string; questions?: string[] };
export type AiConfig = {
  systemOn: boolean; enabled: boolean; provider: string; websites: string[]; delayMinutes: number;
  windowStart: string; windowEnd: string; maxAttempts: number; retryMinutes: number[]; skipIfWorked: boolean;
  recentCallDays: number; openingLine: string; questions: string[]; language: "hinglish" | "hindi" | "english";
  profiles: Record<string, AiProfile>;
};
export type AiOverview = {
  config: AiConfig;
  providers: AiProvider[];
  stats: { status: string; outcome: string | null; count: number; seconds: number }[];
  recent: (AiCall & { lead_name?: string; website_code?: string })[];
  webhook: { urlTemplate: string; secretConfigured: boolean };
};
export type RecordingsPage = {
  calls: AiCall[]; page: number; pageSize: number; total: number;
  summary?: { calls: number; seconds: number; positive: number; leads: number };
  websites?: { code: string; name: string; count: number }[];
};

type StatusInfo = { label: string; icon: IconName; bg: string; fg: string };
const FAILED_STATUS: StatusInfo = { label: "Failed", icon: "close-circle", bg: colors.dangerSoft, fg: colors.danger };
export const CALL_STATUS: Record<string, StatusInfo> = {
  SCHEDULED: { label: "Scheduled", icon: "time", bg: "#E8F0FE", fg: "#2563EB" },
  DIALING: { label: "Calling…", icon: "call", bg: "#E8F0FE", fg: "#2563EB" },
  IN_PROGRESS: { label: "On the call", icon: "call", bg: "#E8F0FE", fg: "#2563EB" },
  COMPLETED: { label: "Completed", icon: "call", bg: colors.successSoft, fg: colors.success },
  NO_ANSWER: { label: "No answer", icon: "call-outline", bg: colors.warningSoft, fg: colors.warning },
  BUSY: { label: "Busy", icon: "call-outline", bg: colors.warningSoft, fg: colors.warning },
  FAILED: FAILED_STATUS,
  CANCELLED: { label: "Cancelled", icon: "ban", bg: "#EEF0F5", fg: "#4A5070" },
  SKIPPED: { label: "Skipped", icon: "ban", bg: "#EEF0F5", fg: "#4A5070" },
};
export const callStatus = (s?: string | null): StatusInfo => CALL_STATUS[s || ""] ?? FAILED_STATUS;
export const ACTIVE_STATUSES = ["SCHEDULED", "DIALING", "IN_PROGRESS"];

const UNCLEAR_TONE = { bg: "#EEF0F5", fg: "#4A5070" };
export const OUTCOME_TONE: Record<string, { bg: string; fg: string }> = {
  INTERESTED: { bg: colors.successSoft, fg: colors.success },
  CALLBACK: { bg: "#E8F0FE", fg: "#2563EB" },
  NOT_INTERESTED: { bg: "#EEF0F5", fg: "#4A5070" },
  WRONG_NUMBER: { bg: colors.warningSoft, fg: colors.warning },
  DO_NOT_CALL: { bg: colors.dangerSoft, fg: colors.danger },
  UNCLEAR: { bg: "#EEF0F5", fg: "#4A5070" },
};
export const outcomeTone = (o?: string | null) => OUTCOME_TONE[o || ""] ?? UNCLEAR_TONE;
export const OUTCOMES: [string, string][] = [
  ["", "All outcomes"], ["INTERESTED", "Interested"], ["CALLBACK", "Call back"], ["NOT_INTERESTED", "Not interested"],
  ["WRONG_NUMBER", "Wrong number"], ["DO_NOT_CALL", "Do not call"], ["UNCLEAR", "Unclear"],
];

/** Same order and labels as the web lead page. */
export const ANSWER_LABELS: [string, string][] = [
  ["company", "Company"], ["service", "Service needed"], ["goal", "Goal"], ["currentMarketing", "Current marketing"],
  ["decisionMaker", "Decision maker"], ["website", "Website"],
  ["configuration", "Configuration"], ["budget", "Budget"], ["location", "Preferred location"], ["purpose", "Purpose"],
  ["timeline", "Buying timeline"], ["siteVisit", "Site visit"], ["callbackTime", "Call back"], ["language", "Language"], ["notes", "Notes"],
];

export const WEBSITE_ORDER = ["RMW", "MPF", "CT", "CTMPL"];
export const WEBSITE_NAMES: Record<string, string> = { RMW: "Ritz Media World", MPF: "MyPropertyFact", CT: "Contenaissance", CTMPL: "Creative Thinks Media" };

export const duration = (s?: number | null) =>
  s == null ? null : s < 60 ? `${s}s` : `${Math.floor(s / 60)}m ${String(s % 60).padStart(2, "0")}s`;
export const clock = (s: number) => {
  const v = Number.isFinite(s) && s > 0 ? s : 0;
  return `${Math.floor(v / 60)}:${String(Math.floor(v % 60)).padStart(2, "0")}`;
};
export const talkTime = (secs: number) => {
  if (!secs) return "0m";
  const h = Math.floor(secs / 3600); const m = Math.floor((secs % 3600) / 60); const s = secs % 60;
  return h ? `${h}h ${m}m` : m ? `${m}m ${s}s` : `${s}s`;
};

/** Splits "Agent: … / Customer: …" transcripts into chat bubbles. */
export function transcriptLines(t?: string | null) {
  return (t || "").split("\n").filter(Boolean).map((line) => {
    const m = line.match(/^(Agent|AI|Assistant|Bot|Customer|User)\s*:\s*(.*)$/i);
    if (!m) return { who: null as null | "agent" | "customer", text: line };
    return { who: /^(agent|ai|assistant|bot)$/i.test(m[1] ?? "") ? ("agent" as const) : ("customer" as const), text: m[2] ?? "" };
  });
}

export const recordingUrl = (id: number) => `${CRM_URL}/api/crm/ai-calls/${id}/recording`;

/**
 * Downloads a recording with the signed-in session (the app's fetch sends the session cookie; the audio
 * player's own network stack would not) and caches it as a local file for playback, sharing and saving.
 */
const cached = new Map<number, string>();
export async function localRecording(id: number, name: string): Promise<string> {
  const hit = cached.get(id);
  if (hit) return hit;
  const res = await fetch(recordingUrl(id), { headers: { Origin: CRM_URL, "X-Client": "rmw-crm-app" }, credentials: "include" });
  if (!res.ok) throw new Error(res.status === 403 ? "Only the Owner and Super Admins can play recordings." : `Recording not available (${res.status})`);
  const type = res.headers.get("content-type") || "audio/mpeg";
  const ext = /wav/.test(type) ? "wav" : /ogg/.test(type) ? "ogg" : /mp4|m4a|aac/.test(type) ? "m4a" : "mp3";
  const safe = name.replace(/[^\w.-]+/g, "-").replace(/-+/g, "-").replace(/^-|-$/g, "") || `call-${id}`;
  const file = new File(Paths.cache, `${safe}.${ext}`);
  if (file.exists) file.delete();
  await file.write(new Uint8Array(await res.arrayBuffer()));
  cached.set(id, file.uri);
  return file.uri;
}

export const recordingFileName = (c: AiCall) =>
  `${c.website_code || "call"}-${c.lead_name || `lead-${c.lead_id}`}-${String(c.started_at || c.created_at || "").slice(0, 10)}`;

export const leadAiCalls = (leadId: number | string) => api<AiCallsForLead>(`/crm/leads/${leadId}/ai-calls`);
