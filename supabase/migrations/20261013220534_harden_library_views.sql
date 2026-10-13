-- Read library views as the caller, so purchases' ownership RLS applies.
-- Keep past buyers able to see their product even if it is later disabled.
CREATE POLICY products_purchased_read ON public.products FOR SELECT TO authenticated
USING (EXISTS (
  SELECT 1 FROM public.purchases p
  WHERE p.product_id = products.id AND p.user_id = (SELECT auth.uid()) AND p.status = 'completed'
));
ALTER VIEW public.user_library SET (security_invoker = true);
ALTER VIEW public.user_purchases SET (security_invoker = true);
REVOKE ALL ON public.user_library, public.user_purchases FROM anon;
REVOKE INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER ON public.user_library, public.user_purchases FROM authenticated;
GRANT SELECT ON public.user_library, public.user_purchases TO authenticated;
-- Only the trusted server queries a guest purchase or calculates discounts.
REVOKE EXECUTE ON FUNCTION public.get_purchase_by_email(text, uuid) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.apply_discount_code(text, numeric) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_purchase_by_email(text, uuid), public.apply_discount_code(text, numeric) TO service_role;
ALTER FUNCTION public.get_purchase_by_email(text, uuid) SECURITY INVOKER;
ALTER FUNCTION public.apply_discount_code(text, numeric) SECURITY INVOKER;
