// ============================================================
// Lyceum Connect — ElevenLabs Speech-to-Text proxy
// Deno edge function. The ElevenLabs API key lives ONLY here as a
// Supabase secret — it is never shipped to the browser.
//
// Deploy:
//   supabase secrets set ELEVENLABS_API_KEY=sk_...
//   supabase functions deploy transcribe
//
// The browser calls it via supabase-js:
//   sb.functions.invoke('transcribe', { body: formData })
// which attaches the signed-in user's JWT, so only authenticated
// portal users can spend transcription credits.
// ============================================================

const ELEVEN_URL = "https://api.elevenlabs.io/v1/speech-to-text";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS, "Content-Type": "application/json" },
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  // Supabase verifies the JWT before we get here (verify_jwt is on by
  // default); this is a belt-and-braces check for a missing header.
  if (!req.headers.get("authorization")) {
    return json({ error: "Not signed in" }, 401);
  }

  const apiKey = Deno.env.get("ELEVENLABS_API_KEY");
  if (!apiKey) {
    return json(
      { error: "Transcription is not configured yet — set the ELEVENLABS_API_KEY secret." },
      503,
    );
  }

  let inbound: FormData;
  try {
    inbound = await req.formData();
  } catch {
    return json({ error: "Expected multipart/form-data with an audio file." }, 400);
  }

  const file = inbound.get("file");
  if (!(file instanceof File)) {
    return json({ error: "No audio file supplied." }, 400);
  }

  // Build the ElevenLabs request. scribe_v1 + diarisation gives us
  // speaker-labelled meeting transcripts.
  const out = new FormData();
  out.append("file", file, file.name || "recording.webm");
  out.append("model_id", (inbound.get("model_id") as string) || "scribe_v1");
  out.append("diarize", "true");
  out.append("tag_audio_events", "false");
  const lang = inbound.get("language_code");
  if (typeof lang === "string" && lang && lang !== "auto") {
    out.append("language_code", lang);
  }
  const numSpeakers = inbound.get("num_speakers");
  if (typeof numSpeakers === "string" && numSpeakers) {
    out.append("num_speakers", numSpeakers);
  }

  let res: Response;
  try {
    res = await fetch(ELEVEN_URL, {
      method: "POST",
      headers: { "xi-api-key": apiKey },
      body: out,
    });
  } catch (e) {
    return json({ error: "Could not reach the transcription service.", detail: String(e) }, 502);
  }

  const text = await res.text();
  if (!res.ok) {
    // Surface a useful message without leaking the key or internals.
    let detail = text.slice(0, 500);
    try {
      const parsed = JSON.parse(text);
      detail = parsed?.detail?.message || parsed?.detail || parsed?.message || detail;
    } catch { /* keep raw text */ }
    return json({ error: "Transcription failed", status: res.status, detail }, res.status);
  }

  return new Response(text, {
    status: 200,
    headers: { ...CORS, "Content-Type": "application/json" },
  });
});
