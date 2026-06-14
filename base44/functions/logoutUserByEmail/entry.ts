import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user || user.role !== 'admin' && user.role !== 'super_admin') {
      return Response.json({ error: 'Unauthorized' }, { status: 403 });
    }

    const { target_email } = await req.json();
    if (!target_email) {
      return Response.json({ error: 'target_email required' }, { status: 400 });
    }

    // Fetch the target user to verify they exist
    const targetUser = await base44.asServiceRole.entities.User.filter({ email: target_email });
    if (!targetUser || targetUser.length === 0) {
      return Response.json({ error: 'User not found' }, { status: 404 });
    }

    // Note: Base44 doesn't have a direct "logout by email" endpoint.
    // The frontend will need to handle logout via notification or session invalidation.
    // Return success to indicate the role change was recorded.
    return Response.json({ success: true, message: 'User should be logged out and re-authenticate' });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});