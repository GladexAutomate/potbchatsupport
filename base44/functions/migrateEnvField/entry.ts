/**
 * One-time migration: stamps env='test' on all existing records
 * that don't yet have an env field.
 * Run this ONCE from the dashboard after deploying the env schema changes.
 */
import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

const ENTITIES_TO_MIGRATE = [
  'Ticket',
  'TicketMessage',
  'TicketHistory',
  'InternalTicket',
  'GroupChatMessage',
  'EmployeeAccount',
  'StaffDirectory',
  'VIPCustomer',
  'StaffRating',
  'ConversationTag',
  'SavedReply',
  'Permission',
];

const sleep = (ms) => new Promise(r => setTimeout(r, ms));

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user || user.role !== 'admin') {
      return Response.json({ error: 'Admin only' }, { status: 403 });
    }

    const results = {};

    for (const entityName of ENTITIES_TO_MIGRATE) {
      try {
        await sleep(300); // avoid rate limiting between entities
        const records = await base44.asServiceRole.entities[entityName].list(null, 200);
        const needsMigration = (records || []).filter(r => !r.env);
        let updated = 0;
        for (const record of needsMigration) {
          await sleep(100); // small delay between updates
          await base44.asServiceRole.entities[entityName].update(record.id, { env: 'test' });
          updated++;
        }
        results[entityName] = { total: records.length, migrated: updated };
      } catch (err) {
        results[entityName] = { error: err.message };
      }
    }

    return Response.json({ success: true, results });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});