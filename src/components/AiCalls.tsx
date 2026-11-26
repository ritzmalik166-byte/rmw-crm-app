import { Ionicons } from "@expo/vector-icons";
import { useQuery } from "@tanstack/react-query";
import { setAudioModeAsync, useAudioPlayer, useAudioPlayerStatus } from "expo-audio";
import * as Haptics from "expo-haptics";
import * as Sharing from "expo-sharing";
import { useEffect, useMemo, useState } from "react";
import { ActivityIndicator, Alert, Animated, Easing, Pressable, StyleSheet, Text, View } from "react-native";
import { Badge, Button, EmptyState, ErrorView, Loading, type IconName } from "@/components/ui";
import { api, apiMessage } from "@/lib/api";
import {
  ACTIVE_STATUSES, ANSWER_LABELS, callStatus, outcomeTone as toneOf, clock, duration, leadAiCalls, localRecording,
  recordingFileName, transcriptLines, type AiCall,
} from "@/lib/aicall";
import { formatDateTime } from "@/lib/format";
import { confirm, useAction } from "@/lib/hooks";
import { colors, shadow } from "@/lib/theme";
import { useAuth } from "@/providers/AuthProvider";

const BARS = 46;
const SPEEDS = [1, 1.25, 1.5, 2];

/** Stable spike pattern per call (React Native can't decode audio to draw the real waveform). */
function spikes(seed: number) {
  let x = seed * 9301 + 49297;
  const rnd = () => { x = (x * 9301 + 49297) % 233280; return x / 233280; };
  return Array.from({ length: BARS }, (_, i) => {
    const env = 0.55 + 0.45 * Math.sin((i / BARS) * Math.PI);
    return Math.max(0.12, Math.min(1, env * (0.35 + rnd() * 0.75)));
  });
}

let audioModeSet = false;

/**
 * Recording player drawn as spikes: played spikes fill with colour, the spikes at the playhead pulse while
 * playing, tapping the spikes seeks. The file is fetched once with the session and reused for Save / Share.
 */
