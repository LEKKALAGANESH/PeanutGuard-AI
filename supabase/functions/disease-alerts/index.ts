/// <reference lib="deno.ns" />
// supabase/functions/disease-alerts/index.ts
// Edge Function: Returns recent disease reports near a GPS grid cell
// "Leaf Spot reported 2km from your field" — community disease map

import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const url = new URL(req.url);
    const gpsGrid = url.searchParams.get("h3");
    const region = url.searchParams.get("region");
    const daysBack = parseInt(url.searchParams.get("days") ?? "30", 10);

    if (!gpsGrid) {
      return new Response(JSON.stringify({ error: "Missing h3 parameter" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    const since = new Date(Date.now() - daysBack * 24 * 60 * 60 * 1000).toISOString();

    // Get disease reports for this grid cell and neighbors
    // H3 neighbor lookup would need h3-js; for now, exact grid match
    const { data: reports, error } = await supabase
      .from("disease_reports")
      .select("disease_label, severity, confidence, reported_at")
      .eq("gps_grid", gpsGrid)
      .gte("reported_at", since)
      .order("reported_at", { ascending: false })
      .limit(50);

    if (error) throw new Error(error.message);

    // Aggregate by disease
    const summary: Record<string, { count: number; avgSeverity: number; avgConfidence: number; latest: string }> = {};

    for (const r of reports ?? []) {
      if (!summary[r.disease_label]) {
        summary[r.disease_label] = { count: 0, avgSeverity: 0, avgConfidence: 0, latest: r.reported_at };
      }
      const s = summary[r.disease_label];
      s.count++;
      s.avgSeverity = (s.avgSeverity * (s.count - 1) + (r.severity ?? 0)) / s.count;
      s.avgConfidence = (s.avgConfidence * (s.count - 1) + (r.confidence ?? 0)) / s.count;
      if (r.reported_at > s.latest) s.latest = r.reported_at;
    }

    // Build alerts
    const alerts = Object.entries(summary)
      .filter(([, s]) => s.count >= 1)
      .map(([label, s]) => ({
        disease: label,
        reportCount: s.count,
        avgSeverity: Math.round(s.avgSeverity * 10) / 10,
        avgConfidence: Math.round(s.avgConfidence * 1000) / 1000,
        latestReport: s.latest,
        message: `${label.replace(/_/g, " ")} reported ${s.count} time(s) in your area (avg severity: ${s.avgSeverity.toFixed(1)}/5)`,
      }))
      .sort((a, b) => b.reportCount - a.reportCount);

    return new Response(JSON.stringify({ grid: gpsGrid, alerts, totalReports: reports?.length ?? 0 }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
