import { useRef, useState, type ComponentRef } from "react";
import { Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { colors } from "@/lib/theme";

/** Six separate boxes backed by one hidden input, so paste and SMS autofill work. */
export function OtpInput({ value, onChange, length = 6, error }: { value: string; onChange: (v: string) => void; length?: number; error?: boolean }) {
  const ref = useRef<ComponentRef<typeof TextInput>>(null);
  const [focused, setFocused] = useState(true);
  return (
    <Pressable onPress={() => ref.current?.focus()} style={{ flexDirection: "row", justifyContent: "space-between", gap: 8 }}>
      {Array.from({ length }).map((_, i) => {
        const active = focused && (i === value.length || (i === length - 1 && value.length === length));
        const filled = i < value.length;
        return (
          <View key={i} style={[st.box, filled && st.filled, active && st.active, error && st.error]}>
            <Text style={st.digit}>{value[i] ?? ""}</Text>
            {active && !filled ? <View style={st.caret} /> : null}
          </View>
        );
      })}
      <TextInput
        ref={ref}
        value={value}
        onChangeText={(t) => onChange(t.replace(/\D/g, "").slice(0, length))}
        keyboardType="number-pad"
        autoComplete="one-time-code"
        textContentType="oneTimeCode"
        maxLength={length}
        autoFocus
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        style={st.hidden}
        caretHidden
      />
    </Pressable>
  );
}

const st = StyleSheet.create({
  box: { flex: 1, aspectRatio: 0.86, maxWidth: 54, borderRadius: 14, borderWidth: 1.5, borderColor: colors.border, backgroundColor: "#F8F9FC", alignItems: "center", justifyContent: "center" },
  filled: { backgroundColor: "#fff", borderColor: "#C9CEE6" },
  active: { borderColor: colors.primary, backgroundColor: "#fff", shadowColor: colors.primary, shadowOpacity: 0.18, shadowRadius: 8, shadowOffset: { width: 0, height: 2 }, elevation: 2 },
  error: { borderColor: colors.danger },
  digit: { fontSize: 24, fontWeight: "800", color: colors.text },
  caret: { position: "absolute", width: 2, height: 24, borderRadius: 1, backgroundColor: colors.primary },
  hidden: { position: "absolute", opacity: 0, width: 1, height: 1 },
});
