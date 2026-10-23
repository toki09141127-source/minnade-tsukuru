import Billing from "@/app/components/v2/Billing";
import { billingBoundary } from "@/lib/billing/server";
export const dynamic = "force-dynamic";
export default async function Page({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const query = await searchParams;
  return billingBoundary() ? (
    <Billing
      initialPlan={query.plan === "pro" ? "pro" : "plus"}
      initialCycle={query.cycle === "year" ? "year" : "month"}
      returned={!!query.checkout}
    />
  ) : (
    <section>
      <h1>プランとAI利用枠</h1>
      <p>現在準備中です。</p>
    </section>
  );
}
