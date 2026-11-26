import { Ionicons } from "@expo/vector-icons";
import { useQuery } from "@tanstack/react-query";
import { router, type Href } from "expo-router";
import { useState } from "react";
import { Alert, Pressable, StyleSheet, Switch, Text, View } from "react-native";
import { MultiSelectField, SelectField, Sheet, StackHeader } from "@/components/kit";
import { Badge, Button, Card, ErrorView, Input, Loading, Screen, T, type IconName } from "@/components/ui";
import { api, apiMessage } from "@/lib/api";
import { callStatus, type AiConfig, type AiOverview } from "@/lib/aicall";
import { formatDateTime } from "@/lib/format";
import { confirm, useAction, useLookups } from "@/lib/hooks";
import { colors, shadow } from "@/lib/theme";
import { useAuth } from "@/providers/AuthProvider";

const KEY = ["admin", "ai-calling"];
type ProfileForm = { agentId: string; openingLine: string; questionsText: string };
type Form = Omit<AiConfig, "profiles"> & { questionsText: string; retryText: string; delayText: string; attemptsText: string; recentText: string; profiles: Record<string, ProfileForm> };

const toForm = (c: AiConfig): Form => ({
  ...c,
  questionsText: c.questions.join("\n"),
  retryText: c.retryMinutes.join(", "),
  delayText: String(c.delayMinutes),
  attemptsText: String(c.maxAttempts),
  recentText: String(c.recentCallDays),
  profiles: Object.fromEntries(Object.entries(c.profiles || {}).map(([code, p]) => [code, { agentId: p.agentId || "", openingLine: p.openingLine || "", questionsText: (p.questions || []).join("\n") }])),
});

function Stat({ icon, label, value, tone }: { icon: IconName; label: string; value: string | number; tone: string }) {
  return (
    <View style={st.stat}>
      <View style={[st.statIcon, { backgroundColor: `${tone}1A` }]}><Ionicons name={icon} size={16} color={tone} /></View>
      <Text style={st.statLabel}>{label}</Text>
      <Text style={st.statValue}>{value}</Text>
    </View>
  );
}

function ToggleRow({ title, text, value, onChange, disabled }: { title: string; text?: string; value: boolean; onChange: (v: boolean) => void; disabled?: boolean }) {
  return (
    <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
      <View style={{ flex: 1 }}>
        <T bold size={14}>{title}</T>
        {text ? <T muted size={12.5}>{text}</T> : null}
      </View>
      <Switch value={value} onValueChange={onChange} disabled={disabled} trackColor={{ true: colors.primary, false: colors.border }} thumbColor="#fff" />
    </View>
  );
}

