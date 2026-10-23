import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { DeletionJob } from "@/lib/accountDeletion";
import { billingBoundary, billingEnabled } from "./server";
import { StripeTestProvider } from "./stripe";
export async function prepareBillingDeletion(
  client: SupabaseClient,
  job: DeletionJob,
) {
  if (!billingBoundary()) return; // MVP production has no V2 billing tables; production V2 rollout is forbidden.
  const args = { p_id: job.id, p_lease: job.lease };
  const state = await client.rpc("v24_deletion_context", args);
  if (state.error) throw Error("BILLING_DELETION_UNAVAILABLE");
  if (!state.data || state.data.confirmed) return;
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
