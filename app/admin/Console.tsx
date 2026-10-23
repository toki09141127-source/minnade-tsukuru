"use client";
import {
  useState,
  useEffect,
  useRef,
  useCallback,
  type FormEvent,
} from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { supabase } from "@/lib/supabase/client";
import {
  adminFetch,
  errors,
  type AdminData,
  type AdminAction,
  type Row,
} from "@/lib/admin/client";
import css from "./admin.module.css";
const sections = [
  ["overview", "概要"],
  ["reports", "通報"],
  ["users", "ユーザー"],
  ["rooms", "ルーム"],
  ["works", "作品"],
  ["ai", "AI"],
  ["billing", "課金"],
  ["system", "システム"],
  ["audit", "監査ログ"],
];
const labels: Record<string, string> = {
  id: "ID",
  title: "タイトル",
  username: "公開名義",
  creator: "Creator",
  creator_id: "Creator ID",
  target_type: "対象",
  target_id: "対象ID",
  reporter_user_id: "通報者ID",
  status: "状態",
  category: "分類",
  priority: "優先度",
  created_at: "作成日時",
  published_at: "公開日時",
  hidden: "非表示",
  suspended: "利用停止",
  departing: "退会処理中",
  deleted: "退会済み",
  plan: "プラン",
  rooms: "制作ルーム",
  works: "公開作品",
  reports: "通報数",
  members: "参加者数",
  capacity: "定員",
  expires_at: "締切",
  ai_level: "AI利用",
  likes: "いいね",
  ai_assistance: "AI利用作品",
  role: "運営権限",
  active: "有効",
  version: "更新番号",
  joins: "参加",
  posts: "投稿",
  uploads: "アップロード",
  actor_id: "操作者ID",
  actor_role: "操作権限",
  action: "操作",
  reason: "理由",
  severity: "重要度",
  before_state: "変更前",
  after_state: "変更後",
  request_id: "操作ID",
  state: "状態",
  processingState: "受付処理",
  failureCode: "失敗分類",
  notes: "運営メモ",
  note: "メモ",
  history: "操作履歴",
  deletion: "退会処理",
  snapshot: "公開スナップショット",
  blocks: "作品ブロック",
  content: "本文",
  text: "文章",
  type: "種類",
  highlightCount: "ハイライト数",
  logCount: "制作履歴数",
  aiHistory: "AI処理履歴",
  room_id: "ルームID",
  owner_id: "Creator ID",
  provider: "決済モード",
  cycle: "請求周期",
  period_end: "期間終了",
  grace_until: "猶予期限",
  cancel_at_end: "期間末解約予定",
  next_plan: "次回プラン",
  next_cycle: "次回周期",
  deleting: "退会準備中",
  consumed: "使用クレジット",
  reserved: "予約クレジット",
  status_since: "状態更新",
  trigger_type: "発火条件",
  actor_type: "人間 / システム",
  kind: "種類",
  model_tier: "モデル区分",
  finished_at: "終了時刻",
  attempts: "試行回数",
  error_code: "失敗分類",
  input_tokens: "入力トークン",
  output_tokens: "出力トークン",
  credit_cost: "クレジット",
  credit_state: "残高処理",
  enabled: "有効",
  enabledRooms: "AI設定ルーム",
  forbiddenRooms: "AI禁止ルーム",
  manual: "手動リクエスト",
  system: "自動リクエスト",
  failures: "失敗",
  stuck: "滞留",
  rateLimited: "レート制限",
  knownIssue: "未解決事項",
  activeRooms: "制作中ルーム",
  publishedWorks: "公開作品",
  activeUsers: "有効アカウント",
  newUsers: "期間内の新規登録",
  openReports: "未完了通報",
  suspendedUsers: "利用停止中",
  hiddenWorks: "非表示作品",
  aiFailures: "AI失敗 / 滞留",
  billingPastDue: "支払い遅延",
  billingGrace: "猶予中",
  deletionQueue: "退会待ち",
  startup: "起動設定の許可状態",
  flags: "機能の実効状態",
  room_creation: "ルーム作成",
  forced_publish: "期限公開",
  deletion_intake: "退会受付",
  deletion_worker: "退会ワーカー",
  moderation: "運営変更",
  ai: "AI処理",
  buffer: "Buffer接続",
  cron: "定期処理の観測",
  security: "セキュリティ事象",
  occurrences: "観測件数",
  latest: "最終観測",
  plans: "プラン別件数",
  mode: "モード",
  lastWebhook: "最終Webhook反映",
  pendingWebhooks: "処理待ちWebhook",
  failedWebhooks: "Webhook失敗",
  duplicates: "重複イベント",
  stale: "古いイベント",
  unmapped: "紐付け不足",
  eventCounters: "件数の定義",
  paused: "停止中",
  jobs: "退会ジョブ",
  stage: "段階",
  updated_at: "更新日時",
  lease_until: "ロック期限",
  staff_role: "運営権限",
  publicExcluded: "公開履歴から除外",
  attachmentType: "添付種別",
};
const values: Record<string, string> = {
  requested: "受付済み",
  prepared: "準備完了",
  auth_unknown: "Auth処理の確認待ち",
  auth_deleted: "Auth削除完了",
  completed: "完了",
  needs_review: "手動確認が必要",
  owner: "Owner",
  moderator: "Moderator",
  open: "未対応 / 制作中",
  reviewing: "確認中",
  resolved: "対応済み",
  dismissed: "対応不要",
  forced_publish: "公開済み",
  active: "有効",
  free: "Free",
  plus: "Plus",
  pro: "Pro",
  month: "月額",
  year: "年額",
  past_due: "支払い遅延",
  pending: "待機",
  running: "実行中",
  succeeded: "成功",
  failed: "失敗",
  stuck: "滞留",
  skipped: "見送り",
  privacy: "個人情報",
  copyright: "著作権",
  inappropriate: "不適切",
  harassment: "嫌がらせ",
  spam: "スパム",
  security: "安全対策",
  operational: "運用確認",
  other: "その他",
  hide: "表示制御",
  suspend: "利用停止",
  report: "通報対応",
  feature: "機能制御",
  role: "権限変更",
  room_controls: "ルーム制御",
  warning: "注意",
  notice: "記録",
  human: "人間",
  system: "システム",
  stripe_test: "Stripeテスト",
  synthetic: "合成テスト",
};
function shown(v: unknown): string {
  if (v === null || v === undefined) return "—";
  if (typeof v === "boolean") return v ? "はい" : "いいえ";
  if (typeof v === "object")
    return Array.isArray(v) ? `${v.length}件` : "詳細あり";
  const s = String(v);
  if (/^\d{4}-\d\d-\d\dT/.test(s)) return new Date(s).toLocaleString("ja-JP");
  return values[s] || s;
}
function Details({ data, depth = 0 }: { data: unknown; depth?: number }) {
  if (data === null || data === undefined) return <span>—</span>;
  if (typeof data !== "object")
    return <span className={css.content}>{shown(data)}</span>;
  if (depth > 6) return <span>内容が深いため省略しました</span>;
  if (Array.isArray(data))
    return data.length ? (
      <ol>
        {data.map((v, i) => (
          <li key={i}>
            <Details data={v} depth={depth + 1} />
          </li>
        ))}
      </ol>
    ) : (
      <span>該当なし</span>
    );
  return (
    <dl>
      {Object.entries(data).map(([k, v]) => (
        <div key={k}>
          <dt>{labels[k] || k}</dt>
          <dd>
            <Details data={v} depth={depth + 1} />
          </dd>
        </div>
      ))}
    </dl>
  );
}
const columns: Record<string, string[]> = {
  reports: [
    "status",
    "category",
    "priority",
    "target_type",
    "target_id",
    "created_at",
    "hidden",
  ],
  users: [
    "username",
    "plan",
    "suspended",
    "departing",
    "rooms",
    "works",
    "reports",
  ],
  rooms: [
    "title",
    "creator",
    "status",
    "members",
    "expires_at",
    "reports",
    "hidden",
  ],
  works: [
    "title",
    "creator",
    "published_at",
    "likes",
    "ai_assistance",
    "hidden",
  ],
  posts: ["username", "created_at", "hidden"],
  ai: [
    "title",
    "status",
    "trigger_type",
    "model_tier",
    "error_code",
    "credit_cost",
    "created_at",
  ],
  billing: [
    "username",
    "plan",
    "status",
    "cycle",
    "period_end",
    "grace_until",
    "cancel_at_end",
    "consumed",
    "reserved",
  ],
  audit: [
    "actor_role",
    "actor_id",
    "action",
    "target_type",
    "target_id",
    "reason",
    "created_at",
  ],
  staff: ["username", "role", "active", "version"],
};
type Choice = {
  title: string;
  action: string;
  type: string;
  target: string;
  version: number;
  value: unknown;
};
function Actions({
  r,
  section,
  role,
  choose,
}: {
  r: Row;
  section: string;
  role?: string;
  choose: (c: Choice) => void;
}) {
  const id = String(r.id),
    version = Number(r.version || 0),
    kind =
      section === "users"
        ? "user"
        : section === "works"
          ? "work"
          : section === "posts"
            ? "post"
            : "room";
  const base = { target: id, version, type: kind };
  return (
    <div className={css.actions}>
      {["rooms", "works", "posts"].includes(section) && (
        <button
          onClick={() =>
            choose({
              ...base,
              title: r.hidden ? "再表示" : "非表示",
              action: "hide",
              value: !r.hidden,
            })
          }
        >
          {r.hidden ? "再表示" : "非表示"}
        </button>
      )}
      {section === "users" && !r.departing && !r.deleted && !r.staff_role && (
        <button
          onClick={() =>
            choose({
              ...base,
              title: r.suspended ? "利用停止を解除" : "利用を停止",
              action: "suspend",
              value: !r.suspended,
            })
          }
        >
          {r.suspended ? "利用停止を解除" : "利用を停止"}
        </button>
      )}
      {section === "reports" &&
        ["open", "reviewing"].includes(String(r.status)) &&
        (r.status === "open" ? ["reviewing"] : ["resolved", "dismissed"]).map(
          (s) => (
            <button
              key={s}
              onClick={() =>
                choose({
                  target: id,
                  version,
                  type: "report",
                  title: values[s],
                  action: "report",
                  value: { status: s, category: r.category || "other" },
                })
              }
            >
              {values[s]}
            </button>
          ),
        )}
      {section === "reports" && (
        <Link
          href={
            "/admin/" +
            (r.target_type === "room" ? "rooms" : "posts") +
            "?target=" +
            r.target_id
          }
        >
          対象を確認
        </Link>
      )}
      {section === "rooms" &&
        role === "owner" &&
        ["joins", "posts", "uploads"].map((k) => (
          <button
            key={k}
            onClick={() =>
              choose({
                ...base,
                title: labels[k] + (r[k] ? "を停止" : "を再開"),
                action: "room_controls",
                value: {
                  joins: r.joins,
                  posts: r.posts,
                  uploads: r.uploads,
                  [k]: !r[k],
                },
              })
            }
          >
            {labels[k]}
            {r[k] ? "を停止" : "を再開"}
          </button>
        ))}
      {section === "staff" && r.role === "moderator" && role === "owner" && (
        <button
          onClick={() =>
            choose({
              ...base,
              type: "staff",
              action: "role",
              title: r.active ? "Moderatorを解除" : "Moderatorを再開",
              value: r.active ? "revoked" : "moderator",
            })
          }
        >
          {r.active ? "権限解除" : "権限再開"}
        </button>
      )}
    </div>
  );
}
export default function Console({ section }: { section: string }) {
  const search = useSearchParams(),
    target = search.get("target") || "";
  const [received, setData] = useState<(AdminData & { key: string }) | null>(
      null,
    ),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false),
    [query, setQuery] = useState(""),
    [status, setStatus] = useState(""),
    [sort, setSort] = useState("newest"),
    [days, setDays] = useState("7"),
    [offset, setOffset] = useState(0),
    [filters, setFilters] = useState({
      action: "",
      type: "",
      severity: "",
      actor: "",
    }),
    [revision, setRevision] = useState(0);
  const [choice, setChoice] = useState<Choice | null>(null),
    [pending, setPending] = useState(false),
    [reason, setReason] = useState("operational"),
    [note, setNote] = useState(""),
    [confirmed, setConfirmed] = useState(false),
    [actionError, setActionError] = useState(""),
    [notice, setNotice] = useState(""),
    [staffId, setStaffId] = useState("");
  const dialog = useRef<HTMLDialogElement>(null),
    seq = useRef(0),
    request = useRef(""),
    trigger = useRef<HTMLElement | null>(null);
  const params = useCallback(() => {
    const p = new URLSearchParams({
      section,
      query,
      status,
      sort,
      days,
      offset: String(offset),
      ...filters,
    });
    if (target) p.set("target", target);
    return p;
  }, [section, query, status, sort, days, offset, filters, target]);
  const data = received?.key === params().toString() ? received : null;
  useEffect(() => {
    const controller = new AbortController(),
      n = ++seq.current;
    const timer = setTimeout(() => {
      setBusy(true);
      setError("");
      setData(null);
      adminFetch(params(), controller.signal)
        .then((r) => {
          if (seq.current === n) setData({ ...r, key: params().toString() });
        })
        .catch((e) => {
          if (e.name !== "AbortError" && seq.current === n)
            setError(errors[e.message] || errors.ADMIN_UNAVAILABLE);
        })
        .finally(() => {
          if (seq.current === n) setBusy(false);
        });
    }, 180);
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [params, revision]);
  useEffect(() => {
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event) => {
      if (event === "SIGNED_OUT" || event === "USER_UPDATED") {
        seq.current++;
        setData(null);
        setChoice(null);
        setRevision((n) => n + 1);
      }
    });
    return () => subscription.unsubscribe();
  }, []);
  useEffect(() => {
    if (choice) {
      dialog.current?.showModal();
    } else {
      dialog.current?.close();
      trigger.current?.focus();
    }
  }, [choice]);
  const choose = (c: Choice) => {
    trigger.current = document.activeElement as HTMLElement;
    request.current = crypto.randomUUID();
    setNote("");
    setReason(c.type === "report" ? "other" : "operational");
    setConfirmed(false);
    setActionError("");
    setChoice(c);
  };
  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!choice || pending || !confirmed) return;
    setPending(true);
    setActionError("");
    const body: AdminAction = {
      ...choice,
      request: request.current,
      reason,
      note,
      confirm: true,
    };
    delete (body as unknown as Record<string, unknown>).title;
    try {
      await adminFetch(new URLSearchParams(), undefined, body);
      setChoice(null);
      setNotice("操作を記録しました。");
      setRevision((n) => n + 1);
    } catch (e) {
      const code = (e as Error).message;
      setActionError(errors[code] || errors.ADMIN_UNAVAILABLE);
      if (["ADMIN_FORBIDDEN", "OWNER_REQUIRED"].includes(code)) {
        setData(null);
        setChoice(null);
        setError(errors[code]);
      }
    } finally {
      setPending(false);
    }
  };

  const row = data?.items[0];
  const title =
    section === "staff"
      ? "運営権限"
      : section === "posts"
        ? "投稿確認"
        : sections.find((x) => x[0] === section)?.[1] || "運営";
  return (
    <main className={css.shell}>
      <p className={css.muted}>みんつく · 運営コンソール</p>
      <h1>{title}</h1>
      <p>
        対象：staging検収環境{" "}
        {data && <span className={css.tag}>{shown(data.role)}</span>}
      </p>
      <nav aria-label="運営管理" className={css.nav}>
        {sections
          .filter(([s]) => s !== "system" || data?.role === "owner")
          .map(([s, label]) => (
            <Link
              key={s}
              href={s === "overview" ? "/admin" : "/admin/" + s}
              aria-current={section === s ? "page" : undefined}
            >
              {label}
            </Link>
          ))}
      </nav>
      {section === "system" && data?.role === "owner" && (
        <p>
          <Link href="/admin/staff">運営権限を管理</Link>
        </p>
      )}
      <div className={css.bar}>
        <label>
          検索
          <input
            value={query}
            maxLength={100}
            placeholder="公開名義・タイトル・対象ID"
            onChange={(e) => {
              setQuery(e.target.value);
              setOffset(0);
            }}
          />
        </label>
        <label>
          対象期間
          <select
            value={days}
            onChange={(e) => {
              setDays(e.target.value);
              setOffset(0);
            }}
          >
            <option value="1">今日（日本時間）</option>
            <option value="7">7日間</option>
            <option value="30">30日間</option>
          </select>
        </label>
        <label>
          並び順
          <select
            value={sort}
            onChange={(e) => {
              setSort(e.target.value);
              setOffset(0);
            }}
          >
            <option value="newest">新しい順</option>
            <option value="oldest">古い順</option>
            {section === "reports" && (
              <option value="priority">優先度順</option>
            )}
            {["rooms", "works"].includes(section) && (
              <option value="reports">通報数順</option>
            )}
          </select>
        </label>
        {["reports", "users", "rooms", "works", "ai", "billing"].includes(
          section,
        ) && (
          <label>
            状態
            <select
              value={status}
              onChange={(e) => {
                setStatus(e.target.value);
                setOffset(0);
              }}
            >
              <option value="">すべて</option>
              {(section === "reports"
                ? ["open", "reviewing", "resolved", "dismissed"]
                : section === "users"
                  ? ["active", "suspended"]
                  : section === "ai"
                    ? [
                        "pending",
                        "running",
                        "succeeded",
                        "failed",
                        "stuck",
                        "skipped",
                      ]
                    : section === "billing"
                      ? ["active", "past_due", "canceled"]
                      : ["open", "forced_publish", "hidden"]
              ).map((s) => (
                <option key={s} value={s}>
                  {values[s] || labels[s] || s}
                </option>
              ))}
            </select>
          </label>
        )}
        <button onClick={() => setRevision((n) => n + 1)} disabled={busy}>
          再読込
        </button>
      </div>
      {section === "audit" && (
        <div className={css.bar}>
          {(["actor", "action", "type", "severity"] as const).map((k) => (
            <label key={k}>
              {
                {
                  actor: "操作者ID",
                  action: "操作",
                  type: "対象種別",
                  severity: "重要度",
                }[k]
              }
              <input
                value={filters[k]}
                onChange={(e) => {
                  setFilters({ ...filters, [k]: e.target.value });
                  setOffset(0);
                }}
                maxLength={80}
              />
            </label>
          ))}
        </div>
      )}
      {error && (
        <p role="alert" className={css.error}>
          {error} <Link href="/login">ログイン画面</Link>
        </p>
      )}
      {busy && <p role="status">読み込み中…</p>}
      {notice && <p role="status">{notice}</p>}
      {data && !busy && (
        <>
          <p className={css.muted}>
            確認時刻：{shown(data.checkedAt)}
            。失敗した取得結果を0件として表示しません。
          </p>
          {section === "overview" && data.detail && (
            <>
              <div className={css.cards}>
                {Object.entries((data.detail.metrics || {}) as Row).map(
                  ([k, v]) => (
                    <div className={css.card} key={k}>
                      {labels[k] || k}
                      <strong>{shown(v)}</strong>
                    </div>
                  ),
                )}
              </div>
              <p className={css.muted}>
                有効アカウントは退会中・利用停止中を除く件数です。日別アクティブ人数ではありません。
              </p>
              <section className={css.detail}>
                <h2>機能の実効状態</h2>
                <Details
                  data={{
                    flags: data.detail.flags,
                    startup: data.detail.startup,
                  }}
                />
              </section>
              <section className={css.detail}>
                <h2>最近の運営操作</h2>
                <Details data={data.detail.recent} />
              </section>
            </>
          )}
          {section === "system" && data.detail && (
            <>
              <section className={css.detail}>
                <h2>停止・復旧</h2>
                <p>
                  環境変数による停止も別途有効です。ここで再開しても、起動設定で停止中の処理は動きません。外部へ送信済みの処理は取り消せません。
                </p>
                <div className={css.cards}>
                  {Object.entries((data.detail.flags || {}) as Row).map(
                    ([key, on]) => (
                      <div className={css.card} key={key}>
                        <h3>{labels[key]}</h3>
                        <p>{on ? "DB許可" : "DB停止"}</p>
                        <button
                          onClick={() =>
                            choose({
                              title: labels[key] + (on ? "を停止" : "を再開"),
                              action: "feature",
                              type: "system",
                              target: key,
                              version: Number(data.detail?.version),
                              value: !on,
                            })
                          }
                        >
                          {on ? "停止" : "再開"}
                        </button>
                      </div>
                    ),
                  )}
                </div>
              </section>
              <section className={css.detail}>
                <h2>退会・外部処理</h2>
                <Details
                  data={{
                    startup: data.detail.startup,
                    deletion: data.detail.deletion,
                    buffer: data.detail.buffer,
                    cron: data.detail.cron,
                    security: data.detail.security,
                  }}
                />
                <p>
                  観測なしは正常の証明ではありません。外部副作用が不明な退会ジョブは、運用手順で照合するまで再開しないでください。
                </p>
              </section>
            </>
          )}
          {section === "staff" && (
            <form
              className={css.bar}
              onSubmit={(e) => {
                e.preventDefault();
                choose({
                  title: "Moderatorを追加",
                  action: "role",
                  type: "staff",
                  target: staffId,
                  version: 0,
                  value: "moderator",
                });
              }}
            >
              <label>
                追加するユーザーID
                <input
                  required
                  pattern="[0-9a-fA-F-]{36}"
                  value={staffId}
                  onChange={(e) => setStaffId(e.target.value)}
                />
              </label>
              <button>Moderatorを追加</button>
            </form>
          )}
          {section !== "overview" &&
            section !== "system" &&
            (data.items.length ? (
              <div
                className={css.table}
                tabIndex={0}
                role="region"
                aria-label={title + "一覧（横スクロール可）"}
              >
                <table>
                  <caption>{title}一覧 · 最大25件</caption>
                  <thead>
                    <tr>
                      {(columns[section] || []).map((k) => (
                        <th key={k} scope="col">
                          {labels[k] || k}
                        </th>
                      ))}
                      <th scope="col">確認</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.items.slice(0, 25).map((r, i) => (
                      <tr key={String(r.id || i)}>
                        {(columns[section] || []).map((k) => (
                          <td key={k} data-label={labels[k] || k}>
                            {shown(r[k])}
                          </td>
                        ))}
                        <td data-label="確認">
                          {[
                            "reports",
                            "users",
                            "rooms",
                            "works",
                            "posts",
                          ].includes(section) && (
                            <Link
                              href={"/admin/" + section + "?target=" + r.id}
                            >
                              詳細
                            </Link>
                          )}
                          {(target || section === "staff") && (
                            <Actions
                              r={r}
                              section={section}
                              role={data.role}
                              choose={choose}
                            />
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <p>条件に合う項目はありません。</p>
            ))}
          {target && row && (
            <section className={css.detail}>
              <h2>対象の詳細</h2>
              <Details data={row} />
              {
                <Actions
                  r={row}
                  section={section}
                  role={data.role}
                  choose={choose}
                />
              }
              {data.detail && <Details data={data.detail} />}
              <Link href={"/admin/" + section}>一覧へ戻る</Link>
            </section>
          )}
          {!target && ["ai", "billing"].includes(section) && data.detail && (
            <section className={css.detail}>
              <h2>監視情報</h2>
              <Details data={data.detail} />
              <p>
                公開名義と状態だけを確認できます。AI入力・決済の個人情報は表示しません。
              </p>
            </section>
          )}
          {section === "audit" &&
            data.items.map((r) => (
              <details className={css.detail} key={String(r.id)}>
                <summary>
                  {shown(r.action)} · {shown(r.created_at)}
                </summary>
                <Details data={r} />
              </details>
            ))}
          {!["overview", "system"].includes(section) && !target && (
            <div className={css.footer}>
              <button
                disabled={offset === 0}
                onClick={() => setOffset(Math.max(0, offset - 25))}
              >
                前の25件
              </button>
              <span>{offset + 1}件目から</span>
              <button
                disabled={data.items.length <= 25}
                onClick={() => setOffset(offset + 25)}
              >
                次の25件
              </button>
            </div>
          )}
        </>
      )}
      <dialog
        ref={dialog}
        className={css.dialog}
        aria-labelledby="admin-confirm-title"
        onCancel={(e) => {
          e.preventDefault();
          if (!pending) setChoice(null);
        }}
      >
        <form onSubmit={submit}>
          <h2 id="admin-confirm-title">{choice?.title}の確認</h2>
          <p>対象ID：{choice?.target}</p>
          <p>
            更新番号：{choice?.version}。この操作と理由は監査ログに残ります。
          </p>
          <p>
            {choice?.action === "hide"
              ? "非表示は一般公開を止めます。本文・名義・共同制作履歴は保持されます。再表示すると公開範囲に従って再び閲覧可能になります。"
              : choice?.action === "suspend"
                ? "利用停止中は新規の投稿・参加・作成・添付・手動AIを拒否します。既存作品は保持します。解除すると通常の権限に戻ります。"
                : choice?.action === "report"
                  ? "通報の対応状態だけを変更します。対象の非表示・復旧は別操作です。"
                  : choice?.action === "role"
                    ? "Moderatorは通報詳細の閲覧や利用停止を行えます。権限を解除すると次の操作から管理アクセスを拒否します。"
                    : choice?.action === "feature"
                      ? "選択した機能の新しい処理を停止、または再開します。開始済みの外部処理は取り消せません。公開停止の解除では期限超過ルームが次の公開処理の対象になります。"
                      : "このルームの選択した新規操作だけを制限します。過去の作品や投稿は削除しません。"}
          </p>
          {choice?.action === "feature" && (
            <p>再開前に原因の解消と途中処理の状態を確認してください。</p>
          )}
          <label>
            理由
            <select
              value={reason}
              onChange={(e) => {
                setReason(e.target.value);
                request.current = crypto.randomUUID();
              }}
            >
              {[
                "operational",
                "privacy",
                "copyright",
                "inappropriate",
                "harassment",
                "spam",
                "security",
                "other",
              ].map((v) => (
                <option value={v} key={v}>
                  {values[v]}
                </option>
              ))}
            </select>
          </label>
          <label>
            運営メモ（個人情報・認証情報は記入しない）
            <textarea
              required
              minLength={1}
              maxLength={500}
              value={note}
              onChange={(e) => {
                setNote(e.target.value);
                request.current = crypto.randomUUID();
              }}
            />
          </label>
          <label>
            <input
              type="checkbox"
              checked={confirmed}
              onChange={(e) => setConfirmed(e.target.checked)}
            />{" "}
            対象と影響を確認しました
          </label>
          {actionError && (
            <p role="alert" className={css.error}>
              {actionError}
            </p>
          )}
          <div className={css.actions}>
            <button
              type="button"
              disabled={pending}
              onClick={() => setChoice(null)}
            >
              キャンセル
            </button>
            <button
              className={css.danger}
              disabled={pending || !confirmed || !note.trim()}
            >
              {pending ? "処理中…" : "確認して実行"}
            </button>
          </div>
        </form>
      </dialog>
    </main>
  );
}
