import { Ionicons } from "@expo/vector-icons";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { router } from "expo-router";
import { useEffect, useMemo, useState } from "react";
import { ActivityIndicator, Alert, Linking, Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from "react-native";
import { MetaLogo } from "@/components/Meta";
import { SelectField, Sheet, StackHeader } from "@/components/kit";
import { Badge, Button, Chip, EmptyState, ErrorView, Loading, T } from "@/components/ui";
import { useTeams, useWebsites } from "@/lib/admin";
import { api, apiMessage } from "@/lib/api";
import { formatDateTime as fmtDateTime, timeAgo } from "@/lib/format";
import { confirm, useAction } from "@/lib/hooks";
import { fmtDuration, syncEstimate, type MetaAssets, type MetaEvent, type MetaLog, type MetaStatus, type SyncStats } from "@/lib/meta";
import { colors, shadow } from "@/lib/theme";
import type { Paged } from "@/lib/types";
import { useAuth } from "@/providers/AuthProvider";

const STATE: Record<MetaStatus["state"], { label: string; bg: string; fg: string }> = {
  CONNECTED: { label: "Connected", bg: colors.successSoft, fg: colors.success },
  SETUP_REQUIRED: { label: "Setup required", bg: colors.warningSoft, fg: colors.warning },
  ERROR: { label: "Connection error", bg: colors.dangerSoft, fg: colors.danger },
  NOT_CONNECTED: { label: "Not connected", bg: "#EEF0F5", fg: "#4A5070" },
  NOT_CONFIGURED: { label: "Not configured", bg: "#EEF0F5", fg: "#4A5070" },
};
const EV_TONE: Record<string, [string, string]> = {
  PROCESSED: [colors.successSoft, colors.success], DUPLICATE: ["#EEF0F5", "#4A5070"], FAILED: [colors.dangerSoft, colors.danger],
  IGNORED: [colors.warningSoft, colors.warning], RECEIVED: [colors.primarySoft, colors.primary], PROCESSING: [colors.primarySoft, colors.primary],
};
const LOG_COLOR = { info: colors.textMuted, warn: colors.warning, error: colors.danger };
const KEY = ["admin", "meta-status"];

const Kv = ({ label, value, tone }: { label: string; value?: string | null; tone?: string }) => (
  <View style={st.kv}><Text style={st.kvL}>{label}</Text><Text style={[st.kvV, tone ? { color: tone } : null]} numberOfLines={2}>{value || "—"}</Text></View>
);

function Check({ label, ok, okText, badText, hint }: { label: string; ok: boolean | null | undefined; okText: string; badText: string; hint?: string | null }) {
  const icon = ok ? "checkmark-circle" : ok === false ? "close-circle" : "remove-circle-outline";
  const c = ok ? colors.success : ok === false ? colors.danger : colors.textFaint;
  return (
    <View style={st.kv}>
      <Text style={st.kvL}>{label}</Text>
      <View style={{ flex: 1, alignItems: "flex-end" }}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 5 }}>
          <Ionicons name={icon} size={15} color={c} />
          <Text style={[st.kvV, { color: c, flex: 0 }]}>{ok == null ? "Unknown" : ok ? okText : badText}</Text>
        </View>
        {hint && !ok ? <Text style={{ fontSize: 11.5, color: colors.danger, textAlign: "right" }} numberOfLines={3}>{hint}</Text> : null}
      </View>
    </View>
  );
}

