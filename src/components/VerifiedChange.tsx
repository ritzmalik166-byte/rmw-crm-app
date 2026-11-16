import { router } from "expo-router";
import { useState } from "react";
import { Alert, View } from "react-native";
import { StackHeader } from "@/components/kit";
import { OtpInput } from "@/components/OtpInput";
import { Button, Input, Screen, T, type IconName } from "@/components/ui";
import { api } from "@/lib/api";
import { useAction } from "@/lib/hooks";

/** Two-step change (new value + password → code → verify), shared by mobile and email changes. */
export function VerifiedChange({ kind }: { kind: "mobile" | "email" }) {
  const isMobile = kind === "mobile";
  const [value, setValue] = useState("");
  const [password, setPassword] = useState("");
  const [sentTo, setSentTo] = useState<string | null>(null);
  const [otp, setOtp] = useState("");

  const request = useAction(
    () => api<{ maskedMobile?: string; maskedEmail?: string }>(`/auth/me/${kind}/request`, { method: "POST", body: { [kind]: value.trim(), currentPassword: password } }),
    { onDone: (r) => setSentTo(r?.maskedMobile || r?.maskedEmail || value.trim()) },
  );
  const verify = useAction((code: string) => api(`/auth/me/${kind}/verify`, { method: "POST", body: { otp: code } }), {
    invalidate: [["me"]],
    onDone: () => { Alert.alert(isMobile ? "Mobile number updated" : "Email updated"); router.back(); },
  });

  const icon: IconName = isMobile ? "call-outline" : "mail-outline";
  return (
    <View style={{ flex: 1 }}>
      <StackHeader title={isMobile ? "Change mobile" : "Change email"} />
      <Screen>
        {!sentTo ? (
          <>
            <Input
              label={isMobile ? "New mobile number" : "New email address"}
              icon={icon}
              value={value}
              onChangeText={setValue}
              keyboardType={isMobile ? "phone-pad" : "email-address"}
              autoCapitalize="none"
              autoFocus
            />
            <Input label="Current password" icon="lock-closed-outline" value={password} onChangeText={setPassword} secureTextEntry />
            <T muted size={13}>We&apos;ll send a verification code to the new {isMobile ? "number" : "address"} to confirm it&apos;s yours.</T>
            <Button title="Send code" size="lg" onPress={() => request.mutate()} loading={request.isPending} disabled={!value.trim() || !password} />
          </>
        ) : (
          <>
            <T bold size={17}>Enter the code</T>
            <T muted size={14}>Sent to {sentTo}</T>
            <OtpInput value={otp} onChange={(v) => { setOtp(v); if (v.length === 6) verify.mutate(v); }} />
            <Button title="Verify" size="lg" onPress={() => verify.mutate(otp)} loading={verify.isPending} disabled={otp.length < 4} />
            <Button title="Use a different one" variant="ghost" onPress={() => { setSentTo(null); setOtp(""); }} />
          </>
        )}
      </Screen>
    </View>
  );
}
