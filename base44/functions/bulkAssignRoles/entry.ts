import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

const suggestRole = (jobTitle) => {
  if (!jobTitle) return null;
  const t = jobTitle.toUpperCase();
  if (t.includes('ACCOUNTING') || t.includes('ACCOUNTS PAYABLE') || t.includes('ACCOUNTS RECEIVABLE') || t.includes('FINANCE') || t.includes('AUDIT')) return 'accounting';
  if (t.includes('TRAVEL CONSULTANT') || t.includes('SALES') || t.includes('BUSINESS DEVELOPMENT') || t.includes('PRODUCT DEV') || t.includes('FACEBOOK ADS')) return 'sales';
  if (t.includes('TRAINING') || t.includes('TRAINOR') || t.includes('CORPORATE') || t.includes('COACH') || t.includes('HR LEARNING') || t.includes('LEARNING AND DEV')) return 'corp_training';
  if (t.includes('SIGN UP') || t.includes('SIGNUP') || t.includes('ONBOARD') || t.includes('ON-BOARD')) return 'sign_ups';
  if (t.includes('TEAM LEADER') || t.includes('TEAM LEAD') || t.includes('MANAGER') || t.includes('SUPERVISOR') || t.includes('CHIEF') || t.includes('LEAD COACH') || t.includes('OPERATION')) return 'tl_management';
  if (t.includes('ADMIN') || t.includes('EXECUTIVE ASSISTANT') || t.includes('EXECUTIVE SECRETARY') || t.includes('HR') || t.includes('EMPLOYEE EXPERIENCE')) return 'admin';
  if (t.includes('CUSTOMER') || t.includes('CSR') || t.includes('SUPPORT') || t.includes('RESPONSE AGENT') || t.includes('REPRESENTATIVE')) return 'csr';
  if (t.includes('TECH') || t.includes('ENGINEER') || t.includes('DEVELOPER') || t.includes('PROGRAMMER') || t.includes('COMPUTER') || t.includes('GRAPHIC') || t.includes('MULTI MEDIA') || t.includes('CONTENT')) return 'csr';
  return null;
};

const sleep = (ms) => new Promise(r => setTimeout(r, ms));

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user || user.role !== 'admin') return Response.json({ error: 'Unauthorized' }, { status: 403 });

    const payload = await req.json().catch(() => ({}));
    const emps = await base44.asServiceRole.entities.EmployeeAccount.list('-created_date', 500);

    // Clear roles from Non-POTB employees without portal access
    if (payload.clear_non_potb) {
      const toClear = emps.filter(e =>
        e.current_role &&
        !e.employee_code?.toUpperCase().startsWith('POTB') &&
        !e.portal_access_granted
      );
      let cleared = 0;
      for (const emp of toClear) {
        await base44.asServiceRole.entities.EmployeeAccount.update(emp.id, { current_role: null });
        cleared++;
        await sleep(300);
      }
      return Response.json({ success: true, cleared, total: toClear.length });
    }

    const toUpdate = emps.filter(e =>
      !e.current_role &&
      e.status === 'active' &&
      !e.is_blocked &&
      e.email?.toLowerCase() !== 'automate@gladextours.com' &&
      e.employee_code?.toUpperCase().startsWith('POTB')
    );

    let updated = 0;
    let skipped = 0;

    for (const emp of toUpdate) {
      const role = suggestRole(emp.job_title);
      if (role) {
        await base44.asServiceRole.entities.EmployeeAccount.update(emp.id, { current_role: role });
        updated++;
      } else {
        skipped++;
      }
      await sleep(100);
    }

    return Response.json({ success: true, updated, skipped, total: toUpdate.length });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});