function SyncProgress({ stats }: { stats: SyncStats | null | undefined }) {
  const [now, setNow] = useState(Date.now());
  useEffect(() => { const t = setInterval(() => setNow(Date.now()), 1000); return () => clearInterval(t); }, []);
  const { pct, elapsed, left } = syncEstimate(stats, now);
  const phase = stats?.phase === "forms" ? "Reading lead forms…" : stats?.phase === "spend" ? "Updating campaign spend…" : "Importing leads";
  return (
    <View style={st.sync}>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
        <ActivityIndicator size="small" color="#0082FB" />
        <Text style={{ flex: 1, fontSize: 13.5, fontWeight: "700", color: colors.text }}>{phase}</Text>
        {pct != null ? <Text style={{ fontSize: 13.5, fontWeight: "800", color: "#0064E0" }}>{pct}%</Text> : null}
      </View>
      <View style={st.bar}><View style={[st.barFill, { width: `${pct ?? 15}%`, opacity: pct == null ? 0.5 : 1 }]} /></View>
      {stats?.phase === "leads" && stats.forms ? <Text style={st.meta} numberOfLines={1}>Form {Math.min((stats.formsDone ?? 0) + 1, stats.forms)} of {stats.forms}{stats.currentForm ? ` · ${stats.currentForm}` : ""}</Text> : null}
      {stats?.inProgress ? <Text style={st.meta}>Imported {stats.imported} · Already in CRM {stats.duplicatesSkipped}{stats.errors ? ` · Errors ${stats.errors}` : ""}</Text> : null}
      <Text style={[st.meta, { color: colors.text }]}>{left != null ? `About ${fmtDuration(left)} left` : "Estimating time left…"}{elapsed != null ? ` · running ${fmtDuration(elapsed)}` : ""}</Text>
    </View>
  );
}

/** Choose Business / Page / Instagram / Ad account + CRM pipeline and team. Tokens stay on the server. */
function AssetSheet({ onClose }: { onClose: () => void }) {
  const assets = useQuery({ queryKey: ["admin", "meta-assets"], queryFn: () => api<MetaAssets>("/super-admin/integrations/meta/assets"), retry: false, staleTime: 60_000 });
  const websites = useWebsites();
  const teams = useTeams();
  const [f, setF] = useState<{ businessId: string; pageId: string; instagramId: string; adAccountId: string; websiteId: number | null; teamId: number | null } | null>(null);
  useEffect(() => {
    if (!assets.data || f) return;
    const s = assets.data.selected ?? {};
    const mpf = websites.data?.find((w) => w.code === "MPF");
    setF({ businessId: s.businessId ?? "", pageId: s.pageId ?? "", instagramId: s.instagramId ?? "", adAccountId: s.adAccountId ?? "", websiteId: s.websiteId ?? mpf?.id ?? null, teamId: s.assignmentTeamId ?? null });
  }, [assets.data, websites.data, f]);
  const d = assets.data;
  const pages = useMemo(() => (d?.pages ?? []).filter((p) => !f?.businessId || !p.businessId || p.businessId === f.businessId), [d, f?.businessId]);
  const ads = useMemo(() => (d?.adAccounts ?? []).filter((a) => !f?.businessId || !a.businessId || a.businessId === f.businessId), [d, f?.businessId]);
  const page = d?.pages.find((p) => p.id === f?.pageId);
  const forms = useQuery({
    queryKey: ["admin", "meta-asset-forms", f?.pageId],
    queryFn: () => api<{ id: string; name: string }[]>(`/super-admin/integrations/meta/assets/forms?pageId=${encodeURIComponent(f!.pageId)}`),
    enabled: Boolean(f?.pageId), retry: false, staleTime: 60_000,
  });
  const save = useAction(() => api<{ formsCount?: number }>("/super-admin/integrations/meta/selection", {
    method: "PUT",
    body: { pageId: f!.pageId, businessId: f!.businessId || null, instagramId: f!.instagramId || null, adAccountId: f!.adAccountId || null, websiteId: f!.websiteId, assignmentTeamId: f!.teamId },
  }), { invalidate: [KEY, ["admin", "meta-logs"]], onDone: (r) => { Alert.alert("Meta connected", `${r?.formsCount ?? 0} lead forms detected. New leads now arrive automatically.`); onClose(); } });

  const set = (patch: Partial<NonNullable<typeof f>>) => setF((s) => (s ? { ...s, ...patch } : s));
  return (
    <Sheet open onClose={onClose} title="Meta connection">
      {assets.isError ? <ErrorView message={apiMessage(assets.error)} onRetry={() => void assets.refetch()} /> : !f || !d ? <Loading /> : (
        <>
          {d.warnings?.length ? <Text style={st.warn}>{d.warnings.join(" ")}</Text> : null}
          <SelectField label="Business" value={f.businessId} onChange={(v) => set({ businessId: v, pageId: "", instagramId: "", adAccountId: "" })}
            options={[{ value: "", label: d.businesses.length ? "All businesses" : "No business access" }, ...d.businesses.map((b) => ({ value: b.id, label: b.name }))]} />
          <SelectField label="Facebook Page" value={f.pageId} placeholder="Select a Page" onChange={(v) => set({ pageId: v, instagramId: d.pages.find((p) => p.id === v)?.instagram?.id ?? "" })}
            options={pages.map((p) => ({ value: p.id, label: p.name }))} />
          {!pages.length ? <Text style={[st.meta, { color: colors.danger }]}>No Pages found. The account needs a role on the Page.</Text> : null}
          <SelectField label="Instagram" value={f.instagramId} onChange={(v) => set({ instagramId: v })}
            options={[{ value: "", label: "None" }, ...(page?.instagram ? [{ value: page.instagram.id, label: `@${page.instagram.username || page.instagram.id}` }] : [])]} />
          <SelectField label="Ad account (for spend & CPL)" value={f.adAccountId} onChange={(v) => set({ adAccountId: v })}
            options={[{ value: "", label: "None" }, ...ads.map((a) => ({ value: a.id, label: a.name, sub: a.currency ?? undefined }))]} />
          <View style={st.formsBox}>
            <Ionicons name="document-text-outline" size={16} color={colors.textMuted} />
            <Text style={[st.meta, { flex: 1 }]} numberOfLines={2}>
              {!f.pageId ? "Select a Page to detect lead forms." : forms.isLoading ? "Detecting lead forms…" : forms.isError ? apiMessage(forms.error)
                : `${forms.data?.length ?? 0} lead forms detected${forms.data?.length ? `: ${forms.data.slice(0, 3).map((x) => x.name).join(", ")}${forms.data.length > 3 ? "…" : ""}` : ""}`}
            </Text>
          </View>
          <SelectField label="CRM website (pipeline)" value={f.websiteId} placeholder="Select website" onChange={(v) => set({ websiteId: v, teamId: null })}
            options={(websites.data ?? []).map((w) => ({ value: w.id as number | null, label: `${w.code} · ${w.name}` }))} />
          <SelectField label="Assign to team" value={f.teamId} onChange={(v) => set({ teamId: v })}
            options={[{ value: null as number | null, label: "System default" }, ...(teams.data ?? []).filter((t) => t.is_active !== 0 && (!f.websiteId || !t.website_id || t.website_id === f.websiteId)).map((t) => ({ value: t.id as number | null, label: t.name, sub: t.department_name }))]} />
          <Button title="Save connection" onPress={() => save.mutate()} loading={save.isPending} disabled={!f.pageId || !f.websiteId} />
        </>
      )}
    </Sheet>
  );
}

