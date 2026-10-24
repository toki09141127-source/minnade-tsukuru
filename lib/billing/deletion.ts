import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { DeletionJob } from "@/lib/accountDeletion";
import { productionEnvironment, stagingEnvironment, v2SchemaRequired } from "@/lib/v2/environment";
import { billingEnabled } from "./server";
import { StripeTestProvider } from "./stripe";
export async function prepareBillingDeletion(
  client: SupabaseClient,
  job: DeletionJob,
) {
  if (!productionEnvironment() && !stagingEnvironment())
    throw Error("BILLING_DELETION_UNAVAILABLE");
  const args = { p_id: job.id, p_lease: job.lease };
  const state = await client.rpc("v24_deletion_context", args);
  // Only a missing RPC on old MVP is compatible. Other failures never mean
  // "no subscription". Expected V2 schema always fails closed.
  if (state.error) {
    if (state.error.code === "PGRST202" && !v2SchemaRequired()) return;
    throw Error("BILLING_DELETION_UNAVAILABLE");
  }
  if (state.data === null) return;
  const data = state.data;
  if (!data || typeof data.account !== "string" ||
      !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(data.account) ||
      typeof data.confirmed !== "boolean" ||
      ![null, "stripe_test", "synthetic"].includes(data.provider) ||
      !(data.customer === null || (typeof data.customer === "string" && /^cus_[a-zA-Z0-9]+$/.test(data.customer))))
    throw Error("BILLING_DELETION_UNAVAILABLE");
  // Production free launch cannot act on test/live mappings, even if confirmed.
  if (productionEnvironment() && (data.customer !== null || data.provider !== null))
    throw Error("BILLING_DELETION_UNAVAILABLE");
  if (data.confirmed) return;
  if (state.data.customer) {
    if (state.data.provider !== "stripe_test" || !billingEnabled())
      throw Error("BILLING_DELETION_UNAVAILABLE");
    await new StripeTestProvider().cancelAll(
      state.data.customer,
      state.data.account,
    );
  }
  const confirm = await client.rpc("v24_deletion_confirm", {
    ...args,
    p_account: state.data.account,
  });
  if (confirm.error) throw Error("BILLING_DELETION_UNAVAILABLE");
}
