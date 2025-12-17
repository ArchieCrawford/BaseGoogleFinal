import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
const SERVICE_ROLE_KEY = Deno.env.get("SERVICE_ROLE_KEY");
const WEBHOOK_SECRET = Deno.env.get("WEBHOOK_SECRET");

function s(v: any) {
  return typeof v === "string" ? v : v == null ? null : String(v);
}

serve(async (req) => {
  if (req.method !== "POST") return new Response("Method not allowed", { status: 405 });

  const requestId = req.headers.get("sb-request-id") ?? crypto.randomUUID();
  const missing = [
    SUPABASE_URL ? null : "SUPABASE_URL",
    SERVICE_ROLE_KEY ? null : "SERVICE_ROLE_KEY",
  ].filter(Boolean) as string[];

  if (missing.length > 0) {
    console.error("log missing env", { requestId, missing });
    return new Response(JSON.stringify({ ok: false, error: "missing env var", missing }), {
      status: 500,
      headers: { "content-type": "application/json" },
    });
  }

  // Allow anon bearer token or x-webhook-secret override for testing.
  const authHeader = req.headers.get("authorization");
  const webhookHeader = req.headers.get("x-webhook-secret");
  const bearer = authHeader?.toLowerCase().startsWith("bearer ");
  const webhookOK = WEBHOOK_SECRET && webhookHeader === WEBHOOK_SECRET;
  if (!bearer && !webhookOK) {
    return new Response(JSON.stringify({ ok: false, error: "unauthorized" }), {
      status: 401,
      headers: { "content-type": "application/json" },
    });
  }

  const supabase = createClient(SUPABASE_URL!, SERVICE_ROLE_KEY!);

  const body = await req.json().catch(() => null);
  if (!body?.type) {
    return new Response(JSON.stringify({ ok: false, error: "Missing type" }), {
      status: 400,
      headers: { "content-type": "application/json" },
    });
  }

  const ts = body.ts ? new Date(body.ts) : new Date();
  const id = s(body.id) ?? crypto.randomUUID();

  const raw = {
    id,
    source: "app",
    type: s(body.type),
    ts: ts.toISOString(),
    wallet: s(body.wallet)?.toLowerCase() ?? null,
    token: s(body.token)?.toLowerCase() ?? null,
    fid: body.fid ?? null,
    username: s(body.username)?.toLowerCase() ?? null,
    text: s(body.text),
    tx_hash: s(body.txHash)?.toLowerCase() ?? null,
    payload: body.props ?? body.payload ?? {},
  };

  const doc = {
    doc_id: `event:app:${raw.id}`,
    doc_type: "event",
    title: `App event: ${raw.type}`,
    snippet: raw.text ?? null,
    ts: raw.ts,
    token: raw.token,
    wallet: raw.wallet,
    fid: raw.fid,
    username: raw.username,
    tx_hash: raw.tx_hash,
    url: null,
    keywords: [raw.type, "app", raw.wallet, raw.token, raw.username].filter(Boolean),
    body: raw,
  };

  console.log("log handler", { requestId, doc_id: doc.doc_id, type: raw.type });

  try {
    const { error: e1 } = await supabase.from("raw_events").upsert(raw, { onConflict: "id" });
    if (e1) throw e1;
  } catch (err) {
    console.error("log raw_events upsert failed", { requestId, err });
    return new Response(JSON.stringify({ ok: false, error: "db upsert failed", details: String(err) }), {
      status: 500,
      headers: { "content-type": "application/json" },
    });
  }

  try {
    const { error: e2 } = await supabase.from("search_docs").upsert(doc, { onConflict: "doc_id" });
    if (e2) throw e2;
  } catch (err) {
    console.error("log search_docs upsert failed", { requestId, err });
    return new Response(JSON.stringify({ ok: false, error: "db upsert failed", details: String(err) }), {
      status: 500,
      headers: { "content-type": "application/json" },
    });
  }

  return new Response(JSON.stringify({ ok: true, id: raw.id }), {
    headers: { "content-type": "application/json" },
  });
});
