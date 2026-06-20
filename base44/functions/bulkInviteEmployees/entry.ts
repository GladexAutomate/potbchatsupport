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

    const targetEnv = 'test'; // always test for now

    // Get all active employees from EmployeeAccount
    const employees = await base44.asServiceRole.entities.EmployeeAccount.filter(
      { status: 'active', env: targetEnv },
      'email',
      2000
    );

    // Get all Base44 users
    const allUsers = await base44.asServiceRole.entities.User.list('email', 2000);
    const usersByEmail = {};
    for (const u of allUsers) {
      usersByEmail[u.email?.toLowerCase()] = true;
    }

    const toInvite = employees.filter(emp => !usersByEmail[emp.email?.toLowerCase()]);
    
    let invited = 0;
    let failed = 0;

    // Batch invite with 1s delay between each to avoid rate limit
    for (const emp of toInvite) {
      try {
        await base44.users.inviteUser(emp.email, 'user');
        invited++;
      } catch (err) {
        console.log(`Failed to invite ${emp.email}:`, err.message);
        failed++;
      }
      // Delay 1 second between invites to avoid rate limit
      await new Promise(resolve => setTimeout(resolve, 1000));
    }

    return Response.json({ success: true, total: toInvite.length, invited, failed });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});