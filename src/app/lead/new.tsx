import { router } from "expo-router";
import { useState } from "react";
import { View } from "react-native";
import { SelectField, StackHeader } from "@/components/kit";
import { SOURCES, useCreateLead } from "@/components/LeadSheets";
import { Button, Chip, Input, Screen, T } from "@/components/ui";
import { useLookups } from "@/lib/hooks";

export default function NewLead() {
  const { data: lk } = useLookups();
  const [websiteId, setWebsiteId] = useState<number | null>(null);
  const [f, setF] = useState({ name: "", phone: "", email: "", location: "", interest: "", message: "" });
  const [source, setSource] = useState("Phone call");
  const set = (k: keyof typeof f) => (v: string) => setF((s) => ({ ...s, [k]: v }));
  const site = websiteId ?? (lk?.websites.length === 1 ? lk.websites[0]!.id : null);
  const create = useCreateLead((id) => router.replace(`/lead/${id}`));

  return (
    <View style={{ flex: 1 }}>
      <StackHeader title="New lead" subtitle="Add a lead you got offline" />
      <Screen>
        <SelectField label="Website / pipeline" icon="globe-outline" value={site} onChange={setWebsiteId} placeholder="Choose where this lead belongs"
          options={(lk?.websites ?? []).map((w) => ({ value: w.id as number | null, label: w.name || w.code, sub: w.code }))} />
        <Input label="Name *" icon="person-outline" value={f.name} onChangeText={set("name")} autoCapitalize="words" />
        <Input label="Phone" icon="call-outline" value={f.phone} onChangeText={set("phone")} keyboardType="phone-pad" />
        <Input label="Email" icon="mail-outline" value={f.email} onChangeText={set("email")} keyboardType="email-address" autoCapitalize="none" />
        <Input label="Location" icon="location-outline" value={f.location} onChangeText={set("location")} />
        <Input label="Interested in" icon="home-outline" value={f.interest} onChangeText={set("interest")} placeholder="Project, service or property" />
        <View style={{ gap: 7 }}>
          <T muted size={13} bold>How did they reach you?</T>
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
            {SOURCES.map((s) => <Chip key={s} label={s} active={source === s} onPress={() => setSource(s)} />)}
          </View>
        </View>
        <Input label="Notes / requirement" value={f.message} onChangeText={set("message")} multiline />
        <Button
          title="Create lead"
          size="lg"
          icon="add-circle"
          loading={create.isPending}
          disabled={!site || !f.name.trim() || (!f.phone.trim() && !f.email.trim())}
          onPress={() => create.mutate({ ...f, email: f.email.trim() || null, websiteId: site, source: source.toLowerCase(), medium: "offline" })}
        />
        <T muted size={12} style={{ textAlign: "center" }}>Add at least a phone number or an email.</T>
      </Screen>
    </View>
  );
}