function RoutingSheet({ status, onClose }: { status: MetaStatus; onClose: () => void }) {
  const c = status.connection!;
  const websites = useWebsites();
  const teams = useTeams();
  const [websiteId, setWebsiteId] = useState<number | null>(c.website?.id ?? null);
  const [teamId, setTeamId] = useState<number | null>(c.assignmentTeam?.id ?? null);
  const save = useAction(() => api("/super-admin/integrations/meta/settings", { method: "PATCH", body: { websiteId, assignmentTeamId: teamId } }), {
    invalidate: [KEY], success: "Lead routing saved", onDone: onClose,
  });
  return (
    <Sheet open onClose={onClose} title="Lead routing">
      <T muted size={13}>New Meta leads are created in this pipeline and assigned round robin inside the team (fewest open leads first).</T>
      <SelectField label="CRM website (pipeline)" value={websiteId} onChange={(v) => { setWebsiteId(v); setTeamId(null); }}
        options={(websites.data ?? []).map((w) => ({ value: w.id as number | null, label: `${w.code} · ${w.name}` }))} />
      <SelectField label="Assign to team" value={teamId} onChange={setTeamId}
        options={[{ value: null as number | null, label: "System default" }, ...(teams.data ?? []).filter((t) => t.is_active !== 0 && (!t.website_id || t.website_id === websiteId)).map((t) => ({ value: t.id as number | null, label: t.name, sub: t.department_name }))]} />
      <Button title="Save routing" onPress={() => save.mutate()} loading={save.isPending} disabled={!websiteId} />
    </Sheet>
  );
}

