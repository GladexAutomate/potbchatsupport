import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const emailLower = user.email?.toLowerCase()?.trim();
    if (!emailLower) return Response.json({ error: 'No email found' }, { status: 400 });

    // Check EmployeeAccount first
    const empAccount = await base44.asServiceRole.entities.EmployeeAccount.filter(
      { env: 'test' },
      'email',
      1000
    );
    const employee = empAccount?.find(e => e.email?.toLowerCase()?.trim() === emailLower && !e.is_blocked);
    if (employee) {
      return Response.json({ employee, source: 'EmployeeAccount' });
    }

    // Check StaffDirectory
    const staffDir = await base44.asServiceRole.entities.StaffDirectory.filter(
      { env: 'test' },
      'email',
      1000
    );
    const staff = staffDir?.find(s => s.email?.toLowerCase()?.trim() === emailLower && !s.is_blocked);
    if (staff) {
      return Response.json({ employee: staff, source: 'StaffDirectory' });
    }

    return Response.json({ employee: null, source: null });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});