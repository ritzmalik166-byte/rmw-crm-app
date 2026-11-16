import { Ionicons } from "@expo/vector-icons";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import * as Clipboard from "expo-clipboard";
import { useEffect, useState } from "react";
import { ActivityIndicator, Alert, FlatList, Linking, Pressable, RefreshControl, StyleSheet, Switch, Text, View } from "react-native";
import { MetaLogo } from "@/components/Meta";
import { CRM_URL } from "@/lib/api";
import { fmtDuration, syncEstimate, type MetaStatus, type SyncStats } from "@/lib/meta";
import { Sheet, StackHeader } from "@/components/kit";
import { Badge, Button, Chip, EmptyState, ErrorView, Input, Loading, T } from "@/components/ui";
import { useWebsites, type Website } from "@/lib/admin";
import { api, apiMessage } from "@/lib/api";
import { timeAgo, titleCase } from "@/lib/format";
import { confirm, useAction } from "@/lib/hooks";
import { colors, shadow } from "@/lib/theme";
import type { Paged } from "@/lib/types";
import { useAuth } from "@/providers/AuthProvider";

type Health = {
  website_id: number; code: string; name: string; method: string | null; is_active: number; require_signature: number; api_key_prefix: string | null;
  failed_events: number; pending_events: number; events_24h: number; last_event_at?: string | null; last_success_at?: string | null;
};
type Event = { id: number; website: string; status: string; lead_id: number | null; attempts: number; error: string | null; created_at: string };

function WebsiteSheet({ site, health, onClose }: { site: Website | undefined; health: Health; onClose: () => void }) {
  const { canSA } = useAuth();
  const [name, setName] = useState(site?.name ?? health.name);
  const [domain, setDomain] = useState(site?.domain ?? "");
  const [active, setActive] = useState(!!health.is_active);
  const [sig, setSig] = useState(!!health.require_signature);
  const inv = [["admin", "integrations"], ["admin", "websites"]];
  const saveSite = useAction(() => api(`/super-admin/websites/${health.website_id}`, { method: "PATCH", body: { name: name.trim(), domain: domain.trim() || null } }), { invalidate: inv });
  const saveInt = useAction(() => api(`/super-admin/integrations/${health.website_id}`, { method: "PATCH", body: { isActive: active, requireSignature: sig } }), { invalidate: inv, success: "Integration updated" });
  const sync = useAction(() => api<{ created: number; updated: number; failed: number }>(`/super-admin/integrations/${health.website_id}/sync`, { method: "POST" }), {
    invalidate: [...inv, ["leads"], ["dashboard"]],
    onDone: (r) => Alert.alert("Sync finished", `${r?.created ?? 0} new · ${r?.updated ?? 0} refreshed · ${r?.failed ?? 0} failed`),
  });
  const rotate = useAction(() => api<{ apiKey?: string; hmacSecret?: string; endpoint: string }>(`/super-admin/integrations/${health.website_id}/rotate-key`, { method: "POST", body: { requireSignature: sig } }), {
    invalidate: inv,
    onDone: (r) => {
      const key = r?.apiKey ?? "";
      Alert.alert("New API key", `Copy it now, it won't be shown again.\n\n${key}${r?.hmacSecret ? `\n\nSigning secret:\n${r.hmacSecret}` : ""}\n\nEndpoint:\n${r?.endpoint}`, [
        { text: "Copy key", onPress: () => void Clipboard.setStringAsync(key) },
        { text: "Done" },
      ]);
    },
  });
  const manageSite = canSA("website.manage");
  const manageInt = canSA("integration.manage");
  return (
    <Sheet open onClose={onClose} title={`${health.name} (${health.code})`}>
      {manageSite ? (
        <>
          <Input label="Website name" value={name} onChangeText={setName} />
          <Input label="Domain" value={domain} onChangeText={setDomain} autoCapitalize="none" placeholder="example.com" />
          <Button title="Save website" variant="soft" onPress={() => saveSite.mutate()} loading={saveSite.isPending} />
        </>
      ) : null}
      <View style={st.panel}>
        <Row label="Method" value={titleCase(health.method || "push")} />
        <Row label="Key prefix" value={health.api_key_prefix ? `${health.api_key_prefix}…` : "—"} />
        <Row label="Events (24h)" value={String(health.events_24h)} />
        <Row label="Pending / failed" value={`${health.pending_events} / ${health.failed_events}`} />
      </View>
      {manageInt ? (
        <>
          <View style={st.toggle}><T bold size={14} style={{ flex: 1 }}>Integration active</T><Switch value={active} onValueChange={setActive} trackColor={{ true: colors.primary }} thumbColor="#fff" /></View>
          <View style={st.toggle}><T bold size={14} style={{ flex: 1 }}>Require signed requests</T><Switch value={sig} onValueChange={setSig} trackColor={{ true: colors.primary }} thumbColor="#fff" /></View>
          <Button title="Save integration" onPress={() => saveInt.mutate()} loading={saveInt.isPending} />
          <Button title="Sync now" icon="refresh" variant="outline" onPress={() => sync.mutate()} loading={sync.isPending} />
          <Button title="Rotate API key" icon="key" variant="outline" loading={rotate.isPending}
            onPress={() => confirm("Rotate the API key?", "The current key stops working immediately. Update the website with the new key.", "Rotate", () => rotate.mutate())} />
        </>
      ) : null}
    </Sheet>
  );
}

