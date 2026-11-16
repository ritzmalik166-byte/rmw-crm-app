import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { FlatList, RefreshControl, StyleSheet, Text, View } from "react-native";
import { MultiSelectField, SelectField, Sheet, StackHeader } from "@/components/kit";
import { Avatar, Badge, Button, EmptyState, ErrorView, Input, Loading } from "@/components/ui";
import { api, apiMessage } from "@/lib/api";
import { timeAgo, titleCase } from "@/lib/format";
import { confirm, useAction } from "@/lib/hooks";
import { colors, shadow } from "@/lib/theme";
import type { Paged } from "@/lib/types";
import { useAuth } from "@/providers/AuthProvider";

type Req = {
  id: number; full_name: string; email: string; mobile: string | null; status: string; created_at: string;
  requested_department: string | null; requested_team: string | null; requested_department_id: number | null; requested_team_id: number | null; message?: string | null;
};
type Ref = { id: number; name: string; code?: string };

function ApproveSheet({ req, onClose }: { req: Req; onClose: () => void }) {
  const roles = useQuery({ queryKey: ["admin", "roles"], queryFn: () => api<Ref[]>("/admin/roles") });
  const sites = useQuery({ queryKey: ["admin", "websites"], queryFn: () => api<Ref[]>("/admin/websites") });
  const depts = useQuery({ queryKey: ["admin", "departments"], queryFn: () => api<Ref[]>("/admin/departments") });
  const teams = useQuery({ queryKey: ["admin", "teams"], queryFn: () => api<Ref[]>("/admin/teams") });
  const [roleId, setRoleId] = useState<number | null>(null);
  const [departmentId, setDepartmentId] = useState<number | null>(req.requested_department_id);
  const [teamIds, setTeamIds] = useState<number[]>(req.requested_team_id ? [req.requested_team_id] : []);
  const [websiteIds, setWebsiteIds] = useState<number[]>([]);
  const approve = useAction(() => api(`/super-admin/user-requests/${req.id}/approve`, { method: "POST", body: { roleId, departmentId, teamIds, websiteIds } }), {
    invalidate: [["admin", "requests"], ["admin", "users"]], success: `${req.full_name} can now sign in`, onDone: onClose,
  });
  const userRoles = (roles.data ?? []).filter((r) => r.code !== "OWNER");
  return (
    <Sheet open onClose={onClose} title={`Approve ${req.full_name}`}>
      <SelectField label="Role *" icon="shield-outline" value={roleId} onChange={setRoleId} options={userRoles.map((r) => ({ value: r.id as number | null, label: r.name }))} placeholder="Choose a role" />
      <MultiSelectField label="Website access *" values={websiteIds} onChange={setWebsiteIds} options={(sites.data ?? []).map((w) => ({ value: w.id, label: w.name, sub: w.code }))} placeholder="Choose websites" />
      <SelectField label="Department" icon="business-outline" value={departmentId} onChange={setDepartmentId} options={[{ value: null, label: "None" }, ...(depts.data ?? []).map((d) => ({ value: d.id as number | null, label: d.name }))]} />
      <MultiSelectField label="Teams" values={teamIds} onChange={setTeamIds} options={(teams.data ?? []).map((t) => ({ value: t.id, label: t.name }))} placeholder="Optional" />
      <Button title="Approve access" icon="checkmark-circle" size="lg" onPress={() => approve.mutate()} loading={approve.isPending} disabled={!roleId || websiteIds.length === 0} />
    </Sheet>
  );
}

function RejectSheet({ req, onClose }: { req: Req; onClose: () => void }) {
  const [reason, setReason] = useState("");
  const reject = useAction(() => api(`/super-admin/user-requests/${req.id}/reject`, { method: "POST", body: { reason: reason.trim() || null } }), { invalidate: [["admin", "requests"]], onDone: onClose });
  return (
    <Sheet open onClose={onClose} title={`Reject ${req.full_name}?`}>
      <Input label="Reason (shared with the requester)" value={reason} onChangeText={setReason} multiline />
      <Button title="Reject request" size="lg" variant="outline" onPress={() => confirm("Reject this request?", "They won't be able to sign in.", "Reject", () => reject.mutate())} loading={reject.isPending} />
    </Sheet>
  );
}

export default function AccessRequests() {
  const { canSA } = useAuth();
  const q = useQuery({ queryKey: ["admin", "requests"], queryFn: () => api<Paged<Req>>("/admin/user-requests?status=PENDING_APPROVAL&limit=100") });
  const [approving, setApproving] = useState<Req | null>(null);
  const [rejecting, setRejecting] = useState<Req | null>(null);
  return (
    <View style={{ flex: 1, backgroundColor: colors.page }}>
      <StackHeader title="Access requests" subtitle={q.data ? `${q.data.meta.total} waiting` : undefined} />
      {q.isLoading ? <Loading /> : q.isError ? <ErrorView message={apiMessage(q.error)} onRetry={() => void q.refetch()} /> : (
        <FlatList
          data={q.data!.rows}
          keyExtractor={(r) => String(r.id)}
          contentContainerStyle={{ padding: 16, gap: 12, paddingBottom: 40 }}
          refreshControl={<RefreshControl refreshing={q.isRefetching} onRefresh={() => void q.refetch()} tintColor={colors.primary} />}
          ListEmptyComponent={<EmptyState icon="person-add-outline" title="No pending requests" text="New sign-up requests will appear here for approval." />}
          renderItem={({ item: r }) => (
            <View style={st.card}>
              <View style={{ flexDirection: "row", gap: 12, alignItems: "center" }}>
                <Avatar name={r.full_name} />
                <View style={{ flex: 1 }}>
                  <Text style={st.name}>{r.full_name}</Text>
                  <Text style={st.meta}>{r.email}{r.mobile ? ` · ${r.mobile}` : ""}</Text>
                </View>
                <Badge label={titleCase(r.status)} bg={colors.warningSoft} fg={colors.warning} />
              </View>
              {r.requested_department || r.requested_team ? <Text style={st.meta}>Wants: {[r.requested_department, r.requested_team].filter(Boolean).join(" · ")}</Text> : null}
              <Text style={[st.meta, { fontSize: 12 }]}>Requested {timeAgo(r.created_at)}</Text>
              {canSA("user.approve") ? <View style={{ flexDirection: "row", gap: 8 }}>
                <Button title="Reject" variant="outline" size="sm" style={{ flex: 1 }} onPress={() => setRejecting(r)} />
                <Button title="Approve" icon="checkmark" size="sm" style={{ flex: 1 }} onPress={() => setApproving(r)} />
              </View> : <Text style={st.meta}>A Super Admin approves requests.</Text>}
            </View>
          )}
        />
      )}
      {approving ? <ApproveSheet req={approving} onClose={() => setApproving(null)} /> : null}
      {rejecting ? <RejectSheet req={rejecting} onClose={() => setRejecting(null)} /> : null}
    </View>
  );
}

const st = StyleSheet.create({
  card: { backgroundColor: "#fff", borderRadius: 20, padding: 14, gap: 10, ...shadow.card },
  name: { fontSize: 16, fontWeight: "700", color: colors.text },
  meta: { fontSize: 13, color: colors.textMuted },
});
