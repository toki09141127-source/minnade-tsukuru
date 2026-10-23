import { notFound } from "next/navigation";
import { adminEnabled } from "@/lib/admin/server";
import Console from "../Console";
export const dynamic = "force-dynamic";
export default async function Page({
  params,
}: {
  params: Promise<{ section: string }>;
}) {
  const { section } = await params;
  if (
    !adminEnabled() ||
    ![
      "reports",
      "users",
      "rooms",
      "works",
      "ai",
      "billing",
      "system",
      "audit",
      "staff",
      "posts",
    ].includes(section)
  )
    notFound();
  return <Console section={section} />;
}
