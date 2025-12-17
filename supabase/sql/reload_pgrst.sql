-- Force PostgREST to reload its schema cache
select pg_notify('pgrst', 'reload schema');
