import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);

    let isAuthorized = false;
    try {
      const user = await base44.auth.me();
      if (user?.role === 'admin') isAuthorized = true;
    } catch {
      isAuthorized = true; // scheduled/automation calls
    }
    if (!isAuthorized) return Response.json({ error: 'Forbidden' }, { status: 403 });

    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    if (!supabaseUrl || !supabaseKey) {
      return Response.json({ error: 'Missing Supabase secrets' }, { status: 500 });
    }

    // Fetch all from Supabase employeeaccount table
    const res = await fetch(`${supabaseUrl}/rest/v1/employeeaccount?limit=1000`, {
      headers: {
        'Authorization': `Bearer ${supabaseKey}`,
        'apikey': supabaseKey,
      }
    });
    if (!res.ok) {
      const text = await res.text();
      return Response.json({ error: `Supabase error: ${text}` }, { status: 500 });
    }
    const rows = await res.json();

    // Get existing EmployeeAccount records to find which to update vs create
    const existing = await base44.asServiceRole.entities.EmployeeAccount.list('-created_date', 1000);
    const existingByEmail = {};
    for (const e of existing) {
      existingByEmail[e.email?.toLowerCase()] = e;
    }

    let created = 0;
    let updated = 0;

    const toCreate = [];
    const toUpdate = [];

    for (const row of rows) {
      const d = row.data || {};
      const email = d.email?.toLowerCase();
      if (!email) continue;

      const payload = {
        email: d.email,
        full_name: d.full_name || '',
        status: d.status || 'active',
        employee_code: d.employee_code || '',
        job_title: d.job_title || '',
        generated_password: d.generated_password || '',
        airtable_record_id: d.airtable_record_id || '',
      };

      if (existingByEmail[email]) {
        // Preserve app-managed fields that should never be overwritten by Supabase sync
        const existing = existingByEmail[email];
        toUpdate.push({
          id: existing.id,
          ...payload,
          current_role: existing.current_role ?? null,
          is_blocked: existing.is_blocked ?? false,
          portal_access_granted: existing.portal_access_granted ?? false,
        });
      } else {
        toCreate.push(payload);
      }
    }

    // Bulk create new records
    if (toCreate.length > 0) {
      await base44.asServiceRole.entities.EmployeeAccount.bulkCreate(toCreate);
      created = toCreate.length;
    }

    // Update existing — skip if no change to avoid rate limits
    for (const rec of toUpdate) {
      const { id, ...data } = rec;
      const existing = existingByEmail[data.email?.toLowerCase()];
      const hasChange = !existing ||
        existing.full_name !== data.full_name ||
        existing.status !== data.status ||
        existing.employee_code !== data.employee_code ||
        existing.job_title !== data.job_title ||
        existing.generated_password !== data.generated_password;
      if (hasChange) {
        // Only update Supabase-sourced fields; never overwrite app-managed ones
        const { current_role, is_blocked, portal_access_granted, ...supabaseFields } = data;
        await base44.asServiceRole.entities.EmployeeAccount.update(id, supabaseFields);
        updated++;
      }
    }

    return Response.json({ success: true, total: rows.length, created, updated });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});