/** Bottom-sheet confirmation before AI calling goes ON: what will happen, blockers, and a consent switch. */
function TurnOnSheet({ open, onClose, data, loading, onConfirm }: { open: boolean; onClose: () => void; data: AiOverview; loading: boolean; onConfirm: () => void }) {
  const [agree, setAgree] = useState(false);
  const c = data.config;
  const provider = data.providers.find((p) => p.id === c.provider);
  const notReady = !!provider && !provider.configured;
  const simulated = c.provider === "simulator";
  const rows: [string, string][] = [
    ["Calling service", provider?.label || c.provider],
    ["Automatic calls", c.enabled ? `On, ${c.delayMinutes} min after a lead arrives` : "Off (only “Call with AI now”)"],
    ["Websites", c.websites.length ? c.websites.join(", ") : "None selected"],
    ["Calling hours (IST)", `${c.windowStart} to ${c.windowEnd}`],
    ["Retries", `${c.maxAttempts} attempts${c.retryMinutes.length ? `, after ${c.retryMinutes.join(" / ")} min` : ""}`],
  ];
  const close = () => { setAgree(false); onClose(); };
  return (
    <Sheet open={open} onClose={close} title="Turn ON AI calling?">
      <View style={{ gap: 14 }}>
        <View style={{ flexDirection: "row", gap: 12, alignItems: "center" }}>
          <View style={[st.statIcon, { width: 44, height: 44, borderRadius: 14, backgroundColor: colors.successSoft }]}><Ionicons name="power" size={22} color={colors.success} /></View>
          <T muted size={13.5} style={{ flex: 1 }}>
            {simulated ? "The Simulator is selected, so no one will actually be dialled. Results are sample data." : "The AI agent will start placing real phone calls to leads using these settings."}
          </T>
        </View>
        <View style={st.summary}>
          {rows.map(([k, v], i) => (
            <View key={k} style={[st.summaryRow, i === rows.length - 1 && { borderBottomWidth: 0 }]}>
              <Text style={{ color: colors.textMuted, fontSize: 13 }}>{k}</Text>
              <Text style={{ color: colors.text, fontSize: 13, fontWeight: "600", flexShrink: 1, textAlign: "right" }}>{v}</Text>
            </View>
          ))}
        </View>
        {notReady ? (
          <View style={[st.note, { backgroundColor: colors.dangerSoft }]}>
            <Ionicons name="warning" size={16} color={colors.danger} />
            <Text style={[st.noteText, { color: colors.danger }]}>{provider!.label} isn&apos;t set up on the server (missing {provider!.missing.join(", ")}). Calls would fail.</Text>
          </View>
        ) : null}
        {simulated ? (
          <View style={[st.note, { backgroundColor: colors.warningSoft }]}>
            <Ionicons name="flask" size={16} color={colors.warning} />
            <Text style={[st.noteText, { color: colors.warning }]}>Pick Bolna or Vapi and save settings first if you want real calls.</Text>
          </View>
        ) : (
          <Pressable onPress={() => setAgree((v) => !v)} style={st.consent}>
            <Ionicons name={agree ? "checkbox" : "square-outline"} size={22} color={agree ? colors.primary : colors.textMuted} />
            <Text style={{ flex: 1, fontSize: 13, color: colors.text, lineHeight: 19 }}>I confirm leads have consented to automated calls, and the questions and calling hours are correct.</Text>
          </Pressable>
        )}
        <Button title="Turn ON" icon="power" size="lg" loading={loading} disabled={(!simulated && !agree) || notReady} onPress={onConfirm} />
        <Button title="Cancel" variant="outline" onPress={close} />
      </View>
    </Sheet>
  );
}

