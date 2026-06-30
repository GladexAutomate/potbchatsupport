import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const payload = await req.json();
    const { data: ticket } = payload;

    if (!ticket) {
      return Response.json({ ok: true, skipped: 'no ticket data' });
    }

    // Single env: stamp new records 'prod'.
    const env = ticket.env || 'prod';

    // Check if customer is VIP. Don't scope by env (single data pool) and also honor
    // an is_vip flag the client already set, so VIP detection can't be missed.
    const vips = await base44.asServiceRole.entities.VIPCustomer.filter({ email: ticket.customer_email }, 'created_date', 5);
    const isVIP = ticket.is_vip === true || (vips && vips.length > 0);

    if (isVIP) {
      // 1. Auto-escalate to Critical and mark as VIP
      await base44.asServiceRole.entities.Ticket.update(ticket.id, { priority: 'Critical', is_vip: true });

      // 2. Post Group Chat alert as ticket_endorsement so staff can click "Open Ticket"
      await base44.asServiceRole.entities.GroupChatMessage.create({
        env,
        sender_email: 'system@potb.com',
        sender_name: '⭐ VIP Alert',
        message: `⭐ VIP Customer **${ticket.customer_name}** (${ticket.customer_email}) just opened a new ticket! Please prioritize this ticket promptly.`,
        message_type: 'ticket_endorsement',
        ticket_ref: {
          ticket_id: ticket.id,
          ticket_number: ticket.ticket_number || '',
          subject: ticket.subject,
          status: ticket.status || 'Open',
          priority: 'Critical',
          department: ticket.department || '',
          customer_name: ticket.customer_name,
          is_vip: true,
        },
      });

      // 3. Log to ticket history
      await base44.asServiceRole.entities.TicketHistory.create({
        env,
        ticket_id: ticket.id,
        event_type: 'priority_changed',
        description: 'Priority auto-escalated to Critical — VIP Customer',
        actor: 'System',
        old_value: ticket.priority || 'Medium',
        new_value: 'Critical',
      });
    }

    return Response.json({ ok: true, isVIP });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});