import { router } from "expo-router";
import { useState } from "react";
import { Alert, View } from "react-native";
import { StackHeader } from "@/components/kit";
import { Button, Input, Screen, T } from "@/components/ui";
import { api } from "@/lib/api";
import { useAction } from "@/lib/hooks";
import { colors } from "@/lib/theme";
import { PASSWORD_RULES } from "@/lib/admin";

const RULES = PASSWORD_RULES;

export default function ChangePassword() {
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [confirm, setConfirm] = useState("");
  const save = useAction(() => api("/auth/change-password", { method: "POST", body: { currentPassword: current, newPassword: next } }), {
    onDone: () => { Alert.alert("Password changed", "Use your new password next time you sign in."); router.back(); },
  });
  const valid = RULES.every(([, ok]) => ok(next)) && next === confirm && current.length > 0;

  return (
    <View style={{ flex: 1 }}>
      <StackHeader title="Change password" />
      <Screen>
        <Input label="Current password" icon="lock-closed-outline" value={current} onChangeText={setCurrent} secureTextEntry autoComplete="current-password" />
        <Input label="New password" icon="key-outline" value={next} onChangeText={setNext} secureTextEntry autoComplete="new-password" />
        <View style={{ gap: 4, paddingHorizontal: 4 }}>
          {RULES.map(([label, ok]) => (
            <T key={label} size={13} style={{ color: ok(next) ? colors.success : colors.textMuted }}>{ok(next) ? "✓" : "•"} {label}</T>
          ))}
        </View>
        <Input label="Confirm new password" icon="key-outline" value={confirm} onChangeText={setConfirm} secureTextEntry autoComplete="new-password" />
        {confirm && confirm !== next ? <T size={13} style={{ color: colors.danger }}>Passwords don&apos;t match</T> : null}
        <Button title="Update password" size="lg" onPress={() => save.mutate()} loading={save.isPending} disabled={!valid} />
      </Screen>
    </View>
  );
}