function Deliveries({ canManage }: { canManage: boolean }) {
  const [status, setStatus] = useState("");
  const ev = useQuery({ queryKey: ["admin", "meta-events", status], queryFn: () => api<Paged<MetaEvent>>(`/admin/integrations/meta/events?limit=40${status ? `&status=${status}` : ""}`) });
  const retry = useAction((id: number) => api(`/super-admin/integrations/meta/events/${id}/retry`, { method: "POST" }), { invalidate: [["admin", "meta-events"], KEY], success: "Retry queued" });
  return (
    <View style={{ gap: 10 }}>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
        {[["", "All"], ["PROCESSED", "Processed"], ["DUPLICATE", "Duplicate"], ["FAILED", "Failed"], ["IGNORED", "Ignored"], ["RECEIVED", "Pending"]].map(([k, l]) => (
          <Chip key={k} label={l!} active={status === k} onPress={() => setStatus(k!)} />
        ))}
      </ScrollView>
      {ev.isLoading ? <Loading /> : ev.isError ? <ErrorView message={apiMessage(ev.error)} onRetry={() => void ev.refetch()} /> : !ev.data?.rows.length ? (
        <EmptyState icon="cloud-download-outline" title="No Meta leads received yet" text="Leads appear here as Meta delivers them." />
      ) : ev.data.rows.map((e) => {
        const [bg, fg] = EV_TONE[e.status] ?? ["#EEF0F5", "#4A5070"];
        return (
          <View key={e.id} style={st.card}>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
              <Badge label={e.status.toLowerCase()} bg={bg} fg={fg} />
              <Text style={st.meta}>{e.source.toLowerCase()}</Text>
              <Text style={[st.meta, { marginLeft: "auto" }]}>{timeAgo(e.created_at)}</Text>
            </View>
            <Text style={[st.meta, { fontFamily: "monospace" }]} numberOfLines={1}>META-{e.leadgen_id}</Text>
            {e.error ? <Text style={[st.meta, { color: colors.danger }]} numberOfLines={3}>{e.error}</Text> : null}
            <View style={{ flexDirection: "row", gap: 8 }}>
              {e.lead_id ? <Button title={`Open lead #${e.lead_id}`} size="sm" variant="soft" onPress={() => router.push(`/lead/${e.lead_id}`)} /> : null}
              {canManage && ["FAILED", "IGNORED"].includes(e.status) ? <Button title="Retry" icon="refresh" size="sm" variant="outline" loading={retry.isPending && retry.variables === e.id} onPress={() => retry.mutate(e.id)} /> : null}
            </View>
          </View>
        );
      })}
    </View>
  );
}

function ActivityLog() {
  const logs = useQuery({ queryKey: ["admin", "meta-logs"], queryFn: () => api<MetaLog[]>("/admin/integrations/meta/logs?limit=100"), refetchInterval: 15_000 });
  if (logs.isLoading) return <Loading />;
  if (logs.isError) return <ErrorView message={apiMessage(logs.error)} onRetry={() => void logs.refetch()} />;
  if (!logs.data?.length) return <EmptyState icon="list-outline" title="No activity yet" />;
  return (
    <View style={[st.card, { gap: 0, paddingVertical: 4 }]}>
      {logs.data.map((l, i) => (
        <View key={l.id} style={[st.logRow, i === logs.data!.length - 1 && { borderBottomWidth: 0 }]}>
          <Text style={[st.meta, { width: 74, fontSize: 11.5 }]}>{timeAgo(l.created_at)}</Text>
          <Text style={{ flex: 1, fontSize: 13, color: LOG_COLOR[l.level] ?? colors.textMuted }}>{l.message}</Text>
        </View>
      ))}
    </View>
  );
}

type Tab = "overview" | "deliveries" | "log";

