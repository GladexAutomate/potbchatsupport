import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const payload = await req.json();

    // Entity automation payload: { event, data }
    const ticket = payload.data || payload.ticket;

    if (!ticket) {
      return Response.json({ ok: true, skipped: 'no ticket data' });
    }

    // Only endorse if this is actually a VIP ticket
    if (!ticket.is_vip) {
      return Response.json({ ok: true, skipped: 'not a VIP ticket' });
    }

    await base44.asServiceRole.entities.GroupChatMessage.create({
      env: ticket.env || 'test',
      sender_email: 'system@potb.com',
      sender_name: '⭐ VIP Alert',
      message: `⭐ **VIP Customer** "${ticket.customer_name}" (${ticket.customer_email}) submitted a ticket. Please prioritize!`,
      message_type: 'ticket_endorsement',
      ticket_ref: {
        ticket_id: ticket.id,
        ticket_number: ticket.ticket_number || '',
        subject: ticket.subject,
        status: ticket.status || 'Open',
        priority: ticket.priority || 'Critical',
        department: ticket.department || '',
        customer_name: ticket.customer_name,
        customer_email: ticket.customer_email || '',
        is_vip: true,
      },
      reactions: {},
    });

    return Response.json({ success: true });
  } catch (error) {
    console.error('Error auto-endorsing VIP ticket:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});