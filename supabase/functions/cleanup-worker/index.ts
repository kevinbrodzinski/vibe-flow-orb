import { serve } from "https://deno.land/std@0.205.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { logInvocation, EdgeLogStatus, withTimeout } from "../_shared/edge-logger.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const supabase = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
);

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const startTime = Date.now();
  let status: EdgeLogStatus = 'success';
  let errorMessage: string | null = null;
  let metadata: Record<string, unknown> = {};

  try {
    const result = await withTimeout(doWork(), 45_000);
    return result;
  } catch (err) {
    if ((err as Error).message === 'function timed out') {
      status = 'timeout';
      errorMessage = 'Function execution timed out';
      return new Response(JSON.stringify({ error: "Request timeout" }), {
        status: 504,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }
    
    status = 'error';
    errorMessage = (err as Error).message;
    console.error("[cleanup-worker] Unexpected error:", err);
    
    return new Response(
      JSON.stringify({ error: "Internal server error" }),
      { 
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );
  } finally {
    await logInvocation({
      functionName: 'cleanup-worker',
      status,
      durationMs: Date.now() - startTime,
      errorMessage,
      metadata
    });
  }

  async function doWork() {
    console.log('[cleanup-worker] Starting cleanup process...');
    
    const { data, error } = await supabase.rpc("cleanup_inactive_floqs");

    if (error) {
      console.error("[cleanup-worker] Error:", error);
      return new Response(
        JSON.stringify({ error: error.message }),
        { 
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      );
    }

    console.log('[cleanup-worker] Cleanup completed:', data);
    
    // Set metadata for logging
    metadata = {
      cleaned_floqs: data?.cleaned_floqs || 0,
      cleaned_suggestions: data?.cleaned_suggestions || 0,
      cleanup_timestamp: data?.timestamp || new Date().toISOString()
    };
    
    return new Response(
      JSON.stringify({ 
        success: true, 
        ...data 
      }),
      { 
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );
  } // End of doWork function
});