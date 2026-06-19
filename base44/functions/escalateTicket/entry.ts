import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const { ticket, fromDept, toPriority, escalationNote } = await req.json();

    if (!ticket || !toPriority) {
      return Response.json({ error: 'Missing required fields' }, { status: 400 });
    }

    // Create internal escalation ticket using service role (admin permissions)
    const internalTicket = await base44.asServiceRole.entities.InternalTicket.create({
      env: ticket.env || 'test',
      ticket_number: ticket.ticket_number || `INT-${Date.now()}`,
      from_department: 'CSR',
      to_department: 'TL/Management',
      subject: ticket.subject,
      description: `Escalated ticket: ${ticket.description}${escalationNote ? `\n\nEscalation note: ${escalationNote}` : ''}`,
      created_by_email: user.email,
      created_by_name: user.full_name,
      status: 'Open',
      priority: toPriority,
      escalated: true,
    });

    return Response.json({ success: true, internalTicketId: internalTicket.id });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});