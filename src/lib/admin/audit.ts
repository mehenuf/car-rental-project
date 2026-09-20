import type { StaffRole } from "./permissions";
import { redact } from "./redact";

export function clientIp(headers: Headers): string | null {
  const forwarded = headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  return forwarded || headers.get("x-real-ip") || null;
}

export interface AuditInput {
  actor: { userId: string; role: StaffRole };
  action: string;
  entityType: string;
  entityId?: string | null;
  before?: unknown;
  after?: unknown;
  reason?: string | null;
  headers: Headers;
}

/** The row for `audit_log`: who did what to which record, with secrets removed and free text bounded. */
export function buildAuditRow(input: AuditInput) {
  return {
    actor_user_id: input.actor.userId,
    actor_role: input.actor.role,
    action: input.action,
    entity_type: input.entityType,
    entity_id: input.entityId ?? null,
    before: input.before === undefined ? null : (redact(input.before) as never),
    after: input.after === undefined ? null : (redact(input.after) as never),
    reason: input.reason ? input.reason.slice(0, 500) : null,
    ip: clientIp(input.headers),
    user_agent: input.headers.get("user-agent")?.slice(0, 300) ?? null,
    request_id: input.headers.get("x-vercel-id") ?? input.headers.get("x-request-id"),
  };
}
