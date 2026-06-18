import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    
    // Admin-only
    if (!user || user.role !== 'admin') {
      return Response.json({ error: 'Admin access required' }, { status: 403 });
    }

    const entities = [
      'Ticket', 'TicketMessage', 'TicketHistory', 'InternalTicket', 
      'GroupChatMessage', 'EmployeeAccount', 'StaffDirectory', 'VIPCustomer',
      'StaffRating', 'ConversationTag', 'SavedReply', 'Permission'
    ];

    let totalMigrated = 0;
    const results = {};

    for (const entityName of entities) {
      const entity = base44.asServiceRole.entities[entityName];
      try {
        // Get all records without env field
        const allRecords = await entity.list('created_date', 1000);
        const untagged = (allRecords || []).filter(r => !r.env);

        // Batch update them to env='prod' (published is the source of truth)
        for (const record of untagged) {
          await entity.update(record.id, { env: 'prod' });
          totalMigrated++;
          await new Promise(r => setTimeout(r, 50)); // Rate limit
        }

        results[entityName] = { untagged: untagged.length, migrated: untagged.length };
      } catch (e) {
        results[entityName] = { error: e.message };
      }
    }

    return Response.json({ totalMigrated, results });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});