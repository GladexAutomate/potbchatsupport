import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);

    // Delete old escalation tickets that were created by Admin (incorrect state)
    // These should have been created by CSR going to TL/Management
    const oldEscalations = await base44.asServiceRole.entities.InternalTicket.filter({
      from_department: 'Admin',
      escalated: true
    });

    let deleted = 0;
    for (const ticket of oldEscalations || []) {
      await base44.asServiceRole.entities.InternalTicket.delete(ticket.id);
      deleted++;
    }

    return Response.json({ success: true, deleted, message: `Deleted ${deleted} old escalation tickets` });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});