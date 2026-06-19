import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const { ticket } = await req.json();

    if (!ticket) {
      return Response.json({ error: 'Missing ticket data' }, { status: 400 });
    }

    // Create group chat endorsement message
    await base44.asServiceRole.entities.GroupChatMessage.create({
      env: ticket.env || 'test',
      sender_email: 'system@potb.com',
      sender_name: '🚨 Escalation Alert',
      message: `🚨 **Escalated** Ticket #${ticket.ticket_number} from "${ticket.customer_name}" needs immediate attention!`,
      message_type: 'ticket_endorsement',
      ticket_ref: {
        ticket_id: ticket.id,
        ticket_number: ticket.ticket_number || '',
        subject: ticket.subject,
        status: ticket.status || 'Open',
        priority: ticket.priority || 'High',
        department: ticket.department || '',
        customer_name: ticket.customer_name,
      },
      reactions: {},
    });

    return Response.json({ success: true });
  } catch (error) {
    console.error('Error auto-endorsing escalated ticket:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});