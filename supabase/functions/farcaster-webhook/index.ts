import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
const SERVICE_ROLE_KEY = Deno.env.get("SERVICE_ROLE_KEY");
const WEBHOOK_SECRET = Deno.env.get("WEBHOOK_SECRET");

const addrRe = /\b0x[a-fA-F0-9]{40}\b/g;
const txRe = /\b0x[a-fA-F0-9]{64}\b/g;
const handleRe = /@([a-zA-Z0-9_.-]{1,32})/g;

function extract(text: string) {
  const addrs = [...(text.match(addrRe) ?? [])].map((x) => x.toLowerCase());
  const txs = [...(text.match(txRe) ?? [])].map((x) => x.toLowerCase());
  const handles = [...text.matchAll(handleRe)].map((m) => m[1].toLowerCase());
  return { addrs, txs, handles };
}

async function hmacSha512Hex(secret: string, message: string) {
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    enc.encode(secret),
    { name: "HMAC", hash: "SHA-512" },
    false,
    ["sign"],
  );
  const sigBuf = await crypto.subtle.sign("HMAC", key, enc.encode(message));
  return [...new Uint8Array(sigBuf)]
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

function timingSafeEqualHex(a: string, b: string) {
  if (a.length !== b.length) return false;
  const toBytes = (hex: string) =>
    new Uint8Array(hex.match(/.{1,2}/g)!.map((x) => parseInt(x, 16)));
  const aa = toBytes(a.toLowerCase());
  const bb = toBytes(b.toLowerCase());
  let diff = 0;
  for (let i = 0; i < aa.length; i++) diff |= aa[i] ^ bb[i];
  return diff === 0;
}

serve(async (req) => {
  if (req.method !== "POST") {
    return new Response("Method not allowed", { status: 405 });
  }

  const requestId = req.headers.get("sb-request-id") ?? crypto.randomUUID();

  const missing = [
    SUPABASE_URL ? null : "SUPABASE_URL",
    SERVICE_ROLE_KEY ? null : "SERVICE_ROLE_KEY",
    WEBHOOK_SECRET ? null : "WEBHOOK_SECRET",
  ].filter(Boolean) as string[];

  if (missing.length > 0) {
    console.error("farcaster missing env", { requestId, missing });
    return new Response(JSON.stringify({ ok: false, error: "missing env var", missing }), {
      status: 500,
      headers: { "content-type": "application/json" },
    });
  }

  // ---- NEYNAR SIGNATURE VERIFICATION ----
  const rawBody = await req.text();

  const sig =
    req.headers.get("X-Neynar-Signature") ??
    req.headers.get("x-neynar-signature");

  if (!sig) {
    return new Response(JSON.stringify({ ok: false, error: "missing neynar signature" }), {
      status: 401,
      headers: { "content-type": "application/json" },
    });
  }

  const expected = await hmacSha512Hex(WEBHOOK_SECRET!, rawBody);
  if (!timingSafeEqualHex(expected, sig)) {
    return new Response(JSON.stringify({ ok: false, error: "invalid signature" }), {
      status: 401,
      headers: { "content-type": "application/json" },
    });
  }

  const body = JSON.parse(rawBody);
  const supabase = createClient(SUPABASE_URL!, SERVICE_ROLE_KEY!);

  // ---- EVENT PARSING ----
  const eventType = body.type ?? body.event ?? "farcaster_event";
  const cast = body.data?.cast ?? body.cast ?? body.data ?? body;

  const castHash = cast.hash ?? cast.castHash ?? cast.id;
  if (!castHash) {
    return new Response(JSON.stringify({ ok: false, error: "missing cast hash" }), {
      status: 400,
      headers: { "content-type": "application/json" },
    });
  }

  const fid = cast.author?.fid ?? cast.fid ?? null;
  const username = cast.author?.username ?? cast.username ?? null;
  const text = cast.text ?? cast.body?.text ?? "";

  const { addrs, txs } = extract(text);
  const ts = (cast.timestamp ? new Date(cast.timestamp) : new Date()).toISOString();

  const rawId = `fc:${castHash}:${eventType}`;
  const docId = `post:fc:${castHash}`;

  console.log("farcaster handler", { requestId, docId, eventType });

  // ---- RAW EVENTS ----
  const raw = {
    id: rawId,
    source: "farcaster",
    type: String(eventType),
    ts,
    fid,
    username: username?.toLowerCase() ?? null,
    text,
    token: addrs[0] ?? null,
    tx_hash: txs[0] ?? null,
    payload: body,
  };

  const { error: rawErr } = await supabase
    .from("raw_events")
    .upsert(raw, { onConflict: "id" });

  if (rawErr) {
    console.error("raw_events upsert failed", { requestId, rawErr });
    return new Response(JSON.stringify({ ok: false, error: "raw_events upsert failed" }), {
      status: 500,
      headers: { "content-type": "application/json" },
    });
  }

  // ---- SEARCH DOCS ----
  const doc = {
    doc_id: docId,
    doc_type: "post",
    title: username ? `@${username} cast` : "Farcaster cast",
    snippet: text.slice(0, 280),
    ts,
    token: addrs[0] ?? null,
    wallet: null,
    fid,
    username: username?.toLowerCase() ?? null,
    tx_hash: txs[0] ?? null,
    url: null,
    keywords: ["farcaster", username, ...addrs.slice(0, 5)].filter(Boolean),
    body: { castHash, fid, username, text, addrs, txs },
  };

  const { error: docErr } = await supabase
    .from("search_docs")
    .upsert(doc, { onConflict: "doc_id" });

  if (docErr) {
    console.error("search_docs upsert failed", { requestId, docErr });
    return new Response(JSON.stringify({ ok: false, error: "search_docs upsert failed" }), {
      status: 500,
      headers: { "content-type": "application/json" },
    });
  }

  return new Response(JSON.stringify({ ok: true, id: rawId, doc_id: docId }), {
      headers: { "content-type": "application/json" },
  });
});