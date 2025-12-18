"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "@/lib/supabaseClient";

type Tab = "latest" | "search";

type Result = {
  doc_id: string;
  ts: string;
  title: string | null;
  snippet: string | null;
  username: string | null;
  token: string | null;
  url: string | null;
  score?: number | null;
  pfp_url?: string | null;
};

const PAGE_SIZE = 20;

export default function SearchPage() {
  const [tab, setTab] = useState<Tab>("latest");
  const [query, setQuery] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");
  const [items, setItems] = useState<Result[]>([]);
  const [cursor, setCursor] = useState<{ ts: string | null; id: string | null }>({
    ts: null,
    id: null,
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(true);

  const loadingRef = useRef(false);
  const doneRef = useRef(false);
  const sentinelRef = useRef<HTMLDivElement | null>(null);

  const isSearching = tab === "search" && debouncedQuery.length > 0;

  useEffect(() => {
    const t = setTimeout(() => setDebouncedQuery(query.trim()), 300);
    return () => clearTimeout(t);
  }, [query]);

  useEffect(() => {
    setItems([]);
    setCursor({ ts: null, id: null });
    setHasMore(true);
    doneRef.current = false;
    loadingRef.current = false;
    setError(null);
    loadPage(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab, isSearching ? debouncedQuery : ""]);

  useEffect(() => {
    const el = sentinelRef.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting) loadPage(false);
      },
      { rootMargin: "240px" }
    );
    observer.observe(el);
    return () => observer.disconnect();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isSearching, debouncedQuery, tab]);

  const loadPage = async (initial: boolean) => {
    if (loadingRef.current || doneRef.current) return;
    setLoading(true);
    setError(null);
    loadingRef.current = true;

    const cursor_ts = initial ? null : cursor.ts;
    const cursor_id = initial ? null : cursor.id;

    const { data, error: rpcError } = isSearching
      ? await supabase.rpc("search_universal", {
          q: debouncedQuery,
          cursor_ts,
          cursor_id,
          limit_n: PAGE_SIZE,
        })
      : await supabase.rpc("feed_fc", {
          cursor_ts,
          cursor_id,
          limit_n: PAGE_SIZE,
        });

    if (rpcError) {
      setError(rpcError.message);
      setLoading(false);
      loadingRef.current = false;
      return;
    }

    const rows = (data ?? []) as Result[];
    setItems((prev) => (initial ? rows : [...prev, ...rows]));

    if (rows.length < PAGE_SIZE) {
      setHasMore(false);
      doneRef.current = true;
    }

    if (rows.length > 0) {
      const last = rows[rows.length - 1];
      setCursor({ ts: last.ts, id: last.doc_id });
    }

    setLoading(false);
    loadingRef.current = false;
  };

  const state = useMemo(() => {
    if (error) return "error";
    if (loading && items.length === 0) return "loading";
    if (!loading && items.length === 0) return "empty";
    return "ready";
  }, [error, loading, items.length]);

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">
      <div className="mx-auto max-w-5xl px-4 pb-12">
        <div className="sticky top-0 z-20 -mx-4 px-4 pt-6 pb-4 bg-slate-950/80 backdrop-blur border-b border-slate-900">
          <header className="flex flex-col gap-4">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <h1 className="text-xl sm:text-2xl font-semibold tracking-tight">
                  Base Search
                </h1>
                <p className="mt-1 text-sm text-slate-400">
                  Search casts, addresses, tokens — or just browse the latest.
                </p>
              </div>

              <div className="hidden sm:flex items-center gap-2 text-xs text-slate-400">
                {tab === "latest" ? <Pill>Feed</Pill> : <Pill>Search</Pill>}
                <Pill>{items.length} results</Pill>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-[1fr_auto] gap-3">
              <SearchBar value={query} onChange={setQuery} />
              <SegmentedTabs tab={tab} setTab={setTab} />
            </div>

            {tab === "search" && !debouncedQuery && (
              <div className="rounded-xl border border-slate-900 bg-slate-950/40 px-4 py-3 text-sm text-slate-300">
                Type to search. Results update as you stop typing.
              </div>
            )}
          </header>
        </div>

        <main className="mt-6">
          {state === "loading" && <SkeletonList />}
          {state === "error" && (
            <Notice tone="error" title="Query failed">
              {error}
            </Notice>
          )}
          {state === "empty" && (
            <EmptyState
              title={tab === "latest" ? "Nothing in the feed yet" : "No matches"}
              subtitle={
                tab === "latest"
                  ? "Once your pipeline starts ingesting, items will show up here."
                  : debouncedQuery
                  ? "Try a different keyword, username, token symbol, or address."
                  : "Start typing to search."
              }
            />
          )}

          {items.length > 0 && (
            <div className="space-y-3">
              {items.map((r) => (
                <ResultCard
                  key={r.doc_id}
                  result={r}
                  showScore={isSearching}
                  highlight={isSearching ? debouncedQuery : ""}
                />
              ))}
            </div>
          )}

          <div ref={sentinelRef} className="h-10 w-full" />

          {loading && items.length > 0 && (
            <div className="mt-6 flex items-center justify-center text-xs text-slate-400">
              <Spinner />
              <span className="ml-2">Loading more…</span>
            </div>
          )}

          {!hasMore && items.length > 0 && (
            <div className="mt-6 text-center text-xs text-slate-500">
              You’ve reached the end.
            </div>
          )}
        </main>
      </div>
    </div>
  );
}

