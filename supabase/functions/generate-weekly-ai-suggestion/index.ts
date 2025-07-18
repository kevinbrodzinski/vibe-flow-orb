import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient, SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.50.3";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Helper function to handle both authenticated and pre-warm requests
function getUserIdAuthedOrPrewarm(body: any, supabase: SupabaseClient, req: Request) {
  // preWarm bypasses JWT
  if (body?.preWarm === true && body?.userId) return { userId: body.userId };

  // regular auth path
  const auth = req.headers.get('authorization') ?? '';
  return supabase.auth.getUser(auth.replace('Bearer ', ''));
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const openaiKey = Deno.env.get('OPENAI_API_KEY');

    if (!openaiKey) {
      console.error('OpenAI API key not configured');
      return new Response(JSON.stringify({ error: 'OpenAI API key not configured' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // ─── 1. AUTH or PREWARM ─────────────────────────────────────────────────
    const body = await req.json().catch(() => ({}));
    const preWarm = body.preWarm === true;
    const force = !!body.forceRefresh;
    const userRes = await getUserIdAuthedOrPrewarm(body, supabase, req);

    if (!userRes?.userId && !userRes?.data?.user) {
      return new Response('Unauthorized', { status: 401, headers: corsHeaders });
    }
    const userId = userRes.userId ?? userRes.data.user.id;

    // ─── 2. Params & helpers ────────────────────────────────────────────────
    const today = new Date();
    const sunday = new Date(today);
    sunday.setDate(sunday.getDate() - sunday.getDay());  // previous Sunday
    const weekKey = sunday.toISOString().slice(0, 10);  // YYYY-MM-DD

    console.log(`${preWarm ? 'Pre-warming' : 'Generating'} weekly AI suggestion for user ${userId}, week ending ${weekKey}, forceRefresh: ${force}`);

    // ─── 3. Check cooldown (12 hours for regeneration, but skip for pre-warm) ─
    if (force && !preWarm) {
      const { data: cooldown } = await supabase
        .from("weekly_ai_suggestion_cooldowns")
        .select("last_regenerated_at")
        .eq("user_id", userId)
        .maybeSingle();

      if (cooldown?.last_regenerated_at) {
        const lastRegen = new Date(cooldown.last_regenerated_at);
        const hoursAgo = (Date.now() - lastRegen.getTime()) / (1000 * 60 * 60);
        
        if (hoursAgo < 12) {
          const hoursLeft = Math.ceil(12 - hoursAgo);
          console.log(`Cooldown active: ${hoursLeft} hours remaining`);
          return new Response(JSON.stringify({ 
            error: 'cooldown_active',
            message: `Please wait ${hoursLeft} more hour${hoursLeft > 1 ? 's' : ''} before regenerating`,
            hoursLeft 
          }), {
            status: 429,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        }
      }

      // Update cooldown timestamp immediately
      await supabase
        .from("weekly_ai_suggestion_cooldowns")
        .upsert({
          user_id: userId,
          last_regenerated_at: new Date().toISOString(),
        });
    }

    // ─── 4. Check cache (skip for force refresh or pre-warm) ────────────────
    if (!force && !preWarm) {
      const { data, error } = await supabase
        .from("weekly_ai_suggestions")
        .select("json")
        .eq("user_id", userId)
        .eq("week_ending", weekKey)
        .maybeSingle();

      if (error) {
        console.error('Cache lookup error:', error);
      } else if (data?.json) {
        console.log('Returning cached suggestion');
        return new Response(JSON.stringify({ 
          source: "cache", 
          suggestion: {
            text: data.json?.text || data.json,
            energy_score: data.json?.energy_score || 50,
            social_score: data.json?.social_score || 50
          }
        }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
    }

    // ─── 5. Gather stats needed for prompt (energy/social etc.) ─────────────
    const { data: trends, error: trendsError } = await supabase
      .rpc("get_afterglow_weekly_trends", { p_user_id: userId });

    if (trendsError) {
      console.error('Error fetching weekly trends:', trendsError);
    }

    // Get the most recent week's data or use fallbacks
    const latestTrend = trends && trends.length > 0 ? trends[trends.length - 1] : null;
    const avgEnergy = latestTrend?.avg_energy ?? 70;
    const avgSocial = latestTrend?.avg_social ?? 50;

    console.log(`User stats - Energy: ${avgEnergy}, Social: ${avgSocial}`);

    // ─── 5. Call OpenAI with network error handling ─────────────────────────
    let completion;
    try {
      completion = await fetch("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${openaiKey}`,
        },
        body: JSON.stringify({
          model: "gpt-4o-mini",
          messages: [
            {
              role: "system",
              content: "You are a friendly social coach who speaks in concise bullet points. Always return exactly three actionable suggestions in bullet point format.",
            },
            {
              role: "user",
              content: buildPrompt({ avgEnergy, avgSocial }),
            },
          ],
          max_tokens: 150,
          temperature: 0.7,
        }),
      });
    } catch (networkError) {
      console.error('Network error calling OpenAI:', networkError);
      return new Response(JSON.stringify({ 
        error: 'network_error',
        message: 'Unable to connect to AI service. Please try again later.' 
      }), {
        status: 502,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (!completion.ok) {
      const errorText = await completion.text();
      console.error('OpenAI API error:', errorText);
      return new Response(JSON.stringify({ error: 'Failed to generate AI suggestion' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const completionData = await completion.json();
    const suggestionText = completionData.choices?.[0]?.message?.content?.trim() ?? "";

    if (!suggestionText) {
      console.error('OpenAI returned empty suggestion');
      return new Response(JSON.stringify({ error: 'No suggestion generated' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const payload = { 
      text: suggestionText, 
      generated_at: new Date().toISOString(),
      energy_score: Math.round(avgEnergy),
      social_score: Math.round(avgSocial)
    };

    // ─── 6. Upsert cache ────────────────────────────────────────────────────
    const { error: upsertError } = await supabase
      .from("weekly_ai_suggestions")
      .upsert({
        user_id: userId,
        week_ending: weekKey,
        json: payload,
      });

    if (upsertError) {
      console.error('Error caching suggestion:', upsertError);
      // Still return the suggestion even if caching fails
    }

    // ─── 7. Cooldown already updated above ─────────────────────────────────

    console.log('Generated new AI suggestion successfully');
    return new Response(JSON.stringify({ source: "openai", suggestion: payload }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Error in generate-weekly-ai-suggestion function:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});

// Helper function to build the AI prompt
function buildPrompt({ avgEnergy, avgSocial }: { avgEnergy: number; avgSocial: number }) {
  return `This week your average Energy score was ${Math.round(avgEnergy)} / 100 and your average Social Intensity was ${Math.round(avgSocial)} / 100.

Return exactly three short bullet-point suggestions (max 16 words each) to help the user balance their vibes next week.

Format example:
• Catch a morning workout to lift energy  
• Say yes to one unexpected invite  
• Block Sunday evening for quiet recharge

Focus on actionable, specific suggestions that address both energy and social balance.`;
}