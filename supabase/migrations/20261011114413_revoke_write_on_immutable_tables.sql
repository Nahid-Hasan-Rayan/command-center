-- Append-only tables: no role may update or delete rows, regardless of RLS.
revoke update, delete on public.events            from authenticated, anon;
revoke update, delete on public.review_log        from authenticated, anon;
revoke update, delete on public.application_stage from authenticated, anon;
revoke update, delete on public.audit_log         from authenticated, anon;
