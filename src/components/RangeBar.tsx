import { useState } from "react";
import { ScrollView, View } from "react-native";
import { DateTimeField, Sheet } from "@/components/kit";
import { Button, Chip, T } from "@/components/ui";

const pad = (n: number) => String(n).padStart(2, "0");
export const ymd = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const shift = (days: number) => { const d = new Date(); d.setDate(d.getDate() + days); return d; };

export type Range = { preset: "today" | "yesterday" | "7d" | "30d" | "month" | "custom"; from: string; to: string };

const PRESETS: { key: Exclude<Range["preset"], "custom">; label: string; get: () => { from: string; to: string } }[] = [
  { key: "today", label: "Today", get: () => ({ from: ymd(new Date()), to: ymd(new Date()) }) },
  { key: "yesterday", label: "Yesterday", get: () => ({ from: ymd(shift(-1)), to: ymd(shift(-1)) }) },
  { key: "7d", label: "7 days", get: () => ({ from: ymd(shift(-6)), to: ymd(new Date()) }) },
  { key: "30d", label: "30 days", get: () => ({ from: ymd(shift(-29)), to: ymd(new Date()) }) },
  { key: "month", label: "This month", get: () => { const d = new Date(); return { from: ymd(new Date(d.getFullYear(), d.getMonth(), 1)), to: ymd(d) }; } },
];

export const todayRange = (): Range => ({ preset: "today", ...PRESETS[0]!.get() });

export function rangeLabel(r: Range) {
  if (r.preset !== "custom") return PRESETS.find((p) => p.key === r.preset)!.label;
  const f = (s: string) => new Date(`${s}T00:00:00`).toLocaleDateString("en-IN", { day: "numeric", month: "short" });
  return r.from === r.to ? f(r.from) : `${f(r.from)} – ${f(r.to)}`;
}

/** Preset chips + custom range sheet. Dates are YYYY-MM-DD; the API treats them as whole IST days. */
export function RangeBar({ value, onChange, allowAll, dark }: { value: Range | null; onChange: (r: Range | null) => void; allowAll?: boolean; dark?: boolean }) {
  const [open, setOpen] = useState(false);
  const [from, setFrom] = useState(value ? new Date(`${value.from}T00:00:00`) : new Date());
  const [to, setTo] = useState(value ? new Date(`${value.to}T00:00:00`) : new Date());
  return (
    <>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, paddingRight: 16 }}>
        {allowAll ? <Chip dark={dark} label="Any time" active={!value} onPress={() => onChange(null)} /> : null}
        {PRESETS.map((p) => <Chip dark={dark} key={p.key} label={p.label} active={value?.preset === p.key} onPress={() => onChange({ preset: p.key, ...p.get() })} />)}
        <Chip dark={dark} label={value?.preset === "custom" ? rangeLabel(value) : "Custom"} icon="calendar-outline" active={value?.preset === "custom"} onPress={() => setOpen(true)} />
      </ScrollView>
      <Sheet open={open} onClose={() => setOpen(false)} title="Custom date range">
        <DateTimeField label="From" dateOnly value={from} maximumDate={to} onChange={setFrom} />
        <DateTimeField label="To" dateOnly value={to} minimumDate={from} maximumDate={new Date()} onChange={setTo} />
        <View>
          <T muted size={12}>Shows leads received from the start of the first day to the end of the last day.</T>
        </View>
        <Button title="Apply range" size="lg" disabled={from > to} onPress={() => { onChange({ preset: "custom", from: ymd(from), to: ymd(to) }); setOpen(false); }} />
      </Sheet>
    </>
  );
}
