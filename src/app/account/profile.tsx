import { router } from "expo-router";
import { useState } from "react";
import { View } from "react-native";
import { StackHeader } from "@/components/kit";
import { Button, Input, Screen, T } from "@/components/ui";
import { api } from "@/lib/api";
import { useAction } from "@/lib/hooks";
import { useAuth } from "@/providers/AuthProvider";

export default function EditProfile() {
  const { me } = useAuth();
  const [name, setName] = useState(me?.user.full_name ?? "");
  const save = useAction(() => api("/auth/me", { method: "PATCH", body: { fullName: name.trim() } }), { invalidate: [["me"]], onDone: () => router.back() });
  return (
    <View style={{ flex: 1 }}>
      <StackHeader title="Your name" />
      <Screen>
        <Input label="Full name" icon="person-outline" value={name} onChangeText={setName} autoCapitalize="words" autoFocus maxLength={150} />
        <T muted size={13}>This is how your name appears on leads, notes and follow-ups.</T>
        <Button title="Save" size="lg" onPress={() => save.mutate()} loading={save.isPending} disabled={name.trim().length < 2 || name.trim() === me?.user.full_name} />
      </Screen>
    </View>
  );
}