function Editor({ data }: { data: AiOverview }) {
  const { canSA } = useAuth();
  const editable = canSA("aicall.manage");
  const lookups = useLookups();
  const [f, setF] = useState<Form>(() => toForm(data.config));
  const [onOpen, setOnOpen] = useState(false);
  const set = <K extends keyof Form>(k: K) => (v: Form[K]) => setF((x) => ({ ...x, [k]: v }));
  const setProfile = (code: string, k: keyof ProfileForm) => (v: string) =>
    setF((x) => ({ ...x, profiles: { ...x.profiles, [code]: { agentId: "", openingLine: "", questionsText: "", ...x.profiles[code], [k]: v } } }));

  const power = useAction((systemOn: boolean) => api<AiConfig>("/super-admin/ai-calling", { method: "PUT", body: { systemOn } }), {
    invalidate: [KEY],
    onDone: (cfg) => {
      setOnOpen(false);
      Alert.alert(cfg?.systemOn ? "AI calling is ON" : "AI calling is OFF", cfg?.systemOn ? "Calls will be placed according to the settings." : "No calls will be placed until you switch it back on.");
    },
  });
  const save = useAction(() => api<AiConfig>("/super-admin/ai-calling", {
    method: "PUT",
    body: {
      enabled: f.enabled, provider: f.provider, websites: f.websites, language: f.language, skipIfWorked: f.skipIfWorked,
      windowStart: f.windowStart.trim(), windowEnd: f.windowEnd.trim(), openingLine: f.openingLine.trim(),
      delayMinutes: Number(f.delayText), maxAttempts: Number(f.attemptsText), recentCallDays: Number(f.recentText),
      questions: f.questionsText.split("\n").map((q) => q.trim()).filter(Boolean),
      retryMinutes: f.retryText.split(",").map((x) => Number(x.trim())).filter((n) => Number.isFinite(n) && n > 0),
      profiles: Object.fromEntries(Object.entries(f.profiles).map(([code, p]) => [code, {
        agentId: p.agentId.trim(), openingLine: p.openingLine.trim(), questions: p.questionsText.split("\n").map((q) => q.trim()).filter(Boolean),
      }])),
    },
  }), { invalidate: [KEY], success: "AI calling settings saved" });

  const sum = (pred: (s: AiOverview["stats"][number]) => boolean) => data.stats.filter(pred).reduce((n, s) => n + Number(s.count), 0);
  const placed = sum((s) => ["COMPLETED", "NO_ANSWER", "BUSY", "FAILED"].includes(s.status));
  const connected = sum((s) => s.status === "COMPLETED");
  const interested = sum((s) => s.outcome === "INTERESTED" || s.outcome === "CALLBACK");
  const minutes = Math.round(data.stats.reduce((n, s) => n + Number(s.seconds), 0) / 60);
  const on = data.config.systemOn;
  const provider = data.providers.find((p) => p.id === f.provider);
  const websites = (lookups.data?.websites || []).map((w) => ({ value: w.code, label: `${w.code} · ${w.name}` }));
  const agentLabel = f.provider === "vapi" ? "Vapi assistant ID" : "Bolna agent ID";

  const togglePower = () => {
    if (on) confirm("Switch OFF AI calling?", "No calls will be placed (automatic, manual or retries) until you switch it back on. Queued calls will wait.", "Turn OFF", () => power.mutate(false));
    else setOnOpen(true);
  };

  return (
    <Screen>
      <TurnOnSheet open={onOpen} onClose={() => setOnOpen(false)} data={data} loading={power.isPending} onConfirm={() => power.mutate(true)} />

      <View style={[st.banner, { backgroundColor: on ? colors.successSoft : colors.dangerSoft, borderColor: on ? "#BDE9D3" : "#F6C7C9" }]}>
        <View style={[st.dot, { backgroundColor: on ? colors.success : colors.danger }]} />
        <Text style={{ flex: 1, color: on ? colors.success : colors.danger, fontWeight: "600", fontSize: 13.5 }}>
          {on ? "AI calling is ON. Calls go out according to the settings below." : "AI calling is OFF. No calls are placed; queued calls wait."}
        </Text>
      </View>
      {editable ? <Button title={on ? "Turn AI calling OFF" : "Turn AI calling ON"} icon="power" variant={on ? "outline" : "primary"} loading={power.isPending} onPress={togglePower} /> : null}

      <View style={st.stats}>
        <Stat icon="call" label="Calls (30 days)" value={placed} tone={colors.primary} />
        <Stat icon="checkmark-circle" label="Connected" value={connected} tone={colors.success} />
        <Stat icon="sparkles" label="Interested / call back" value={interested} tone={colors.warning} />
        <Stat icon="time" label="Talk minutes" value={minutes} tone={colors.blue} />
      </View>

      <Pressable onPress={() => router.push("/admin/call-recordings" as Href)} style={st.link}>
        <Ionicons name="headset" size={18} color={colors.primary} />
        <Text style={{ flex: 1, fontWeight: "700", color: colors.text }}>Call recordings</Text>
        <Ionicons name="chevron-forward" size={18} color={colors.textFaint} />
      </Pressable>

      {!editable ? <T muted size={13}>You can view these settings; only a Super Admin can change them.</T> : null}

      <Card title="Settings">
        <View style={{ gap: 14 }}>
          <ToggleRow title="Call new leads automatically" text="When off, only “Call with AI now” on a lead places calls." value={f.enabled} onChange={set("enabled")} disabled={!editable} />
          <SelectField label="Calling service" value={f.provider} onChange={(v) => editable && set("provider")(v)}
            options={data.providers.map((p) => ({ value: p.id, label: p.label, sub: p.configured ? "Ready" : `Needs ${p.missing.join(", ")}` }))} />
          {provider && !provider.configured ? <Text style={{ color: colors.warning, fontSize: 12.5 }}>Add {provider.missing.join(", ")} to the server .env and restart it before switching this on.</Text> : null}
          <SelectField label="Language" value={f.language} onChange={(v) => editable && set("language")(v)}
            options={[{ value: "hinglish", label: "Hindi + English (follows the customer)" }, { value: "hindi", label: "Hindi" }, { value: "english", label: "English" }]} />
          <MultiSelectField label="Websites whose new leads are called" values={f.websites} options={websites} onChange={(v) => editable && set("websites")(v)} />
          <View style={{ flexDirection: "row", gap: 10 }}>
            <View style={{ flex: 1 }}><Input label="Call after (min)" value={f.delayText} onChangeText={set("delayText")} keyboardType="number-pad" editable={editable} /></View>
            <View style={{ flex: 1 }}><Input label="Attempts" value={f.attemptsText} onChangeText={set("attemptsText")} keyboardType="number-pad" editable={editable} /></View>
          </View>
          <View style={{ flexDirection: "row", gap: 10 }}>
            <View style={{ flex: 1 }}><Input label="From (IST, HH:MM)" value={f.windowStart} onChangeText={set("windowStart")} keyboardType="numbers-and-punctuation" editable={editable} /></View>
            <View style={{ flex: 1 }}><Input label="Until (IST, HH:MM)" value={f.windowEnd} onChangeText={set("windowEnd")} keyboardType="numbers-and-punctuation" editable={editable} /></View>
          </View>
          <View style={{ flexDirection: "row", gap: 10 }}>
            <View style={{ flex: 1 }}><Input label="Retry after (min)" value={f.retryText} onChangeText={set("retryText")} placeholder="30, 120" keyboardType="numbers-and-punctuation" editable={editable} /></View>
            <View style={{ flex: 1 }}><Input label="Skip if called in (days)" value={f.recentText} onChangeText={set("recentText")} keyboardType="number-pad" editable={editable} /></View>
          </View>
          <ToggleRow title="Skip leads already worked on" text="Don't call if someone changed the stage, added a note or booked a follow-up." value={f.skipIfWorked} onChange={set("skipIfWorked")} disabled={!editable} />
          <Input label="Opening line" value={f.openingLine} onChangeText={set("openingLine")} multiline maxLength={600} editable={editable} />
          <T muted size={12}>Placeholders: {"{name} {brand} {project} {city}"}. Keep the automated-assistant and recording disclosure.</T>
          <Input label="Default questions (one per line)" value={f.questionsText} onChangeText={set("questionsText")} multiline editable={editable} />
        </View>
      </Card>

      {f.websites.length ? (
        <Card title="Script per website">
          <View style={{ gap: 16 }}>
            <T muted size={12.5}>Each business can use its own agent and questions. Leave a box empty to use the defaults.</T>
            {f.websites.map((code) => {
              const p = f.profiles[code] || { agentId: "", openingLine: "", questionsText: "" };
              return (
                <View key={code} style={st.profile}>
                  <T bold size={14}>{code}</T>
                  <Input label={agentLabel} value={p.agentId} onChangeText={setProfile(code, "agentId")} autoCapitalize="none" editable={editable} placeholder="Empty = server default" />
                  <Input label="Opening line" value={p.openingLine} onChangeText={setProfile(code, "openingLine")} multiline maxLength={600} editable={editable} placeholder="Empty = default" />
                  <Input label="Questions (one per line)" value={p.questionsText} onChangeText={setProfile(code, "questionsText")} multiline editable={editable} placeholder="Empty = default questions" />
                </View>
              );
            })}
          </View>
        </Card>
      ) : null}

      {editable ? <Button title="Save settings" size="lg" onPress={() => save.mutate()} loading={save.isPending} /> : null}

      <Card title="Setup status">
        <View style={{ gap: 10 }}>
          {data.providers.map((p) => (
            <View key={p.id} style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
              <T size={14}>{p.label}</T>
              {p.configured ? <Badge label="Ready" bg={colors.successSoft} fg={colors.success} /> : <Badge label={`Needs ${p.missing.length} key${p.missing.length > 1 ? "s" : ""}`} bg={colors.warningSoft} fg={colors.warning} />}
            </View>
          ))}
          {!data.webhook.secretConfigured ? <Text style={{ color: colors.danger, fontSize: 12.5 }}>AI_CALL_WEBHOOK_SECRET is not set, so results from real providers are refused.</Text> : null}
        </View>
      </Card>

      <Card title="Recent calls">
        {!data.recent.length ? <T muted size={13}>No calls yet.</T> : (
          <View>
            {data.recent.slice(0, 15).map((c, i) => {
              const s0 = callStatus(c.status);
              return (
                <Pressable key={c.id} onPress={() => router.push(`/lead/${c.lead_id}`)} style={[st.recent, i === Math.min(14, data.recent.length - 1) && { borderBottomWidth: 0 }]}>
                  <View style={{ flex: 1 }}>
                    <T bold size={14} numberOfLines={1}>{c.lead_name || "Unnamed"}</T>
                    <T muted size={12}>{c.website_code} · {formatDateTime(c.started_at || c.scheduled_at)}{c.provider === "simulator" ? " · simulated" : ""}</T>
                  </View>
                  <View style={{ alignItems: "flex-end", gap: 3 }}>
                    <Badge label={s0.label} bg={s0.bg} fg={s0.fg} />
                    {c.outcome_label ? <T muted size={11.5}>{c.outcome_label}</T> : null}
                  </View>
                </Pressable>
              );
            })}
          </View>
        )}
      </Card>
    </Screen>
  );
}

