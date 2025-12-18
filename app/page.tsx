"use client";

import Link from "next/link";

export default function Home() {
  const features = [
    {
      title: "Search casts",
      desc: "Find Farcaster posts by username, text, tokens, and addresses.",
    },
    {
      title: "Live feed",
      desc: "Browse the latest Farcaster posts as they land in the index.",
    },
    {
      title: "Keyset pagination",
      desc: "Fast, cursor-based pagination for smooth infinite scrolling.",
    },
  ];

  return (
    <main className="min-h-screen bg-slate-950 text-slate-100">
      <div className="mx-auto max-w-5xl px-6 py-16">
        <header className="flex flex-col gap-6 text-center">
          <span className="inline-flex items-center justify-center self-center rounded-full border border-slate-800 bg-slate-900/70 px-4 py-1 text-xs font-semibold text-slate-300 uppercase tracking-[0.2em]">
            Base Search
          </span>
          <h1 className="text-4xl font-bold leading-tight sm:text-5xl">
            Find Farcaster signals on Base, fast.
          </h1>
          <p className="text-lg text-slate-300 sm:text-xl">
            Search casts, addresses, and tokens — or jump straight into the live feed.
          </p>
          <div className="flex flex-col items-center justify-center gap-3 sm:flex-row sm:gap-4">
            <Link
              href="/search"
              className="rounded-xl bg-blue-500 px-5 py-3 text-sm font-semibold text-white shadow-lg shadow-blue-500/20 transition hover:bg-blue-400"
            >
              Open Search
            </Link>
            <Link
              href="/search"
              className="rounded-xl border border-slate-800 bg-slate-900 px-5 py-3 text-sm font-semibold text-slate-100 transition hover:border-slate-700 hover:bg-slate-900/80"
            >
              View Latest Feed
            </Link>
          </div>
        </header>

        <section className="mt-16 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {features.map((f) => (
            <div
              key={f.title}
              className="rounded-2xl border border-slate-900 bg-slate-950/60 p-5 shadow-inner shadow-slate-900/40"
            >
              <h3 className="text-lg font-semibold text-slate-50">{f.title}</h3>
              <p className="mt-2 text-sm text-slate-300">{f.desc}</p>
            </div>
          ))}
        </section>

        <section className="mt-16 rounded-2xl border border-slate-900 bg-gradient-to-br from-slate-900 via-slate-950 to-black px-6 py-10">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="space-y-2">
              <div className="text-xs uppercase tracking-[0.3em] text-slate-400">Get started</div>
              <div className="text-2xl font-semibold text-slate-50">Jump into the search experience</div>
              <div className="text-sm text-slate-300">
                No auth needed. Use the public anon key in your environment and explore the index.
              </div>
            </div>
            <Link
              href="/search"
              className="inline-flex items-center justify-center rounded-xl bg-blue-500 px-5 py-3 text-sm font-semibold text-white shadow-lg shadow-blue-500/20 transition hover:bg-blue-400"
            >
              Go to /search
            </Link>
          </div>
        </section>
      </div>
    </main>
  );
}
