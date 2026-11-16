import { Ionicons } from "@expo/vector-icons";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { LinearGradient } from "expo-linear-gradient";
import { router } from "expo-router";
import { useState } from "react";
import { ActivityIndicator, Image, Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { LeadCard } from "@/components/LeadCard";
import { RangeBar, rangeLabel, todayRange, type Range } from "@/components/RangeBar";
import { Avatar, EmptyState, ErrorView, Section, type IconName } from "@/components/ui";
import { api, apiMessage } from "@/lib/api";
import { PIPELINES, type PipelineCounts, type PipelineKey } from "@/lib/pipelines";
import { colors, gradients, shadow } from "@/lib/theme";
import type { LeadRow, Paged } from "@/lib/types";
import { useAuth } from "@/providers/AuthProvider";
import { useLookups } from "@/lib/hooks";
import { MetaFormRow } from "@/components/Meta";
import { useMetaForms } from "@/lib/meta";

type Dashboard = {
  mine: {
    leads: { total: number; new_leads: number; converted: number; converted_30d: number };
    followups: { today: number; overdue: number; upcoming: number };
    recent: LeadRow[];
  };
  team: null | {
    leads: { total: number; unassigned: number; new_leads: number; converted_30d: number };
    followups: { due_today: number; overdue: number };
    teamPerformance: { id: number; full_name: string; assigned: number; converted: number; open_leads: number }[];
  };
};

function Stat({ icon, label, value, tone, onPress }: { icon: IconName; label: string; value?: number; tone: string; onPress?: () => void }) {
  return (
    <Pressable onPress={onPress} disabled={!onPress} style={({ pressed }) => [st.stat, pressed && { transform: [{ scale: 0.97 }] }]}>
      <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start" }}>
        <Text style={st.statLabel} numberOfLines={2}>{label}</Text>
        <View style={[st.statIcon, { backgroundColor: `${tone}1F` }]}><Ionicons name={icon} size={18} color={tone} /></View>
      </View>
      <Text style={st.statValue}>{value ?? "–"}</Text>
    </Pressable>
  );
}

const leadsHref = (r: Range, extra: Record<string, string> = {}) => ({ pathname: "/leads" as const, params: { from: r.from, to: r.to, preset: r.preset, ...extra } });

export default function Home() {
  const insets = useSafeAreaInsets();
  const { me } = useAuth();
  const [range, setRange] = useState<Range>(todayRange);
  const [rangeOpen, setRangeOpen] = useState(false);
  const rq = `from=${range.from}&to=${range.to}`;
  const label = rangeLabel(range);
  const metaForms = useMetaForms(range);

  const dash = useQuery({ queryKey: ["dashboard", range.from, range.to], queryFn: () => api<Dashboard>(`/crm/dashboard?${rq}`), placeholderData: keepPreviousData, refetchInterval: 60_000 });
  const pipes = useQuery({
    queryKey: ["pipelines", range.from, range.to],
    queryFn: () => api<{ counts: Partial<Record<PipelineKey, PipelineCounts>> }>(`/crm/pipelines?${rq}`),
    placeholderData: keepPreviousData,
    refetchInterval: 60_000,
  });
  // Fallback when /crm/pipelines fails (e.g. older server): derive counts from the leads list totals.
  const lookups = useLookups();
  const newId = lookups.data?.statuses.find((x) => /^new$/i.test(x.name))?.id;
  const fallback = useQuery({
    queryKey: ["pipelines-fallback", range.from, range.to, newId],
    enabled: pipes.isError,
    placeholderData: keepPreviousData,
    queryFn: async () => {
      const total = (qs: string) => api<Paged<LeadRow>>(`/crm/leads?${rq}&limit=1&${qs}`).then((r) => r.meta.total).catch(() => 0);
      const out: Partial<Record<PipelineKey, PipelineCounts>> = {};
      await Promise.all(PIPELINES.map(async (p) => {
        const [t, un, nw] = await Promise.all([
          total(`pipeline=${p.key}`),
          total(`pipeline=${p.key}&assignedUserId=unassigned`),
          newId ? total(`pipeline=${p.key}&statusId=${newId}`) : Promise.resolve(0),
        ]);
        out[p.key] = { total: t, unassigned: un, new_leads: nw, converted: 0, today: 0, overdue: 0 };
      }));
      return { counts: out };
    },
  });
  const pipeData = pipes.isError ? fallback.data : pipes.data;
  const pipeLoading = pipes.isError ? fallback.isFetching : pipes.isFetching && (pipes.isPlaceholderData || !pipes.data);
  const dashLoading = dash.isFetching && dash.isPlaceholderData;
  const received = useQuery({
    queryKey: ["leads", "home", range.from, range.to],
    queryFn: () => api<Paged<LeadRow>>(`/crm/leads?${rq}&limit=10&sort=received_at&dir=desc`),
    placeholderData: keepPreviousData,
    refetchInterval: 60_000,
  });
  const unread = useQuery({
    queryKey: ["notifications", "unread"],
    queryFn: () => api<{ count?: number; unread?: number } | number>("/crm/notifications/unread-count"),
    refetchInterval: 60_000,
  });
  const badge = typeof unread.data === "number" ? unread.data : unread.data?.count ?? unread.data?.unread ?? 0;

  const first = me?.user.full_name?.split(" ")[0] ?? "there";
  const d = dash.data;
  const fu = d?.mine.followups;
  const team = d?.team;
  const counts = pipeData?.counts ?? {};
  const sum = (f: keyof PipelineCounts) => PIPELINES.reduce((a, p) => a + (counts[p.key]?.[f] ?? 0), 0);
  const totalReceived = received.data?.meta.total;
  const refreshing = (dash.isRefetching && !dash.isPlaceholderData) || (received.isRefetching && !received.isPlaceholderData);

  const bar = [
    { label: "Total", value: sum("total"), color: gradients.pipeline[0], view: undefined },
    { label: "New", value: sum("new_leads"), color: gradients.pipeline[1], view: undefined },
    { label: "Unassigned", value: sum("unassigned"), color: gradients.pipeline[2], view: "unassigned" },
    { label: "Converted", value: sum("converted"), color: gradients.pipeline[3], view: undefined },
  ];

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: colors.page }}
      contentContainerStyle={{ paddingBottom: 130 }}
      showsVerticalScrollIndicator={false}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { void dash.refetch(); void received.refetch(); void pipes.refetch(); }} tintColor="#fff" progressViewOffset={insets.top} />}
    >
      <LinearGradient colors={gradients.brand} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={[st.hero, { paddingTop: insets.top + 12 }]}>
        <View style={[st.orb, { top: -70, right: -50, backgroundColor: "#6C4FE8" }]} />
        <View style={[st.orb, { bottom: -120, left: -90, backgroundColor: colors.gold, opacity: 0.12 }]} />

        <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
          <View style={st.brandTile}><Image source={require("../../../assets/images/crm-icon.png")} style={{ width: 24, height: 24 }} resizeMode="contain" /></View>
          <Text style={{ color: "#fff", fontSize: 17, fontWeight: "800", flex: 1 }}>RMW <Text style={{ color: colors.gold }}>CRM</Text></Text>
          <Pressable onPress={() => router.push("/notifications")} hitSlop={8} style={st.glassBtn} accessibilityLabel="Notifications">
            <Ionicons name="notifications-outline" size={20} color="#fff" />
            {badge > 0 ? <View style={st.badge}><Text style={st.badgeText}>{badge > 9 ? "9+" : badge}</Text></View> : null}
          </Pressable>
          <Pressable onPress={() => router.push("/profile")} style={st.avatarRing}><Avatar name={me?.user.full_name} src={me?.user.avatar} size={34} tone={colors.gold} /></Pressable>
        </View>

        <View style={{ flexDirection: "row", alignItems: "flex-end", marginTop: 26, gap: 12 }}>
          <View style={{ flex: 1 }}>
            <Text style={st.hello}>Hi {first} 👋</Text>
            <Text style={st.helloSub}>Here&apos;s your lead performance · {label.toLowerCase()}</Text>
          </View>
          <Pressable onPress={() => setRangeOpen((o) => !o)} style={st.rangePill}>
            {dashLoading || pipeLoading ? <ActivityIndicator size="small" color="#fff" /> : null}
            <Text style={{ color: "#fff", fontWeight: "700", fontSize: 13 }}>{label}</Text>
            <Ionicons name={rangeOpen ? "chevron-up" : "chevron-down"} size={14} color="#fff" />
          </Pressable>
        </View>
        {rangeOpen ? <View style={{ marginTop: 14, marginRight: -20 }}><RangeBar value={range} dark onChange={(r) => { if (r) setRange(r); setRangeOpen(false); }} /></View> : null}

        {dash.isError ? <View style={[st.panel, { marginTop: 18 }]}><ErrorView message={apiMessage(dash.error)} onRetry={() => void dash.refetch()} /></View> : (
          <View style={[st.grid, dashLoading && { opacity: 0.55 }]}>
            {dashLoading ? <View style={st.gridLoader}><ActivityIndicator color="#fff" /></View> : null}
            <Stat icon="person-add-outline" label={`New leads`} value={d?.mine.leads.new_leads} tone={colors.violet} onPress={() => router.push(leadsHref(range, { view: "me" }))} />
            <Stat icon="calendar-outline" label="Follow-ups today" value={fu?.today} tone={colors.saffron} onPress={() => router.push("/followups")} />
            <Stat icon="checkmark-circle-outline" label="Converted · 30d" value={d?.mine.leads.converted_30d} tone={colors.success} />
            <Stat icon="alarm-outline" label="Overdue" value={fu?.overdue} tone={colors.danger} onPress={() => router.push("/followups")} />
          </View>
        )}
      </LinearGradient>

      <View style={{ paddingHorizontal: 16, marginTop: 18, gap: 22 }}>
        <View style={st.panel}>
          <View style={st.panelHead}>
            <Ionicons name="funnel-outline" size={18} color={colors.primary} />
            <Text style={st.panelTitle}>Leads pipeline</Text>
            {pipeLoading ? <ActivityIndicator size="small" color={colors.primary} /> : null}
            <Text style={st.link} onPress={() => router.push(leadsHref(range))}>View all</Text>
          </View>
          <View style={[st.segBar, pipeLoading && { opacity: 0.45 }]}>
            {bar.map((b, i) => (
              <Pressable key={b.label} onPress={() => router.push(leadsHref(range, b.view ? { view: b.view } : {}))} style={[st.seg, { backgroundColor: b.color }, i === 0 && st.segFirst, i === bar.length - 1 && st.segLast]}>
                <Text style={st.segValue}>{pipeData ? b.value : "–"}</Text>
                <Text style={st.segLabel} numberOfLines={1}>{b.label}</Text>
              </Pressable>
            ))}
          </View>

          {PIPELINES.map((p) => {
            const c = counts[p.key];
            return (
              <Pressable key={p.key} onPress={() => router.push(leadsHref(range, { view: p.key }))} style={({ pressed }) => [st.pipeRow, pipeLoading && { opacity: 0.45 }, pressed && { backgroundColor: "#F8F6FE" }]}>
                <View style={[st.pipeLogo, { backgroundColor: `${p.tone}14` }]}><Image source={p.logo} style={{ width: 26, height: 26 }} resizeMode="contain" /></View>
                <View style={{ flex: 1, gap: 5 }}>
                  <Text style={st.pipeTitle}>{p.title}</Text>
                  <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6 }}>
                    <Pill text={`${c?.new_leads ?? 0} new`} fg={colors.violet} />
                    {c?.unassigned ? <Pill text={`${c.unassigned} unassigned`} fg={colors.warning} /> : null}
                    {c?.overdue ? <Pill text={`${c.overdue} overdue`} fg={colors.danger} /> : null}
                    {c?.converted ? <Pill text={`${c.converted} won`} fg={colors.success} /> : null}
                  </View>
                </View>
                <View style={{ alignItems: "flex-end" }}>
                  <Text style={st.pipeTotal}>{c ? c.total : "–"}</Text>
                  <Text style={st.pipeSub}>LEADS</Text>
                </View>
                <Ionicons name="chevron-forward" size={16} color={colors.textFaint} />
              </Pressable>
            );
          })}
        </View>

        {team ? (
          <View style={st.grid2}>
            <Stat icon="people-outline" label={`Team leads · ${label}`} value={team.leads.total} tone={colors.blue} onPress={() => router.push(leadsHref(range))} />
            <Stat icon="person-remove-outline" label="Unassigned" value={team.leads.unassigned} tone={colors.warning} onPress={() => router.push(leadsHref(range, { view: "unassigned" }))} />
          </View>
        ) : null}

        <Section title={`Leads received · ${label}`} action={totalReceived ? `View all ${totalReceived}` : undefined} onAction={() => router.push(leadsHref(range))}>
          {received.isLoading || (received.isFetching && received.isPlaceholderData) ? (
            <View style={{ gap: 10 }}>{[0, 1, 2].map((i) => <View key={i} style={st.skeleton} />)}</View>
          ) : received.data?.rows.length ? (
            <View style={{ gap: 10 }}>{received.data.rows.map((l) => <LeadCard key={l.id} lead={l} />)}</View>
          ) : (
            <View style={st.panel}>
              <EmptyState icon="sunny-outline" title={range.preset === "today" ? "No leads yet today" : "No leads in this period"} text="Pick another range at the top to look back at earlier days." />
            </View>
          )}
        </Section>

        {metaForms.data?.length ? (
          <Section title={`Meta lead forms · ${label}`} action="All Meta leads" onAction={() => router.push({ pathname: "/leads", params: { view: "mpf", channel: "meta" } })}>
            <View style={[st.panel, { paddingVertical: 4, overflow: "hidden" }]}>
              {metaForms.data.slice(0, 6).map((f) => (
                <MetaFormRow key={f.formId} form={f} onPress={() => router.push({ pathname: "/leads", params: { view: "mpf", channel: "meta", formId: f.formId } })} />
              ))}
            </View>
          </Section>
        ) : null}

        {team?.teamPerformance.length ? (
          <Section title="Team performance">
            <View style={[st.panel, { paddingVertical: 6 }]}>
              {team.teamPerformance.slice(0, 8).map((u, i) => (
                <View key={u.id} style={[st.perf, i > 0 && { borderTopWidth: 1, borderTopColor: "#F1EEF9" }]}>
                  <Avatar name={u.full_name} size={36} />
                  <Text style={{ flex: 1, fontWeight: "600", color: colors.text }} numberOfLines={1}>{u.full_name}</Text>
                  <View style={{ alignItems: "flex-end" }}>
                    <Text style={{ fontWeight: "800", color: colors.text }}>{u.assigned}</Text>
                    <Text style={{ fontSize: 11, color: colors.textMuted }}>{u.open_leads} open · {u.converted} won</Text>
                  </View>
                </View>
              ))}
            </View>
          </Section>
        ) : null}
      </View>
    </ScrollView>
  );
}

