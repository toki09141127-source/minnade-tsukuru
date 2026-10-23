import "server-only";
import type { PaymentProvider, OperationContext } from "./domain";
import {
  BillingError,
  validSelection,
  type Cycle,
  type BillingEvent,
} from "./domain";
import { rpc } from "./server";
export async function executeBilling(
  provider: PaymentProvider,
  request: string,
  body: { action: string; plan?: unknown; cycle?: unknown },
) {
  const context = await rpc<OperationContext>("v24_operation_context", {
    p_request: request,
  });
  if (context.operation !== body.action)
    throw new BillingError("REQUEST_CONFLICT");
  if (context.reference?.startsWith("rejected:"))
    throw new BillingError(context.reference.slice(9));
  if (context.complete) return { ok: true, url: context.url };
  let customer = context.customer;
  if (!customer) {
    customer = await provider.customer(context.account);
    await rpc("v24_customer_bind", {
      p_request: request,
      p_provider: provider.name,
      p_customer: customer,
    });
  }
  if (context.provider && context.provider !== provider.name)
    throw new BillingError("PROVIDER_MISMATCH");
  let result: { reference: string | null; url: string | null } = {
    reference: context.subscription,
    url: null,
  };
  if (body.action === "checkout") {
    if (!validSelection(body.plan, body.cycle))
      throw new BillingError("INVALID_INPUT");
    result = await provider.checkout(
      customer,
      context.account,
      body.plan,
      body.cycle as Cycle,
      request,
    );
  } else if (body.action === "portal")
    result = await provider.portal(customer, request);
  else {
    if (!context.subscription) throw new BillingError("SUBSCRIPTION_REQUIRED");
    if (body.action === "change") {
      if (!validSelection(body.plan, body.cycle))
        throw new BillingError("INVALID_INPUT");
      await provider.change(
        customer,
        context.subscription,
        body.plan,
        body.cycle as Cycle,
        request,
      );
    } else if (body.action === "cancel" || body.action === "resume")
      await provider.cancel(
        customer,
        context.subscription,
        body.action === "cancel",
        request,
      );
    else throw new BillingError("INVALID_INPUT");
  }
  await rpc("v24_operation_finish", {
    p_request: request,
    p_ref: result.reference,
    p_url: result.url,
  });
  return { ok: true, url: result.url };
}
export async function receiveBilling(
  provider: PaymentProvider,
  event: BillingEvent,
) {
  const claim = await rpc<{
    duplicate?: boolean;
    account: string;
    lease: string;
    deleting: boolean;
  }>("v24_webhook_claim", {
    p_provider: provider.name,
    p_event: event.id,
    p_customer: event.customer,
    p_type: event.type,
    p_created: new Date(event.created * 1000).toISOString(),
    p_hash: event.hash,
  });
  if (claim.duplicate) {await adminEvent('webhook_duplicate');return;}
  try {
    // Current provider state is fetched AFTER obtaining the account lease; event delivery order never decides access.
    if (claim.deleting) await provider.cancelAll(event.customer, claim.account);
    const snapshot = await provider.current(event.customer, claim.account);
    await rpc("v24_webhook_apply", {
      p_provider: provider.name,
      p_event: event.id,
      p_lease: claim.lease,
      p_snapshot: snapshot,
    });
  } finally {
    await rpc("v24_webhook_release", {
      p_account: claim.account,
      p_lease: claim.lease,
    }).catch(() => {});
  }
}

async function adminEvent(kind:string){if(process.env.ADMIN_ENABLED==='true'){await import('@/lib/admin/server').then(m=>m.adminEvent(kind)).catch(()=>{});}}
