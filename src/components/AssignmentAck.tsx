import { Ionicons } from "@expo/vector-icons";
import { useQueryClient } from "@tanstack/react-query";
import * as Haptics from "expo-haptics";
import { router } from "expo-router";
import { useCallback, useEffect, useRef, useState } from "react";
import { AppState, Modal, Pressable, StyleSheet, Text, View } from "react-native";
import { Button } from "@/components/ui";
import { api, apiMessage } from "@/lib/api";
import { onAssignmentPush, type AssignmentPush } from "@/lib/push";
import { colors, shadow } from "@/lib/theme";

type Pending = { id: number; lead_id: number; name: string | null; external_lead_id: string; remark: string | null; assigned_by_name: string | null; reminded_at: string | null; created_at: string };
type Item = { leadId: number; name: string | null; externalLeadId: string | null; remark: string | null; by: string | null; transfer: boolean };

/**
 * "New lead assigned to you" popup. Opens when an assignment push arrives in the foreground, and on
 * app start / resume for assignments that were already reminded but still not acknowledged (mirrors web).
 */
export function AssignmentAck() {
  const qc = useQueryClient();
  const [queue, setQueue] = useState<Item[]>([]);
  const seen = useRef(new Set<number>());
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const push = useCallback((items: Item[]) => {
    const fresh = items.filter((i) => !seen.current.has(i.leadId));
    if (!fresh.length) return;
    fresh.forEach((i) => seen.current.add(i.leadId));
    void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
    setQueue((q) => [...q, ...fresh]);
  }, []);

  const fromRow = (r: Pending, transfer = false): Item => ({ leadId: r.lead_id, name: r.name, externalLeadId: r.external_lead_id, remark: r.remark, by: r.assigned_by_name, transfer });

  // Reminded-but-unacknowledged assignments on start and whenever the app comes back.
  useEffect(() => {
    const check = () => void api<Pending[]>("/crm/assignments/pending").then((rows) => push((rows ?? []).filter((r) => r.reminded_at).map((r) => fromRow(r)))).catch(() => {});
    check();
    const sub = AppState.addEventListener("change", (s) => { if (s === "active") check(); });
    return () => sub.remove();
  }, [push]);

  // Live: an assignment push arrived while the app is open.
  useEffect(() => onAssignmentPush(async (n: AssignmentPush) => {
    if (n.needsAck === false) return;
    const transfer = n.type === "LEAD_REASSIGNED";
    if (n.needsAck === true && n.leadId) {
      push([{ leadId: n.leadId, name: n.name ?? null, externalLeadId: n.externalLeadId ?? null, remark: n.remark ?? null, by: n.by ?? null, transfer }]);
      return;
    }
    // The push carries only { link, type }: look the assignment up. Only assignments by someone else are pending.
    try {
      const rows = await api<Pending[]>("/crm/assignments/pending");
      const row = (rows ?? []).find((r) => r.lead_id === n.leadId);
      if (row) push([fromRow(row, transfer)]);
    } catch { /* ignore */ }
  }), [push]);

  const cur = queue[0];
  const next = () => { setError(null); setQueue((q) => q.slice(1)); };
  const ack = async (open: boolean) => {
    if (!cur) return;
    if (open) { next(); router.push(`/lead/${cur.leadId}`); return; }
    setBusy(true);
    try {
      await api(`/crm/leads/${cur.leadId}/acknowledge`, { method: "POST" });
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      void qc.invalidateQueries({ queryKey: ["lead", String(cur.leadId)] });
      next();
    } catch (e) {
      setError(apiMessage(e));
    } finally {
      setBusy(false);
    }
  };

  if (!cur) return null;
  const who = cur.name || "a lead";
  return (
    <Modal visible transparent animationType="fade" onRequestClose={next} statusBarTranslucent>
      <View style={st.backdrop}>
        <View style={st.card}>
          <View style={st.icon}><Ionicons name={cur.transfer ? "swap-horizontal" : "person-add"} size={26} color={colors.primary} /></View>
          <Text style={st.title}>{cur.transfer ? "A lead was transferred to you" : "New lead assigned to you"}</Text>
          <Text style={st.text}>
            {cur.by || "Someone"} assigned <Text style={{ fontWeight: "800", color: colors.text }}>{who}</Text>
            {cur.externalLeadId ? ` (${cur.externalLeadId})` : ""} to you
          </Text>
          {cur.remark ? (
            <View style={st.remark}>
              <Text style={st.remarkLabel}>REMARK</Text>
              <Text style={{ color: colors.text, fontSize: 14.5, lineHeight: 20 }}>{cur.remark}</Text>
            </View>
          ) : null}
          {error ? <Text style={{ color: colors.danger, fontSize: 13, textAlign: "center" }}>{error}</Text> : null}
          <View style={{ flexDirection: "row", gap: 10, alignSelf: "stretch" }}>
            <Button title="Open lead" variant="outline" style={{ flex: 1 }} onPress={() => void ack(true)} />
            <Button title="Acknowledge" icon="checkmark" style={{ flex: 1 }} loading={busy} onPress={() => void ack(false)} />
          </View>
          {queue.length > 1 ? <Pressable onPress={next} hitSlop={8}><Text style={{ color: colors.textMuted, fontSize: 12.5 }}>{queue.length - 1} more waiting</Text></Pressable> : null}
        </View>
      </View>
    </Modal>
  );
}

const st = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: "rgba(22,14,51,0.55)", alignItems: "center", justifyContent: "center", padding: 24 },
  card: { width: "100%", maxWidth: 420, backgroundColor: "#fff", borderRadius: 26, padding: 22, alignItems: "center", gap: 12, ...shadow.float },
  icon: { width: 56, height: 56, borderRadius: 18, backgroundColor: colors.primarySoft, alignItems: "center", justifyContent: "center" },
  title: { fontSize: 19, fontWeight: "800", color: colors.text, textAlign: "center", letterSpacing: -0.3 },
  text: { fontSize: 14.5, color: colors.textMuted, textAlign: "center", lineHeight: 21 },
  remark: { alignSelf: "stretch", backgroundColor: colors.goldSoft, borderRadius: 14, padding: 12, gap: 4 },
  remarkLabel: { fontSize: 10.5, fontWeight: "800", color: "#B7791F", letterSpacing: 0.6 },
});