/** Full Meta Lead Ads management: connect, Page/ad account, routing, sync, deliveries, activity log, disconnect. */
export default function MetaIntegration() {
  const { canSA } = useAuth();
  const canManage = canSA("integration.manage");
  const qc = useQueryClient();
  const [tab, setTab] = useState<Tab>("overview");
  const [sheet, setSheet] = useState<"assets" | "routing" | null>(null);
  const [watching, setWatching] = useState(false);
  const s = useQuery({ queryKey: KEY, queryFn: () => api<MetaStatus>("/admin/integrations/meta/status"), refetchInterval: (q) => (q.state.data?.sync?.running || watching ? 3000 : 60_000) });
  const d = s.data;

  // Report the result once a sync we started has finished.
  useEffect(() => {
    if (!watching || !d || d.sync?.running) return;
    const x = d.sync?.stats;
    if (d.sync?.status === "FAILED") Alert.alert("Sync failed", "See the activity log for details.");
    else if (x) Alert.alert("Sync complete", `${x.stopped ? "Stopped early. " : ""}${x.imported} imported · ${x.duplicatesSkipped} already in CRM · ${x.errors} errors`);
    setWatching(false);
  }, [d, watching]);

  const connect = useAction(() => api<{ url: string }>("/super-admin/integrations/meta/connect", { method: "POST" }), {
    onDone: (r) => {
      void Linking.openURL(r.url);
      Alert.alert("Finish in the browser", "Log in with Facebook and allow access. When you come back, pull down to refresh and choose the Page.");
    },
  });
  const sync = useAction(() => api("/super-admin/integrations/meta/sync", { method: "POST", body: { full: true } }), {
    invalidate: [KEY], onDone: () => setTimeout(() => setWatching(true), 1500),
  });
  const stop = useAction(() => api("/super-admin/integrations/meta/sync/stop", { method: "POST" }), { invalidate: [KEY], success: "Stopping sync. Leads already imported are kept." });
  const disconnect = useAction(() => api<{ warnings?: string[] }>("/super-admin/integrations/meta", { method: "DELETE" }), {
    invalidate: [KEY, ["admin", "meta-logs"], ["meta-forms"]],
    onDone: (r) => Alert.alert(r?.warnings?.length ? "Disconnected (some Meta-side cleanup failed; see the log)" : "Meta disconnected"),
  });

  const refresh = () => { void s.refetch(); void qc.invalidateQueries({ queryKey: ["admin", "meta-events"] }); void qc.invalidateQueries({ queryKey: ["admin", "meta-logs"] }); };

  if (s.isLoading) return <View style={st.page}><StackHeader title="Meta Lead Ads" /><Loading /></View>;
  if (s.isError || !d) return <View style={st.page}><StackHeader title="Meta Lead Ads" /><ErrorView message={apiMessage(s.error)} onRetry={() => void s.refetch()} /></View>;

  const c = d.connection;
  const h = d.health;
  const tone = STATE[d.state];
  const running = d.sync?.running || sync.isPending;
  const stats = d.sync?.stats;

  return (
    <View style={st.page}>
      <StackHeader title="Meta Lead Ads" subtitle="Facebook + Instagram" />
      <View style={st.tabs}>
        {([["overview", "Overview"], ["deliveries", "Deliveries"], ["log", "Activity"]] as const).map(([k, l]) => (
          <Pressable key={k} onPress={() => setTab(k)} style={[st.tab, tab === k && st.tabOn]}>
            <Text style={{ fontWeight: "700", color: tab === k ? colors.navy : colors.textMuted }}>{l}</Text>
          </Pressable>
        ))}
      </View>
      <ScrollView contentContainerStyle={{ padding: 16, gap: 12, paddingBottom: 48 }} refreshControl={<RefreshControl refreshing={s.isRefetching} onRefresh={refresh} tintColor={colors.primary} />}>
        {tab === "deliveries" ? <Deliveries canManage={canManage} /> : tab === "log" ? <ActivityLog /> : (
          <>
            <View style={[st.card, { gap: 10 }]}>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
                <MetaLogo size={44} />
                <View style={{ flex: 1 }}>
                  <Text style={st.name}>Meta</Text>
                  <Text style={st.meta} numberOfLines={2}>{c?.metaUserName ? `Connected as ${c.metaUserName}${c.connectedBy ? ` by ${c.connectedBy}` : ""}` : "Facebook + Instagram lead forms"}</Text>
                </View>
                <Badge label={tone.label} bg={tone.bg} fg={tone.fg} dot />
              </View>
              {d.state === "NOT_CONFIGURED" ? <Text style={st.warn}>Server setup needed: set {(d.missingConfig ?? []).join(", ")} in the API environment.</Text> : null}
              {d.state === "NOT_CONNECTED" ? <Text style={st.meta}>Receive Facebook and Instagram lead form submissions in the CRM instantly, with campaign attribution.</Text> : null}
              {d.state === "SETUP_REQUIRED" ? <Text style={st.warn}>Meta is authorised. Choose the Facebook Page and CRM pipeline to start receiving leads.</Text> : null}
              {d.error ? <Text style={[st.warn, { backgroundColor: colors.dangerSoft, color: colors.danger }]}>{d.error.message}</Text> : null}
              {running ? <SyncProgress stats={stats} /> : stats && d.sync?.lastSyncAt ? (
                <Text style={st.meta}>{d.sync.status === "FAILED" ? "Last sync failed" : `${stats.stopped ? "Stopped · " : ""}Last sync: ${stats.imported} imported · ${stats.duplicatesSkipped} duplicates · ${stats.errors} errors`}</Text>
              ) : null}
              {canManage ? (
                <View style={{ gap: 8 }}>
                  {d.state === "NOT_CONNECTED" || d.state === "NOT_CONFIGURED" ? <Button title="Connect Meta" icon="flash" disabled={d.state === "NOT_CONFIGURED"} loading={connect.isPending} onPress={() => connect.mutate()} /> : null}
                  {d.state === "ERROR" ? <Button title="Reconnect" icon="flash" loading={connect.isPending} onPress={() => connect.mutate()} /> : null}
                  {d.state === "SETUP_REQUIRED" ? <Button title="Choose Page" icon="options" onPress={() => setSheet("assets")} /> : null}
                  {c && d.state !== "SETUP_REQUIRED" ? (running
                    ? <Button title="Stop sync" icon="stop-circle-outline" variant="outline" loading={stop.isPending} onPress={() => stop.mutate()} />
                    : <Button title="Full sync (90 days)" icon="refresh" variant="soft" onPress={() => sync.mutate()} />) : null}
                </View>
              ) : null}
            </View>

            {c ? (
              <View style={st.card}>
                <Text style={st.section}>Connection</Text>
                <Kv label="Business" value={c.business?.name} />
                <Kv label="Facebook Page" value={c.page?.name} tone={c.page ? undefined : colors.warning} />
                <Kv label="Instagram" value={c.instagram?.name} />
                <Kv label="Ad account" value={c.adAccount?.name} />
                <Kv label="Lead forms" value={String(c.formsCount)} />
                <Kv label="CRM pipeline" value={c.website ? `${c.website.code}${c.website.name ? ` · ${c.website.name}` : ""}` : "Not set"} tone={c.website ? undefined : colors.warning} />
                <Kv label="Assignment" value={c.assignmentTeam?.name ?? "System default"} />
                <Kv label="Connected" value={c.connectedAt ? fmtDateTime(c.connectedAt) : null} />
                {canManage ? (
                  <View style={{ flexDirection: "row", gap: 8, marginTop: 6 }}>
                    <Button title="Page / ad account" icon="options" size="sm" variant="outline" style={{ flex: 1 }} onPress={() => setSheet("assets")} />
                    <Button title="Lead routing" icon="git-branch" size="sm" variant="outline" style={{ flex: 1 }} onPress={() => setSheet("routing")} />
                  </View>
                ) : null}
              </View>
            ) : null}

            {c && h ? (
              <View style={st.card}>
                <Text style={st.section}>Health</Text>
                <Check label="Webhook" ok={h.webhook.subscribed && d.webhookConfigured !== false} okText="Active" badText={d.webhookConfigured === false ? "Verify token not set" : "Page not subscribed"} />
                <Check label="API" ok={h.api.ok} okText="Connected" badText="Unreachable" hint={h.api.error} />
                <Check label="Token" ok={h.token.valid} okText={h.token.expiresAt ? `Valid · till ${fmtDateTime(h.token.expiresAt)}` : "Valid"} badText="Expired or revoked" />
                <Check label="Permissions" ok={h.token.missingScopes ? !h.token.missingScopes.length : null} okText="All granted" badText={`Missing: ${(h.token.missingScopes ?? []).join(", ")}`} />
                <Kv label="Last webhook" value={h.webhook.lastReceivedAt ? timeAgo(h.webhook.lastReceivedAt) : "Never"} />
                <Kv label="Last Meta lead" value={h.lastLeadAt ? timeAgo(h.lastLeadAt) : "Never"} />
                <Kv label="Last sync" value={d.sync?.lastSyncAt ? timeAgo(d.sync.lastSyncAt) : "Never"} />
                <Kv label="Leads (24h / all)" value={`${h.leads.last24h ?? 0} / ${h.leads.total ?? 0}`} />
                <Kv label="Failed deliveries" value={String(h.events?.failed ?? 0)} tone={h.events?.failed ? colors.danger : undefined} />
              </View>
            ) : null}

            <View style={{ gap: 8 }}>
              <Button title="Meta Ads analytics" icon="bar-chart" variant="soft" onPress={() => router.push("/admin/meta-analytics")} />
              <Button title="Meta leads" icon="people" variant="outline" onPress={() => router.push({ pathname: "/(tabs)/leads", params: { channel: "meta" } })} />
              {canManage && c ? (
                <Button title="Disconnect Meta" icon="unlink" variant="outline" loading={disconnect.isPending}
                  onPress={() => confirm("Disconnect Meta?", "New Facebook and Instagram leads stop arriving. The Page is unsubscribed, access is revoked and stored tokens are deleted. Existing leads stay in the CRM.", "Disconnect", () => disconnect.mutate())} />
              ) : null}
            </View>
            <Text style={[st.meta, { fontSize: 11.5, textAlign: "center" }]}>Graph API {d.apiVersion ?? ""} · tokens are stored encrypted on the server and never sent to the app.</Text>
          </>
        )}
      </ScrollView>
      {sheet === "assets" ? <AssetSheet onClose={() => setSheet(null)} /> : null}
      {sheet === "routing" && c ? <RoutingSheet status={d} onClose={() => setSheet(null)} /> : null}
    </View>
  );
}

