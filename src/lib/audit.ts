import { db } from '@/db';
import { auditLogs } from '@/db/schema';

export async function createAuditLog({
  userId,
  action,
  entityType,
  entityId,
  previousValue,
  newValue,
  ipAddress,
  userAgent,
}: {
  userId?: string;
  action: string;
  entityType: string;
  entityId?: string;
  previousValue?: Record<string, unknown>;
  newValue?: Record<string, unknown>;
  ipAddress?: string;
  userAgent?: string;
}) {
  await db.insert(auditLogs).values({
    userId,
    action,
    entityType,
    entityId,
    previousValue,
    newValue,
    ipAddress,
    userAgent,
  });
}

export const AUDIT_ACTIONS = {
  // User actions
  USER_LOGIN: 'user_login',
  USER_LOGOUT: 'user_logout',
  USER_CREATED: 'user_created',
  USER_UPDATED: 'user_updated',
  USER_DEACTIVATED: 'user_deactivated',
  
  // Claim actions
  CLAIM_CREATED: 'claim_created',
  CLAIM_UPDATED: 'claim_updated',
  CLAIM_ASSIGNED: 'claim_assigned',
  CLAIM_STATUS_CHANGED: 'claim_status_changed',
  CLAIM_NOTE_ADDED: 'claim_note_added',
  CLAIM_SUBMITTED_FOR_REVIEW: 'claim_submitted_for_review',
  CLAIM_APPROVED: 'claim_approved',
  CLAIM_REJECTED: 'claim_rejected',
  CLAIM_REWORK_REQUESTED: 'claim_rework_requested',
  
  // Document actions
  DOCUMENT_UPLOADED: 'document_uploaded',
  EOB_UPLOADED: 'eob_uploaded',
  DENIAL_DOCUMENT_UPLOADED: 'denial_document_uploaded',
  
  // File actions
  FILE_UPLOADED: 'file_uploaded',
  FILE_PROCESSED: 'file_processed',
  
  // System actions
  DENIAL_CODE_ADDED: 'denial_code_added',
  DENIAL_CODE_UPDATED: 'denial_code_updated',
} as const;
