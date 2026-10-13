-- Server-only RPCs: preserve the trusted server path, deny direct client calls.
REVOKE EXECUTE ON FUNCTION public.record_download(uuid, uuid, text, text) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.use_discount_code(text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.record_download(uuid, uuid, text, text) TO service_role;
GRANT EXECUTE ON FUNCTION public.use_discount_code(text) TO service_role;
ALTER FUNCTION public.record_download(uuid, uuid, text, text) SECURITY INVOKER;
ALTER FUNCTION public.use_discount_code(text) SECURITY INVOKER;

-- All references in these existing functions are schema-qualified.
ALTER FUNCTION public.record_download(uuid, uuid, text, text) SET search_path = '';
ALTER FUNCTION public.use_discount_code(text) SET search_path = '';
ALTER FUNCTION public.get_purchase_by_email(text, uuid) SET search_path = '';
ALTER FUNCTION public.apply_discount_code(text, numeric) SET search_path = '';
ALTER FUNCTION public.handle_new_user() SET search_path = '';
ALTER FUNCTION public.generate_invoice_number() SET search_path = '';
ALTER FUNCTION public.set_updated_at() SET search_path = '';
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;

-- Storage signing happens first in the server route. This single transaction
-- then consumes the token and quota together; no customer rows are backfilled.
CREATE OR REPLACE FUNCTION public.consume_download_token(p_token text)
RETURNS text LANGUAGE plpgsql SECURITY INVOKER SET search_path = ''
AS $$
DECLARE
  v_token public.download_tokens%ROWTYPE;
  v_purchase public.purchases%ROWTYPE;
BEGIN
  SELECT * INTO v_token FROM public.download_tokens WHERE token = p_token FOR UPDATE;
  IF NOT FOUND OR v_token.used_at IS NOT NULL OR v_token.expires_at IS NULL
     OR v_token.expires_at <= clock_timestamp() THEN
    RETURN 'invalid_token';
  END IF;
  SELECT * INTO v_purchase FROM public.purchases WHERE id = v_token.purchase_id FOR UPDATE;
  IF NOT FOUND OR v_purchase.status IS DISTINCT FROM 'completed' THEN
    RETURN 'invalid_token';
  END IF;
  IF v_purchase.downloads_limit IS NULL OR v_purchase.downloads_used IS NULL
     OR v_purchase.downloads_used >= v_purchase.downloads_limit THEN
    RETURN 'limit_reached';
  END IF;
  UPDATE public.purchases SET downloads_used = downloads_used + 1 WHERE id = v_purchase.id;
  UPDATE public.download_tokens SET used_at = clock_timestamp() WHERE id = v_token.id;
  INSERT INTO public.downloads(purchase_id, user_id, ip_address, user_agent)
  VALUES (v_purchase.id, v_token.user_id, NULL, NULL);
  RETURN 'ok';
END;
$$;
REVOKE EXECUTE ON FUNCTION public.consume_download_token(text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.consume_download_token(text) TO service_role;
