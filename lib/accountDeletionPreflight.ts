// Pure planning only. This is never a PreparationReceipt or permission to delete Auth.
export type RetentionUpload = {
  id: string
  published: boolean | null
  shared: boolean | null
  everUsed: boolean | null
  expired: boolean
  uploaded: boolean
  storageOwnershipVerified: boolean
}
export type DeletionInventory = {
  complete: boolean
  unpublishedCreatorRooms: number
  ownedEvents: number
  blockingForeignKeys: number
  destructiveCascades: number
  profileCleanupVerified: boolean
  writeFenceVerified: boolean
  triggersVerified: boolean
  storageVerified: boolean
  uploads: RetentionUpload[]
}
export function planAccountDeletion(inventory: DeletionInventory) {
  const blockers: string[] = []
  if (!inventory.complete) blockers.push('INVENTORY_INCOMPLETE')
  for (const key of ['unpublishedCreatorRooms', 'ownedEvents', 'blockingForeignKeys', 'destructiveCascades'] as const) {
    if (!Number.isSafeInteger(inventory[key]) || inventory[key] < 0) blockers.push('INVALID_INVENTORY')
    else if (inventory[key] > 0) blockers.push(key)
  }
  for (const key of ['profileCleanupVerified', 'writeFenceVerified', 'triggersVerified', 'storageVerified'] as const)
    if (inventory[key] !== true) blockers.push(key)
  const uploads = inventory.uploads.map(upload => {
    if (upload.published === true || upload.shared === true || upload.everUsed === true)
      return { id: upload.id, action: 'retain' as const }
    if (upload.published !== false || upload.shared !== false || upload.everUsed !== false ||
        !upload.storageOwnershipVerified || !upload.uploaded)
      return { id: upload.id, action: 'review' as const }
    return { id: upload.id, action: upload.expired ? 'cleanup_candidate' as const : 'retain' as const }
  })
  if (uploads.some(upload => upload.action === 'review')) blockers.push('UPLOAD_REVIEW')
  return { status: blockers.length ? 'needs_review' as const : 'ready_for_verification' as const, blockers, uploads }
}
