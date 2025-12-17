-- Latest Farcaster feed with tuple keyset pagination
create or replace function public.feed_fc(
  cursor_ts timestamptz default null,
  cursor_id text default null,
  limit_n int default 20
) returns table (
  doc_id text,
  ts timestamptz,
  title text,
  snippet text,
  username text,
  token text,
  url text
) language sql stable as $$
  select
    d.doc_id,
    d.ts,
    d.title,
    d.snippet,
    d.username,
    d.token,
    d.url
  from public.search_docs d
  where d.doc_id like 'post:fc:%'
    and (
      cursor_ts is null
      or (d.ts, d.doc_id) < (cursor_ts, cursor_id)
    )
  order by d.ts desc, d.doc_id desc
  limit limit_n;
$$;

grant execute on function public.feed_fc(timestamptz, text, int) to anon, authenticated;
