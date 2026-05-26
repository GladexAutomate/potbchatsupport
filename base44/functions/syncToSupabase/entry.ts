import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';
import { createClient } from 'npm:@supabase/supabase-js@2';

const ENTITIES_TO_SYNC = [
  'Ticket',
  'TicketMessage',
  'TicketHistory',
  'GroupChatMessage',
  'VIPCustomer',
  'StaffRating',
  'SavedReply',
  'ConversationTag',
  'SLAPolicy',
];

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);

    // Allow both admin calls and scheduled automation calls
    let isAuthorized = false;
    try {
      const user = await base44.auth.me();
      if (user?.role === 'admin') isAuthorized = true;
    } catch {
      // Called from automation (no user session) — allow via service role
      isAuthorized = true;
    }

    if (!isAuthorized) {
      return Response.json({ error: 'Forbidden' }, { status: 403 });
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL'),
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
    );

    const results = {};

    for (const entityName of ENTITIES_TO_SYNC) {
      try {
        const records = await base44.asServiceRole.entities[entityName].list('-updated_date', 1000);
        if (!records || records.length === 0) {
          results[entityName] = { synced: 0 };
          continue;
        }

        // Upsert into Supabase table (table name = lowercase entity name)
        const tableName = entityName.replace(/([A-Z])/g, (m, l, i) => i === 0 ? l.toLowerCase() : `_${l.toLowerCase()}`);
        const { error } = await supabase
          .from(tableName)
          .upsert(records, { onConflict: 'id' });

        if (error) {
          results[entityName] = { error: error.message };
        } else {
          results[entityName] = { synced: records.length };
        }
      } catch (err) {
        results[entityName] = { error: err.message };
      }
    }

    return Response.json({ success: true, results, synced_at: new Date().toISOString() });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});