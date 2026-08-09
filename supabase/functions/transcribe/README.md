# `transcribe` — ElevenLabs Speech-to-Text proxy

Turns a saved meeting recording into a speaker-labelled transcript.
The **ElevenLabs API key lives only in Supabase** — it is never sent to the
browser, so nobody can read it from the public site and spend your credits.

```
browser (meeting-transcription.html)
   └─ sb.functions.invoke('transcribe', { body: FormData(file) })   ← user's JWT attached
        └─ this function  ──(xi-api-key from secret)──►  api.elevenlabs.io/v1/speech-to-text
```

## One-time setup

1. **Get an API key** — https://elevenlabs.io → Profile → API Keys.

2. **Store it as a Supabase secret** (you run this; the key never goes through chat):

   ```bash
   supabase login
   supabase link --project-ref kxxwtebxkrvdlqyljkzu
   supabase secrets set ELEVENLABS_API_KEY=your_key_here
   ```

   Or in the dashboard: **Edge Functions → Secrets → Add new secret**,
   name `ELEVENLABS_API_KEY`.

3. **Deploy the function:**

   ```bash
   supabase functions deploy transcribe
   ```

That's it — the **Transcribe** button on the Meeting Recorder page starts working
for any signed-in portal user.

## Notes

- **Auth is required.** Supabase verifies the caller's JWT, so only signed-in
  portal users can spend transcription credits. Users on the offline/demo login
  will be told to sign in with Supabase first.
- **Model:** `scribe_v1` with `diarize: true`, so the transcript comes back split
  by speaker (rendered as *Speaker 1 / Speaker 2 …* chips in the portal).
- **Language:** auto-detected by default; the page's dropdown can pin English,
  Sinhala or Tamil.
- **Limits:** ElevenLabs accepts files up to 5 GB. A 60-minute portal recording is
  roughly 30–60 MB, so it is comfortably within range.
- **Before the secret is set** the function returns a clear
  "Transcription is not configured yet" message rather than failing obscurely.
