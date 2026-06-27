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

    const body = await req.json().catch(() => ({}));
    const isProd = body.env === 'published';
    const supabaseUrl = isProd ? Deno.env.get('SUPABASE_PROD_URL') : Deno.env.get('SUPABASE_URL');
    const supabaseKey = isProd ? Deno.env.get('SUPABASE_PROD_SERVICE_ROLE_KEY') : Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    if (!supabaseUrl || !supabaseKey) {
      return Response.json({ error: 'Missing Supabase secrets for current environment' }, { status: 500 });
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

    const targetEnv = isProd ? 'prod' : 'test';

    // Get existing EmployeeAccount records FOR THIS ENV only — so accounts that exist
    // in another env still get created here.
    const existingAll = await base44.asServiceRole.entities.EmployeeAccount.list('-created_date', 2000);

    // Index existing records by EVERY identifier we might match on.
    // IMPORTANT: email is mutable — if an employee's email changes in Supabase, matching
    // on email alone would treat them as a brand-new person and create a duplicate while
    // the old record keeps the outdated email. So we match on a stable identifier first
    // (airtable_record_id, then employee_code) and only fall back to email.
    const norm = (v) => (v || '').toString().trim().toLowerCase();
    const existingByAid = {};
    const existingByCode = {};
    const existingByEmail = {};
    for (const e of existingAll) {
      if (e.env !== targetEnv) continue;
      const aid = norm(e.airtable_record_id);
      const code = norm(e.employee_code);
      const em = norm(e.email);
      if (aid) existingByAid[aid] = e;
      if (code) existingByCode[code] = e;
      if (em) existingByEmail[em] = e;
    }

    // Resolve an existing record for a Supabase row using stable keys first.
    const findExisting = (d) => {
      const aid = norm(d.airtable_record_id);
      const code = norm(d.employee_code);
      const em = norm(d.email);
      return (aid && existingByAid[aid]) ||
             (code && existingByCode[code]) ||
             (em && existingByEmail[em]) ||
             null;
    };

    let created = 0;
    let updated = 0;

    const toCreate = [];
    const toUpdate = [];

    for (const row of rows) {
      const d = row.data || {};
      const email = d.email?.toLowerCase();
      if (!email) continue;

      const payload = {
        env: targetEnv,
        email: d.email,
        full_name: d.full_name || '',
        status: d.status || 'active',
        employee_code: d.employee_code || '',
        job_title: d.job_title || '',
        generated_password: d.generated_password || '',
        airtable_record_id: d.airtable_record_id || '',
      };

      const existing = findExisting(d);
      if (existing) {
        // Carry the matched record through so the update loop can diff against it and
        // preserve app-managed fields (role/block/access) that Supabase must never overwrite.
        toUpdate.push({ id: existing.id, existing, data: payload });
      } else {
        toCreate.push(payload);
      }
    }

    // Bulk create new records
    if (toCreate.length > 0) {
      await base44.asServiceRole.entities.EmployeeAccount.bulkCreate(toCreate);
      created = toCreate.length;
    }

    // Update existing — skip if no change to avoid rate limits.
    // email is now part of the diff so a changed email actually propagates.
    for (const { id, existing, data } of toUpdate) {
      const hasChange =
        existing.email !== data.email ||
        existing.full_name !== data.full_name ||
        existing.status !== data.status ||
        existing.employee_code !== data.employee_code ||
        existing.job_title !== data.job_title ||
        existing.generated_password !== data.generated_password ||
        existing.airtable_record_id !== data.airtable_record_id;
      if (hasChange) {
        await base44.asServiceRole.entities.EmployeeAccount.update(id, {
          ...data,
          // Preserve app-managed fields — never overwritten by Supabase sync
          POTBChatsupportrole: existing.POTBChatsupportrole ?? null,
          is_blocked: existing.is_blocked ?? false,
          portal_access_granted: existing.portal_access_granted ?? false,
        });
        updated++;
      }
    }

    return Response.json({ success: true, total: rows.length, created, updated });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});