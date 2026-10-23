/* eslint-disable @typescript-eslint/no-require-imports */
const fs = require("node:fs"),
  Stripe = require("stripe"),
  { load } = require("../staging/safety.cjs");
(async () => {
  const ctx = load(),
    env = ctx.env;
  if (
    ctx.ref !== "fwqucffxdmbdczspkcyr" ||
    !/^sk_test_[A-Za-z0-9]+$/.test(env.STRIPE_TEST_SECRET_KEY || "")
  )
    throw Error("TEST_KEY_REQUIRED");
  const stripe = new Stripe(env.STRIPE_TEST_SECRET_KEY, {
    maxNetworkRetries: 0,
    timeout: 20000,
  });
  const { db } = await require("./db.cjs")();
  try {
    const config = (await db.query("SELECT v24_plans() c")).rows[0].c,
      changed = { BILLING_PROVIDER: "stripe_test" };
    for (const plan of ["plus", "pro"]) {
      const product = await stripe.products.create(
        {
          name: "TEST Minnade " + plan,
          metadata: { project: ctx.ref, version: "v24" },
        },
        { idempotencyKey: "v24-product-" + ctx.ref + "-" + plan },
      );
      if (product.livemode) throw Error("LIVE_MODE_FORBIDDEN");
      for (const cycle of ["month", "year"]) {
        const price = await stripe.prices.create(
          {
            product: product.id,
            currency: config.currency,
            unit_amount:
              cycle === "month"
                ? config.plans[plan].monthly
                : config.plans[plan].yearly,
            recurring: { interval: cycle },
            metadata: { project: ctx.ref, plan, cycle },
          },
          {
            idempotencyKey:
              "v24-price-" +
              ctx.ref +
              "-" +
              plan +
              "-" +
              cycle +
              "-" +
              config.version,
          },
        );
        if (price.livemode) throw Error("LIVE_MODE_FORBIDDEN");
        changed[
          "STRIPE_TEST_PRICE_" + plan.toUpperCase() + "_" + cycle.toUpperCase()
        ] = price.id;
      }
    }
    const portal = await stripe.billingPortal.configurations.create(
      {
        features: {
          customer_update: { enabled: false },
          invoice_history: { enabled: true },
          payment_method_update: { enabled: true },
          subscription_cancel: { enabled: false },
          subscription_update: { enabled: false },
        },
        metadata: { project: ctx.ref, version: "v24" },
      },
      { idempotencyKey: "v24-portal-" + ctx.ref },
    );
    if (portal.livemode) throw Error("LIVE_MODE_FORBIDDEN");
    changed.STRIPE_TEST_PORTAL_CONFIG = portal.id;
    let content = fs.readFileSync(".env.staging.local", "utf8");
    for (const [k, v] of Object.entries(changed)) {
      content = content.replace(new RegExp("^" + k + "=.*\\r?\\n?", "gm"), "");
      content += "\n" + k + "=" + v + "\n";
    }
    fs.writeFileSync(".env.staging.local", content);
    fs.writeFileSync(
      "docs/v2-4-stripe-setup.json",
      JSON.stringify(
        {
          complete: true,
          provider: "stripe_test",
          products: 2,
          prices: 4,
          portalLimitedToPaymentMethodsAndInvoices: true,
          liveMode: false,
          productionChanges: "NONE",
        },
        null,
        2,
      ) + "\n",
    );
    console.log(
      JSON.stringify({
        complete: true,
        provider: "stripe_test",
        products: 2,
        prices: 4,
        liveMode: false,
      }),
    );
  } finally {
    await db.end();
  }
})().catch((e) => {
  console.error(
    JSON.stringify({
      complete: false,
      code: [
        "StripeAuthenticationError",
        "StripePermissionError",
        "StripeRateLimitError",
      ].includes(e.type)
        ? e.type
        : e.code === "LIVE_MODE_FORBIDDEN"
          ? e.code
          : "STRIPE_TEST_SETUP_FAILED",
      httpStatus: e.statusCode ?? null,
    }),
  );
  process.exitCode = 1;
});