export default function AiCallingScreen() {
  const q = useQuery({ queryKey: KEY, queryFn: () => api<AiOverview>("/super-admin/ai-calling"), refetchInterval: 30_000 });
  return (
    <View style={{ flex: 1 }}>
      <StackHeader title="AI calling agent" subtitle="Calls new leads, asks the questions, saves the answers" />
      {q.isLoading ? <Loading /> : q.isError ? <ErrorView message={apiMessage(q.error)} onRetry={() => void q.refetch()} /> : <Editor key={q.data!.config.systemOn ? "on" : "off"} data={q.data!} />}
    </View>
  );
}

const st = StyleSheet.create({
  banner: { flexDirection: "row", alignItems: "center", gap: 10, borderRadius: 16, borderWidth: 1, paddingHorizontal: 14, paddingVertical: 12 },
  dot: { width: 10, height: 10, borderRadius: 5 },
  stats: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
  stat: { flexGrow: 1, flexBasis: "45%", backgroundColor: colors.card, borderRadius: 18, padding: 12, gap: 4, borderWidth: 1, borderColor: colors.border, ...shadow.card },
  statIcon: { width: 32, height: 32, borderRadius: 10, alignItems: "center", justifyContent: "center" },
  statLabel: { fontSize: 11.5, color: colors.textMuted, fontWeight: "600" },
  statValue: { fontSize: 20, color: colors.text, fontWeight: "800" },
  link: { flexDirection: "row", alignItems: "center", gap: 10, backgroundColor: colors.card, borderRadius: 16, padding: 14, borderWidth: 1, borderColor: colors.border },
  profile: { gap: 10, borderTopWidth: 1, borderTopColor: colors.border, paddingTop: 12 },
  recent: { flexDirection: "row", alignItems: "center", gap: 10, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: colors.border },
  summary: { borderWidth: 1, borderColor: colors.border, borderRadius: 14 },
  summaryRow: { flexDirection: "row", justifyContent: "space-between", gap: 12, paddingHorizontal: 12, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: colors.border },
  note: { flexDirection: "row", gap: 8, borderRadius: 12, padding: 12, alignItems: "flex-start" },
  noteText: { flex: 1, fontSize: 12.5, lineHeight: 18 },
  consent: { flexDirection: "row", gap: 10, alignItems: "flex-start", backgroundColor: colors.page, borderRadius: 12, padding: 12 },
});
