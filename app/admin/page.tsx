import { notFound } from "next/navigation";
import { adminEnabled } from "@/lib/admin/server";
import Console from "./Console";
export const dynamic = "force-dynamic";
export default function Page() {
  if (!adminEnabled()) notFound();
  return <Console section="overview" />;
}
