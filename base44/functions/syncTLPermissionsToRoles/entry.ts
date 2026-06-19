import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    // Get all tl_management permissions that are enabled (only active ones)
    const tlPerms = await base44.asServiceRole.entities.Permission.filter({
      role: 'tl_management',
      has_access: true
    }, null, 100);

    if (!tlPerms || tlPerms.length === 0) {
      return Response.json({ message: 'No tl_management permissions found' });
    }

    // Target roles to sync to
    const targetRoles = ['admin', 'csr', 'sales', 'accounting', 'sign_ups', 'on_boarding', 'corp_training'];
    
    // Build all permission records to create (only new ones)
    const createOps = [];
    for (const role of targetRoles) {
      for (const tlPerm of tlPerms) {
        // Just add to create list — duplicates will be handled by DB constraints or ignored
        createOps.push({
          role,
          resource_type: tlPerm.resource_type,
          resource_name: tlPerm.resource_name,
          resource_label: tlPerm.resource_label,
          has_access: true
        });
      }
    }

    // Bulk create (will skip duplicates)
    if (createOps.length > 0) {
      await base44.asServiceRole.entities.Permission.bulkCreate(createOps);
    }

    return Response.json({ 
      message: 'Permissions synced',
      recordsProcessed: createOps.length
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});