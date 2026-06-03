import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { messages } = await req.json();
    // Accept the common "CROQ" misspelling too so a typo'd secret name still works.
    const GROQ_API_KEY = Deno.env.get("GROQ_API_KEY") ?? Deno.env.get("CROQ_API_KEY");
    if (!GROQ_API_KEY) throw new Error("GROQ_API_KEY is not configured");

    const systemPrompt = `Du är en expert på geologi, hydrogeologi och miljövetenskap med fokus på svenska förhållanden. Du hjälper användare att analysera geodata från SGU:s (Sveriges geologiska undersökning) karttjänster.

Du kan analysera:
- Brunnar (borrdjup, kapacitet, grundvattennivåer, jorddjup, kommun, användning)
- Källor (naturliga källor i Sverige)
- Grundvattenmagasin (avgränsningar, typ, egenskaper)
- Jordarter (jordartstyper, fördelning)
- Grundvattenförekomster (vattenförvaltning)
- Grundvattennivåer (observerade stationer)
- Grundvattenkvalitet (provplatser)
- CSV-filer med geologisk eller hydrogeologisk data

När du får kartdata eller CSV-data, ge:
1. Statistisk sammanfattning (antal, medelvärden, min/max, fördelning)
2. Identifiera mönster och trender
3. Jämförelser mellan olika datakällor om möjligt
4. Relevanta geologiska/hydrogeologiska observationer
5. Rekommendationer för vidare analys

Svara alltid på svenska. Var konkret och datadriven i dina analyser. Använd tabeller och punktlistor för tydlighet.`;

    // Groq exposes an OpenAI-compatible API, so the streaming SSE shape
    // (choices[0].delta.content) already matches what the frontend expects.
    const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${GROQ_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "llama-3.3-70b-versatile",
        messages: [
          { role: "system", content: systemPrompt },
          ...messages,
        ],
        stream: true,
      }),
    });

    if (!response.ok) {
      const t = await response.text();
      console.error("Groq API error:", response.status, t);
      if (response.status === 429) {
        return new Response(
          JSON.stringify({ error: "Begränsningen för antal förfrågningar har nåtts. Försök igen om en stund." }),
          { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }
      return new Response(
        JSON.stringify({ error: "AI-tjänsten är inte tillgänglig just nu" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    return new Response(response.body, {
      headers: { ...corsHeaders, "Content-Type": "text/event-stream" },
    });
  } catch (e) {
    console.error("geo-chat error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Okänt fel" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
