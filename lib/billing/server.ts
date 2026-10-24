import "server-only";
import { createClient } from "@supabase/supabase-js";
import { v2Enabled } from "@/lib/v2/server";
import { stagingEnvironment } from "@/lib/v2/environment";
import { BillingError } from "./domain";
export function billingBoundary() {
  return v2Enabled() && stagingEnvironment();
}
export function billingEnabled() {
  return (
    billingBoundary() &&
    process.env.BILLING_ENABLED === "true" &&
    process.env.BILLING_PROVIDER === "stripe_test" &&
    /^sk_test_[A-Za-z0-9]+$/.test(process.env.STRIPE_TEST_SECRET_KEY ?? "")
  );
}
export function billingAdmin() {
  if (!billingBoundary()) throw new BillingError("BILLING_DISABLED");
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false } },
  );
}
export function billingOrigin() {
  const value =
    process.env.BILLING_SITE_URL ||
    (process.env.VERCEL_URL ? "https://" + process.env.VERCEL_URL : "");
  let u: URL;
  try {
    u = new URL(value);
  } catch {
    throw new BillingError("BILLING_DISABLED");
  }
  if (
    u.origin !== value ||
    (!(
      u.protocol === "https:" &&
      /^minnade-tsukuru-staging-[a-z0-9-]+-sonetokiyas-projects\.vercel\.app$/.test(
        u.hostname,
      )
    ) &&
      !(
        u.protocol === "http:" &&
        u.hostname === "127.0.0.1" &&
        !process.env.VERCEL
      ))
  )
    throw new BillingError("BILLING_DISABLED");
  return u.origin;
}
export async function rpc<T>(
  name: string,
  args: Record<string, unknown> = {},
): Promise<T> {
  const r = await billingAdmin().rpc(name, args);
  if (r.error)
    throw new BillingError(
      [
        "BILLING_BUSY",
        "CUSTOMER_UNMAPPED",
        "BILLING_FORBIDDEN",
        "EVENT_CONFLICT",
        "LEASE_CONFLICT",
      ].includes(r.error.message)
        ? r.error.message
        : "BILLING_DB_UNAVAILABLE",
    );
  return r.data as T;
}
