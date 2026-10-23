export type Plan = "free" | "plus" | "pro";
export type Cycle = "month" | "year";
export type BillingStatus =
  | "free"
  | "active"
  | "past_due"
  | "canceled"
  | "incomplete"
  | "unpaid";
export type ModelTier = "cheap" | "standard" | "premium";
export type BillingConfig = {
  version: number;
  currency: string;
  provisional: boolean;
  graceDays: number;
  plans: Record<
    Plan,
    { rank: number; monthly: number; yearly: number; credits: number }
  >;
  classes: Record<
    string,
    { kind: string; cost: number; min: Plan; tier: ModelTier }
  >;
};
export type Snapshot = {
  customer: string;
  subscription: string | null;
  live: false;
  plan: Plan;
  cycle: Cycle | null;
  status: BillingStatus;
  periodStart: string | null;
  periodEnd: string | null;
  failureAt?: string | null;
  cancelAtEnd: boolean;
  nextPlan: Plan | null;
  nextCycle: Cycle | null;
};
export type BillingEvent = {
  id: string;
  type: string;
  created: number;
  customer: string;
  hash: string;
};
export type OperationContext = {
  account: string;
  customer: string | null;
  subscription: string | null;
  provider: string | null;
  plan: Plan;
  cycle: Cycle | null;
  status: BillingStatus;
  periodEnd: string | null;
  operation: string;
  complete: boolean;
  url: string | null;
  reference: string | null;
};
export type Profile = {
  id: string;
  name: string;
  settings: AiPreferences;
  version: number;
};
export type BillingState = {
  pendingOperation?: {
    id: string;
    selection: {
      action: string;
      plan: Plan | null;
      cycle: Cycle | null;
    } | null;
    createdAt: string;
  } | null;
  plan: Plan;
  status: string;
  cycle: Cycle | null;
  renewalAt: string | null;
  graceUntil: string | null;
  cancelAtEnd: boolean;
  nextPlan: Plan | null;
  nextCycle: Cycle | null;
  credits: {
    granted: number;
    consumed: number;
    reserved: number;
    remaining: number;
    periodStart: string;
    periodEnd: string;
  };
  profiles: Profile[];
};
export type AiPreferences = {
  name?: string;
  icon?: string;
  personality?: string;
  style?: string;
  specialties?: string[];
  activity?: string;
  profile?: string;
  sliders?: number[];
  politeness?: string;
  length?: string;
  emoji?: string;
  jargon?: string;
  questions?: string;
  inactivity?: string;
  deadline?: boolean;
  ideas?: string;
  meeting?: string;
  finalEdit?: string;
  instructions?: string;
};
export type RoomBilling = {
  plan: Plan;
  ownerPlan: Plan;
  settings: AiPreferences;
  canEdit: boolean;
  isCreator: boolean;
  remaining: number;
};
export const planNames: Record<Plan, string> = {
  free: "Free",
  plus: "Plus",
  pro: "Pro",
};
export const planCopy: Record<Plan, string> = {
  free: "みんなで作る基本機能は、ずっと無料。",
  plus: "AI Creatorと、もっと深く作る。",
  pro: "自分だけのAI Creatorをつくる。",
};
export const classNames: Record<string, string> = {
  question: "質問する",
  summarize: "まとめを更新",
  idea: "アイデアの候補",
  organize: "整理する",
  draft_assist: "ドラフトの提案",
  minutes: "詳しい議事録",
  long_log: "長いログの整理",
  characters: "キャラクター整理",
  worldbuilding: "世界観整理",
  premium_draft: "充実したドラフト提案",
  final_edit: "最終編集の提案",
};
export const uuid = (v: unknown): v is string =>
  typeof v === "string" &&
  /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i.test(v);
export function validSelection(
  plan: unknown,
  cycle: unknown,
): plan is Exclude<Plan, "free"> {
  return (
    (plan === "plus" || plan === "pro") &&
    (cycle === "month" || cycle === "year")
  );
}
export class BillingError extends Error {
  constructor(public code: string) {
    super(code);
  }
}
export interface PaymentProvider {
  readonly name: "stripe_test" | "synthetic";
  verify(raw: string, signature: string): BillingEvent | null;
  customer(account: string): Promise<string>;
  checkout(
    customer: string,
    account: string,
    plan: Exclude<Plan, "free">,
    cycle: Cycle,
    request: string,
  ): Promise<{ reference: string; url: string }>;
  change(
    customer: string,
    subscription: string,
    plan: Exclude<Plan, "free">,
    cycle: Cycle,
    request: string,
  ): Promise<void>;
  cancel(
    customer: string,
    subscription: string,
    cancel: boolean,
    request: string,
  ): Promise<void>;
  portal(
    customer: string,
    request: string,
  ): Promise<{ reference: string; url: string }>;
  current(customer: string, account: string): Promise<Snapshot>;
  cancelAll(customer: string, account: string): Promise<void>;
}
