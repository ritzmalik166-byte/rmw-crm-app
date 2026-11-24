import { useMemo } from "react";
import type { ImageSourcePropType } from "react-native";
import { useAuth } from "@/providers/AuthProvider";

export type PipelineKey = "mpf" | "rmw" | "ct" | "ctmpl";
export type PipelineCounts = { total: number; new_leads: number; unassigned: number; converted: number; today: number; overdue: number };
/** `logo` is optional: pipelines without a mark render their initials instead. */
export type Pipeline = { key: PipelineKey; title: string; short: string; site: string; logo?: ImageSourcePropType; tone: string };

/** The business pipelines shown on Home and as Leads filters. Order matches the web dashboard. */
export const PIPELINES: Pipeline[] = [
  { key: "mpf", title: "MPF Leads", short: "MPF", site: "MyPropertyFact", logo: require("../../assets/images/mpf-mark.png"), tone: "#13A89A" },
  { key: "rmw", title: "RMW Leads", short: "RMW", site: "Ritz Media World", logo: require("../../assets/images/rmw-mark.png"), tone: "#E8A23A" },
  { key: "ct", title: "CT Leads", short: "CT", site: "Contenaissance", logo: require("../../assets/images/ct-mark.png"), tone: "#7C5CFF" },
  { key: "ctmpl", title: "CTMPL Leads", short: "CTMPL", site: "Creative Thinks Media", tone: "#D6409F" },
];

export const pipelineFor = (code?: string | null) => PIPELINES.find((p) => p.short === code);

/** Pipelines for the websites the signed-in user can access (`me.websites`; Owner / Super Admin get all). */
export function usePipelines(): Pipeline[] {
  const { me } = useAuth();
  const sites = me?.websites;
  return useMemo(() => {
    if (!sites) return PIPELINES; // older server without `websites`: keep the previous behaviour
    const codes = new Set(sites.map((w) => w.code.toUpperCase()));
    return PIPELINES.filter((p) => codes.has(p.short));
  }, [sites]);
}
