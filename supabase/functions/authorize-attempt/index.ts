// Supabase Edge Function: authorize-attempt
// Verifies Admin Key securely on the server and grants an extra game attempt for a student.
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

// In-memory rate limiting for failed admin key attempts (per IP)
interface RateLimitRecord {
  failures: number;
  lockedUntil: number;
}
const rateLimitMap = new Map<string, RateLimitRecord>();
const MAX_FAILURES = 5;
const LOCKOUT_MS = 5 * 60 * 1000; // 5 minute cooldown after 5 failed attempts

// Constant-time string comparison to prevent timing attacks
function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let mismatch = 0;
  for (let i = 0; i < a.length; i++) {
    mismatch |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return mismatch === 0;
}

serve(async (req: Request) => {
  // 1. Handle CORS Preflight
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  // 2. Identify client IP for rate limiting
  const clientIp =
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    req.headers.get("cf-connecting-ip") ||
    "unknown";

  const now = Date.now();
  const limit = rateLimitMap.get(clientIp);
  if (limit && limit.lockedUntil > now) {
    const remainingSeconds = Math.ceil((limit.lockedUntil - now) / 1000);
    return new Response(
      JSON.stringify({
        success: false,
        error: `Too many failed attempts. Rate limited for ${remainingSeconds}s.`,
      }),
      {
        status: 429,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }

  try {
    const body = await req.json();
    const enrollment = typeof body.enrollment === "string" ? body.enrollment.trim() : "";
    const adminKey = typeof body.adminKey === "string" ? body.adminKey.trim() : "";

    if (!enrollment) {
      return new Response(
        JSON.stringify({ success: false, error: "Enrollment number is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!adminKey) {
      return new Response(
        JSON.stringify({ success: false, error: "Invalid admin key" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // 3. Verify Server-Side Secret
    // The ADMIN_KEY secret is configured securely in the Supabase Dashboard / CLI secrets
    const expectedKey = Deno.env.get("ADMIN_KEY") || Deno.env.get("CYBERCHASE_ADMIN_KEY");

    if (!expectedKey) {
      console.error("ADMIN_KEY environment secret is not set in Supabase project!");
      return new Response(
        JSON.stringify({
          success: false,
          error: "Admin key verification service is not configured on the server.",
        }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const isValid = timingSafeEqual(adminKey, expectedKey);

    if (!isValid) {
      // Record failure for rate limiting
      const currentRecord = rateLimitMap.get(clientIp) || { failures: 0, lockedUntil: 0 };
      currentRecord.failures += 1;
      if (currentRecord.failures >= MAX_FAILURES) {
        currentRecord.lockedUntil = now + LOCKOUT_MS;
      }
      rateLimitMap.set(clientIp, currentRecord);

      return new Response(
        JSON.stringify({ success: false, error: "Invalid admin key" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Reset rate limiter on successful authentication
    rateLimitMap.delete(clientIp);

    // 4. Connect to Supabase using internal service-role key
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

    const normalizedEnrollment = enrollment.toUpperCase();

    // Insert new authorization record
    const { error: insertError } = await supabaseAdmin
      .from("cyberchase_authorizations")
      .insert([
        {
          normalized_enrollment: normalizedEnrollment,
          created_by: "ADMIN_EDGE_FUNCTION",
          authorized_at: new Date().toISOString(),
          used_at: null,
        },
      ]);

    if (insertError) {
      console.error("Failed to insert authorization:", insertError);
      return new Response(
        JSON.stringify({ success: false, error: "Database error authorizing attempt." }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(
      JSON.stringify({
        success: true,
        message: `Attempt authorized for enrollment ${normalizedEnrollment}`,
        enrollment: normalizedEnrollment,
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error("Error processing request:", err);
    return new Response(
      JSON.stringify({ success: false, error: "Malformed request or server error" }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
