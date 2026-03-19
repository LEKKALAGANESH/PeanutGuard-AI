/// <reference lib="deno.ns" />
// supabase/functions/check-reviews/index.ts
// Edge Function: Submit expert review requests and check review status
// Supports: POST (submit review) and GET (check status by device_id)

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

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_ANON_KEY") ?? "",
    { global: { headers: { Authorization: req.headers.get("Authorization") ?? "" } } }
  );

  try {
    // ── GET: Check review status ──
    if (req.method === "GET") {
      const url = new URL(req.url);
      const deviceId = url.searchParams.get("device_id");

      if (!deviceId) {
        return new Response(JSON.stringify({ error: "Missing device_id" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const { data: reviews, error } = await supabase
        .from("expert_reviews")
        .select("id, scan_id, status, reviewer_diagnosis, reviewer_confidence, reviewer_note, reviewed_at, trigger_reason, created_at")
        .eq("device_id", deviceId)
        .order("created_at", { ascending: false })
        .limit(20);

      if (error) throw new Error(error.message);

      const pending = reviews?.filter(r => r.status === "pending" || r.status === "in_review") ?? [];
      const completed = reviews?.filter(r => r.status === "confirmed" || r.status === "revised" || r.status === "inconclusive") ?? [];

      return new Response(JSON.stringify({ pending, completed, total: reviews?.length ?? 0 }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ── POST: Submit review request ──
    if (req.method === "POST") {
      const { data: { user }, error: authError } = await supabase.auth.getUser();
      if (authError || !user) {
        return new Response(JSON.stringify({ error: "Unauthorized" }), {
          status: 401,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const body = await req.json();
      const {
        scanId,
        deviceId,
        imageThumbnail,
        predictions,
        qualityReport,
        lesionBoxes,
        fieldContext,
        farmerNote,
        urgency,
        triggerReason,
      } = body;

      if (!scanId || !deviceId || !imageThumbnail || !predictions || !triggerReason) {
        return new Response(JSON.stringify({ error: "Missing required fields: scanId, deviceId, imageThumbnail, predictions, triggerReason" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const { data, error } = await supabase.from("expert_reviews").insert({
        scan_id: scanId,
        device_id: deviceId,
        image_thumbnail: imageThumbnail,
        predictions,
        quality_report: qualityReport ?? null,
        lesion_boxes: lesionBoxes ?? null,
        field_context: fieldContext ?? null,
        farmer_note: farmerNote ?? null,
        urgency: urgency ?? "routine",
        trigger_reason: triggerReason,
      }).select("id").single();

      if (error) throw new Error(error.message);

      return new Response(JSON.stringify({ success: true, reviewId: data?.id }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
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
