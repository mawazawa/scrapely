/**
 * Human-in-the-loop approval for agent actions
 * Enables manual review for edge cases
 */

import { z } from 'zod';
import { Env } from '../index';
import { logger } from '../lib/logger';

/**
 * Approval request schema
 */
export const ApprovalRequestSchema = z.object({
  id: z.string(),
  agentId: z.string(),
  action: z.string(),
  parameters: z.record(z.unknown()),
  reason: z.string(),
  createdAt: z.number(),
  expiresAt: z.number(),
  status: z.enum(['pending', 'approved', 'rejected', 'expired']),
  reviewedBy: z.string().optional(),
  reviewedAt: z.number().optional(),
  notes: z.string().optional(),
});

export type ApprovalRequest = z.infer<typeof ApprovalRequestSchema>;

/**
 * Approval decision
 */
export interface ApprovalDecision {
  approved: boolean;
  notes?: string;
  modifiedParameters?: Record<string, unknown>;
}

/**
 * Actions that require approval
 */
export const APPROVAL_REQUIRED_ACTIONS = [
  'publish_brief',
  'delete_article',
  'modify_source',
  'send_notification',
  'bulk_operation',
];

/**
 * Check if an action requires approval
 */
export function requiresApproval(action: string): boolean {
  return APPROVAL_REQUIRED_ACTIONS.includes(action);
}

/**
 * Create an approval request
 */
export function createApprovalRequest(
  agentId: string,
  action: string,
  parameters: Record<string, unknown>,
  reason: string,
  expiresInMs: number = 24 * 60 * 60 * 1000 // 24 hours default
): ApprovalRequest {
  const now = Date.now();
  return {
    id: crypto.randomUUID(),
    agentId,
    action,
    parameters,
    reason,
    createdAt: now,
    expiresAt: now + expiresInMs,
    status: 'pending',
  };
}

/**
 * Store approval request in KV
 */
export async function storeApprovalRequest(
  kv: KVNamespace | undefined,
  request: ApprovalRequest
): Promise<boolean> {
  if (!kv) {
    logger.warn('No KV namespace for approval storage');
    return false;
  }

  try {
    const key = `approval:${request.id}`;
    const ttl = Math.ceil((request.expiresAt - Date.now()) / 1000);

    await kv.put(key, JSON.stringify(request), { expirationTtl: ttl });

    // Also store in pending list for easy retrieval
    const pendingKey = `approval:pending:${request.agentId}`;
    const pendingList = await kv.get<string[]>(pendingKey, 'json') || [];
    pendingList.push(request.id);
    await kv.put(pendingKey, JSON.stringify(pendingList), { expirationTtl: ttl });

    logger.info('Approval request stored', { requestId: request.id, action: request.action });
    return true;
  } catch (error) {
    logger.error('Failed to store approval request', { error: String(error) });
    return false;
  }
}

/**
 * Get approval request from KV
 */
export async function getApprovalRequest(
  kv: KVNamespace | undefined,
  requestId: string
): Promise<ApprovalRequest | null> {
  if (!kv) return null;

  try {
    const key = `approval:${requestId}`;
    const request = await kv.get<ApprovalRequest>(key, 'json');

    if (request && request.expiresAt < Date.now()) {
      // Mark as expired
      request.status = 'expired';
      await kv.put(key, JSON.stringify(request));
    }

    return request;
  } catch {
    return null;
  }
}

/**
 * Process approval decision
 */
export async function processApprovalDecision(
  kv: KVNamespace | undefined,
  requestId: string,
  decision: ApprovalDecision,
  reviewerId: string
): Promise<ApprovalRequest | null> {
  if (!kv) return null;

  const request = await getApprovalRequest(kv, requestId);
  if (!request) return null;

  if (request.status !== 'pending') {
    logger.warn('Approval request already processed', { requestId, status: request.status });
    return request;
  }

  const updatedRequest: ApprovalRequest = {
    ...request,
    status: decision.approved ? 'approved' : 'rejected',
    reviewedBy: reviewerId,
    reviewedAt: Date.now(),
    notes: decision.notes,
    parameters: decision.modifiedParameters || request.parameters,
  };

  await kv.put(`approval:${requestId}`, JSON.stringify(updatedRequest));

  logger.info('Approval decision processed', {
    requestId,
    approved: decision.approved,
    reviewerId,
  });

  return updatedRequest;
}

/**
 * Get pending approvals for an agent
 */
export async function getPendingApprovals(
  kv: KVNamespace | undefined,
  agentId: string
): Promise<ApprovalRequest[]> {
  if (!kv) return [];

  try {
    const pendingKey = `approval:pending:${agentId}`;
    const pendingIds = await kv.get<string[]>(pendingKey, 'json') || [];

    const requests: ApprovalRequest[] = [];
    for (const id of pendingIds) {
      const request = await getApprovalRequest(kv, id);
      if (request && request.status === 'pending') {
        requests.push(request);
      }
    }

    return requests;
  } catch {
    return [];
  }
}

/**
 * Wait for approval with timeout
 */
export async function waitForApproval(
  kv: KVNamespace | undefined,
  request: ApprovalRequest,
  pollIntervalMs: number = 5000,
  timeoutMs: number = 60000
): Promise<ApprovalRequest> {
  const startTime = Date.now();

  while (Date.now() - startTime < timeoutMs) {
    const current = await getApprovalRequest(kv, request.id);

    if (!current) {
      throw new Error('Approval request not found');
    }

    if (current.status !== 'pending') {
      return current;
    }

    // Wait before next poll
    await new Promise(resolve => setTimeout(resolve, pollIntervalMs));
  }

  // Timeout - mark as expired
  return {
    ...request,
    status: 'expired',
  };
}
