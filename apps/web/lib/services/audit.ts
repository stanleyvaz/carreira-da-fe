import { q } from "../db";
export async function audit(actorId: string | null, action: string, entity?: string, entityId?: string, detail?: unknown) {
  await q("INSERT INTO audit_logs(actor_id,action,entity,entity_id,detail) VALUES ($1,$2,$3,$4,$5)",
    [actorId, action, entity ?? null, entityId ?? null, detail ? JSON.stringify(detail) : null]);
}
