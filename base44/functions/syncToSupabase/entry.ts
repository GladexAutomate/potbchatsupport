import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

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

// Convert CamelCase to snake_case for Supabase table names
function toSnakeCase(str) {
  return str
    .replace(/([A-Z]+)([A-Z][a-z])/g, '$1_$2')
    .replace(/([a-z\d])([A-Z])/g, '$1_$2')
    .toLowerCase();
}

async function upsertToSupabase(supabaseUrl, supabaseKey, tableName, records) {
  const res = await fetch(`${supabaseUrl}/rest/v1/${tableName}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${supabaseKey}`,
      'apikey': supabaseKey,
      'Prefer': 'resolution=merge-duplicates,return=minimal',
    },
    body: JSON.stringify(records),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Supabase error (${res.status}): ${text}`);
  }
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);

    // Allow both admin calls and scheduled automation calls
    let isAuthorized = false;
    try {
      const user = await base44.auth.me();
      if (user?.role === 'admin') isAuthorized = true;
    } catch {
      isAuthorized = true;
    }

    if (!isAuthorized) {
      return Response.json({ error: 'Forbidden' }, { status: 403 });
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

    console.log('SUPABASE_URL set:', supabaseUrl ? 'YES' : 'NO');
    console.log('SUPABASE_KEY set:', supabaseKey ? 'YES' : 'NO');

    if (!supabaseUrl || !supabaseKey) {
      return Response.json({ error: 'Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY secrets' }, { status: 500 });
    }

    const results = {};

    for (const entityName of ENTITIES_TO_SYNC) {
      try {
        const records = await base44.asServiceRole.entities[entityName].list('-updated_date', 1000);
        if (!records || records.length === 0) {
          results[entityName] = { synced: 0 };
          continue;
        }

        const tableName = toSnakeCase(entityName);
        // Strip Base44 internal fields not present in Supabase schema
        const INTERNAL_FIELDS = ['created_by_id', 'is_sample', '_metadata', '__v'];
        const stripped = records.map(r => {
          const out = { ...r };
          INTERNAL_FIELDS.forEach(f => delete out[f]);
          return out;
        });
        // Normalize: all records must have the same keys (PGRST102 fix)
        const allKeys = [...new Set(stripped.flatMap(r => Object.keys(r)))];
        const cleaned = stripped.map(r => {
          const out = {};
          allKeys.forEach(k => { out[k] = r[k] !== undefined ? r[k] : null; });
          return out;
        });
        await upsertToSupabase(supabaseUrl, supabaseKey, tableName, cleaned);
        results[entityName] = { synced: records.length };
      } catch (err) {
        results[entityName] = { error: err.message };
      }
    }

    return Response.json({ success: true, results, synced_at: new Date().toISOString() });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});