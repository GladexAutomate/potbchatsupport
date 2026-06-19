import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const payload = await req.json();
    const ticket = payload.data || payload;

    if (!ticket) {
      return Response.json({ error: 'Missing ticket data' }, { status: 400 });
    }

    // Create group chat endorsement message for internal escalated ticket
    await base44.asServiceRole.entities.GroupChatMessage.create({
      env: ticket.env || 'test',
      sender_email: 'system@potb.com',
      sender_name: '🚨 Escalation Alert',
      message: `🚨 **Escalated** Internal Ticket #${ticket.ticket_number} from ${ticket.from_department} to TL/Management needs immediate attention!`,
      message_type: 'ticket_endorsement',
      ticket_ref: {
        ticket_id: ticket.id,
        ticket_number: ticket.ticket_number || '',
        subject: ticket.subject,
        status: ticket.status || 'Open',
        priority: ticket.priority || 'High',
        department: ticket.to_department || 'TL/Management',
      },
      reactions: {},
    });

    return Response.json({ success: true });
  } catch (error) {
    console.error('Error auto-endorsing escalated internal ticket:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});