export function WaveformPlayer({ call }: { call: AiCall }) {
  const player = useAudioPlayer(null);
  const status = useAudioPlayerStatus(player);
  const [uri, setUri] = useState<string | null>(null);
  const [busy, setBusy] = useState<"" | "load" | "share">("");
  const [speed, setSpeed] = useState(1);
  const [width, setWidth] = useState(0);
  const [pulse] = useState(() => new Animated.Value(0));
  const peaks = useMemo(() => spikes(call.id), [call.id]);

  const dur = status.duration || call.duration_seconds || 0;
  const time = status.currentTime || 0;
  const progress = dur ? Math.min(1, time / dur) : 0;
  const head = progress * BARS;

  useEffect(() => {
    if (!status.playing) { pulse.stopAnimation(); pulse.setValue(0); return; }
    const loop = Animated.loop(Animated.sequence([
      Animated.timing(pulse, { toValue: 1, duration: 260, easing: Easing.out(Easing.quad), useNativeDriver: true }),
      Animated.timing(pulse, { toValue: 0, duration: 260, easing: Easing.in(Easing.quad), useNativeDriver: true }),
    ]));
    loop.start();
    return () => loop.stop();
  }, [status.playing, pulse]);

  useEffect(() => { if (status.didJustFinish) { void player.seekTo(0); player.pause(); } }, [status.didJustFinish, player]);

  const ensure = async () => {
    if (uri) return uri;
    setBusy("load");
    try {
      if (!audioModeSet) { await setAudioModeAsync({ playsInSilentMode: true }); audioModeSet = true; }
      const u = await localRecording(call.id, recordingFileName(call));
      player.replace({ uri: u });
      setUri(u);
      return u;
    } finally { setBusy(""); }
  };

  const toggle = async () => {
    void Haptics.selectionAsync();
    try {
      await ensure();
      if (status.playing) player.pause();
      else { player.setPlaybackRate(speed); player.play(); }
    } catch (e) { Alert.alert("Can't play the recording", apiMessage(e)); }
  };
  const seek = async (fraction: number) => {
    try {
      await ensure();
      const d = status.duration || call.duration_seconds || 0;
      if (d) await player.seekTo(Math.max(0, Math.min(d, fraction * d)));
    } catch (e) { Alert.alert("Can't play the recording", apiMessage(e)); }
  };
  const skip = (s: number) => { if (uri) void player.seekTo(Math.max(0, Math.min(dur, time + s))); };
  const cycleSpeed = () => {
    const next = SPEEDS[(SPEEDS.indexOf(speed) + 1) % SPEEDS.length] ?? 1;
    setSpeed(next);
    player.setPlaybackRate(next);
  };
  const share = async (save: boolean) => {
    setBusy("share");
    try {
      const u = await ensure();
      if (!(await Sharing.isAvailableAsync())) throw new Error("Sharing isn't available on this device.");
      await Sharing.shareAsync(u, {
        mimeType: "audio/mpeg",
        dialogTitle: save ? "Save recording" : `AI call recording: ${call.lead_name || `Lead #${call.lead_id}`}`,
        UTI: "public.audio",
      });
    } catch (e) { Alert.alert(save ? "Couldn't save" : "Couldn't share", apiMessage(e)); }
    setBusy("");
  };

  return (
    <View style={st.player}>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
        <Pressable onPress={toggle} accessibilityLabel={status.playing ? "Pause recording" : "Play recording"} style={({ pressed }) => [st.play, pressed && { transform: [{ scale: 0.94 }] }]}>
          {busy === "load" ? <ActivityIndicator color="#fff" /> : <Ionicons name={status.playing ? "pause" : "play"} size={22} color="#fff" style={!status.playing && { marginLeft: 3 }} />}
        </Pressable>

        <Pressable
          style={st.track}
          onLayout={(e) => setWidth(e.nativeEvent.layout.width)}
          onPress={(e) => width && void seek(e.nativeEvent.locationX / width)}
          accessibilityRole="adjustable"
          accessibilityLabel={`Recording, ${clock(time)} of ${clock(dur)}`}
        >
          {peaks.map((p, i) => {
            const played = i < head;
            const near = status.playing && Math.abs(i - head) < 2.5;
            const bar = <View style={[st.bar, { height: `${p * 100}%`, backgroundColor: played ? colors.primary : "#D8D2EE" }]} />;
            return near ? (
              <Animated.View key={i} style={{ flex: 1, height: "100%", justifyContent: "center", transform: [{ scaleY: pulse.interpolate({ inputRange: [0, 1], outputRange: [1, 1.45] }) }] }}>{bar}</Animated.View>
            ) : (
              <View key={i} style={{ flex: 1, height: "100%", justifyContent: "center" }}>{bar}</View>
            );
          })}
          {dur > 0 && <View pointerEvents="none" style={[st.head, { left: `${progress * 100}%` }]} />}
        </Pressable>
      </View>

      <View style={st.controls}>
        <Text style={st.time}><Text style={{ color: colors.text, fontWeight: "700" }}>{clock(time)}</Text> / {clock(dur)}</Text>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 2 }}>
          <CtrlBtn icon="play-back" label="Back 10 seconds" onPress={() => skip(-10)} />
          <CtrlBtn icon="play-forward" label="Forward 10 seconds" onPress={() => skip(10)} />
          <Pressable onPress={cycleSpeed} style={st.ctrl} accessibilityLabel="Playback speed"><Text style={{ fontWeight: "800", color: colors.text, fontSize: 13 }}>{speed}×</Text></Pressable>
          <CtrlBtn icon="download-outline" label="Save recording" onPress={() => void share(true)} busy={busy === "share"} />
          <CtrlBtn icon="share-social-outline" label="Share recording" onPress={() => void share(false)} />
        </View>
      </View>
    </View>
  );
}

function CtrlBtn({ icon, label, onPress, busy }: { icon: IconName; label: string; onPress: () => void; busy?: boolean }) {
  return (
    <Pressable onPress={onPress} accessibilityLabel={label} style={({ pressed }) => [st.ctrl, pressed && { backgroundColor: colors.primarySoft }]}>
      {busy ? <ActivityIndicator size="small" color={colors.primary} /> : <Ionicons name={icon} size={18} color={colors.text} />}
    </Pressable>
  );
}

