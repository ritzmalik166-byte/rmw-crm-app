import { Ionicons } from "@expo/vector-icons";
import { useQueryClient } from "@tanstack/react-query";
import * as Haptics from "expo-haptics";
import { useState } from "react";
import { Alert, Pressable, StyleSheet, Text, View } from "react-native";
import { DateTimeField, SelectField, Sheet } from "@/components/kit";
import { Avatar, Button, Chip, Input, SearchBar, T } from "@/components/ui";
import { api, ApiError, apiMessage } from "@/lib/api";
import { colors } from "@/lib/theme";
import { useAction, useLookups } from "@/lib/hooks";
import type { Followup, LeadDetail } from "@/lib/types";

const leadKeys = (id: number | string) => [["lead", String(id)], ["leads"], ["dashboard"]];

export function EditLeadSheet({ lead, open, onClose }: { lead: LeadDetail; open: boolean; onClose: () => void }) {
  const [f, setF] = useState({ name: lead.name ?? "", phone: lead.phone ?? "", email: lead.email ?? "", location: lead.location ?? "", interest: lead.interest ?? "", message: lead.message ?? "" });
  const set = (k: keyof typeof f) => (v: string) => setF((s) => ({ ...s, [k]: v }));
  const save = useAction(() => api(`/crm/leads/${lead.id}`, { method: "PATCH", body: { ...f, email: f.email.trim() || null } }), { invalidate: leadKeys(lead.id), onDone: onClose });
  return (
    <Sheet open={open} onClose={onClose} title="Edit lead">
      <Input label="Name" icon="person-outline" value={f.name} onChangeText={set("name")} autoCapitalize="words" />
      <Input label="Phone" icon="call-outline" value={f.phone} onChangeText={set("phone")} keyboardType="phone-pad" />
      <Input label="Email" icon="mail-outline" value={f.email} onChangeText={set("email")} keyboardType="email-address" autoCapitalize="none" />
      <Input label="Location" icon="location-outline" value={f.location} onChangeText={set("location")} />
      <Input label="Interested in" icon="home-outline" value={f.interest} onChangeText={set("interest")} />
      <Input label="Message" value={f.message} onChangeText={set("message")} multiline />
      <T muted size={12}>The lead ID and source attribution can&apos;t be edited.</T>
      <Button title="Save changes" size="lg" onPress={() => save.mutate()} loading={save.isPending} disabled={!f.name.trim()} />
    </Sheet>
  );
}

/** Which channel permission a lead needs, from its source type (mirrors backend ensureChannelAccess). */
function channelFor(sourceType?: string | null): { key: "can_client" | "can_meta"; label: string } | null {
  if (sourceType === "LANDING_PAGE" || sourceType === "META_FORM") return { key: "can_client", label: "Client Leads" };
  if (sourceType === "META") return { key: "can_meta", label: "Meta Leads" };
  return null;
}

