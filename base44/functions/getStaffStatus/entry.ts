import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

// Normalizes whatever the caller sends ('preview' | 'published' | 'test' | 'prod')
// into the stored env value. Unknown / missing → null (no env preference).
function resolvePreferredEnv(raw) {
  if (raw === 'test' || raw === 'preview') return 'test';
  if (raw === 'prod' || raw === 'published') return 'prod';
  return null;
}

// Picks the single most-usable record for a person out of all their matches across
// both environments. Source of truth = User Management, so we want the record that
// actually grants access: prefer the caller's env, then a non-blocked / active /
// role-bearing record. This makes login work regardless of which env (test/prod)
// the admin happened to save the role under.
function pickBest(matches, preferredEnv) {
  if (!matches.length) return null;
  // Access-granting fields must outrank env preference: a usable (unblocked,
  // active, role-bearing) record in EITHER env must win over a blocked/inactive
  // record that merely matches the caller's env. Env is only a final tiebreaker.
  const score = (e) =>
    (!e.is_blocked ? 8 : 0) +
    (e.status === 'active' ? 4 : 0) +
    (e.POTBChatsupportrole || e.current_role ? 2 : 0) +
    (preferredEnv && e.env === preferredEnv ? 1 : 0);
  return [...matches].sort((a, b) => score(b) - score(a))[0];
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const emailLower = user.email?.toLowerCase()?.trim();
    if (!emailLower) return Response.json({ error: 'No email found' }, { status: 400 });

    // Caller tells us which env it's running in so we can prefer that record when a
    // person exists in both. We still fall back to the other env so a role saved in
    // only one env still resolves.
    const body = await req.json().catch(() => ({}));
    const preferredEnv = resolvePreferredEnv(body?.env);

    // EmployeeAccount first — search BOTH envs, not just 'test'.
    const [empTest, empProd] = await Promise.all([
      base44.asServiceRole.entities.EmployeeAccount.filter({ env: 'test' }, 'email', 1000),
      base44.asServiceRole.entities.EmployeeAccount.filter({ env: 'prod' }, 'email', 1000),
    ]);
    const empMatches = [...(empTest || []), ...(empProd || [])].filter(
      (e) => e.email?.toLowerCase()?.trim() === emailLower
    );
    const employee = pickBest(empMatches, preferredEnv);
    if (employee) {
      // Return blocked/inactive records too (don't hide them) so callers can enforce
      // the right message instead of silently treating the user as "not staff".
      return Response.json({
        employee: { ...employee, resolved_role: employee.POTBChatsupportrole || null },
        source: 'EmployeeAccount',
      });
    }

    // Fall back to StaffDirectory — also across both envs.
    const [staffTest, staffProd] = await Promise.all([
      base44.asServiceRole.entities.StaffDirectory.filter({ env: 'test' }, 'email', 1000),
      base44.asServiceRole.entities.StaffDirectory.filter({ env: 'prod' }, 'email', 1000),
    ]);
    const staffMatches = [...(staffTest || []), ...(staffProd || [])].filter(
      (s) => s.email?.toLowerCase()?.trim() === emailLower
    );
    const staff = pickBest(staffMatches, preferredEnv);
    if (staff) {
      return Response.json({
        employee: { ...staff, resolved_role: staff.current_role || null },
        source: 'StaffDirectory',
      });
    }

    return Response.json({ employee: null, source: null });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});
