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

    const targetEnv = 'test';

    // Get all employees (active + inactive) from EmployeeAccount
    const employees = await base44.asServiceRole.entities.EmployeeAccount.filter(
      { env: targetEnv },
      'email',
      2000
    );

    // Get existing StaffDirectory records
    const staffDirRecords = await base44.asServiceRole.entities.StaffDirectory.list('-created_date', 2000);
    const staffByEmail = {};
    for (const s of staffDirRecords) {
      if (s.env !== targetEnv) continue;
      staffByEmail[s.email?.toLowerCase()] = s;
    }

    // Get all Base44 users
    const allUsers = await base44.asServiceRole.entities.User.list('email', 2000);
    const usersByEmail = {};
    for (const u of allUsers) {
      usersByEmail[u.email?.toLowerCase()] = u.id;
    }

    let invited = 0;
    let created = 0;
    let updated = 0;

    for (const emp of employees) {
      const email = emp.email?.toLowerCase();
      if (!email) continue;

      // Step 1: Invite to Base44 if not already a user (1s delay between invites)
      let userId = usersByEmail[email];
      if (!userId) {
        try {
          await base44.users.inviteUser(emp.email, 'user');
          invited++;
          // After invite, fetch the new user
          const newUsers = await base44.asServiceRole.entities.User.list('email', 100);
          userId = newUsers.find(u => u.email?.toLowerCase() === email)?.id;
        } catch (inviteErr) {
          console.log(`Skip invite ${email}:`, inviteErr.message);
        }
        // Delay 1s to avoid rate limit
        await new Promise(resolve => setTimeout(resolve, 1000));
      }

      // Step 2: Sync to StaffDirectory
      const staffRecord = staffByEmail[email];
      const payload = {
        env: targetEnv,
        email: emp.email,
        full_name: emp.full_name || '',
        employee_code: emp.employee_code || '',
        job_title: emp.job_title || '',
        status: emp.status || 'active',
        airtable_record_id: emp.airtable_record_id || '',
        user_id: userId || null,
        current_role: emp.POTBChatsupportrole || null,
      };

      // Block if status is inactive
      const shouldBlock = emp.status === 'inactive';

      if (staffRecord) {
        // Update (block if inactive, otherwise preserve is_blocked)
        await base44.asServiceRole.entities.StaffDirectory.update(staffRecord.id, {
          ...payload,
          is_blocked: shouldBlock ? true : (staffRecord.is_blocked ?? false),
          portal_access_granted: staffRecord.portal_access_granted ?? false,
        });
        updated++;
      } else {
        // Create (block if inactive)
        await base44.asServiceRole.entities.StaffDirectory.create({
          ...payload,
          is_blocked: shouldBlock,
          portal_access_granted: !shouldBlock,
          is_potb: false,
        });
        created++;
      }
    }

    return Response.json({ success: true, invited, created, updated, total: employees.length });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});