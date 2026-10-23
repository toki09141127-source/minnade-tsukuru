import Pricing from "@/app/components/v2/Pricing";
import { billingBoundary } from "@/lib/billing/server";
export const dynamic = "force-dynamic";
export default function Page() {
  return billingBoundary() ? (
    <Pricing />
  ) : (
    <section>
      <h1>プラン</h1>
      <p>現在準備中です。</p>
    </section>
  );
}
