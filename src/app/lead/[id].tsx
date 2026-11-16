import { Ionicons } from "@expo/vector-icons";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import * as Haptics from "expo-haptics";
import * as Clipboard from "expo-clipboard";
import { router, useLocalSearchParams } from "expo-router";
import { useState, type ReactNode } from "react";
import { Alert, Linking, Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { AssignSheet, EditLeadSheet, FollowupSheet } from "@/components/LeadSheets";
import { Avatar, Badge, Button, Chip, ErrorView, Input, Loading, Section, StatusBadge, WebsiteBadge, type IconName } from "@/components/ui";
import { confirm } from "@/lib/hooks";
import { api, apiMessage } from "@/lib/api";
import { formatDateTime, timeAgo, titleCase, whatsappUrl } from "@/lib/format";
import { colors, shadow } from "@/lib/theme";
import type { Followup, LeadDetail, Lookups } from "@/lib/types";
import { useAuth } from "@/providers/AuthProvider";
import { MetaSourceCard } from "@/components/Meta";
import { LEAD_SOURCE_TYPES } from "@/lib/meta";

const ACTIVITY: Record<string, { label: string; icon: IconName; tone: string }> = {
  LEAD_CREATED: { label: "Lead created", icon: "sparkles", tone: colors.blue },
  LEAD_SYNCED: { label: "Updated from website", icon: "refresh", tone: "#0284C7" },
  LEAD_ASSIGNED: { label: "Lead assigned", icon: "person-add", tone: colors.violet },
  LEAD_REASSIGNED: { label: "Lead reassigned", icon: "people", tone: colors.violet },
  STATUS_CHANGED: { label: "Stage changed", icon: "swap-horizontal", tone: colors.warning },
  LEAD_UPDATED: { label: "Details updated", icon: "create", tone: colors.textMuted },
  NOTE_ADDED: { label: "Note added", icon: "chatbubble-ellipses", tone: colors.textMuted },
  FOLLOWUP_CREATED: { label: "Follow-up scheduled", icon: "calendar", tone: colors.violet },
  FOLLOWUP_COMPLETED: { label: "Follow-up completed", icon: "checkmark-circle", tone: colors.success },
  CONVERTED: { label: "Converted", icon: "trophy", tone: colors.success },
  LEAD_MERGED: { label: "Merged", icon: "git-merge", tone: "#F76B15" },
  META_LEAD_RECEIVED: { label: "Lead received from Meta Ads", icon: "infinite", tone: "#0082FB" },
};

const describe = (type: string, raw: unknown) => {
  let m: Record<string, unknown> = {};
  try { m = (typeof raw === "string" ? JSON.parse(raw) : raw) || {}; } catch { /* ignore */ }
  if (type === "STATUS_CHANGED" || type === "CONVERTED") return `${titleCase(m.from as string)} → ${titleCase(m.to as string)}`;
  if (type === "LEAD_UPDATED") return (m.fields as string[] | undefined)?.join(", ");
  if (type === "FOLLOWUP_CREATED" && m.dueAt) return `Due ${formatDateTime(m.dueAt as string)}`;
  if (type === "META_LEAD_RECEIVED") return [m.campaign && `Campaign: ${m.campaign}`, m.form && `Form: ${m.form}`].filter(Boolean).join(" · ") || null;
  if (type === "LEAD_SYNCED" && m.via === "meta") return "Re-delivered by Meta";
  return (m.reason as string) || null;
};

const SLOTS: [string, () => Date][] = [
  ["In 1 hour", () => new Date(Date.now() + 3600e3)],
  ["Tomorrow 10am", () => { const d = new Date(); d.setDate(d.getDate() + 1); d.setHours(10, 0, 0, 0); return d; }],
  ["In 3 days", () => { const d = new Date(); d.setDate(d.getDate() + 3); d.setHours(10, 0, 0, 0); return d; }],
  ["Next week", () => { const d = new Date(); d.setDate(d.getDate() + 7); d.setHours(10, 0, 0, 0); return d; }],
];

function Action({ icon, label, onPress, tone }: { icon: IconName; label: string; onPress: () => void; tone: string }) {
  return (
    <Pressable accessibilityLabel={label} onPress={() => { void Haptics.selectionAsync(); onPress(); }} style={({ pressed }) => [st.action, { backgroundColor: tone }, pressed && { opacity: 0.8 }]}>
      <Ionicons name={icon} size={20} color="#fff" />
    </Pressable>
  );
}

function MiniAction({ icon, label, onPress }: { icon: IconName; label: string; onPress: () => void }) {
  return (
    <Pressable onPress={() => { void Haptics.selectionAsync(); onPress(); }} style={({ pressed }) => [st.mini, pressed && { opacity: 0.7 }]}>
      <Ionicons name={icon} size={15} color={colors.primary} />
      <Text style={{ color: colors.primary, fontWeight: "700", fontSize: 13 }}>{label}</Text>
    </Pressable>
  );
}

function KV({ icon, label, children }: { icon: IconName; label: string; children: ReactNode }) {
  return (
    <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
      <Ionicons name={icon} size={18} color={colors.textMuted} />
      <Text style={{ flex: 1, fontSize: 14, color: colors.textMuted }}>{label}</Text>
      {children}
    </View>
  );
}

function InfoRow({ icon, label, value, onPress }: { icon: IconName; label: string; value: string; onPress?: () => void }) {
  return (
    <Pressable onPress={onPress} disabled={!onPress} style={st.info}>
      <View style={st.infoIcon}><Ionicons name={icon} size={17} color={colors.primary} /></View>
      <View style={{ flex: 1 }}>
        <Text style={{ fontSize: 12, color: colors.textMuted }}>{label}</Text>
        <Text style={{ fontSize: 15, color: onPress ? colors.primary : colors.text, fontWeight: "600", marginTop: 1 }}>{value}</Text>
      </View>
    </Pressable>
  );
}

export default function LeadScreen() {
  const insets = useSafeAreaInsets();
  const { id } = useLocalSearchParams<{ id: string }>();
  const qc = useQueryClient();
  const { can } = useAuth();
  const [note, setNote] = useState("");
  const [slot, setSlot] = useState<number | null>(null);
  const [fuNote, setFuNote] = useState("");
  const [tab, setTab] = useState<"activity" | "notes">("activity");
  const [sheet, setSheet] = useState<null | "edit" | "assign" | "followup">(null);
  const [editingFu, setEditingFu] = useState<Followup | null>(null);

  const q = useQuery({ queryKey: ["lead", id], queryFn: () => api<LeadDetail>(`/crm/leads/${id}`) });
  const lk = useQuery({ queryKey: ["lookups"], queryFn: () => api<Lookups>("/crm/lookups"), staleTime: 10 * 60_000 });
  const refresh = () => { void qc.invalidateQueries({ queryKey: ["lead", id] }); void qc.invalidateQueries({ queryKey: ["leads"] }); void qc.invalidateQueries({ queryKey: ["dashboard"] }); };
  const onError = (e: unknown) => Alert.alert("Something went wrong", apiMessage(e));
  const ok = () => void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);

  const status = useMutation({ mutationFn: (statusId: number) => api(`/crm/leads/${id}`, { method: "PATCH", body: { statusId } }), onSuccess: () => { ok(); refresh(); }, onError });
  const addNote = useMutation({ mutationFn: () => api(`/crm/leads/${id}/notes`, { method: "POST", body: { body: note.trim() } }), onSuccess: () => { ok(); setNote(""); refresh(); }, onError });
  const addFollowup = useMutation({
    mutationFn: () => api(`/crm/leads/${id}/followups`, { method: "POST", body: { dueAt: SLOTS[slot!]![1]().toISOString(), priority: "MEDIUM", notes: fuNote.trim() || null } }),
    onSuccess: () => { ok(); setSlot(null); setFuNote(""); refresh(); void qc.invalidateQueries({ queryKey: ["followups"] }); },
    onError,
  });

  const fuAction = useMutation({
    mutationFn: ({ fid, status }: { fid: number; status: "COMPLETED" | "CANCELLED" }) => api(`/crm/followups/${fid}`, { method: "PATCH", body: { status } }),
    onSuccess: () => { ok(); refresh(); void qc.invalidateQueries({ queryKey: ["followups"] }); },
    onError,
  });
  const remove = useMutation({
    mutationFn: () => api(`/crm/leads/${id}`, { method: "DELETE" }),
    onSuccess: () => { ok(); void qc.invalidateQueries({ queryKey: ["leads"] }); void qc.invalidateQueries({ queryKey: ["dashboard"] }); router.back(); },
    onError,
  });
  const resolveDup = useMutation({
    mutationFn: (b: { dupId: number; action: "MERGE" | "KEEP_SEPARATE"; primaryLeadId?: number }) => api(`/crm/duplicates/${b.dupId}/resolve`, { method: "POST", body: { action: b.action, primaryLeadId: b.primaryLeadId } }),
    onSuccess: () => { ok(); refresh(); },
    onError,
  });

  if (q.isLoading) return <View style={{ flex: 1, backgroundColor: colors.page }}><Loading /></View>;
  if (q.isError || !q.data) return <View style={{ flex: 1, backgroundColor: colors.page, paddingTop: insets.top + 60 }}><ErrorView message={apiMessage(q.error)} onRetry={() => void q.refetch()} /></View>;
  const lead = q.data;
  const wa = whatsappUrl(lead.phone);
  const statuses = (lk.data?.statuses ?? []).filter((x) => x.is_active || x.id === lead.status_id).sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0));
  const openFu = lead.followups.filter((f) => f.status === "UPCOMING" || f.status === "OVERDUE");
  const canAssign = lead.assigned_user_id ? can("lead.reassign") : can("lead.assign");
  const openDups = (lead.duplicates ?? []).filter((d) => d.status === "OPEN");
  const menu = () => Alert.alert(lead.name || "Lead", undefined, [
    ...(can("lead.edit") ? [{ text: "Edit details", onPress: () => setSheet("edit") }] : []),
    ...(canAssign ? [{ text: lead.assigned_user_id ? "Transfer lead" : "Assign lead", onPress: () => setSheet("assign") }] : []),
    { text: "New follow-up", onPress: () => { setEditingFu(null); setSheet("followup"); } },
    ...(can("lead.delete") ? [{ text: "Delete lead", style: "destructive" as const, onPress: () => confirm("Delete this lead?", "This can't be undone.", "Delete", () => remove.mutate()) }] : []),
    { text: "Cancel", style: "cancel" as const },
  ]);
  const fuMenu = (f: Followup) => Alert.alert(formatDateTime(f.due_at), f.notes || undefined, [
    { text: "Mark as done", onPress: () => fuAction.mutate({ fid: f.id, status: "COMPLETED" }) },
    { text: "Reschedule / edit", onPress: () => { setEditingFu(f); setSheet("followup"); } },
    { text: "Cancel follow-up", style: "destructive", onPress: () => fuAction.mutate({ fid: f.id, status: "CANCELLED" }) },
    { text: "Close", style: "cancel" },
  ]);
  const isMeta = lead.source_type === LEAD_SOURCE_TYPES.META;
  const source = isMeta ? "" : [lead.source, lead.medium !== "none" ? lead.medium : null].filter(Boolean).join(" / ");

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: colors.page }}
      contentContainerStyle={{ paddingBottom: insets.bottom + 40 }}
      showsVerticalScrollIndicator={false}
      keyboardShouldPersistTaps="handled"
      refreshControl={<RefreshControl refreshing={q.isRefetching} onRefresh={() => void q.refetch()} tintColor={colors.primary} progressViewOffset={insets.top} />}
    >
      <View style={[st.top, { paddingTop: insets.top + 8 }]}>
        <Pressable onPress={() => router.back()} hitSlop={10} style={st.back} accessibilityLabel="Back"><Ionicons name="chevron-back" size={22} color={colors.text} /></Pressable>
        <Text style={st.topTitle}>Lead Details</Text>
        {can("lead.edit") ? <Pressable onPress={() => setSheet("edit")} hitSlop={10} style={st.back} accessibilityLabel="Edit lead"><Ionicons name="create-outline" size={20} color={colors.text} /></Pressable> : null}
        <Pressable onPress={menu} hitSlop={10} style={st.back} accessibilityLabel="Lead actions"><Ionicons name="ellipsis-vertical" size={19} color={colors.text} /></Pressable>
      </View>

      <View style={[st.panel, st.profile]}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 14 }}>
          <Avatar name={lead.name} size={62} />
          <View style={{ flex: 1, gap: 3 }}>
            <Text style={st.name} numberOfLines={2}>{lead.name || "Unnamed lead"}</Text>
            {lead.phone ? (
              <Pressable onPress={() => { void Clipboard.setStringAsync(lead.phone!); ok(); }} style={{ flexDirection: "row", alignItems: "center", gap: 6 }} accessibilityLabel="Copy phone number">
                <Text style={{ fontSize: 14.5, color: colors.text, fontWeight: "500" }}>{lead.phone}</Text>
                <Ionicons name="copy-outline" size={14} color={colors.textMuted} />
              </Pressable>
            ) : null}
            <Text style={{ fontSize: 12, color: colors.textFaint }}>{lead.external_lead_id} · {timeAgo(lead.external_created_at || lead.created_at)}</Text>
          </View>
          <View style={{ flexDirection: "row", gap: 8 }}>
            {lead.phone ? <Action icon="call" label="Call" tone={colors.success} onPress={() => void Linking.openURL(`tel:${lead.phone}`)} /> : null}
            {wa ? <Action icon="logo-whatsapp" label="WhatsApp" tone={colors.whatsapp} onPress={() => void Linking.openURL(wa)} /> : null}
          </View>
        </View>
        <View style={{ height: 1, backgroundColor: "#F1EEF9" }} />
        <KV icon="pulse-outline" label="Status"><StatusBadge name={lead.status_name} color={lead.status_color} /></KV>
        <KV icon="globe-outline" label="Website"><WebsiteBadge code={lead.website_code} /></KV>
        {lead.form_type ? <KV icon="document-text-outline" label="Form"><Text style={st.kvValue}>{lead.form_type}</Text></KV> : null}
        <View style={{ flexDirection: "row", gap: 8, marginTop: 2 }}>
          {lead.phone ? <MiniAction icon="chatbubble-outline" label="SMS" onPress={() => void Linking.openURL(`sms:${lead.phone}`)} /> : null}
          {lead.email ? <MiniAction icon="mail-outline" label="Email" onPress={() => void Linking.openURL(`mailto:${lead.email}`)} /> : null}
          <MiniAction icon="calendar-outline" label="Follow-up" onPress={() => { setEditingFu(null); setSheet("followup"); }} />
        </View>
      </View>

      <View style={{ paddingHorizontal: 16, marginTop: 18, gap: 22 }}>
        {can("lead.edit") && statuses.length ? (
          <View style={[st.panel, { paddingVertical: 14 }]}>
            <Text style={[st.panelLabel, { paddingHorizontal: 16 }]}>Stage</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, paddingHorizontal: 16 }}>
              {statuses.map((x) => (
                <Chip key={x.id} label={x.name} icon={x.id === lead.status_id ? "checkmark" : undefined} active={x.id === lead.status_id} onPress={() => x.id !== lead.status_id && !status.isPending && status.mutate(x.id)} />
              ))}
            </ScrollView>
          </View>
        ) : null}

        {openDups.length ? (
          <Section title={`Possible duplicates · ${openDups.length}`}>
            <View style={[st.panel, { padding: 14, gap: 12, backgroundColor: colors.warningSoft }]}>
              {openDups.map((d) => (
                <View key={d.id} style={{ gap: 8 }}>
                  <Pressable onPress={() => router.push(`/lead/${d.candidate_id}`)} style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                    <Ionicons name="copy" size={16} color={colors.warning} />
                    <Text style={{ flex: 1, fontWeight: "700", color: colors.text }}>{d.name || "Unnamed"} · {d.external_lead_id}</Text>
                    <Ionicons name="chevron-forward" size={16} color={colors.textFaint} />
                  </Pressable>
                  {can("lead.merge") ? (
                    <View style={{ flexDirection: "row", gap: 8 }}>
                      <Button title="Keep separate" size="sm" variant="outline" style={{ flex: 1 }} onPress={() => resolveDup.mutate({ dupId: d.id, action: "KEEP_SEPARATE" })} />
                      <Button title="Merge here" size="sm" icon="git-merge" style={{ flex: 1 }} onPress={() => confirm("Merge into this lead?", "The other lead is marked as merged; both records are kept.", "Merge", () => resolveDup.mutate({ dupId: d.id, action: "MERGE", primaryLeadId: lead.id }), false)} />
                    </View>
                  ) : null}
                </View>
              ))}
            </View>
          </Section>
        ) : null}

        <Section title="Contact info">
          <View style={st.panel}>
            {lead.phone ? <InfoRow icon="call" label="Mobile" value={lead.phone} onPress={() => void Linking.openURL(`tel:${lead.phone}`)} /> : null}
            {lead.email ? <InfoRow icon="mail" label="Email" value={lead.email} onPress={() => void Linking.openURL(`mailto:${lead.email}`)} /> : null}
            {lead.location ? <InfoRow icon="location" label="Location" value={lead.location} onPress={() => void Linking.openURL(`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(lead.location!)}`)} /> : null}
            {lead.interest ? <InfoRow icon="home" label="Interested in" value={lead.interest} /> : null}
            <InfoRow icon="person" label="Owner" value={lead.assigned_user_name || (canAssign ? "Unassigned · tap to assign" : "Unassigned")} onPress={canAssign ? () => setSheet("assign") : undefined} />
            {source ? <InfoRow icon="globe" label="Source" value={source} /> : null}
            {lead.message ? (
              <View style={st.message}>
                <Ionicons name="chatbox-ellipses" size={16} color={colors.gold} />
                <Text style={{ flex: 1, fontSize: 14, color: colors.text, lineHeight: 20 }}>{lead.message}</Text>
              </View>
            ) : null}
          </View>
        </Section>

        {isMeta ? <Section title="Source"><MetaSourceCard lead={lead} /></Section> : null}

        <Section title={openFu.length ? `Follow-ups · ${openFu.length} open` : "Follow-ups"}>
          <View style={[st.panel, { padding: 16, gap: 12 }]}>
            {openFu.map((f) => {
              const over = f.status === "OVERDUE";
              return (
                <Pressable key={f.id} onPress={() => fuMenu(f)} style={[st.fu, over && { backgroundColor: colors.dangerSoft }]}>
                  <Ionicons name={over ? "alarm" : "time"} size={18} color={over ? colors.danger : colors.primary} />
                  <Text style={{ flex: 1, fontWeight: "700", color: over ? colors.danger : colors.text }}>{formatDateTime(f.due_at)}</Text>
                  <Badge label={titleCase(f.priority)} bg="#fff" fg={over ? colors.danger : colors.primary} />
                  <Ionicons name="ellipsis-vertical" size={16} color={colors.textMuted} />
                </Pressable>
              );
            })}
            <View style={{ flexDirection: "row", alignItems: "center" }}>
              <Text style={[st.panelLabel, { flex: 1 }]}>Quick schedule</Text>
              <Text onPress={() => { setEditingFu(null); setSheet("followup"); }} style={{ color: colors.primary, fontWeight: "700" }}>Custom date & time</Text>
            </View>
            <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
              {SLOTS.map(([label], i) => <Chip key={label} label={label} active={slot === i} onPress={() => setSlot(slot === i ? null : i)} />)}
            </View>
            {slot !== null ? (
              <>
                <Input value={fuNote} onChangeText={setFuNote} icon="create-outline" placeholder="Add an agenda (optional)" />
                <Button title={`Schedule for ${formatDateTime(SLOTS[slot]![1]().toISOString())}`} icon="calendar" onPress={() => addFollowup.mutate()} loading={addFollowup.isPending} />
              </>
            ) : null}
          </View>
        </Section>

        <View style={{ gap: 10 }}>
          <View style={st.tabs}>
            {(["activity", "notes"] as const).map((t) => (
              <Pressable key={t} onPress={() => setTab(t)} style={[st.tabBtn, tab === t && st.tabActive]}>
                <Text style={{ fontWeight: "700", color: tab === t ? colors.primary : colors.textMuted }}>{t === "activity" ? `Timeline · ${lead.activities.length}` : `Notes · ${lead.notes.length}`}</Text>
              </Pressable>
            ))}
          </View>

          {tab === "notes" ? (
            <View style={[st.panel, { padding: 16, gap: 12 }]}>
              <Input value={note} onChangeText={setNote} placeholder="Log a call outcome, budget, requirement…" multiline maxLength={5000} />
              <Button title="Save note" icon="send" onPress={() => addNote.mutate()} loading={addNote.isPending} disabled={!note.trim()} />
              {lead.notes.map((n) => (
                <View key={n.id} style={{ flexDirection: "row", gap: 10, paddingTop: 12, borderTopWidth: 1, borderTopColor: "#F0F1F6" }}>
                  <Avatar name={n.author} size={32} />
                  <View style={{ flex: 1 }}>
                    <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
                      <Text style={{ fontWeight: "700", color: colors.text }}>{n.author || "Unknown"}</Text>
                      <Text style={{ fontSize: 12, color: colors.textFaint }}>{timeAgo(n.created_at)}</Text>
                    </View>
                    <Text style={{ fontSize: 14, color: colors.text, lineHeight: 20, marginTop: 3 }}>{n.body}</Text>
                  </View>
                </View>
              ))}
            </View>
          ) : (
            <View style={[st.panel, { padding: 16 }]}>
              {lead.activities.map((a, i) => {
                const meta = ACTIVITY[a.type] ?? { label: titleCase(a.type), icon: "ellipse" as IconName, tone: colors.textMuted };
                const d = describe(a.type, a.meta);
                const last = i === lead.activities.length - 1;
                return (
                  <View key={a.id} style={{ flexDirection: "row", gap: 12 }}>
                    <View style={{ alignItems: "center" }}>
                      <View style={[st.tlIcon, { backgroundColor: `${meta.tone}1A` }]}><Ionicons name={meta.icon} size={15} color={meta.tone} /></View>
                      {!last ? <View style={st.tlLine} /> : null}
                    </View>
                    <View style={{ flex: 1, paddingBottom: last ? 0 : 18, paddingTop: 4 }}>
                      <View style={{ flexDirection: "row", justifyContent: "space-between", gap: 8 }}>
                        <Text style={{ fontWeight: "700", color: colors.text, flex: 1 }}>{meta.label}</Text>
                        <Text style={{ fontSize: 12, color: colors.textFaint }}>{timeAgo(a.created_at)}</Text>
                      </View>
                      {d ? <Text style={{ fontSize: 13.5, color: colors.textMuted, marginTop: 2 }}>{d}</Text> : null}
                      <Text style={{ fontSize: 12, color: colors.textFaint, marginTop: 2 }}>by {a.actor || "System"}</Text>
                    </View>
                  </View>
                );
              })}
            </View>
          )}
        </View>
      </View>
      {sheet === "edit" ? <EditLeadSheet lead={lead} open onClose={() => setSheet(null)} /> : null}
      {sheet === "assign" ? <AssignSheet lead={lead} open onClose={() => setSheet(null)} /> : null}
      {sheet === "followup" ? <FollowupSheet leadId={lead.id} followup={editingFu} open onClose={() => { setSheet(null); setEditingFu(null); }} /> : null}
    </ScrollView>
  );
}