const Row = ({ label, value }: { label: string; value: string }) => (
  <View style={{ flexDirection: "row", justifyContent: "space-between", paddingVertical: 4 }}><T muted size={13}>{label}</T><T size={13} bold>{value}</T></View>
);

const META_STATE: Record<MetaStatus["state"], { label: string; bg: string; fg: string }> = {
  CONNECTED: { label: "Connected", bg: colors.successSoft, fg: colors.success },
  SETUP_REQUIRED: { label: "Setup required", bg: colors.warningSoft, fg: colors.warning },
  ERROR: { label: "Connection error", bg: colors.dangerSoft, fg: colors.danger },
  NOT_CONNECTED: { label: "Not connected", bg: "#EEF0F5", fg: "#4A5070" },
  NOT_CONFIGURED: { label: "Not configured", bg: "#EEF0F5", fg: "#4A5070" },
};

const Check = ({ label, ok }: { label: string; ok: boolean | null | undefined }) => (
  <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
    <Ionicons name={ok ? "checkmark-circle" : ok === false ? "close-circle" : "remove-circle-outline"} size={15} color={ok ? colors.success : ok === false ? colors.danger : colors.textFaint} />
    <Text style={{ fontSize: 13, color: colors.textMuted }}>{label}</Text>
  </View>
);

/** Live sync progress: spinner, bar, % and time left (ticks every second between 3s status polls). */
function SyncProgress({ stats }: { stats: SyncStats | null | undefined }) {
  const [now, setNow] = useState(Date.now());
  useEffect(() => { const t = setInterval(() => setNow(Date.now()), 1000); return () => clearInterval(t); }, []);
  const { pct, elapsed, left } = syncEstimate(stats, now);
  const phase = stats?.phase === "forms" ? "Reading lead forms…" : stats?.phase === "spend" ? "Updating campaign spend…" : "Importing leads";
  return (
    <View style={{ gap: 6, backgroundColor: "#EEF6FF", borderRadius: 14, padding: 12 }}>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
        <ActivityIndicator size="small" color="#0082FB" />
        <Text style={{ flex: 1, fontSize: 13.5, fontWeight: "700", color: colors.text }}>{phase}</Text>
        {pct != null ? <Text style={{ fontSize: 13.5, fontWeight: "800", color: "#0064E0" }}>{pct}%</Text> : null}
      </View>
      <View style={{ height: 8, borderRadius: 4, backgroundColor: "#D6E9FF", overflow: "hidden" }}>
        <View style={{ height: 8, borderRadius: 4, backgroundColor: "#0082FB", width: `${pct ?? 15}%`, opacity: pct == null ? 0.5 : 1 }} />
      </View>
      {stats?.phase === "leads" && stats.forms ? <Text style={st.meta} numberOfLines={1}>Form {Math.min((stats.formsDone ?? 0) + 1, stats.forms)} of {stats.forms}{stats.currentForm ? ` · ${stats.currentForm}` : ""}</Text> : null}
      {stats?.inProgress ? <Text style={st.meta}>Imported {stats.imported} · Already in CRM {stats.duplicatesSkipped}{stats.errors ? ` · Errors ${stats.errors}` : ""}</Text> : null}
      <Text style={[st.meta, { color: colors.text }]}>
        {left != null ? `About ${fmtDuration(left)} left` : "Estimating time left…"}{elapsed != null ? ` · running ${fmtDuration(elapsed)}` : ""}
      </Text>
    </View>
  );
}