/** One call: status, summary, answers, recording and transcript. */
export function CallCard({ call, onCancel, cancelling, flat }: { call: AiCall; onCancel?: (id: number) => void; cancelling?: boolean; flat?: boolean }) {
  const [showTranscript, setShowTranscript] = useState(false);
  const st0 = callStatus(call.status);
  const answers = ANSWER_LABELS.filter(([k]) => call.answers?.[k]);
  const when = call.status === "SCHEDULED" ? call.scheduled_at : call.started_at || call.created_at;
  const outcomeTone = toneOf(call.outcome);
  return (
    <View style={[!flat && st.card, { gap: 12 }]}>
      <View style={{ flexDirection: "row", gap: 12, alignItems: "flex-start" }}>
        <View style={[st.icon, { backgroundColor: st0.bg }]}><Ionicons name={st0.icon} size={18} color={st0.fg} /></View>
        <View style={{ flex: 1, gap: 6 }}>
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6 }}>
            <Badge label={st0.label} bg={st0.bg} fg={st0.fg} />
            {call.outcome_label ? <Badge label={call.outcome_label} bg={outcomeTone.bg} fg={outcomeTone.fg} /> : null}
            {call.provider === "simulator" ? <Badge label="Simulated" bg="#EEF0F5" fg="#4A5070" /> : null}
          </View>
          <Text style={st.meta}>
            {call.status === "SCHEDULED" ? "Calls " : ""}{formatDateTime(when)} · attempt {call.attempt}
            {duration(call.duration_seconds) ? ` · ${duration(call.duration_seconds)}` : ""}
            {call.trigger_type === "MANUAL" ? ` · by ${call.created_by_name || "a user"}` : ""}
          </Text>
        </View>
        {call.status === "SCHEDULED" && onCancel ? <Button title="Cancel" size="sm" variant="outline" loading={cancelling} onPress={() => onCancel(call.id)} /> : null}
      </View>

      {call.skip_label || call.error ? <Text style={st.body}>{call.skip_label || call.error}</Text> : null}
      {call.has_recording ? <WaveformPlayer call={call} /> : null}
      {call.summary ? (
        <View style={{ gap: 4 }}>
          <Text style={st.label}>SUMMARY</Text>
          <Text style={st.body}>{call.summary}</Text>
        </View>
      ) : null}

      {answers.length ? (
        <View style={{ gap: 6 }}>
          <Text style={st.label}>ANSWERS</Text>
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
            {answers.map(([k, label]) => (
              <View key={k} style={st.answer}>
                <Text style={{ fontSize: 11.5, color: colors.textMuted }}>{label}</Text>
                <Text style={{ fontSize: 13.5, fontWeight: "600", color: colors.text }}>{String(call.answers![k])}</Text>
              </View>
            ))}
          </View>
        </View>
      ) : null}

      {call.transcript ? (
        <View style={{ gap: 8 }}>
          <Pressable onPress={() => setShowTranscript((v) => !v)} style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
            <Ionicons name={showTranscript ? "chevron-up" : "chevron-down"} size={16} color={colors.primary} />
            <Text style={{ color: colors.primary, fontWeight: "700", fontSize: 13.5 }}>{showTranscript ? "Hide transcript" : "Show transcript"}</Text>
          </Pressable>
          {showTranscript ? (
            <View style={st.transcript}>
              {transcriptLines(call.transcript).map((l, i) => (
                <View key={i} style={{ alignItems: l.who === "customer" ? "flex-end" : "flex-start" }}>
                  <View style={[st.bubble, l.who === "agent" && st.bubbleAgent, l.who === "customer" && st.bubbleCustomer]}>
                    {l.who ? <Text style={[st.who, l.who === "customer" && { color: "rgba(255,255,255,0.8)" }]}>{l.who === "agent" ? "AI AGENT" : "CUSTOMER"}</Text> : null}
                    <Text style={{ fontSize: 13.5, lineHeight: 19, color: l.who === "customer" ? "#fff" : colors.text }}>{l.text}</Text>
                  </View>
                </View>
              ))}
            </View>
          ) : null}
        </View>
      ) : null}
    </View>
  );
}

