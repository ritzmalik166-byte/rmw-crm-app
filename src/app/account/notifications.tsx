import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { StyleSheet, Switch, Text, View } from "react-native";
import { Group, StackHeader } from "@/components/kit";
import { Button, ErrorView, Loading, Screen, T } from "@/components/ui";
import { api, apiMessage } from "@/lib/api";
import { titleCase } from "@/lib/format";
import { useAction } from "@/lib/hooks";
import { colors } from "@/lib/theme";

type Pref = { type: string; inApp: boolean; push: boolean; email: boolean };
const CHANNELS: [keyof Omit<Pref, "type">, string][] = [["inApp", "In app"], ["push", "Push"], ["email", "Email"]];

export default function NotificationSettings() {
  const q = useQuery({ queryKey: ["notification-prefs"], queryFn: () => api<Pref[]>("/crm/notifications/preferences") });
  return (
    <View style={{ flex: 1 }}>
      <StackHeader title="Notifications" />
      {q.isLoading ? <Loading /> : q.isError ? <ErrorView message={apiMessage(q.error)} onRetry={() => void q.refetch()} /> : <PrefsForm initial={q.data!} />}
    </View>
  );
}

function PrefsForm({ initial }: { initial: Pref[] }) {
  const [prefs, setPrefs] = useState<Pref[]>(initial);
  const save = useAction(() => api("/crm/notifications/preferences", { method: "PUT", body: { preferences: prefs } }), { invalidate: [["notification-prefs"]], success: "Notification settings saved" });
  const dirty = JSON.stringify(prefs) !== JSON.stringify(initial);

  return (
        <Screen>
          <T muted size={13}>Choose how you hear about each kind of update.</T>
          <Group>
            {prefs.map((p, i) => (
              <View key={p.type} style={[st.row, i < prefs.length - 1 && st.divider]}>
                <Text style={st.title}>{titleCase(p.type)}</Text>
                <View style={{ flexDirection: "row", gap: 6 }}>
                  {CHANNELS.map(([k, label]) => (
                    <View key={k} style={st.channel}>
                      <Switch value={p[k]} onValueChange={(v) => setPrefs((all) => all.map((x) => (x.type === p.type ? { ...x, [k]: v } : x)))} trackColor={{ true: colors.primary, false: "#D5D8E6" }} thumbColor="#fff" />
                      <Text style={st.label}>{label}</Text>
                    </View>
                  ))}
                </View>
              </View>
            ))}
          </Group>
          <Button title="Save changes" size="lg" onPress={() => save.mutate()} loading={save.isPending} disabled={!dirty} />
        </Screen>
  );
}

const st = StyleSheet.create({
  row: { padding: 14, gap: 10 },
  divider: { borderBottomWidth: 1, borderBottomColor: "#F0F1F6" },
  title: { fontSize: 15, fontWeight: "700", color: colors.text },
  channel: { flex: 1, alignItems: "center", gap: 2 },
  label: { fontSize: 12, color: colors.textMuted },
});