/** Meta Lead Ads status. Connecting needs Facebook login in a browser, so that step opens the web CRM. */
function MetaCard() {
  const { canSA } = useAuth();
  const s = useQuery({ queryKey: ["admin", "meta-status"], queryFn: () => api<MetaStatus>("/admin/integrations/meta/status"), refetchInterval: (q) => (q.state.data?.sync?.running ? 3000 : 60_000) });
  const sync = useAction(() => api("/super-admin/integrations/meta/sync", { method: "POST", body: { full: true } }), {
    invalidate: [["admin", "meta-status"]],
    onDone: () => Alert.alert("Full sync started", "Reading the last 90 days of Meta leads. This can take a few minutes."),
  });
  const stop = useAction(() => api("/super-admin/integrations/meta/sync/stop", { method: "POST" }), {
    invalidate: [["admin", "meta-status"]],
    success: "Stopping sync",
  });
  if (s.isLoading || !s.data) return <View style={[st.card, { height: 120 }]} />;
  const d = s.data;
  const c = d.connection;
  const tone = META_STATE[d.state];
  const stats = d.sync?.stats;
  return (
    <View style={[st.card, { gap: 10, marginBottom: 6 }]}>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
        <MetaLogo size={40} />
        <View style={{ flex: 1 }}>
          <Text style={st.name}>Meta Lead Ads</Text>
          <Text style={st.meta}>Facebook + Instagram</Text>
        </View>
        <Badge label={tone.label} bg={tone.bg} fg={tone.fg} dot />
      </View>
      {c ? (
        <>
          <Row label="Page" value={c.page?.name ?? "Not selected"} />
          <Row label="Ad account" value={c.adAccount?.name ?? "—"} />
          <Row label="Pipeline · forms" value={`${c.website?.code ?? "—"} · ${c.formsCount}`} />
          <Row label="Last webhook" value={d.health?.webhook.lastReceivedAt ? timeAgo(d.health.webhook.lastReceivedAt) : "Never"} />
          <Row label="Last sync" value={d.sync?.lastSyncAt ? timeAgo(d.sync.lastSyncAt) : "Never"} />
          <View style={{ flexDirection: "row", gap: 14, flexWrap: "wrap" }}>
            <Check label="Webhook" ok={d.health?.webhook.subscribed} />
            <Check label="API" ok={d.health?.api.ok} />
            <Check label="Token" ok={d.health?.token.valid} />
          </View>
          {d.sync?.running ? <SyncProgress stats={stats} /> : null}
          {!d.sync?.running && stats && d.sync?.lastSyncAt ? <Text style={st.meta}>{stats.stopped ? "Stopped · " : ""}Imported {stats.imported} · Duplicates skipped {stats.duplicatesSkipped} · Errors {stats.errors}</Text> : null}
        </>
      ) : <Text style={st.meta}>Facebook and Instagram lead form submissions arrive in the CRM instantly once connected.</Text>}
      {d.error ? <Text style={[st.meta, { color: colors.danger }]}>{d.error.message}</Text> : null}
      <View style={{ flexDirection: "row", gap: 8 }}>
        {c && d.state !== "SETUP_REQUIRED" && canSA("integration.manage") ? (
          d.sync?.running
            ? <Button title="Stop sync" icon="stop-circle-outline" size="sm" variant="outline" style={{ flex: 1 }} loading={stop.isPending} onPress={() => stop.mutate()} />
            : <Button title="Full sync (90 days)" icon="refresh" size="sm" variant="soft" style={{ flex: 1 }} loading={sync.isPending} onPress={() => sync.mutate()} />
        ) : null}
        {canSA("integration.manage") ? (
          <Button title={c ? "Manage on web" : "Connect on web"} icon="open-outline" size="sm" variant="outline" style={{ flex: 1 }} onPress={() => void Linking.openURL(`${CRM_URL}/super-admin/integrations`)} />
        ) : null}
      </View>
    </View>
  );
}

