import "server-only";
import Stripe from "stripe";
import { createHash } from "node:crypto";
import {
  BillingError,
  type PaymentProvider,
  type BillingEvent,
  type Plan,
  type Cycle,
  type Snapshot,
  type BillingConfig,
} from "./domain";
import { billingEnabled, billingOrigin, rpc } from "./server";
const ref = (value: string | { id: string } | null | undefined) =>
  typeof value === "string" ? value : (value?.id ?? null);
const iso = (n: number | undefined | null) =>
  n ? new Date(n * 1000).toISOString() : null;
const rank = { free: 0, plus: 1, pro: 2 };
export class StripeTestProvider implements PaymentProvider {
  readonly name = "stripe_test" as const;
  private stripe: Stripe;
  constructor(
    private env: NodeJS.ProcessEnv = process.env,
    client?: Stripe,
  ) {
    if (
      !billingEnabled() ||
      !/^sk_test_[A-Za-z0-9]+$/.test(env.STRIPE_TEST_SECRET_KEY ?? "")
    )
      throw new BillingError("BILLING_DISABLED");
    this.stripe =
      client ??
      new Stripe(env.STRIPE_TEST_SECRET_KEY!, {
        maxNetworkRetries: 1,
        timeout: 20000,
      });
  }
  private test<T extends { livemode: boolean }>(obj: T): T {
    if (obj.livemode) throw new BillingError("LIVE_MODE_FORBIDDEN");
    return obj;
  }
  private price(plan: Exclude<Plan, "free">, cycle: Cycle) {
    const id =
      this.env[
        "STRIPE_TEST_PRICE_" + plan.toUpperCase() + "_" + cycle.toUpperCase()
      ];
    if (!id || !/^price_[a-zA-Z0-9]+$/.test(id))
      throw new BillingError("PRICE_UNAVAILABLE");
    return id;
  }
  private selection(id: string): { plan: Exclude<Plan, "free">; cycle: Cycle } {
    for (const plan of ["plus", "pro"] as const)
      for (const cycle of ["month", "year"] as const)
        if (this.price(plan, cycle) === id) return { plan, cycle };
    throw new BillingError("PRICE_UNMAPPED");
  }
  verify(raw: string, signature: string): BillingEvent | null {
    if (!this.env.STRIPE_TEST_WEBHOOK_SECRET?.startsWith("whsec_"))
      throw new BillingError("WEBHOOK_UNAVAILABLE");
    let e: Stripe.Event;
    try {
      e = this.stripe.webhooks.constructEvent(
        raw,
        signature,
        this.env.STRIPE_TEST_WEBHOOK_SECRET,
        300,
      );
    } catch {
      throw new BillingError("SIGNATURE_INVALID");
    }
    this.test(e);
    if (
      ![
        "checkout.session.completed",
        "checkout.session.expired",
        "customer.subscription.created",
        "customer.subscription.updated",
        "customer.subscription.deleted",
        "invoice.paid",
        "invoice.payment_failed",
      ].includes(e.type)
    )
      return null;
    const obj = e.data.object as { customer?: string | { id: string } | null };
    const customer = ref(obj.customer);
    if (!customer) throw new BillingError("CUSTOMER_UNMAPPED");
    return {
      id: e.id,
      type: e.type,
      created: e.created,
      customer,
      hash: createHash("sha256").update(raw).digest("hex"),
    };
  }
  async customer(account: string) {
    const c = this.test(
      await this.stripe.customers.create(
        { metadata: { minnade_account: account } },
        { idempotencyKey: "v24-customer-" + account },
      ),
    );
    return c.id;
  }
  private async owned(customer: string, account?: string) {
    const c = await this.stripe.customers.retrieve(customer);
    if (c.deleted) throw new BillingError("CUSTOMER_UNAVAILABLE");
    this.test(c);
    if (
      !c.metadata.minnade_account ||
      (account && c.metadata.minnade_account !== account)
    )
      throw new BillingError("CUSTOMER_UNMAPPED");
    return c;
  }
  private async subscription(customer: string, id: string) {
    const s = this.test(
      await this.stripe.subscriptions.retrieve(id, {
        expand: ["latest_invoice", "schedule"],
      }),
    );
    if (ref(s.customer) !== customer || s.items.data.length !== 1)
      throw new BillingError("SUBSCRIPTION_UNMAPPED");
    this.selection(s.items.data[0].price.id);
    return s;
  }
  private async verifiedPrice(plan: Exclude<Plan, "free">, cycle: Cycle) {
    const id = this.price(plan, cycle),
      price = this.test(await this.stripe.prices.retrieve(id)),
      config = await rpc<BillingConfig>("v24_plans");
    if (
      !price.active ||
      price.currency !== config.currency ||
      price.unit_amount !==
        (cycle === "month"
          ? config.plans[plan].monthly
          : config.plans[plan].yearly) ||
      price.recurring?.interval !== cycle ||
      price.recurring.interval_count !== 1
    )
      throw new BillingError("PRICE_CONFIG_MISMATCH");
    return id;
  }
  async checkout(
    customer: string,
    account: string,
    plan: Exclude<Plan, "free">,
    cycle: Cycle,
    request: string,
  ) {
    await this.owned(customer, account);
    const active = await this.stripe.subscriptions.list({
      customer,
      status: "all",
      limit: 100,
    });
    if (
      active.has_more ||
      active.data.some(
        (s) => s.status !== "canceled" && s.status !== "incomplete_expired",
      )
    )
      throw new BillingError("SUBSCRIPTION_EXISTS");
    const open = await this.stripe.checkout.sessions.list({
      customer,
      status: "open",
      limit: 100,
    });
    // A retry uses exactly the same provider idempotency key; another intent cannot create a second open checkout.
    if (
      open.has_more ||
      open.data.some((s) => s.metadata?.request_id !== request)
    )
      throw new BillingError("CHECKOUT_OPEN");
    await this.verifiedPrice(plan, cycle);
    const origin = billingOrigin();
    const session = this.test(
      await this.stripe.checkout.sessions.create(
        {
          mode: "subscription",
          customer,
          allowed_payment_method_types: ["card"],
          line_items: [{ price: this.price(plan, cycle), quantity: 1 }],
          client_reference_id: account,
          metadata: { minnade_account: account, request_id: request },
          subscription_data: { metadata: { minnade_account: account } },
          success_url: origin + "/billing?checkout=returned",
          cancel_url: origin + "/billing?checkout=canceled",
          expires_at: Math.floor(Date.now() / 1000) + 1800,
        },
        { idempotencyKey: "v24-checkout-" + request },
      ),
    );
    if (!session.url || !session.url.startsWith("https://checkout.stripe.com/"))
      throw new BillingError("CHECKOUT_UNAVAILABLE");
    return { reference: session.id, url: session.url };
  }
  async change(
    customer: string,
    id: string,
    plan: Exclude<Plan, "free">,
    cycle: Cycle,
    request: string,
  ) {
    const s = await this.subscription(customer, id),
      current = this.selection(s.items.data[0].price.id),
      target = await this.verifiedPrice(plan, cycle);
    if (s.status !== "active" || s.pending_update)
      throw new BillingError("PAYMENT_PENDING");
    const existingSchedule = typeof s.schedule === "object" ? s.schedule : null;
    if (
      ref(s.schedule) &&
      existingSchedule?.metadata?.v24_request &&
      existingSchedule.metadata.v24_request !== request
    )
      throw new BillingError("CHANGE_ALREADY_SCHEDULED");
    if (current.plan === plan && current.cycle === cycle) return;
    if (rank[plan] > rank[current.plan] && cycle === current.cycle) {
      this.test(
        await this.stripe.subscriptions.update(
          id,
          {
            items: [{ id: s.items.data[0].id, price: target }],
            payment_behavior: "pending_if_incomplete",
            proration_behavior: "always_invoice",
          },
          { idempotencyKey: "v24-upgrade-" + request },
        ),
      );
    } else {
      const schedule =
        existingSchedule?.metadata?.v24_request === request
          ? existingSchedule
          : this.test(
              await this.stripe.subscriptionSchedules.create(
                { from_subscription: id },
                { idempotencyKey: "v24-schedule-v2-" + request },
              ),
            );
      // Stripe forbids metadata alongside from_subscription. An untagged schedule
      // is recoverable only when this operation's idempotent create returns its exact ID.
      if (existingSchedule && schedule.id !== existingSchedule.id)
        throw new BillingError("CHANGE_ALREADY_SCHEDULED");
      if (!schedule.current_phase)
        throw new BillingError("SCHEDULE_UNAVAILABLE");
      this.test(
        await this.stripe.subscriptionSchedules.update(
          schedule.id,
          {
            metadata: { v24_request: request },
            end_behavior: "release",
            proration_behavior: "none",
            phases: [
              {
                start_date: schedule.current_phase.start_date,
                end_date: schedule.current_phase.end_date,
                items: [{ price: s.items.data[0].price.id, quantity: 1 }],
                proration_behavior: "none",
              },
              {
                items: [{ price: target, quantity: 1 }],
                duration: { interval: cycle, interval_count: 1 },
                proration_behavior: "none",
              },
            ],
          },
          { idempotencyKey: "v24-phase-" + request },
        ),
      );
    }
  }
  async cancel(customer: string, id: string, cancel: boolean, request: string) {
    const s = await this.subscription(customer, id);
    if (s.status === "canceled") return;
    if (ref(s.schedule))
      await this.stripe.subscriptionSchedules.release(
        ref(s.schedule)!,
        {},
        { idempotencyKey: "v24-release-" + request },
      );
    this.test(
      await this.stripe.subscriptions.update(
        id,
        { cancel_at_period_end: cancel },
        { idempotencyKey: "v24-cancel-" + request },
      ),
    );
  }
  async portal(customer: string, request: string) {
    await this.owned(customer);
    const config = this.env.STRIPE_TEST_PORTAL_CONFIG;
    if (!config?.startsWith("bpc_"))
      throw new BillingError("PORTAL_UNAVAILABLE");
    const c = this.test(
      await this.stripe.billingPortal.configurations.retrieve(config),
    );
    // The app controls scheduled plan changes; portal is limited to payment methods/invoices.
    if (
      c.features.subscription_update.enabled ||
      c.features.subscription_cancel.enabled
    )
      throw new BillingError("PORTAL_UNSAFE");
    const s = this.test(
      await this.stripe.billingPortal.sessions.create(
        {
          customer,
          configuration: config,
          return_url: billingOrigin() + "/billing",
        },
        { idempotencyKey: "v24-portal-" + request },
      ),
    );
    if (!s.url.startsWith("https://billing.stripe.com/"))
      throw new BillingError("PORTAL_UNAVAILABLE");
    return { reference: s.id, url: s.url };
  }
  async current(customer: string, account: string): Promise<Snapshot> {
    await this.owned(customer, account);
    const all = await this.stripe.subscriptions.list({
      customer,
      status: "all",
      limit: 100,
    });
    if (all.has_more) throw new BillingError("RECONCILIATION_REQUIRED");
    for (const s of all.data) this.test(s);
    const candidates = all.data.filter(
      (s) => !["canceled", "incomplete_expired"].includes(s.status),
    );
    if (candidates.length > 1)
      throw new BillingError("RECONCILIATION_REQUIRED");
    const id =
      candidates[0]?.id ??
      all.data.sort((a, b) => b.created - a.created)[0]?.id;
    if (!id)
      return {
        customer,
        subscription: null,
        live: false,
        plan: "free",
        cycle: null,
        status: "free",
        periodStart: null,
        periodEnd: null,
        cancelAtEnd: false,
        nextPlan: null,
        nextCycle: null,
      };
    const s = await this.subscription(customer, id),
      sel = this.selection(s.items.data[0].price.id),
      item = s.items.data[0];
    const invoice =
      typeof s.latest_invoice === "object" ? s.latest_invoice : null;
    // No activation for a positive unpaid latest invoice, even if a transient provider subscription says active.
    let paid = invoice?.status === "paid";
    if (s.pending_update && !paid) {
      const previous = await this.stripe.invoices.list({
        customer,
        subscription: s.id,
        status: "paid",
        limit: 100,
      });
      paid = previous.data.some(
        (i) =>
          !i.livemode &&
          i.lines.data.some(
            (line) =>
              line.period.end >= item.current_period_end &&
              ref(line.pricing?.price_details?.price) === item.price.id,
          ) &&
          i.status === "paid",
      );
    }
    const status: Snapshot["status"] =
      s.status === "active"
        ? paid
          ? "active"
          : "incomplete"
        : s.status === "past_due"
          ? "past_due"
          : s.status === "canceled" || s.status === "incomplete_expired"
            ? "canceled"
            : s.status === "unpaid"
              ? "unpaid"
              : "incomplete";
    let nextPlan: Plan | null = null,
      nextCycle: Cycle | null = null;
    if (s.schedule && typeof s.schedule === "object") {
      const phase = s.schedule.phases.find(
        (p) => p.start_date >= item.current_period_end,
      );
      if (phase) {
        const price = ref(phase.items[0]?.price);
        if (price) {
          const next = this.selection(price);
          nextPlan = next.plan;
          nextCycle = next.cycle;
        }
      }
    }
    return {
      customer,
      subscription: s.id,
      live: false,
      plan: sel.plan,
      cycle: sel.cycle,
      status,
      periodStart: iso(item.current_period_start),
      periodEnd: iso(item.current_period_end),
      failureAt: null, // Grace starts at first observed canonical failure, not invoice creation time.
      cancelAtEnd: s.cancel_at_period_end,
      nextPlan: s.cancel_at_period_end ? "free" : nextPlan,
      nextCycle,
    };
  }
  async cancelAll(customer: string, account: string) {
    await this.owned(customer, account);
    const open = await this.stripe.checkout.sessions.list({
      customer,
      status: "open",
      limit: 100,
    });
    if (open.has_more) throw new BillingError("RECONCILIATION_REQUIRED");
    for (const s of open.data) {
      this.test(s);
      await this.stripe.checkout.sessions.expire(
        s.id,
        {},
        { idempotencyKey: "v24-delete-checkout-" + s.id },
      );
    }
    const all = await this.stripe.subscriptions.list({
      customer,
      status: "all",
      limit: 100,
    });
    if (all.has_more) throw new BillingError("RECONCILIATION_REQUIRED");
    for (const s of all.data) {
      this.test(s);
      if (!["canceled", "incomplete_expired"].includes(s.status))
        this.test(
          await this.stripe.subscriptions.cancel(
            s.id,
            { invoice_now: false, prorate: false },
            { idempotencyKey: "v24-delete-sub-" + s.id },
          ),
        );
    }
    const after = await this.current(customer, account);
    if (!["free", "canceled"].includes(after.status))
      throw new BillingError("DELETION_BILLING_PENDING");
  }
}