function SearchBar({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return (
    <div className="relative">
      <div className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-500">
        <SearchIcon />
      </div>
      <input
        className="w-full rounded-2xl border border-slate-900 bg-slate-950/60 px-10 py-3 text-sm text-slate-100 placeholder:text-slate-500 outline-none focus:border-slate-700 focus:ring-4 focus:ring-slate-900/40"
        placeholder="Search casts, addresses, tokens…"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        spellCheck={false}
      />
      {value.length > 0 && (
        <button
          className="absolute right-2 top-1/2 -translate-y-1/2 rounded-xl px-3 py-1 text-xs text-slate-300 hover:bg-slate-900/60"
          onClick={() => onChange("")}
          type="button"
        >
          Clear
        </button>
      )}
    </div>
  );
}

function SegmentedTabs({ tab, setTab }: { tab: Tab; setTab: (t: Tab) => void }) {
  return (
    <div className="inline-flex w-full sm:w-auto items-center rounded-2xl border border-slate-900 bg-slate-950/60 p-1">
      <TabPill active={tab === "latest"} onClick={() => setTab("latest")}>
        Latest
      </TabPill>
      <TabPill active={tab === "search"} onClick={() => setTab("search")}>
        Search
      </TabPill>
    </div>
  );
}

function TabPill({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={[
        "px-4 py-2 text-sm rounded-2xl transition",
        active
          ? "bg-slate-100 text-slate-950 shadow-sm"
          : "text-slate-300 hover:bg-slate-900/60",
      ].join(" ")}
    >
      {children}
    </button>
  );
}

function ResultCard({
  result,
  showScore,
  highlight,
}: {
  result: Result;
  showScore: boolean;
  highlight: string;
}) {
  const rawSnippet = (result.snippet ?? "").trim();
  const snippet = truncateSnippet(rawSnippet);
  const rel = relativeTime(result.ts);
  const hasUrl = Boolean(result.url);

  const displayTitle =
    result.title?.trim() ||
    (result.token ? `$${result.token}` : null) ||
    (result.username ? `@${result.username}` : "Result");

  const avatarLabel = result.username?.trim() || result.token?.trim() || "??";

  return (
    <div className="group rounded-2xl border border-slate-900 bg-slate-950/40 hover:bg-slate-950/60 transition">
      <div className="px-4 py-4">
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0 flex-1">
            <div className="flex items-start gap-3">
              <AvatarOrImage
                label={avatarLabel}
                seed={result.username || result.token || result.doc_id}
                src={result.pfp_url}
              />

              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <div className="text-sm font-semibold text-slate-100 truncate">
                    {displayTitle}
                  </div>

                  {result.username && (
                    <a
                      href={`https://warpcast.com/${result.username}`}
                      target="_blank"
                      rel="noreferrer"
                      className="rounded-full border border-slate-900 bg-slate-950/70 px-2 py-0.5 text-xs text-slate-300 hover:bg-slate-900/60 hover:text-slate-100"
                      title="Open profile"
                    >
                      @{result.username}
                    </a>
                  )}

                  {result.token && (
                    <span className="rounded-full border border-slate-900 bg-slate-950/70 px-2 py-0.5 text-xs text-slate-300">
                      ${result.token}
                    </span>
                  )}
                </div>

                <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-slate-400">
                  <span>{rel}</span>
                  <span className="text-slate-700">•</span>
                  <span className="font-mono text-[11px] text-slate-500">
                    {shortId(result.doc_id)}
                  </span>
                  {showScore && result.score != null && (
                    <>
                      <span className="text-slate-700">•</span>
                      <span className="text-[11px] text-slate-300">
                        score {result.score.toFixed(3)}
                      </span>
                    </>
                  )}
                </div>
              </div>
            </div>

            {snippet && (
              <div className="mt-3 text-sm leading-relaxed text-slate-200 whitespace-pre-line">
                <HighlightedText text={snippet} query={highlight} />
              </div>
            )}
          </div>

          {hasUrl && (
            <a
              className="shrink-0 inline-flex items-center gap-2 rounded-xl border border-slate-800 bg-slate-950/40 px-3 py-2 text-xs font-medium text-slate-200 hover:bg-slate-900/50"
              href={result.url as string}
              target="_blank"
              rel="noreferrer"
            >
              Open
              <ArrowUpRightIcon />
            </a>
          )}
        </div>
      </div>
    </div>
  );
}

function Avatar({ label, seed }: { label: string; seed: string }) {
function AvatarOrImage({
  label,
  seed,
  src,
}: {
  label: string;
  seed: string;
  src?: string | null;
}) {
  const [errored, setErrored] = useState(false);

  const initials = useMemo(() => {
    const s = (label || "").replace(/^[@$]/, "").trim();
    if (!s) return "??";
    const parts = s.split(/[\s._-]+/).filter(Boolean);
    const a = parts[0]?.[0] ?? s[0];
    const b = parts.length > 1 ? parts[1]?.[0] : s[1];
    const out = `${a ?? ""}${b ?? ""}`.toUpperCase();
    return out.slice(0, 2) || "??";
  }, [label]);

  const className = useMemo(() => {
    const classes = [
      "bg-slate-900 text-slate-200 border-slate-800",
      "bg-indigo-950/40 text-indigo-100 border-indigo-900/60",
      "bg-cyan-950/40 text-cyan-100 border-cyan-900/60",
      "bg-emerald-950/40 text-emerald-100 border-emerald-900/60",
      "bg-amber-950/40 text-amber-100 border-amber-900/60",
      "bg-fuchsia-950/40 text-fuchsia-100 border-fuchsia-900/60",
    ];
    let h = 0;
    for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) >>> 0;
    return classes[h % classes.length];
  }, [seed]);

  if (src && !errored) {
    return (
      <img
        src={src}
        alt={label}
        referrerPolicy="no-referrer"
        className="mt-0.5 h-10 w-10 rounded-2xl border border-slate-800 object-cover bg-slate-900"
        onError={() => setErrored(true)}
      />
    );
  }

  return (
    <div
      className={[
        "mt-0.5 flex h-10 w-10 items-center justify-center rounded-2xl border text-xs font-semibold",
        className,
      ].join(" ")}
      aria-hidden="true"
      title={label}
    >
      {initials}
    </div>
  );
}

function HighlightedText({ text, query }: { text: string; query: string }) {
  const parts = useMemo(() => {
    const q = query.trim();
    if (!q) return [{ t: text, m: false }];

    const tokens = q
      .split(/\s+/)
      .map((t) => t.trim())
      .filter((t) => t.length >= 2)
      .slice(0, 6);

    if (tokens.length === 0) return [{ t: text, m: false }];

    const esc = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const re = new RegExp(`(${tokens.map(esc).join("|")})`, "ig");

    const out: Array<{ t: string; m: boolean }> = [];
    let last = 0;

    text.replace(re, (match, _g1, offset) => {
      const i = offset as number;
      if (i > last) out.push({ t: text.slice(last, i), m: false });
      out.push({ t: match, m: true });
      last = i + match.length;
      return match;
    });

    if (last < text.length) out.push({ t: text.slice(last), m: false });
    if (out.length === 0) return [{ t: text, m: false }];
    return out;
  }, [text, query]);

  return (
    <>
      {parts.map((p, i) =>
        p.m ? (
          <mark
            key={i}
            className="rounded px-1 py-0.5 bg-amber-400/20 text-amber-100 border border-amber-400/20"
          >
            {p.t}
          </mark>
        ) : (
          <span key={i}>{p.t}</span>
        )
      )}
    </>
  );
}

function EmptyState({ title, subtitle }: { title: string; subtitle: string }) {
  return (
    <div className="rounded-2xl border border-slate-900 bg-slate-950/40 px-6 py-10 text-center">
      <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl border border-slate-900 bg-slate-950/60">
        <SparkIcon />
      </div>
      <div className="mt-4 text-base font-semibold text-slate-100">{title}</div>
      <div className="mt-1 text-sm text-slate-400">{subtitle}</div>
    </div>
  );
}

function Notice({
  tone,
  title,
  children,
}: {
  tone: "error" | "info";
  title: string;
  children: React.ReactNode;
}) {
  const toneClasses =
    tone === "error"
      ? "border-red-900/50 bg-red-950/30 text-red-100"
      : "border-slate-900 bg-slate-950/40 text-slate-100";

  return (
    <div className={`rounded-2xl border px-4 py-4 ${toneClasses}`}>
      <div className="text-sm font-semibold">{title}</div>
      <div className="mt-1 text-sm opacity-90">{children}</div>
    </div>
  );
}

function SkeletonList() {
  return (
    <div className="space-y-3">
      {Array.from({ length: 6 }).map((_, i) => (
        <div
          key={i}
          className="rounded-2xl border border-slate-900 bg-slate-950/40 px-4 py-4"
        >
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-2xl bg-slate-900/70" />
                <div className="flex-1">
                  <div className="h-4 w-56 rounded bg-slate-900/70" />
                  <div className="mt-2 h-3 w-40 rounded bg-slate-900/60" />
                </div>
              </div>
              <div className="mt-4 h-3 w-full rounded bg-slate-900/50" />
              <div className="mt-2 h-3 w-5/6 rounded bg-slate-900/50" />
            </div>
            <div className="h-9 w-20 rounded-xl bg-slate-900/60" />
          </div>
        </div>
      ))}
    </div>
  );
}

function Pill({ children }: { children: React.ReactNode }) {
  return (
    <span className="rounded-full border border-slate-900 bg-slate-950/60 px-2.5 py-1">
      {children}
    </span>
  );
}

function Spinner() {
  return (
    <span className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-slate-700 border-t-slate-200" />
  );
}

function truncateSnippet(text: string, max = 280) {
  const t = text.trim();
  if (t.length <= max) return t;
  return t.slice(0, max - 1) + "…";
}

function shortId(id: string, left = 6, right = 4) {
  if (!id) return "";
  if (id.length <= left + right + 1) return id;
  return `${id.slice(0, left)}…${id.slice(-right)}`;
}

function relativeTime(ts: string) {
  const date = new Date(ts);
  const diff = date.getTime() - Date.now();
  const seconds = Math.round(diff / 1000);
  const minutes = Math.round(seconds / 60);
  const hours = Math.round(minutes / 60);
  const days = Math.round(hours / 24);
  const rtf = new Intl.RelativeTimeFormat("en", { numeric: "auto" });

  if (Math.abs(days) >= 1) return rtf.format(days, "day");
  if (Math.abs(hours) >= 1) return rtf.format(hours, "hour");
  if (Math.abs(minutes) >= 1) return rtf.format(minutes, "minute");
  return rtf.format(seconds, "second");
}

function SearchIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M10.5 18a7.5 7.5 0 1 1 0-15 7.5 7.5 0 0 1 0 15Z"
        stroke="currentColor"
        strokeWidth="2"
      />
      <path
        d="M16.2 16.2 21 21"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
      />
    </svg>
  );
}

function ArrowUpRightIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M7 17L17 7"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
      />
      <path
        d="M10 7h7v7"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
      />
    </svg>
  );
}

function SparkIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M12 2l1.2 5.1L18 9l-4.8 1.9L12 16l-1.2-5.1L6 9l4.8-1.9L12 2Z"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinejoin="round"
      />
      <path
        d="M5 14l.7 3L9 18l-3.3 1-0.7 3-0.7-3L1 18l3.3-1L5 14Z"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinejoin="round"
      />
    </svg>
  );
}
