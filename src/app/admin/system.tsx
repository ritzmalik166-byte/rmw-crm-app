import { useQuery } from "@tanstack/react-query";
import { Ionicons } from "@expo/vector-icons";
import { StyleSheet, Text, View } from "react-native";
import { StackHeader } from "@/components/kit";
import { Card, ErrorView, Loading, Screen } from "@/components/ui";
import { api, apiMessage } from "@/lib/api";
import { colors, shadow } from "@/lib/theme";

type Health = {
  db: { ok: boolean; latencyMs?: number }; redis: { configured: boolean; ok: boolean };
  otpProvider: boolean; smtp: boolean; webPush: boolean;
  counts: { users: number; leads: number; active_sessions: number; failed_events: number; pending_requests: number };
  uptimeSeconds: number; node: string;
};

const uptime = (s: number) => { const d = Math.floor(s / 86400); const h = Math.floor((s % 86400) / 3600); const m = Math.floor((s % 3600) / 60); return d ? `${d}d ${h}h` : h ? `${h}h ${m}m` : `${m}m`; };

function Check({ label, ok, detail }: { label: string; ok: boolean; detail?: string }) {
  return (
    <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
      <Ionicons name={ok ? "checkmark-circle" : "close-circle"} size={22} color={ok ? colors.success : colors.danger} />
      <Text style={{ flex: 1, fontSize: 15, fontWeight: "600", color: colors.text }}>{label}</Text>
      <Text style={{ fontSize: 13, color: colors.textMuted }}>{detail ?? (ok ? "OK" : "Not configured")}</Text>
    </View>
  );
}

export default function SystemHealth() {
  const q = useQuery({ queryKey: ["admin", "system"], queryFn: () => api<Health>("/super-admin/system-health"), refetchInterval: 30_000 });
  const h = q.data;
  return (
    <View style={{ flex: 1 }}>
      <StackHeader title="System health" subtitle={h ? `Up ${uptime(h.uptimeSeconds)} · Node ${h.node}` : undefined} />
      {q.isLoading ? <Loading /> : q.isError ? <ErrorView message={apiMessage(q.error)} onRetry={() => void q.refetch()} /> : (
        <Screen refreshing={q.isRefetching} onRefresh={() => void q.refetch()}>
          <Card title="Services">
            <Check label="Database" ok={h!.db.ok} detail={h!.db.ok ? `${h!.db.latencyMs} ms` : "Unreachable"} />
            <Check label="Redis / queues" ok={!h!.redis.configured || h!.redis.ok} detail={!h!.redis.configured ? "Not used" : h!.redis.ok ? "Connected" : "Down"} />
            <Check label="SMS OTP provider" ok={h!.otpProvider} />
            <Check label="Email (SMTP)" ok={h!.smtp} />
            <Check label="Browser push" ok={h!.webPush} />
          </Card>
          <View style={st.grid}>
            {([["Users", h!.counts.users], ["Leads", h!.counts.leads], ["Active sessions", h!.counts.active_sessions], ["Pending requests", h!.counts.pending_requests], ["Failed events", h!.counts.failed_events]] as const).map(([l, v]) => (
              <View key={l} style={st.tile}>
                <Text style={[st.value, l === "Failed events" && v > 0 && { color: colors.danger }]}>{Number(v).toLocaleString("en-IN")}</Text>
                <Text style={st.label}>{l}</Text>
              </View>
            ))}
          </View>
        </Screen>
      )}
    </View>
  );
}

const st = StyleSheet.create({
  grid: { flexDirection: "row", flexWrap: "wrap", gap: 12 },
  tile: { flexBasis: "47%", flexGrow: 1, backgroundColor: "#fff", borderRadius: 20, padding: 16, ...shadow.card },
  value: { fontSize: 24, fontWeight: "800", color: colors.text },
  label: { fontSize: 13, color: colors.textMuted, marginTop: 2 },
});
