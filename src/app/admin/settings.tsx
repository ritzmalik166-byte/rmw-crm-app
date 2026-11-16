import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { View } from "react-native";
import { SelectField, StackHeader } from "@/components/kit";
import { Button, Card, ErrorView, Input, Loading, Screen, T } from "@/components/ui";
import { api, apiMessage } from "@/lib/api";
import { useAction } from "@/lib/hooks";
import { useAuth } from "@/providers/AuthProvider";

type Settings = Record<string, unknown>;

/** Human labels for the known settings (keys match DEFAULT_SETTINGS on the server). */
const FIELDS: { key: string; label: string; hint: string; kind: "number" | "list" | "choice"; choices?: string[] }[] = [
  { key: "auth.session_idle_minutes", label: "Sign out after idle (minutes)", hint: "Inactive sessions end after this long", kind: "number" },
  { key: "auth.session_absolute_days", label: "Maximum session length (days)", hint: "Everyone signs in again after this", kind: "number" },
  { key: "auth.trusted_device_days_options", label: "Trusted device options (days)", hint: "Comma separated, e.g. 7, 30, 90", kind: "list" },
  { key: "auth.trusted_device_default_days", label: "Default trusted-device days", hint: "Pre-selected when verifying a device", kind: "number" },
  { key: "auth.password_reset_ttl_minutes", label: "Password reset link valid (minutes)", hint: "", kind: "number" },
  { key: "leads.auto_assign", label: "Auto-assign new leads", hint: "Round robin inside the website's team", kind: "choice", choices: ["NONE", "ROUND_ROBIN_TEAM"] },
  { key: "followups.reminder_minutes_before", label: "Follow-up reminder (minutes before)", hint: "", kind: "number" },
];

function Form({ initial }: { initial: Settings }) {
  const { canSA } = useAuth();
  const toText = (v: unknown) => (Array.isArray(v) ? v.join(", ") : String(v ?? ""));
  const [vals, setVals] = useState<Record<string, string>>(Object.fromEntries(FIELDS.map((f) => [f.key, toText(initial[f.key])])));
  const editable = canSA("settings.manage");
  const parse = () => Object.fromEntries(FIELDS.map((f) => {
    const v = vals[f.key] ?? "";
    if (f.kind === "number") return [f.key, Number(v)];
    if (f.kind === "list") return [f.key, v.split(",").map((x) => Number(x.trim())).filter((n) => n > 0)];
    return [f.key, v];
  }));
  const changed = Object.fromEntries(Object.entries(parse()).filter(([k, v]) => JSON.stringify(v) !== JSON.stringify(initial[k])));
  const save = useAction(() => api("/super-admin/settings", { method: "PUT", body: { settings: changed } }), { invalidate: [["admin", "settings"]], success: "Settings saved" });

  return (
    <Screen>
      {!editable ? <T muted size={13}>You can view these settings; only a Super Admin can change them.</T> : null}
      <Card>
        {FIELDS.map((f) => f.kind === "choice" ? (
          <SelectField key={f.key} label={f.label} value={vals[f.key] ?? ""} onChange={(v) => editable && setVals((s) => ({ ...s, [f.key]: v }))}
            options={f.choices!.map((c) => ({ value: c, label: c === "NONE" ? "Off (assign manually)" : "Round robin within team" }))} />
        ) : (
          <View key={f.key} style={{ gap: 4 }}>
            <Input label={f.label} value={vals[f.key]} editable={editable} keyboardType={f.kind === "number" ? "number-pad" : "numbers-and-punctuation"} onChangeText={(v) => setVals((s) => ({ ...s, [f.key]: v }))} />
            {f.hint ? <T muted size={12} style={{ marginLeft: 4 }}>{f.hint}</T> : null}
          </View>
        ))}
      </Card>
      {editable ? <Button title={`Save${Object.keys(changed).length ? ` ${Object.keys(changed).length} change(s)` : ""}`} size="lg" onPress={() => save.mutate()} loading={save.isPending} disabled={!Object.keys(changed).length} /> : null}
    </Screen>
  );
}

export default function SystemSettings() {
  const q = useQuery({ queryKey: ["admin", "settings"], queryFn: () => api<Settings>("/admin/settings") });
  return (
    <View style={{ flex: 1 }}>
      <StackHeader title="System settings" />
      {q.isLoading ? <Loading /> : q.isError ? <ErrorView message={apiMessage(q.error)} onRetry={() => void q.refetch()} /> : <Form key={q.dataUpdatedAt} initial={q.data!} />}
    </View>
  );
}
