import { Ionicons } from "@expo/vector-icons";
import { useQuery } from "@tanstack/react-query";
import { StyleSheet, Text, View } from "react-native";
import { StackHeader } from "@/components/kit";
import { Badge, Button, ErrorView, Loading, Screen } from "@/components/ui";
import { api, apiMessage } from "@/lib/api";
import { timeAgo } from "@/lib/format";
import { confirm, useAction } from "@/lib/hooks";
import { colors, shadow } from "@/lib/theme";

type Session = {
  id: number; ip_address: string | null; auth_method: string; created_at: string; last_activity_at: string;
  device_name: string | null; browser: string | null; operating_system: string | null; is_trusted: number | boolean; current: boolean;
};

export default function Sessions() {
  const q = useQuery({ queryKey: ["sessions"], queryFn: () => api<Session[]>("/auth/sessions") });
  const revoke = useAction((id: number) => api(`/auth/sessions/${id}`, { method: "DELETE" }), { invalidate: [["sessions"]] });
  const all = useAction(() => api("/auth/sessions/logout-all", { method: "POST" }), { invalidate: [["sessions"]], success: "Signed out of all other devices" });
  const others = (q.data ?? []).filter((s) => !s.current).length;

  return (
    <View style={{ flex: 1 }}>
      <StackHeader title="Devices & sessions" subtitle={q.data ? `${q.data.length} active` : undefined} />
      {q.isLoading ? <Loading /> : q.isError ? <ErrorView message={apiMessage(q.error)} onRetry={() => void q.refetch()} /> : (
        <Screen refreshing={q.isRefetching} onRefresh={() => void q.refetch()}>
          {q.data!.map((s) => {
            const mobile = /android|ios|iphone|mobile/i.test(`${s.operating_system} ${s.device_name}`);
            return (
              <View key={s.id} style={st.card}>
                <View style={st.icon}><Ionicons name={mobile ? "phone-portrait" : "desktop"} size={20} color={colors.primary} /></View>
                <View style={{ flex: 1, gap: 3 }}>
                  <View style={{ flexDirection: "row", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
                    <Text style={st.name} numberOfLines={1}>{s.device_name || [s.browser, s.operating_system].filter(Boolean).join(" on ") || "Unknown device"}</Text>
                    {s.current ? <Badge label="This device" bg={colors.successSoft} fg={colors.success} /> : null}
                    {s.is_trusted ? <Badge label="Trusted" bg={colors.primarySoft} fg={colors.primary} /> : null}
                  </View>
                  <Text style={st.meta}>{[s.ip_address, `active ${timeAgo(s.last_activity_at)}`].filter(Boolean).join(" · ")}</Text>
                </View>
                {!s.current ? (
                  <Button title="Sign out" size="sm" variant="outline" loading={revoke.isPending && revoke.variables === s.id}
                    onPress={() => confirm("Sign out this device?", "It will need to sign in again.", "Sign out", () => revoke.mutate(s.id))} />
                ) : null}
              </View>
            );
          })}
          {others > 0 ? (
            <Button title="Sign out all other devices" icon="log-out-outline" variant="outline" loading={all.isPending}
              onPress={() => confirm("Sign out everywhere else?", `${others} other device${others > 1 ? "s" : ""} will be signed out.`, "Sign out all", () => all.mutate())} />
          ) : null}
        </Screen>
      )}
    </View>
  );
}

const st = StyleSheet.create({
  card: { flexDirection: "row", alignItems: "center", gap: 12, backgroundColor: "#fff", borderRadius: 20, padding: 14, ...shadow.card },
  icon: { width: 44, height: 44, borderRadius: 15, backgroundColor: colors.primarySoft, alignItems: "center", justifyContent: "center" },
  name: { fontSize: 15, fontWeight: "700", color: colors.text, flexShrink: 1 },
  meta: { fontSize: 12.5, color: colors.textMuted },
});
