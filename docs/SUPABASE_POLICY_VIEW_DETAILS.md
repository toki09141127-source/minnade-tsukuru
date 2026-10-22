# ポリシー・ビュー定義の監査別紙
2026-10-21。承認済みSQLの伏せ字済み結果。ポリシー名は前回同日監査のOIDと照合。実ユーザー行なし。

## posts / posts_select_authenticated / policy_check / OID 19007

状態: absent

## posts / posts_select_all / policy_check / OID 21479

状態: absent

## posts / posts_select / policy_check / OID 22593

状態: absent

## posts / posts_select_visible / policy_check / OID 24856

状態: absent

## posts / posts_select_room_members / policy_check / OID 32955

状態: absent

## posts / posts_delete_own_core_only / policy_check / OID 32959

状態: absent

## posts / posts_update_own / policy_check / OID 38544

状態: allowlisted_tokens_only

```text
(auth.uid() = user_id)
```

## posts / posts_insert_final_core_creator / policy_check / OID 41961

状態: masked_requires_review

```text
((auth.uid() = user_id) AND (post_type = 'final'::text) AND (EXISTS ( SELECT [REDACTED]
   FROM public.room_members rm
  WHERE ((rm.room_id = posts.room_id) AND (rm.user_id = auth.uid()) AND (rm.left_at IS NULL) AND (rm.role = ANY (ARRAY[REDACTED]'creator'::text, 'core'::text[REDACTED]))))))
```

## posts / posts_insert_log_members / policy_check / OID 41962

状態: masked_requires_review

```text
((auth.uid() = user_id) AND (post_type <> 'final'::text) AND (EXISTS ( SELECT [REDACTED]
   FROM public.room_members rm
  WHERE ((rm.room_id = posts.room_id) AND (rm.user_id = auth.uid()) AND (rm.left_at IS NULL)))))
```

## room_members / room_members_select_authenticated / policy_check / OID 18937

状態: absent

## room_members / room_members_select_all / policy_check / OID 21476

状態: absent

## room_members / room_members_select_self / policy_check / OID 24857

状態: absent

## room_members / room_members_insert_supporter_only_v1 / policy_check / OID 32914

状態: allowlisted_tokens_only

```text
((user_id = auth.uid()) AND (role = 'supporter'::text) AND (is_core = false))
```

## room_members / room_members_select_own_v1 / policy_check / OID 32915

状態: absent

## room_members / room_members_insert_supporter_only / policy_check / OID 32952

状態: allowlisted_tokens_only

```text
((user_id = auth.uid()) AND (role = 'supporter'::text))
```

## room_members / room_members_select_own / policy_check / OID 32953

状態: absent

## room_members / room_members_owner_select / policy_check / OID 32954

状態: absent

## room_members / select own membership / policy_check / OID 38548

状態: absent

## room_members / room_members_update_last_seen_at / policy_check / OID 45346

状態: allowlisted_tokens_only

```text
((user_id = auth.uid()) AND (left_at IS NULL))
```

## rooms / rooms_select_authenticated / policy_check / OID 17809

状態: absent

## rooms / rooms_insert_own / policy_check / OID 17810

状態: allowlisted_tokens_only

```text
(created_by = auth.uid())
```

## rooms / rooms_update_by_creator / policy_check / OID 19009

状態: allowlisted_tokens_only

```text
(created_by = auth.uid())
```

## rooms / rooms_select_all / policy_check / OID 21474

状態: absent

## rooms / rooms_insert_auth / policy_check / OID 21475

状態: allowlisted_tokens_only

```text
(auth.uid() IS NOT NULL)
```

## posts / posts_select_authenticated / policy_using / OID 19007

状態: allowlisted_tokens_only

```text
true
```

## posts / posts_select_all / policy_using / OID 21479

状態: allowlisted_tokens_only

```text
true
```

## posts / posts_select / policy_using / OID 22593

状態: masked_requires_review