function Pill({ text, fg }: { text: string; fg: string }) {
  return <View style={{ backgroundColor: `${fg}14`, borderRadius: 999, paddingHorizontal: 8, paddingVertical: 2 }}><Text style={{ color: fg, fontSize: 11, fontWeight: "700" }}>{text}</Text></View>;
}

const st = StyleSheet.create({
  hero: { paddingHorizontal: 20, paddingBottom: 22, borderBottomLeftRadius: 30, borderBottomRightRadius: 30, overflow: "hidden" },
  orb: { position: "absolute", width: 240, height: 240, borderRadius: 120, opacity: 0.35 },
  brandTile: { width: 36, height: 36, borderRadius: 11, backgroundColor: "#fff", alignItems: "center", justifyContent: "center" },
  glassBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: "rgba(255,255,255,0.12)", borderWidth: 1, borderColor: "rgba(255,255,255,0.16)", alignItems: "center", justifyContent: "center" },
  badge: { position: "absolute", top: 4, right: 4, minWidth: 16, height: 16, borderRadius: 8, paddingHorizontal: 3, backgroundColor: colors.danger, alignItems: "center", justifyContent: "center", borderWidth: 1.5, borderColor: colors.navy },
  badgeText: { color: "#fff", fontSize: 9, fontWeight: "800" },
  avatarRing: { padding: 2, borderRadius: 21, borderWidth: 1.5, borderColor: "rgba(242,181,74,0.7)" },
  hello: { color: "#fff", fontSize: 26, fontWeight: "800", letterSpacing: -0.6 },
  helloSub: { color: "rgba(255,255,255,0.7)", fontSize: 13.5, marginTop: 4 },
  rangePill: { flexDirection: "row", alignItems: "center", gap: 6, paddingHorizontal: 14, paddingVertical: 8, borderRadius: 999, backgroundColor: "rgba(255,255,255,0.14)", borderWidth: 1, borderColor: "rgba(255,255,255,0.2)" },
  grid: { flexDirection: "row", flexWrap: "wrap", gap: 12, marginTop: 20 },
  gridLoader: { position: "absolute", top: 0, bottom: 0, left: 0, right: 0, alignItems: "center", justifyContent: "center", zIndex: 2 },
  grid2: { flexDirection: "row", gap: 12 },
  stat: { flexBasis: "46%", flexGrow: 1, backgroundColor: "#fff", borderRadius: 20, padding: 14, ...shadow.card },
  statIcon: { width: 36, height: 36, borderRadius: 12, alignItems: "center", justifyContent: "center" },
  statLabel: { flex: 1, fontSize: 13, color: colors.textMuted, fontWeight: "600", paddingRight: 6 },
  statValue: { fontSize: 30, fontWeight: "800", color: colors.text, letterSpacing: -0.8, marginTop: 6 },
  panel: { backgroundColor: "#fff", borderRadius: 22, ...shadow.card, overflow: "hidden" },
  panelHead: { flexDirection: "row", alignItems: "center", gap: 8, paddingHorizontal: 16, paddingTop: 16 },
  panelTitle: { flex: 1, fontSize: 17, fontWeight: "800", color: colors.text, letterSpacing: -0.3 },
  link: { color: colors.primary, fontWeight: "700", fontSize: 13.5 },
  segBar: { flexDirection: "row", gap: 3, margin: 16, marginBottom: 8 },
  seg: { flex: 1, paddingVertical: 10, paddingHorizontal: 8, borderRadius: 4 },
  segFirst: { borderTopLeftRadius: 14, borderBottomLeftRadius: 14 },
  segLast: { borderTopRightRadius: 14, borderBottomRightRadius: 14 },
  segValue: { color: "#fff", fontSize: 19, fontWeight: "800" },
  segLabel: { color: "rgba(255,255,255,0.9)", fontSize: 11, fontWeight: "600" },
  pipeRow: { flexDirection: "row", alignItems: "center", gap: 12, paddingHorizontal: 16, paddingVertical: 12, borderTopWidth: 1, borderTopColor: "#F1EEF9" },
  pipeLogo: { width: 44, height: 44, borderRadius: 14, alignItems: "center", justifyContent: "center" },
  pipeTitle: { fontSize: 15.5, fontWeight: "700", color: colors.text },
  pipeTotal: { fontSize: 22, fontWeight: "800", color: colors.text, letterSpacing: -0.5 },
  pipeSub: { fontSize: 10, color: colors.textFaint, fontWeight: "700", letterSpacing: 0.6 },
  skeleton: { height: 92, borderRadius: 20, backgroundColor: "#ECE8F7" },
  perf: { flexDirection: "row", alignItems: "center", gap: 12, paddingHorizontal: 14, paddingVertical: 10 },
});
