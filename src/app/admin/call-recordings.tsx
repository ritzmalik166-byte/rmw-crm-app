import { Ionicons } from "@expo/vector-icons";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { router } from "expo-router";
import { useEffect, useMemo, useState } from "react";
import { Image, Pressable, StyleSheet, Text, View } from "react-native";
import { CallCard } from "@/components/AiCalls";
import { Sheet, StackHeader } from "@/components/kit";
import { Avatar, Badge, Chip, EmptyState, ErrorView, Loading, Screen, SearchBar, T, type IconName } from "@/components/ui";
import { api, apiMessage } from "@/lib/api";
import { OUTCOMES, outcomeTone, WEBSITE_NAMES, WEBSITE_ORDER, duration, talkTime, type AiCall, type RecordingsPage } from "@/lib/aicall";
import { formatDateTime } from "@/lib/format";
import { colors, shadow, websiteTone } from "@/lib/theme";

/* Same website marks the web uses. */
const LOGOS: Record<string, number> = {
  RMW: require("../../../assets/images/websites/rmw.png"),
  MPF: require("../../../assets/images/websites/mpf.png"),
  CT: require("../../../assets/images/websites/ct.png"),
  CTMPL: require("../../../assets/images/websites/ctmpl.png"),
};

function SiteMark({ code, size }: { code: string; size: number }) {
  const tone = websiteTone[code] || { bg: colors.primarySoft, fg: colors.primary, solid: colors.primary };
  return (
    <View style={{ width: size, height: size, borderRadius: size * 0.3, backgroundColor: "#FAF8FF", borderWidth: 1, borderColor: colors.border, alignItems: "center", justifyContent: "center" }}>
      {LOGOS[code]
        ? <Image source={LOGOS[code]} style={{ width: size * 0.72, height: size * 0.72 }} resizeMode="contain" />
        : <Text style={{ color: tone.fg, fontWeight: "900", fontSize: size * 0.28 }}>{code}</Text>}
    </View>
  );
}

function Stat({ icon, label, value, tone }: { icon: IconName; label: string; value: string | number; tone: string }) {
  return (
    <View style={st.stat}>
      <Ionicons name={icon} size={16} color={tone} />
      <Text style={st.statValue}>{value}</Text>
      <Text style={st.statLabel}>{label}</Text>
    </View>
  );
}