/** AI calls tab on the lead screen: history, recordings, transcripts, answers, and "Call with AI now". */
export function AiCallsPanel({ leadId, hasPhone }: { leadId: number; hasPhone: boolean }) {
  const { can } = useAuth();
  const q = useQuery({
    queryKey: ["lead", leadId, "ai-calls"],
    queryFn: () => leadAiCalls(leadId),
    // Poll while a call is queued or running so the result shows up on its own.
    refetchInterval: (query) => (query.state.data?.calls?.some((c) => ACTIVE_STATUSES.includes(c.status)) ? 10_000 : false),
  });
  const start = useAction(() => api<{ scheduledAt: string; queuedForWindow: boolean }>(`/crm/leads/${leadId}/ai-calls`, { method: "POST" }), {
    invalidate: [["lead", leadId]],
    onDone: (r) => Alert.alert(r?.queuedForWindow ? "Call queued" : "Calling now", r?.queuedForWindow ? `Outside calling hours. The call is queued for ${formatDateTime(r.scheduledAt)}.` : "The AI agent will call in a few seconds."),
  });
  const cancel = useAction((id: number) => api(`/crm/ai-calls/${id}/cancel`, { method: "POST" }), { invalidate: [["lead", leadId]], success: "Call cancelled" });

  if (q.isLoading) return <Loading />;
  if (q.isError) return <ErrorView message={apiMessage(q.error)} onRetry={() => void q.refetch()} />;
  const data = q.data!;
  const active = data.calls.some((c) => ACTIVE_STATUSES.includes(c.status));
  const canStart = can("lead.edit") && hasPhone && !data.doNotCall && !active;

  return (
    <View style={{ gap: 12 }}>
      <View style={[st.card, { flexDirection: "row", alignItems: "center", gap: 12 }]}>
        <View style={[st.icon, { backgroundColor: colors.primarySoft }]}><Ionicons name="hardware-chip" size={18} color={colors.primary} /></View>
        <View style={{ flex: 1 }}>
          <Text style={{ fontWeight: "700", color: colors.text, fontSize: 15 }}>AI calling agent</Text>
          <Text style={st.meta}>
            {data.doNotCall ? "This lead asked not to be called." : !data.canCall ? "The calling service isn't set up yet." : active ? "A call is queued or in progress." : "Calls the customer and saves the answers here."}
          </Text>
        </View>
      </View>
      {canStart && data.canCall ? (
        <Button
          title="Call with AI now"
          icon="call"
          loading={start.isPending}
          onPress={() => confirm("Call with AI now?", "The AI agent will phone this lead within a few seconds (or at the start of calling hours).", "Call now", () => start.mutate(), false)}
        />
      ) : null}
      {!data.calls.length ? (
        <EmptyState icon="hardware-chip-outline" title="No AI calls yet" text="New leads are called automatically when AI calling is on for this website." />
      ) : data.calls.map((c) => (
        <CallCard key={c.id} call={c} onCancel={(id) => confirm("Cancel this call?", "The AI agent won't place it.", "Cancel call", () => cancel.mutate(id))} cancelling={cancel.isPending && cancel.variables === c.id} />
      ))}
    </View>
  );
}

const st = StyleSheet.create({
  card: { backgroundColor: colors.card, borderRadius: 20, padding: 14, borderWidth: 1, borderColor: colors.border, ...shadow.card },
  icon: { width: 38, height: 38, borderRadius: 12, alignItems: "center", justifyContent: "center" },
  meta: { fontSize: 12.5, color: colors.textMuted, lineHeight: 18 },
  label: { fontSize: 11, fontWeight: "800", letterSpacing: 0.8, color: colors.textMuted },
  body: { fontSize: 14, lineHeight: 21, color: colors.text },
  answer: { backgroundColor: colors.page, borderRadius: 12, paddingHorizontal: 12, paddingVertical: 8, minWidth: "47%", flexGrow: 1, gap: 2 },
  transcript: { backgroundColor: colors.page, borderRadius: 16, padding: 10, gap: 8 },
  bubble: { maxWidth: "88%", borderRadius: 16, paddingHorizontal: 12, paddingVertical: 8 },
  bubbleAgent: { backgroundColor: "#fff", borderTopLeftRadius: 4, borderWidth: 1, borderColor: colors.border },
  bubbleCustomer: { backgroundColor: colors.primary, borderTopRightRadius: 4 },
  who: { fontSize: 10, fontWeight: "800", letterSpacing: 0.6, color: colors.textMuted, marginBottom: 2 },
  player: { backgroundColor: "#FBFAFF", borderRadius: 18, borderWidth: 1, borderColor: colors.border, padding: 12, gap: 8 },
  play: { width: 50, height: 50, borderRadius: 25, backgroundColor: colors.primary, alignItems: "center", justifyContent: "center", ...shadow.float },
  track: { flex: 1, height: 56, flexDirection: "row", alignItems: "center", gap: 2 },
  bar: { width: "100%", borderRadius: 3, minHeight: 4 },
  head: { position: "absolute", top: 2, bottom: 2, width: 2, marginLeft: -1, borderRadius: 1, backgroundColor: colors.primary },
  controls: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingLeft: 62 },
  time: { fontSize: 12.5, color: colors.textMuted, fontVariant: ["tabular-nums"] },
  ctrl: { height: 34, minWidth: 34, paddingHorizontal: 6, borderRadius: 10, alignItems: "center", justifyContent: "center" },
});