export function AssignSheet({ lead, open, onClose }: { lead: LeadDetail; open: boolean; onClose: () => void }) {
  const { data: lk } = useLookups();
  const qc = useQueryClient();
  const transferring = !!lead.assigned_user_id;
  const [userId, setUserId] = useState<number | null>(null);
  const [picked, setPicked] = useState(false); // "Unassigned" is a real choice when assigning
  const [reason, setReason] = useState("");
  const [q, setQ] = useState("");
  const [grant, setGrant] = useState(true);
  const [serverNeedsAccess, setServerNeedsAccess] = useState(false);
  const [busy, setBusy] = useState(false);

  const users = (lk?.users ?? []).filter((u) => !(transferring && u.id === lead.assigned_user_id));
  const needle = q.trim().toLowerCase();
  const shown = needle ? users.filter((u) => u.full_name.toLowerCase().includes(needle) || u.email.toLowerCase().includes(needle)) : users;
  const target = users.find((u) => u.id === userId) ?? null;
  const ch = channelFor(lead.source_type);
  const lacks = !!target && !!ch && (serverNeedsAccess || (target[ch.key] !== undefined && !Number(target[ch.key])));
  const first = target?.full_name.split(" ")[0] ?? "";
  const hasChoice = transferring ? !!target : picked;

  const choose = (id: number | null) => { void Haptics.selectionAsync(); setUserId(id); setPicked(true); setServerNeedsAccess(false); setGrant(true); };

  const submit = async () => {
    setBusy(true);
    try {
      await api(`/crm/leads/${lead.id}/assign`, { method: "POST", body: { userId, reason: reason.trim() || null, ...(lacks && grant ? { grantAccess: true } : {}) } });
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      leadKeys(lead.id).forEach((k) => void qc.invalidateQueries({ queryKey: k }));
      if (lacks && grant && target && ch) {
        void qc.invalidateQueries({ queryKey: ["lookups"] });
        Alert.alert("Access given", `${target.full_name} can now see ${ch.label}`);
      }
      onClose();
    } catch (e) {
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      if (e instanceof ApiError && e.errorCode === "CHANNEL_ACCESS_REQUIRED") { setServerNeedsAccess(true); setGrant(true); }
      else Alert.alert("Couldn't complete that", apiMessage(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Sheet open={open} onClose={onClose} title={transferring ? "Transfer lead" : "Assign lead"}>
      <SearchBar value={q} onChangeText={setQ} placeholder="Search by name or email" />
      <View style={ps.list}>
        {!transferring && !needle ? (
          <MemberRow name="Unassigned" sub="Nobody owns this lead" selected={picked && userId === null} onPress={() => choose(null)} unassigned />
        ) : null}
        {shown.map((u) => <MemberRow key={u.id} name={u.full_name} sub={u.email} selected={u.id === userId} onPress={() => choose(u.id)} />)}
        {!shown.length ? <T muted size={13} style={{ padding: 16, textAlign: "center" }}>{needle ? "No team member matches that search." : "No one else can take this lead."}</T> : null}
      </View>
      <T muted size={12}>Only people with access to this lead&apos;s website are listed.</T>

      {lacks && target && ch ? (
        <View style={ps.notice}>
          <View style={{ flexDirection: "row", gap: 10 }}>
            <Ionicons name="warning-outline" size={20} color="#B45309" />
            <Text style={ps.noticeText}>{target.full_name} can&apos;t see {ch.label} yet. Without access they won&apos;t find this lead.</Text>
          </View>
          <Pressable onPress={() => { void Haptics.selectionAsync(); setGrant((g) => !g); }} style={ps.grantRow} accessibilityRole="checkbox" accessibilityState={{ checked: grant }}>
            <Ionicons name={grant ? "checkbox" : "square-outline"} size={22} color={grant ? "#B45309" : "#D6A35C"} />
            <Text style={{ flex: 1, color: "#7C3A06", fontWeight: "700", fontSize: 14 }}>Give {first || target.full_name} access to {ch.label}</Text>
          </Pressable>
        </View>
      ) : null}

      {target ? <Input label="Remark for the assignee (optional)" value={reason} onChangeText={setReason} multiline placeholder="e.g. Customer prefers Hindi, call after 6 pm" /> : null}
      <Button title={transferring ? "Transfer" : "Assign"} size="lg" onPress={() => void submit()} loading={busy}
        disabled={!hasChoice || userId === lead.assigned_user_id || (lacks && !grant)} />
    </Sheet>
  );
}

function MemberRow({ name, sub, selected, onPress, unassigned }: { name: string; sub: string; selected: boolean; onPress: () => void; unassigned?: boolean }) {
  return (
    <Pressable onPress={onPress} style={({ pressed }) => [ps.row, selected && ps.rowOn, pressed && !selected && { backgroundColor: "#F7F5FD" }]} accessibilityRole="radio" accessibilityState={{ selected }}>
      {unassigned ? <View style={ps.unAvatar}><Ionicons name="person-remove-outline" size={18} color={colors.textMuted} /></View> : <Avatar name={name} size={40} />}
      <View style={{ flex: 1, minWidth: 0 }}>
        <Text style={[ps.name, selected && { color: colors.primary }]} numberOfLines={1}>{name}</Text>
        <Text style={ps.sub} numberOfLines={1}>{sub}</Text>
      </View>
      <Ionicons name={selected ? "checkmark-circle" : "ellipse-outline"} size={22} color={selected ? colors.primary : colors.border} />
    </Pressable>
  );
}

const ps = StyleSheet.create({
  list: { backgroundColor: "#fff", borderRadius: 18, borderWidth: 1, borderColor: colors.border, overflow: "hidden" },
  row: { flexDirection: "row", alignItems: "center", gap: 12, minHeight: 60, paddingHorizontal: 14, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: "#F1EEF9" },
  rowOn: { backgroundColor: colors.primarySoft },
  unAvatar: { width: 40, height: 40, borderRadius: 20, backgroundColor: "#F1EEF9", alignItems: "center", justifyContent: "center" },
  name: { fontSize: 15, fontWeight: "700", color: colors.text },
  sub: { fontSize: 12.5, color: colors.textMuted, marginTop: 1 },
  notice: { backgroundColor: "#FFF7E6", borderColor: "#F6D7A0", borderWidth: 1, borderRadius: 16, padding: 14, gap: 10 },
  noticeText: { flex: 1, color: "#7C3A06", fontSize: 13.5, lineHeight: 19 },
  grantRow: { flexDirection: "row", alignItems: "center", gap: 10, minHeight: 44 },
});

const PRIORITIES = ["LOW", "MEDIUM", "HIGH", "URGENT"] as const;
const tomorrow10 = () => { const d = new Date(); d.setDate(d.getDate() + 1); d.setHours(10, 0, 0, 0); return d; };

/** Create a follow-up for a lead, or reschedule / edit an existing one. */
export function FollowupSheet({ leadId, followup, open, onClose }: { leadId: number; followup?: Followup | null; open: boolean; onClose: () => void }) {
  const { data: lk } = useLookups();
  const [due, setDue] = useState(followup ? new Date(followup.due_at) : tomorrow10());
  const [priority, setPriority] = useState<(typeof PRIORITIES)[number]>(followup?.priority ?? "MEDIUM");
  const [notes, setNotes] = useState(followup?.notes ?? "");
  const [owner, setOwner] = useState<number | null>(null);
  const keys = [["lead", String(leadId)], ["followups"], ["dashboard"]];
  const save = useAction(
    () => followup
      ? api(`/crm/followups/${followup.id}`, { method: "PATCH", body: { dueAt: due.toISOString(), priority, notes: notes.trim() || null } })
      : api(`/crm/leads/${leadId}/followups`, { method: "POST", body: { dueAt: due.toISOString(), priority, notes: notes.trim() || null, ...(owner ? { userId: owner } : {}) } }),
    { invalidate: keys, onDone: onClose },
  );
  return (
    <Sheet open={open} onClose={onClose} title={followup ? "Reschedule follow-up" : "New follow-up"}>
      <DateTimeField label="When" value={due} onChange={setDue} minimumDate={new Date()} />
      <View style={{ gap: 7 }}>
        <T muted size={13} bold>Priority</T>
        <View style={{ flexDirection: "row", gap: 8, flexWrap: "wrap" }}>
          {PRIORITIES.map((p) => <Chip key={p} label={p[0] + p.slice(1).toLowerCase()} active={priority === p} onPress={() => setPriority(p)} />)}
        </View>
      </View>
      {!followup && lk?.users?.length ? (
        <SelectField label="Assign to (optional)" icon="person-outline" value={owner} onChange={setOwner}
          options={[{ value: null, label: "Me" }, ...lk.users.map((u) => ({ value: u.id as number | null, label: u.full_name }))]} />
      ) : null}
      <Input label="Agenda" value={notes} onChangeText={setNotes} multiline placeholder="What should happen on this call?" />
      <Button title={followup ? "Save" : "Schedule"} icon="calendar" size="lg" onPress={() => save.mutate()} loading={save.isPending} />
    </Sheet>
  );
}

const SOURCES = ["Phone call", "Walk-in", "Referral", "WhatsApp", "Event", "Other"];

export function useCreateLead(onDone: (id: number) => void) {
  return useAction((body: Record<string, unknown>) => api<{ id: number }>("/crm/leads", { method: "POST", body }), {
    invalidate: [["leads"], ["dashboard"]],
    onDone: (r) => r?.id && onDone(r.id),
  });
}
export { SOURCES };
