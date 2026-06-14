import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user || user.role !== 'super_admin') return Response.json({ error: 'Unauthorized' }, { status: 401 });
    
    const { email } = await req.json();
    if (!email) return Response.json({ error: 'Email required' }, { status: 400 });
    
    const users = await base44.asServiceRole.entities.User.filter({ email });
    if (!users || users.length === 0) return Response.json({ error: 'User not found' }, { status: 404 });
    
    const targetUser = users[0];
    await base44.asServiceRole.entities.User.update(targetUser.id, { role: 'super_admin' });
    
    return Response.json({ success: true, message: `${targetUser.full_name} is now Super Admin` });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});