import { useState } from "react";
import { View } from "react-native";
import { DateTimeField, SelectField, Sheet } from "@/components/kit";
import { Button, Chip, Input, T } from "@/components/ui";
import { api } from "@/lib/api";
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

export function AssignSheet({ lead, open, onClose }: { lead: LeadDetail; open: boolean; onClose: () => void }) {
  const { data: lk } = useLookups();
  const [userId, setUserId] = useState<number | null>(lead.assigned_user_id);
  const [reason, setReason] = useState("");
  const save = useAction(() => api(`/crm/leads/${lead.id}/assign`, { method: "POST", body: { userId, reason: reason.trim() || null } }), { invalidate: leadKeys(lead.id), onDone: onClose });
  const options = [{ value: null, label: "Unassigned", sub: "Nobody owns this lead" }, ...(lk?.users ?? []).map((u) => ({ value: u.id as number | null, label: u.full_name, sub: u.email }))];
  return (
    <Sheet open={open} onClose={onClose} title={lead.assigned_user_id ? "Transfer lead" : "Assign lead"}>
      <SelectField label="Owner" icon="person-outline" value={userId} options={options} onChange={setUserId} placeholder="Choose a team member" />
      {lead.assigned_user_id ? <Input label="Reason (optional)" value={reason} onChangeText={setReason} placeholder="e.g. Customer prefers Hindi" /> : null}
      <T muted size={12}>Only people with access to this lead&apos;s website are listed.</T>
      <Button title={lead.assigned_user_id ? "Transfer" : "Assign"} size="lg" onPress={() => save.mutate()} loading={save.isPending} disabled={userId === lead.assigned_user_id} />
    </Sheet>
  );
}

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
