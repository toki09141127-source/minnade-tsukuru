import { NextResponse } from "next/server";
import { billingEnabled } from "@/lib/billing/server";
import { StripeTestProvider } from "@/lib/billing/stripe";
import { receiveBilling } from "@/lib/billing/service";
import { BillingError } from "@/lib/billing/domain";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;
export async function POST(req: Request) {
  if (!billingEnabled()) return new NextResponse(null, { status: 503 });
  if (Number(req.headers.get("content-length") ?? 0) > 250000)
    return new NextResponse(null, { status: 413 });
  const raw = await req.text();
  if (raw.length > 250000) return new NextResponse(null, { status: 413 });
  try {
    const provider = new StripeTestProvider(),
      event = provider.verify(raw, req.headers.get("stripe-signature") ?? "");
    if (event) await receiveBilling(provider, event);
    return NextResponse.json(
      { received: true },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (e) {
    // Never return/log provider payload, email, signature, URLs, or request raw data.
    return NextResponse.json(
      { received: false },
      {
        status:
          e instanceof BillingError &&
          ["SIGNATURE_INVALID", "LIVE_MODE_FORBIDDEN"].includes(e.code)
            ? 400
            : 503,
      },
    );
  }
}
