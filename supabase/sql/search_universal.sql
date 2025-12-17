-- Recreate search_universal with the expected signature and grants
create or replace function public.search_universal(
  q text,
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
  url text,
  score double precision
) language sql stable as $$
  with ranked as (
    select
      d.doc_id,
      d.ts,
      d.title,
      d.snippet,
      d.username,
      d.token,
      d.url,
      case
        when coalesce(trim(q), '') = '' then null
        else ts_rank_cd(
          to_tsvector('english', coalesce(d.title,'') || ' ' || coalesce(d.snippet,'') || ' ' || coalesce(d.body::text,'')),
          websearch_to_tsquery('english', q)
        )
      end as score
    from search_docs d
    where coalesce(trim(q), '') = ''
       or to_tsvector('english', coalesce(d.title,'') || ' ' || coalesce(d.snippet,'') || ' ' || coalesce(d.body::text,'')) @@ websearch_to_tsquery('english', q)
  )
  select doc_id, ts, title, snippet, username, token, url, score
  from ranked
  where
    cursor_ts is null
    or (score is not null and (score, ts, doc_id) < (score, cursor_ts, cursor_id))
    or (score is null and cursor_ts is not null and (ts, doc_id) < (cursor_ts, cursor_id))
  order by score desc nulls last, ts desc, doc_id desc
  limit search_universal.limit_n;
$$;

grant execute on function public.search_universal(text, timestamptz, text, int) to anon, authenticated;
