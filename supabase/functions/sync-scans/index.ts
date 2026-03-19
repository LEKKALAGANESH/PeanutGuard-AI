/// <reference lib="deno.ns" />
// supabase/functions/sync-scans/index.ts
// Edge Function: Receives scan metadata from client and writes to DB
// Also contributes to anonymous disease_reports for community map

import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_ANON_KEY") ?? "",
      { global: { headers: { Authorization: req.headers.get("Authorization") ?? "" } } }
    );

    // Verify auth
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body = await req.json();
    const action = body.action as string;

    // ── Upload Scan ──
    if (action === "upload_scan") {
      const { scanId, diseaseLabel, confidence, severity, modelUsed, timestamp, fieldId, lesionCount, gpsGrid } = body;

      // Insert scan record
      const { error: scanErr } = await supabase.from("scans").insert({
        id: scanId,
        user_id: user.id,
        field_id: fieldId ?? null,
        image_type: "leaf",
        created_at: new Date(timestamp).toISOString(),
      });

      if (scanErr && !scanErr.message.includes("duplicate")) {
        throw new Error(`Scan insert failed: ${scanErr.message}`);
      }

      // Insert scan result
      if (diseaseLabel) {
        const { error: resultErr } = await supabase.from("scan_results").insert({
          scan_id: scanId,
          disease_label: diseaseLabel,
          confidence: confidence ?? 0,
          severity: severity ?? 1,
          lesion_count: lesionCount ?? 0,
          model_used: modelUsed ?? "mobilenetv3_large",
        });

        if (resultErr && !resultErr.message.includes("duplicate")) {
          throw new Error(`Result insert failed: ${resultErr.message}`);
        }
      }

      // Contribute to anonymous disease map (if GPS available)
      if (gpsGrid && diseaseLabel && diseaseLabel !== "healthy") {
        await supabase.from("disease_reports").insert({
          gps_grid: gpsGrid,
          disease_label: diseaseLabel,
          severity: severity ?? 1,
          confidence: confidence ?? 0,
        });
      }

      return new Response(JSON.stringify({ success: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ── Update Field ──
    if (action === "update_field") {
      const { fieldId, name, gpsLat, gpsLng, plantingDate, variety, areaHectares } = body;

      const { error } = await supabase.from("fields").upsert({
        id: fieldId,
        user_id: user.id,
        name,
        gps_lat: gpsLat,
        gps_lng: gpsLng,
        planting_date: plantingDate,
        variety,
        area_hectares: areaHectares,
      });

      if (error) throw new Error(`Field upsert failed: ${error.message}`);

      return new Response(JSON.stringify({ success: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ── Delete Scan ──
    if (action === "delete_scan") {
      const { scanId } = body;

      const { error } = await supabase.from("scans").delete().eq("id", scanId).eq("user_id", user.id);
      if (error) throw new Error(`Delete failed: ${error.message}`);

      return new Response(JSON.stringify({ success: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ error: `Unknown action: ${action}` }), {
      status: 400,
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