const st = StyleSheet.create({
  top: { flexDirection: "row", alignItems: "center", gap: 10, paddingHorizontal: 16, paddingBottom: 6 },
  topTitle: { flex: 1, fontSize: 20, fontWeight: "800", color: colors.text, letterSpacing: -0.4, marginLeft: 4 },
  back: { width: 40, height: 40, borderRadius: 20, backgroundColor: "#fff", alignItems: "center", justifyContent: "center", ...shadow.card },
  profile: { marginHorizontal: 16, marginTop: 10, padding: 16, gap: 14 },
  name: { color: colors.text, fontSize: 20, fontWeight: "800", letterSpacing: -0.4 },
  action: { width: 42, height: 42, borderRadius: 14, alignItems: "center", justifyContent: "center" },
  mini: { flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, paddingVertical: 10, borderRadius: 12, backgroundColor: colors.primarySoft },
  kvValue: { fontSize: 14, fontWeight: "600", color: colors.text },
  panel: { backgroundColor: "#fff", borderRadius: 22, ...shadow.card, gap: 10 },
  panelLabel: { fontSize: 13, fontWeight: "700", color: colors.textMuted, marginBottom: 2 },
  info: { flexDirection: "row", alignItems: "center", gap: 14, paddingHorizontal: 16, paddingVertical: 4 },
  infoIcon: { width: 36, height: 36, borderRadius: 12, backgroundColor: colors.primarySoft, alignItems: "center", justifyContent: "center" },
  message: { flexDirection: "row", gap: 10, margin: 12, marginTop: 4, padding: 12, borderRadius: 14, backgroundColor: colors.goldSoft },
  fu: { flexDirection: "row", alignItems: "center", gap: 10, backgroundColor: colors.primarySoft, borderRadius: 14, padding: 12 },
  tabs: { flexDirection: "row", backgroundColor: "#ECE8F7", borderRadius: 16, padding: 4 },
  tabBtn: { flex: 1, alignItems: "center", paddingVertical: 10, borderRadius: 12 },
  tabActive: { backgroundColor: "#fff", ...shadow.card },
  tlIcon: { width: 32, height: 32, borderRadius: 16, alignItems: "center", justifyContent: "center" },
  tlLine: { flex: 1, width: 2, backgroundColor: "#ECEEF5", marginVertical: 4 },
});
