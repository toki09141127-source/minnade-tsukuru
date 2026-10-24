import {
  deletionRpc,
  deletionCheckpoint,
  deletionEffect,
} from "./accountDeletionControl";
import type { SupabaseClient } from "@supabase/supabase-js";
import type {
  DeletionPreparation,
  PreparationReceipt,
} from "./accountDeletionAdapter";
import type { DeletionJob } from "./accountDeletion";

// No global client or scheduler: a verified server worker must explicitly construct this adapter.
export function createFinalDeletionPreparation(
  client: SupabaseClient,
  prepareBilling?: (job: DeletionJob) => Promise<void>,
): DeletionPreparation {
  const rpc = (name: string, args: Record<string, unknown>) =>
    deletionRpc(client, name, args);
  const args = (job: DeletionJob) => ({ p_id: job.id, p_lease: job.lease });
  const verify = async (
    job: DeletionJob,
  ): Promise<PreparationReceipt | null> => {
    if (prepareBilling) await prepareBilling(job);
    const data = await rpc("mvp_verify_deletion", args(job));
    if (!data || data.jobId !== job.id || data.actorId !== job.actorId)
      return null;
    return data as PreparationReceipt; // createAccountDeletionPorts checks every boolean strictly.
  };
  return {
    async prepare(job) {
      // Verify billing stop before anonymization or irreversible storage effects.
      if (prepareBilling) await prepareBilling(job);
      await rpc("mvp_prepare_deletion", args(job));
      await deletionCheckpoint(client, job, "after_prepare");
      const candidates = await rpc(
        "mvp_deletion_cleanup_candidates",
        args(job),
      );
      if (!Array.isArray(candidates))
        throw new Error("DELETION_CLEANUP_INVALID");
      for (const item of candidates) {
        // Exact server ledger namespace only. No prefix removal, URLs, or user-supplied paths.
        const uuid =
          "[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}";
        if (
          item.bucket !== "room_uploads" ||
          typeof item.upload_id !== "string" ||
          !new RegExp("^" + uuid + "$").test(item.upload_id) ||
          typeof item.storage_path !== "string" ||
          !new RegExp(
            "^rooms/" +
              uuid +
              "/(images|videos|files)/" +
              item.upload_id +
              "\\.(png|jpg|gif|webp|mp4|webm|pdf|txt)$",
          ).test(item.storage_path)
        )
          throw new Error("DELETION_CLEANUP_INVALID");
        await rpc("mvp_renew_deletion", {
          ...args(job),
          p_expected: job.stage,
        });
        await deletionEffect(
          client,
          job,
          "storage_delete",
          item.upload_id,
          async () => {
            const { error } = await client.storage
              .from("room_uploads")
              .remove([item.storage_path]);
            if (error) throw new Error("DELETION_STORAGE_RETRY");
          },
        );
        // The DB verifies absence in managed metadata before accepting completion.
        await rpc("mvp_finish_deletion_upload", {
          ...args(job),
          p_upload: item.upload_id,
        });
      }
      return verify(job);
    },
    verify,
    async finalize(job) {
      const receipt = await verify(job);
      const { data, error } = await client.auth.admin.getUserById(job.actorId);
      const absent =
        !!error && error.status === 404 && error.code === "user_not_found";
      return (
        receipt?.storageReadyForAuthDeletion === true && absent && !data.user
      );
    },
  };
}