/** Super Admin → Call recordings: pick a website, then a person, then listen. Owner and Super Admin only. */
export default function CallRecordings() {
  const [website, setWebsite] = useState("");
  const [search, setSearch] = useState("");
  const [q, setQ] = useState("");
  const [outcome, setOutcome] = useState("");
  const [page, setPage] = useState(1);
  const [open, setOpen] = useState<AiCall | null>(null);

  useEffect(() => { const t = setTimeout(() => { setQ(search.trim()); setPage(1); }, 350); return () => clearTimeout(t); }, [search]);

  const params = new URLSearchParams({ page: String(page) });
  if (q) params.set("q", q);
  if (outcome) params.set("outcome", outcome);
  if (website) params.set("website", website);
  const r = useQuery({
    queryKey: ["admin", "call-recordings", page, q, outcome, website],
    queryFn: () => api<RecordingsPage>(`/super-admin/ai-call-recordings?${params}`),
    placeholderData: keepPreviousData,
  });

  const sites = useMemo(() => {
    const fromApi = r.data?.websites || [];
    const list = [...fromApi, ...WEBSITE_ORDER.filter((c) => !fromApi.some((w) => w.code === c)).map((code) => ({ code, name: WEBSITE_NAMES[code], count: 0 }))];
    return list.sort((a, b) => (WEBSITE_ORDER.indexOf(a.code) + 1 || 99) - (WEBSITE_ORDER.indexOf(b.code) + 1 || 99));
  }, [r.data?.websites]);
  const pick = (code: string) => { setWebsite(code); setPage(1); setSearch(""); setQ(""); setOutcome(""); };
  const current = sites.find((w) => w.code === website);
  const pages = r.data ? Math.max(1, Math.ceil(r.data.total / r.data.pageSize)) : 1;
  const s = r.data?.summary;

  if (r.isError) return <View style={{ flex: 1 }}><StackHeader title="Call recordings" /><ErrorView message={apiMessage(r.error)} onRetry={() => void r.refetch()} /></View>;

  /* Step 1: websites */
  if (!website) {
    return (
      <View style={{ flex: 1 }}>
        <StackHeader title="Call recordings" subtitle="Choose a website" />
        {r.isLoading ? <Loading /> : (
          <Screen refreshing={r.isRefetching} onRefresh={() => void r.refetch()}>
            <View style={st.grid}>
              {sites.map((w) => (
                <Pressable key={w.code} onPress={() => pick(w.code)} style={({ pressed }) => [st.tile, pressed && { transform: [{ scale: 0.97 }] }]}>
                  <SiteMark code={w.code} size={72} />
                  <Text style={{ fontWeight: "800", fontSize: 15, color: colors.text, textAlign: "center" }} numberOfLines={2}>{w.name || w.code}</Text>
                  <Text style={{ fontSize: 11, letterSpacing: 2, color: colors.textFaint, fontWeight: "700" }}>{w.code}</Text>
                  <View style={st.count}><Ionicons name="headset" size={12} color={colors.primary} /><Text style={{ color: colors.primary, fontWeight: "700", fontSize: 12 }}>{w.count} recording{w.count === 1 ? "" : "s"}</Text></View>
                </Pressable>
              ))}
            </View>
          </Screen>
        )}
      </View>
    );
  }

  /* Step 2: people  →  Step 3: sheet with summary + recording */
  return (
    <View style={{ flex: 1 }}>
      <StackHeader title={current?.name || website} subtitle="Call recordings" />
      <Screen refreshing={r.isRefetching} onRefresh={() => void r.refetch()}>
        <View style={{ flexDirection: "row", gap: 8, flexWrap: "wrap" }}>
          <Chip label="All websites" icon="arrow-back" onPress={() => pick("")} />
          {sites.map((w) => <Chip key={w.code} label={w.code} count={w.count} active={w.code === website} onPress={() => pick(w.code)} />)}
        </View>

        {s ? (
          <View style={st.stats}>
            <Stat icon="headset" label="Recordings" value={s.calls} tone={colors.primary} />
            <Stat icon="time" label="Talk time" value={talkTime(s.seconds)} tone={colors.blue} />
            <Stat icon="thumbs-up" label="Interested" value={s.positive} tone={colors.success} />
            <Stat icon="people" label="Leads" value={s.leads} tone={colors.warning} />
          </View>
        ) : null}

        <SearchBar value={search} onChangeText={setSearch} placeholder="Search name or phone" />
        <View style={{ flexDirection: "row", gap: 8, flexWrap: "wrap" }}>
          {OUTCOMES.map(([v, label]) => <Chip key={v || "all"} label={label} active={outcome === v} onPress={() => { setOutcome(v); setPage(1); }} />)}
        </View>

        {r.isLoading ? <Loading /> : !r.data?.calls.length ? (
          <EmptyState icon="headset-outline" title="No recordings" text={q || outcome ? "Nothing matches these filters." : "No calls recorded for this website yet."} />
        ) : (
          <View style={[st.list, r.isFetching && { opacity: 0.7 }]}>
            {r.data.calls.map((c, i) => {
              const tone = outcomeTone(c.outcome);
              return (
                <Pressable key={c.id} onPress={() => setOpen({ ...c, has_recording: true })} style={({ pressed }) => [st.row, i === r.data!.calls.length - 1 && { borderBottomWidth: 0 }, pressed && { backgroundColor: colors.page }]}>
                  <Avatar name={c.lead_name || "?"} size={42} />
                  <View style={{ flex: 1, gap: 3 }}>
                    <View style={{ flexDirection: "row", justifyContent: "space-between", gap: 8 }}>
                      <Text style={{ fontWeight: "700", fontSize: 14.5, color: colors.text, flex: 1 }} numberOfLines={1}>{c.lead_name || `Lead #${c.lead_id}`}</Text>
                      <Text style={{ fontSize: 12, color: colors.textFaint }}>{duration(c.duration_seconds)}</Text>
                    </View>
                    <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", gap: 8 }}>
                      <Text style={{ fontSize: 12, color: colors.textMuted, flex: 1 }} numberOfLines={1}>{formatDateTime(c.started_at || c.created_at)}</Text>
                      {c.outcome_label ? <Badge label={c.outcome_label} bg={tone.bg} fg={tone.fg} /> : null}
                    </View>
                  </View>
                  <Ionicons name="chevron-forward" size={18} color={colors.textFaint} />
                </Pressable>
              );
            })}
          </View>
        )}

        {pages > 1 ? (
          <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
            <Chip label="Previous" icon="chevron-back" onPress={page > 1 ? () => setPage((p) => p - 1) : undefined} />
            <T muted size={13}>{page} / {pages}</T>
            <Chip label="Next" icon="chevron-forward" onPress={page < pages ? () => setPage((p) => p + 1) : undefined} />
          </View>
        ) : null}
      </Screen>

      <Sheet open={!!open} onClose={() => setOpen(null)} title={open?.lead_name || (open ? `Lead #${open.lead_id}` : "")}>
        {open ? (
          <View style={{ gap: 12 }}>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
              <Ionicons name="call-outline" size={14} color={colors.textMuted} />
              <T muted size={13} style={{ flex: 1 }}>{open.to_phone}</T>
              <Pressable onPress={() => { const id = open.lead_id; setOpen(null); router.push(`/lead/${id}`); }} style={st.openLead}>
                <Text style={{ color: colors.primary, fontWeight: "700", fontSize: 13 }}>Open lead</Text>
                <Ionicons name="arrow-forward" size={14} color={colors.primary} />
              </Pressable>
            </View>
            <CallCard call={open} flat />
          </View>
        ) : null}
      </Sheet>
    </View>
  );
}

const st = StyleSheet.create({
  grid: { flexDirection: "row", flexWrap: "wrap", gap: 12 },
  tile: { flexBasis: "47%", flexGrow: 1, alignItems: "center", gap: 8, backgroundColor: colors.card, borderRadius: 22, paddingVertical: 22, paddingHorizontal: 12, borderWidth: 1, borderColor: colors.border, ...shadow.card },
  count: { flexDirection: "row", alignItems: "center", gap: 5, backgroundColor: colors.primarySoft, borderRadius: 999, paddingHorizontal: 10, paddingVertical: 5 },
  stats: { flexDirection: "row", gap: 8 },
  stat: { flex: 1, backgroundColor: colors.card, borderRadius: 16, padding: 10, gap: 2, borderWidth: 1, borderColor: colors.border, alignItems: "flex-start" },
  statValue: { fontSize: 17, fontWeight: "800", color: colors.text },
  statLabel: { fontSize: 11, color: colors.textMuted, fontWeight: "600" },
  list: { backgroundColor: colors.card, borderRadius: 20, borderWidth: 1, borderColor: colors.border, overflow: "hidden", ...shadow.card },
  row: { flexDirection: "row", alignItems: "center", gap: 12, paddingHorizontal: 14, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: colors.border },
  openLead: { flexDirection: "row", alignItems: "center", gap: 4, backgroundColor: colors.primarySoft, borderRadius: 10, paddingHorizontal: 10, paddingVertical: 6 },
});
