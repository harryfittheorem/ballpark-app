-- Set cancelled_at on the most recent cancelled membership so it appears
-- in the Cancellations page "last 30 days" filter.

UPDATE public.memberships
SET cancelled_at = now() - interval '3 days'
WHERE id = (
  SELECT m.id
  FROM public.memberships m
  JOIN public.families f ON f.id = m.family_id
  WHERE f.tenant_id = '00000000-0000-0000-0000-000000000001'
    AND m.status = 'cancelled'
    AND (m.cancelled_at IS NULL OR m.cancelled_at < now() - interval '30 days')
  ORDER BY m.updated_at DESC
  LIMIT 1
);
