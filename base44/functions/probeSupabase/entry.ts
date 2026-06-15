import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

    const { table } = await req.json().catch(() => ({ table: 'EmployeeAccount' }));

    const res = await fetch(`${supabaseUrl}/rest/v1/${table}?limit=10`, {
      headers: {
        'Authorization': `Bearer ${supabaseKey}`,
        'apikey': supabaseKey,
      }
    });

    const data = await res.json();
    return Response.json({ status: res.status, rows: data });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});