```text
(EXISTS ( SELECT [REDACTED]
   FROM public.rooms r
  WHERE ((r.id = posts.room_id) AND ((r.status = 'forced_publish'::text) OR (EXISTS ( SELECT [REDACTED]
           FROM public.room_members m
          WHERE ((m.room_id = r.id) AND (m.user_id = auth.uid()))))))))
```

## posts / posts_select_visible / policy_using / OID 24856

状態: allowlisted_tokens_only

```text
((COALESCE(is_hidden, false) = false) AND (deleted_at IS NULL))
```

## posts / posts_select_room_members / policy_using / OID 32955

状態: masked_requires_review

```text
(EXISTS ( SELECT [REDACTED]
   FROM public.room_members m
  WHERE ((m.room_id = posts.room_id) AND (m.user_id = auth.uid()))))
```

## posts / posts_delete_own_core_only / policy_using / OID 32959

状態: masked_requires_review

```text
((user_id = auth.uid()) AND (EXISTS ( SELECT [REDACTED]
   FROM public.room_members m
  WHERE ((m.room_id = posts.room_id) AND (m.user_id = auth.uid()) AND (m.role = 'core'::text)))))
```

## posts / posts_update_own / policy_using / OID 38544

状態: allowlisted_tokens_only

```text
(auth.uid() = user_id)
```

## posts / posts_insert_final_core_creator / policy_using / OID 41961

状態: absent

## posts / posts_insert_log_members / policy_using / OID 41962

状態: absent

## room_members / room_members_select_authenticated / policy_using / OID 18937

状態: allowlisted_tokens_only

```text
true
```

## room_members / room_members_select_all / policy_using / OID 21476

状態: allowlisted_tokens_only

```text
true
```

## room_members / room_members_select_self / policy_using / OID 24857

状態: allowlisted_tokens_only

```text
(user_id = auth.uid())
```

## room_members / room_members_insert_supporter_only_v1 / policy_using / OID 32914

状態: absent

## room_members / room_members_select_own_v1 / policy_using / OID 32915

状態: allowlisted_tokens_only

```text
(user_id = auth.uid())
```

## room_members / room_members_insert_supporter_only / policy_using / OID 32952

状態: absent

## room_members / room_members_select_own / policy_using / OID 32953

状態: allowlisted_tokens_only

```text
(user_id = auth.uid())
```

## room_members / room_members_owner_select / policy_using / OID 32954

状態: masked_requires_review

```text
(EXISTS ( SELECT [REDACTED]
   FROM public.rooms r
  WHERE ((r.id = room_members.room_id) AND (r.created_by = auth.uid()))))
```

## room_members / select own membership / policy_using / OID 38548

状態: allowlisted_tokens_only

```text
(user_id = auth.uid())
```

## room_members / room_members_update_last_seen_at / policy_using / OID 45346

状態: allowlisted_tokens_only

```text
((user_id = auth.uid()) AND (left_at IS NULL))
```

## rooms / rooms_select_authenticated / policy_using / OID 17809

状態: allowlisted_tokens_only

```text
true
```

## rooms / rooms_insert_own / policy_using / OID 17810

状態: absent

## rooms / rooms_update_by_creator / policy_using / OID 19009

状態: allowlisted_tokens_only

```text
(created_by = auth.uid())
```

## rooms / rooms_select_all / policy_using / OID 21474

状態: allowlisted_tokens_only

```text
true
```

## rooms / rooms_insert_auth / policy_using / OID 21475

状態: absent

## profiles_public /  / view / OID 37400

状態: masked_requires_review

```text
 SELECT id,
    username,
    [REDACTED],
    [REDACTED],
    [REDACTED],
    [REDACTED],
    [REDACTED],
    [REDACTED]
   FROM public.profiles p;
```

## report_counts /  / view / OID 23722

状態: masked_requires_review

```text
 SELECT [REDACTED],
    [REDACTED],
    count(*) AS [REDACTED]
   FROM public.[REDACTED] r
  GROUP BY [REDACTED], [REDACTED];
```

