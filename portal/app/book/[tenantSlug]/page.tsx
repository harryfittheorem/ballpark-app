import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import type { Metadata } from "next";
import { BookingClient } from "./BookingClient";

interface TenantInfo {
  id: string;
  name: string;
  slug: string;
  brand_colors: Record<string, string> | null;
  brand_logo_url: string | null;
}

async function fetchTenantInfo(tenantSlug: string): Promise<TenantInfo | null> {
  const supabase = await createClient();
  // get_public_tenant_info is SECURITY DEFINER — accessible to the anon role
  // without a JWT, so this page works for unauthenticated visitors.
  const { data, error } = await supabase.rpc("get_public_tenant_info", {
    p_tenant_slug: tenantSlug,
  });
  if (error || !data || (data as TenantInfo[]).length === 0) return null;
  return (data as TenantInfo[])[0];
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ tenantSlug: string }>;
}): Promise<Metadata> {
  const { tenantSlug } = await params;
  const tenant = await fetchTenantInfo(tenantSlug);
  const name = tenant?.name ?? tenantSlug;
  return {
    title: `Book a Session — ${name}`,
    description: `Browse available sessions and book online at ${name}.`,
  };
}

export default async function PublicBookingPage({
  params,
}: {
  params: Promise<{ tenantSlug: string }>;
}) {
  const { tenantSlug } = await params;
  const tenant = await fetchTenantInfo(tenantSlug);

  if (!tenant) notFound();

  return (
    <BookingClient
      tenantSlug={tenantSlug}
      tenantName={tenant.name}
      brandLogoUrl={tenant.brand_logo_url ?? null}
      brandColors={tenant.brand_colors ?? {}}
    />
  );
}
