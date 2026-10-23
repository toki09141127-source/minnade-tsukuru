# V2 RC migration matrix

Main 402719b → V2 686121a. 本番適用済み38ファイルの番号・名前・SHA256を保持。Buffer10件はcheckout時の改行変換を本番適用hash一致の原本から復元し、全SQLの自動改行変換を停止。SQL意味変更なし。V2旧040〜055をcanonical042〜057へ移動し、本文byte一致。既存stagingは旧番号の履歴を保持し、canonicalを再適用しない。JSON対応表と旧適用manifestを併せて参照。

空DBには監査済みbaseline→main001〜041→V2 042〜057。036は本番未適用/管理extension ACLが実効しなかった歴史的SQLであり、最終037〜041の同期HTTP方式を採用。040/041はmain由来staging追加で本番未適用。番号だけで本番への適用を決めない。

| Migration | Source | Purpose | Production existing | RC required | Reversible | Risk / dependency |
|---|---|---|---|---|---|---|
| 202610210001_attachment_ledger.sql | main | attachment_ledger | yes | fresh yes | forward fix | prior main sequence |
| 202610210002_membership_guards.sql | main | membership_guards | yes | fresh yes | forward fix | prior main sequence |
| 202610210003_account_jobs.sql | main | account_jobs | yes | fresh yes | forward fix | prior main sequence |
| 202610210004_moderation.sql | main | moderation | yes | fresh yes | forward fix | prior main sequence |
| 202610210005_read_boundaries.sql | main | read_boundaries | yes | fresh yes | forward fix | prior main sequence |
| 202610210006_work_drafts.sql | main | work_drafts | yes | fresh yes | forward fix | prior main sequence |
| 202610210007_deletion_lease.sql | main | deletion_lease | yes | fresh yes | forward fix | prior main sequence |
| 202610210008_deletion_retention.sql | main | deletion_retention | yes | fresh yes | forward fix | prior main sequence |
| 202610210009_deletion_attribution_fence.sql | main | deletion_attribution_fence | yes | fresh yes | forward fix | prior main sequence |
| 202610210010_scoped_moderation.sql | main | scoped_moderation | yes | fresh yes | forward fix | prior main sequence |
| 202610210011_report_intake.sql | main | report_intake | yes | fresh yes | forward fix | prior main sequence |
| 202610210012_report_queue.sql | main | report_queue | yes | fresh yes | forward fix | prior main sequence |
| 202610210013_upload_cleanup.sql | main | upload_cleanup | yes | fresh yes | forward fix | prior main sequence |
| 202610210014_like_requests.sql | main | like_requests | yes | fresh yes | forward fix | prior main sequence |
| 202610210015_room_creation.sql | main | room_creation | yes | fresh yes | forward fix | prior main sequence |
| 202610210016_operator_rate_limits.sql | main | operator_rate_limits | yes | fresh yes | forward fix | prior main sequence |
| 202610210017_report_admission.sql | main | report_admission | yes | fresh yes | forward fix | prior main sequence |
| 202610210018_member_admission.sql | main | member_admission | yes | fresh yes | forward fix | prior main sequence |
| 202610210019_core_admission.sql | main | core_admission | yes | fresh yes | forward fix | prior main sequence |
| 202610210020_deletion_privacy_preconditions.sql | main | deletion_privacy_preconditions | yes | fresh yes | forward fix | prior main sequence |
| 202610210021_client_read_contract.sql | main | client_read_contract | yes | fresh yes | forward fix | prior main sequence |
| 202610210022_work_snapshot_read.sql | main | work_snapshot_read | yes | fresh yes | forward fix | prior main sequence |
| 202610210023_retained_actors.sql | main | retained_actors | yes | fresh yes | forward fix | prior main sequence |
| 202610210024_deletion_prepare.sql | main | deletion_prepare | yes | fresh yes | forward fix | prior main sequence |
| 202610210025_deletion_upload_fence.sql | main | deletion_upload_fence | yes | fresh yes | forward fix | prior main sequence |
| 202610220026_deletion_request_timestamp.sql | main | deletion_request_timestamp | yes | fresh yes | forward fix | prior main sequence |
| 202610220027_deletion_pause.sql | main | deletion_pause | yes | fresh yes | forward fix | prior main sequence |
| 202610220028_release_consent.sql | main | release_consent | yes | fresh yes | forward fix | prior main sequence |
| 202610220029_buffer_queue.sql | main | buffer_queue | yes | fresh yes | forward fix | prior main sequence |
| 202610220030_buffer_delivery.sql | main | buffer_delivery | yes | fresh yes | forward fix | prior main sequence |
| 202610220031_buffer_delivery_control.sql | main | buffer_delivery_control | yes | fresh yes | forward fix | prior main sequence |
| 202610220032_buffer_cancelled_capacity.sql | main | buffer_cancelled_capacity | yes | fresh yes | forward fix | prior main sequence |
| 202610220033_buffer_cancel_test_text.sql | main | buffer_cancel_test_text | yes | fresh yes | forward fix | prior main sequence |
| 202610220034_buffer_release_guard.sql | main | buffer_release_guard | yes | fresh yes | forward fix | prior main sequence |
| 202610220035_buffer_scheduler.sql | main | buffer_scheduler | yes | fresh yes | forward fix | prior main sequence |
| 202610220036_buffer_transport_acl.sql | main | buffer_transport_acl | no | fresh yes | forward fix | prior main sequence |
| 202610220037_buffer_private_http.sql | main | buffer_private_http | yes | fresh yes | forward fix | prior main sequence |
| 202610220038_buffer_http_options.sql | main | buffer_http_options | yes | fresh yes | forward fix | prior main sequence |
| 202610220039_buffer_scheduler_response.sql | main | buffer_scheduler_response | yes | fresh yes | forward fix | prior main sequence |
| 202610230040_buffer_manual_test.sql | main | buffer_manual_test | no | fresh yes | forward fix | prior main sequence |
| 202610230042_v2_membership.sql | V2 staging (旧0040) | v2_membership | no | fresh yes | forward fix | main 041, MVP028 |
| 202610230041_buffer_staging_scheduler_auth.sql | main | buffer_staging_scheduler_auth | no | fresh yes | forward fix | prior main sequence |
| 202610230043_v2_creation_log.sql | V2 staging (旧0041) | v2_creation_log | no | fresh yes | forward fix | previous V2 migration |
| 202610230044_v2_publication.sql | V2 staging (旧0042) | v2_publication | no | fresh yes | forward fix | previous V2 migration |
| 202610230045_v2_publication_withdrawal.sql | V2 staging (旧0043) | v2_publication_withdrawal | no | fresh yes | forward fix | previous V2 migration |
| 202610230046_ai_creator.sql | V2 staging (旧0044) | ai_creator | no | fresh yes | forward fix | previous V2 migration |
| 202610230047_ai_publication.sql | V2 staging (旧0045) | ai_publication | no | fresh yes | forward fix | previous V2 migration |
| 202610230048_ai_control_scope.sql | V2 staging (旧0046) | ai_control_scope | no | fresh yes | forward fix | previous V2 migration |
| 202610230049_ai_bounded_publication.sql | V2 staging (旧0047) | ai_bounded_publication | no | fresh yes | forward fix | previous V2 migration |
| 202610230050_billing_foundation.sql | V2 staging (旧0048) | billing_foundation | no | fresh yes | forward fix | previous V2 migration |
| 202610230051_ai_credit_settings.sql | V2 staging (旧0049) | ai_credit_settings | no | fresh yes | forward fix | previous V2 migration |
| 202610230052_billing_deletion_fence.sql | V2 staging (旧0050) | billing_deletion_fence | no | fresh yes | forward fix | previous V2 migration |
| 202610230053_billing_retry_state.sql | V2 staging (旧0051) | billing_retry_state | no | fresh yes | forward fix | previous V2 migration |
| 202610230054_billing_period_timing.sql | V2 staging (旧0052) | billing_period_timing | no | fresh yes | forward fix | previous V2 migration |
| 202610230055_admin_foundation.sql | V2 staging (旧0053) | admin_foundation | no | fresh yes | forward fix | previous V2 migration |
| 202610230056_admin_write_guards.sql | V2 staging (旧0054) | admin_write_guards | no | fresh yes | forward fix | previous V2 migration |
| 202610230057_admin_read_models.sql | V2 staging (旧0055) | admin_read_models | no | fresh yes | forward fix | previous V2 migration |

各SHA256とstaging履歴: [map](v2-rc-migration-map.json)。実DBのmigration記録を書き換えて新番号を適用済みとは扱わない。

## RC追加058
202610240058_v2_buffer_capacity.sql: main側Bufferの固定Member45枠とV2可変定員の不一致を解消。V2はCreator/Core/Memberを含むactive人数、MVPは従来supporter45枠。既存適用SQLは変更なし。freshとstagingで適用、production未適用。canonical001〜058。
