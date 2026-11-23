// MuneemX — AI label scan (Supabase Edge Function)
// Reads a bottle photo with Claude and returns JSON.
//   task "identify": match the photo to the shop's catalog → {match_id, brand, ..., confidence}
//   task "enroll":   read label fields for a new product  → {brand, name, category, pack, size_ml, mrp, barcode}
// Secrets: ANTHROPIC_API_KEY (required), ANTHROPIC_MODEL (optional)
// Deploy:  supabase functions deploy ai-scan
//          supabase secrets set ANTHROPIC_API_KEY=sk-ant-...

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const CATS = "Whisky, Scotch, Rum, Vodka, Brandy, Gin, Beer, Wine, RTD";

const PROMPTS: Record<string, (catalog: string) => string> = {
  identify: (cat) => `You are the product recogniser in a liquor-shop billing system. Look at the photo of a bottle, can or carton. Read the brand, variant and pack size (ml) from the label, and any barcode digits if legible. Then choose the ONE matching product id from the catalog below, or null if nothing matches with confidence (brand AND size must match).
CATALOG (id|product|pack|category|barcode):
${cat}
Reply with only JSON: {"match_id":string|null,"brand":string,"variant":string,"size_ml":number|null,"category":string,"barcode":string|null,"confidence":number between 0 and 1,"note":"one short sentence"}`,
  enroll: () => `You are cataloguing a new product for an Indian liquor shop. From the photo of the bottle/can label, extract the fields. Use pack names: Full (750ml), Half (375ml), Quarter (180ml), Pint (650ml beer), Can, Bottle, Nip. Category is one of: ${CATS}.
Reply with only JSON: {"brand":string,"name":string (variant, e.g. "Deluxe Whisky"),"category":string,"pack":string,"size_ml":number,"mrp":number|null (only if printed on label),"barcode":string|null (only if digits are legible),"note":"one short sentence"}`,
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...CORS, "Content-Type": "application/json" } });

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (req.method !== "POST") return json({ error: "POST only" }, 405);
  const key = Deno.env.get("ANTHROPIC_API_KEY");
  if (!key) return json({ error: "AI is not set up yet: add the ANTHROPIC_API_KEY secret to this function." }, 500);

  let body: { task?: string; image?: string; mediaType?: string; catalog?: string };
  try { body = await req.json(); } catch { return json({ error: "Bad request" }, 400); }
  const task = body.task === "enroll" ? "enroll" : "identify";
  if (!body.image || body.image.length > 4_000_000) return json({ error: "Image missing or too large" }, 400);

  const r = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: { "x-api-key": key, "anthropic-version": "2023-06-01", "content-type": "application/json" },
    body: JSON.stringify({
      model: Deno.env.get("ANTHROPIC_MODEL") ?? "claude-sonnet-5-5",
      max_tokens: 500,
      messages: [{
        role: "user",
        content: [
          { type: "image", source: { type: "base64", media_type: body.mediaType ?? "image/jpeg", data: body.image } },
          { type: "text", text: PROMPTS[task]((body.catalog ?? "").slice(0, 60_000)) },
        ],
      }],
    }),
  });
  const out = await r.json();
  if (!r.ok) return json({ error: out?.error?.message ?? "AI request failed" }, 502);
  const text: string = (out.content ?? []).find((c: { type: string }) => c.type === "text")?.text ?? "";
  const m = text.match(/\{[\s\S]*\}/);
  if (!m) return json({ error: "AI could not read the label" }, 422);
  try { return json(JSON.parse(m[0])); } catch { return json({ error: "AI reply was not valid JSON" }, 422); }
});
