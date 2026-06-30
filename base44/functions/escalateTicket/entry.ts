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

    // Post the escalation notice to the staff Group Chat. We do this HERE rather than
    // relying on the autoEndorseEscalatedTicket trigger, because that trigger only fires
    // on ticket CREATE — but escalation is an UPDATE of an existing ticket, so it never
    // posted. Guard on the ticket not already being escalated so a re-escalation can't
    // post a duplicate card.
    if (!ticket.escalated) {
      const escalatedPriority = toPriority || ticket.priority || 'High';
      await base44.asServiceRole.entities.GroupChatMessage.create({
        env: ticket.env || 'prod',
        sender_email: 'system@potb.com',
        sender_name: '🚨 Escalation Alert',
        message: `🚨 **Escalated** Ticket #${ticket.ticket_number} from "${ticket.customer_name}" needs immediate attention!${escalationNote ? `\nNote: ${escalationNote}` : ''}`,
        message_type: 'ticket_endorsement',
        ticket_ref: {
          ticket_id: ticket.id,
          ticket_number: ticket.ticket_number || '',
          subject: ticket.subject,
          status: ticket.status || 'Open',
          priority: escalatedPriority,
          department: ticket.department || '',
          customer_name: ticket.customer_name,
          is_vip: ticket.is_vip || false,
        },
        reactions: {},
      });
    }

    return Response.json({ success: true, escalationNumber });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});