export default function Integrations() {
  const { can, canSA } = useAuth();
  const qc = useQueryClient();
  const [tab, setTab] = useState<"sites" | "events">("sites");
  const [evStatus, setEvStatus] = useState("");
  const health = useQuery({ queryKey: ["admin", "integrations"], queryFn: () => api<Health[]>("/admin/integrations"), enabled: can("integration.view") });
  const sites = useWebsites();
  const events = useQuery({ queryKey: ["admin", "integration-events", evStatus], queryFn: () => api<Paged<Event>>(`/admin/integrations/events?limit=50${evStatus ? `&status=${evStatus}` : ""}`), enabled: tab === "events" && can("integration.view") });
  const retry = useAction((id: number) => api(`/super-admin/integrations/events/${id}/retry`, { method: "POST" }), { invalidate: [["admin", "integration-events"]], success: "Retry queued" });
  const [open, setOpen] = useState<Health | null>(null);

  const q = tab === "sites" ? health : events;
  return (
    <View style={{ flex: 1, backgroundColor: colors.page }}>
      <StackHeader title="Websites & integrations" />
      <View style={st.tabs}>
        {(["sites", "events"] as const).map((t) => (
          <Pressable key={t} onPress={() => setTab(t)} style={[st.tab, tab === t && st.tabOn]}>
            <Text style={{ fontWeight: "700", color: tab === t ? colors.navy : colors.textMuted }}>{t === "sites" ? "Websites" : "Event log"}</Text>
          </Pressable>
        ))}
      </View>
      {tab === "events" ? (
        <View style={{ flexDirection: "row", gap: 8, paddingHorizontal: 16, paddingBottom: 8 }}>
          {[["", "All"], ["FAILED", "Failed"], ["PROCESSED", "Processed"], ["RECEIVED", "Pending"]].map(([k, l]) => <Chip key={k} label={l!} active={evStatus === k} onPress={() => setEvStatus(k!)} />)}
        </View>
      ) : null}
      {q.isLoading ? <Loading /> : q.isError ? <ErrorView message={apiMessage(q.error)} onRetry={() => void q.refetch()} /> : tab === "sites" ? (
        <FlatList
          data={health.data ?? []}
          keyExtractor={(h) => String(h.website_id)}
          contentContainerStyle={{ padding: 16, gap: 10, paddingBottom: 40 }}
          refreshControl={<RefreshControl refreshing={health.isRefetching} onRefresh={() => { void health.refetch(); void qc.invalidateQueries({ queryKey: ["admin", "meta-status"] }); }} tintColor={colors.primary} />}
          ListHeaderComponent={<MetaCard />}
          renderItem={({ item: h }) => (
            <Pressable onPress={() => setOpen(h)} style={st.card}>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                <Text style={st.name}>{h.name}</Text>
                <Badge label={h.is_active ? "Live" : "Paused"} bg={h.is_active ? colors.successSoft : "#EEF0F5"} fg={h.is_active ? colors.success : "#4A5070"} dot />
                {h.failed_events ? <Badge label={`${h.failed_events} failed`} bg={colors.dangerSoft} fg={colors.danger} /> : null}
              </View>
              <Text style={st.meta}>{h.code} · {h.events_24h} events in 24h · {h.pending_events} pending</Text>
            </Pressable>
          )}
        />
      ) : (
        <FlatList
          data={events.data?.rows ?? []}
          keyExtractor={(e) => String(e.id)}
          contentContainerStyle={{ padding: 16, gap: 10, paddingBottom: 40 }}
          refreshControl={<RefreshControl refreshing={events.isRefetching} onRefresh={() => void events.refetch()} tintColor={colors.primary} />}
          ListEmptyComponent={<EmptyState icon="pulse-outline" title="No events" />}
          renderItem={({ item: e }) => (
            <View style={st.card}>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                <Badge label={e.website} bg={colors.primarySoft} fg={colors.primary} />
                <Badge label={titleCase(e.status)} bg={e.status === "FAILED" ? colors.dangerSoft : e.status === "PROCESSED" ? colors.successSoft : colors.warningSoft} fg={e.status === "FAILED" ? colors.danger : e.status === "PROCESSED" ? colors.success : colors.warning} />
                <Text style={[st.meta, { marginLeft: "auto" }]}>{timeAgo(e.created_at)}</Text>
              </View>
              {e.error ? <Text style={[st.meta, { color: colors.danger }]} numberOfLines={3}>{e.error}</Text> : null}
              <View style={{ flexDirection: "row", alignItems: "center" }}>
                <Text style={st.meta}>#{e.id} · {e.attempts} attempt(s){e.lead_id ? ` · lead ${e.lead_id}` : ""}</Text>
                {e.status === "FAILED" && canSA("integration.manage") ? <Button title="Retry" size="sm" variant="soft" style={{ marginLeft: "auto" }} onPress={() => retry.mutate(e.id)} /> : null}
              </View>
            </View>
          )}
        />
      )}
      {open ? <WebsiteSheet health={open} site={sites.data?.find((s) => s.id === open.website_id)} onClose={() => setOpen(null)} /> : null}
    </View>
  );
}

const st = StyleSheet.create({
  tabs: { flexDirection: "row", marginHorizontal: 16, marginBottom: 8, backgroundColor: "#E9EBF3", borderRadius: 16, padding: 4 },
  tab: { flex: 1, alignItems: "center", paddingVertical: 10, borderRadius: 12 },
  tabOn: { backgroundColor: "#fff", ...shadow.card },
  card: { backgroundColor: "#fff", borderRadius: 20, padding: 14, gap: 6, ...shadow.card },
  name: { fontSize: 16, fontWeight: "700", color: colors.text },
  meta: { fontSize: 13, color: colors.textMuted },
  panel: { backgroundColor: "#fff", borderRadius: 16, padding: 14 },
  toggle: { flexDirection: "row", alignItems: "center", gap: 12, backgroundColor: "#fff", borderRadius: 16, padding: 14 },
});
