import { router } from "expo-router";
import { useState } from "react";
import { Alert, View } from "react-native";
import { SelectField, StackHeader } from "@/components/kit";
import { Button, Input, Screen, T } from "@/components/ui";
import { useRoles } from "@/lib/admin";
import { api } from "@/lib/api";
import { confirm, useAction } from "@/lib/hooks";
import { useAuth } from "@/providers/AuthProvider";

export default function Broadcast() {
  const { can } = useAuth();
  const roles = useRoles(can("role.view"));
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [roleCode, setRoleCode] = useState<string | null>(null);
  const send = useAction(() => api<{ recipients: number }>("/super-admin/notifications/broadcast", { method: "POST", body: { title: title.trim(), body: body.trim() || null, roleCode } }), {
    onDone: (r) => { Alert.alert("Sent", `Delivered to ${r?.recipients ?? 0} people (in app and push).`); router.back(); },
  });
  return (
    <View style={{ flex: 1 }}>
      <StackHeader title="Broadcast" subtitle="Send an alert to everyone or one role" />
      <Screen>
        <SelectField label="Send to" icon="people-outline" value={roleCode} onChange={setRoleCode}
          options={[{ value: null, label: "Everyone (all active users)" }, ...(roles.data ?? []).map((r) => ({ value: r.code as string | null, label: r.name, sub: `${r.user_count} user(s)` }))]} />
        <Input label="Title" value={title} onChangeText={setTitle} maxLength={200} placeholder="e.g. Team meeting at 5 PM" />
        <Input label="Message" value={body} onChangeText={setBody} multiline maxLength={1000} />
        <T muted size={12}>Arrives as an in-app alert and a push notification on phones with the app.</T>
        <Button title="Send broadcast" icon="megaphone" size="lg" loading={send.isPending} disabled={!title.trim()}
          onPress={() => confirm("Send this broadcast?", roleCode ? `Everyone with the ${roleCode} role gets it.` : "Every active user gets it.", "Send", () => send.mutate(), false)} />
      </Screen>
    </View>
  );
}
