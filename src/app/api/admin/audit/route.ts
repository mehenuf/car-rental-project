import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { withErrorHandling } from "@/lib/api-response";
import { requireStaff } from "@/lib/admin/staff";
import { supabaseAdmin } from "@/lib/supabase-server";

const QuerySchema = z.object({
  entity: z.string().max(80).optional(),
  actor: z.string().uuid().optional(),
  action: z.string().max(80).optional(),
  from: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  to: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  page: z.coerce.number().int().min(1).max(1000).default(1),
});
const PAGE_SIZE = 50;

/** GET /api/admin/audit — the audit log, filtered by entity, actor, action and date, newest first. */
export const GET = withErrorHandling(async (request: NextRequest) => {
  await requireStaff("audit.read");
  const q = QuerySchema.parse(Object.fromEntries([...request.nextUrl.searchParams].filter(([, v]) => v !== "")));

  let query = supabaseAdmin
    .from("audit_log")
    .select("id, at, actor_user_id, actor_role, action, entity_type, entity_id, before, after, reason, ip", { count: "exact" })
    .order("id", { ascending: false })
    .range((q.page - 1) * PAGE_SIZE, q.page * PAGE_SIZE - 1);
  if (q.entity) query = query.eq("entity_type", q.entity);
  if (q.actor) query = query.eq("actor_user_id", q.actor);
  if (q.action) query = query.ilike("action", `${q.action.replace(/[\\%_]/g, "\\$&")}%`);
  if (q.from) query = query.gte("at", `${q.from}T00:00:00Z`);
  if (q.to) query = query.lte("at", `${q.to}T23:59:59.999Z`);

  const { data, error, count } = await query;
  if (error) throw new Error(`audit: ${error.message}`);
  return NextResponse.json({ data: data ?? [], count: count ?? 0, pageSize: PAGE_SIZE });
});
