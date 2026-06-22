import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const { ticket, toPriority, escalationNote } = await req.json();

    if (!ticket) {
      return Response.json({ error: 'Missing required fields' }, { status: 400 });
    }

    // Generate escalation number: ESC- prefix on the existing ticket number
    const escalationNumber = `ESC-${Date.now()}`;

    // Mark the original Ticket as escalated — it will appear on the Escalations page automatically
    await base44.asServiceRole.entities.Ticket.update(ticket.id, {
      escalated: true,
      priority: toPriority || ticket.priority,
      notes: escalationNote
        ? `[Escalation by ${user.full_name || user.email}]: ${escalationNote}`
        : `Escalated by ${user.full_name || user.email}`,
    });

    // Add a history entry on the ticket
    await base44.asServiceRole.entities.TicketHistory.create({
      ticket_id: ticket.id,
      event_type: 'status_changed',
      description: `Ticket escalated by ${user.full_name || user.email}${escalationNote ? `: ${escalationNote}` : ''}`,
      actor: user.full_name || user.email,
      old_value: 'Not escalated',
      new_value: `Escalated (${escalationNumber})`,
    });

    return Response.json({ success: true, escalationNumber });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});