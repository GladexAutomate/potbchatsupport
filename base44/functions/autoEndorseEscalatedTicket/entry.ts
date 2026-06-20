import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const payload = await req.json();
    const ticket = payload.data || payload;
    const event = payload.event || {};

    // Only create message on initial create, not on updates
    if (!ticket || !ticket.escalated || event.type !== 'create') {
      return Response.json({ success: true });
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
        is_vip: ticket.is_vip || false,
      },
      reactions: {},
    });

    return Response.json({ success: true });
  } catch (error) {
    console.error('Error auto-endorsing escalated ticket:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});