## rooms_with_counts_v2 /  / view / OID 32868

状態: masked_requires_review

```text
 SELECT id,
    title,
    work_type,
    [REDACTED],
    time_limit_hours,
    status,
    [REDACTED],
    created_by,
    created_at,
    [REDACTED],
    ended_at,
    like_count,
    expires_at,
    deleted_at,
    is_adult,
    is_hidden,
    [REDACTED],
    category,
    type,
    concept,
    ( SELECT count(DISTINCT rm.user_id) AS count
           FROM public.room_members rm
          WHERE ((rm.room_id = r.id) AND (rm.left_at IS NULL))) AS member_count,
    ( SELECT count(DISTINCT rm.user_id) AS count
           FROM public.room_members rm
          WHERE ((rm.room_id = r.id) AND (rm.left_at IS NULL) AND (rm.role = ANY (ARRAY[REDACTED]'creator'::text, 'core'::text[REDACTED])))) AS [REDACTED],
    ai_level
   FROM public.rooms r;
```

## rooms_with_counts /  / view / OID 26038

状態: masked_requires_review

```text
 SELECT r.id,
    r.title,
    r.status,
    r.category AS type,
    r.category,
    r.is_adult,
    r.created_by,
    r.created_at,
    r.[REDACTED],
    r.expires_at,
    r.like_count,
    r.is_hidden,
    r.deleted_at,
    (COALESCE(count(rm.user_id), ([REDACTED])::bigint))::integer AS member_count
   FROM (public.rooms r
     LEFT JOIN public.room_members rm ON ((rm.room_id = r.id)))
  WHERE (r.deleted_at IS NULL)
  GROUP BY r.id, r.title, r.status, r.category, r.is_adult, r.created_by, r.created_at, r.[REDACTED], r.expires_at, r.like_count, r.is_hidden, r.deleted_at;
```

## Service Role参照の機械抽出（アプリ/ヘルパー）
- lib\rooms\getUnreadMapForUser.ts
- app\api\debug\buckets\route.ts
- app\profile\set-username\route.ts
- lib\supabase\admin.ts
- lib\supabase\server.ts
- app\profile\set-sns-links\route.ts
- app\api\uploads\sign\route.ts
- app\api\uploads\route.ts
- app\profile\set-bio\route.ts
- app\api\cron\publish\route.ts
- app\api\account\delete\route.ts
- app\api\reports\create\route.ts
- app\api\rooms\create\route.ts
- app\api\storage\sign\route.ts
- app\api\posts\toggle-mark\route.ts
- app\api\update\route.ts
- app\api\rooms\join-core-first-come\route.ts
- app\api\rooms\_shared.ts
- app\rooms\join\route.ts
- app\api\posts\delete\route.ts
- app\api\rooms\approve-core\route.ts
- app\api\rooms\join-core-by-invite\route.ts
- app\api\rooms\[id]\invite-code\route.ts
- app\api\posts\create\route.ts
- app\api\rooms\delete\route.ts
- app\api\rooms\unread-map\route.ts
- app\api\rooms\join\route.ts
- app\api\rooms\expire\route.ts
- app\api\rooms\leave\route.ts
- app\api\rooms\mark-read\route.ts
- app\api\rooms\seen\route.ts
- app\api\rooms\request-core\route.ts
- app\api\rooms\expire\join\route.ts
- app\api\rooms\join-supporter\route.ts
- app\api\rooms\reject-core\route.ts
- app\api\rooms\like\route.ts
- app\rooms\[id]\core-reject\route.ts
- app\rooms\[id]\core-approve\route.ts
- app\rooms\[id]\core-revoke\route.ts
- app\rooms\[id]\page.tsx
- 間接利用：app/api/uploads/public/[postId]/route.ts → storage/sign。
- リポジトリ全体の追加検索：scripts/reset-password.mjs（管理用CLI、未実行）、docsの2モックはService Roleの模倣のみ。