const st = StyleSheet.create({
  page: { flex: 1, backgroundColor: colors.page },
  tabs: { flexDirection: "row", marginHorizontal: 16, marginBottom: 4, backgroundColor: "#E9EBF3", borderRadius: 16, padding: 4 },
  tab: { flex: 1, alignItems: "center", paddingVertical: 10, borderRadius: 12 },
  tabOn: { backgroundColor: "#fff", ...shadow.card },
  card: { backgroundColor: "#fff", borderRadius: 20, padding: 14, gap: 6, ...shadow.card },
  name: { fontSize: 17, fontWeight: "800", color: colors.text },
  section: { fontSize: 12, fontWeight: "800", color: colors.textMuted, textTransform: "uppercase", letterSpacing: 0.6, marginBottom: 2 },
  meta: { fontSize: 13, color: colors.textMuted },
  warn: { fontSize: 12.5, color: "#8A5A00", backgroundColor: colors.warningSoft, borderRadius: 10, padding: 10, overflow: "hidden" },
  kv: { flexDirection: "row", gap: 12, paddingVertical: 5 },
  kvL: { width: 118, fontSize: 13, color: colors.textMuted },
  kvV: { flex: 1, fontSize: 13, fontWeight: "600", color: colors.text, textAlign: "right" },
  sync: { gap: 6, backgroundColor: "#EEF6FF", borderRadius: 14, padding: 12 },
  bar: { height: 8, borderRadius: 4, backgroundColor: "#D6E9FF", overflow: "hidden" },
  barFill: { height: 8, borderRadius: 4, backgroundColor: "#0082FB" },
  formsBox: { flexDirection: "row", alignItems: "center", gap: 8, borderWidth: 1, borderStyle: "dashed", borderColor: "#CBD2E1", borderRadius: 12, padding: 10 },
  logRow: { flexDirection: "row", gap: 8, paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: "#F0F1F6" },
});
