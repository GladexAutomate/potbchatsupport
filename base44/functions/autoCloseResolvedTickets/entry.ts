import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

Deno.serve(async (req) => {
  const base44 = createClientFromRequest(req);

  // Find tickets with resolution_requested_at set and status still "Pending Resolution"
  const tickets = await base44.asServiceRole.entities.Ticket.filter({ status: 'Pending Resolution' });

  // Read configurable auto-close delay from AppSettings
  const settings = await base44.asServiceRole.entities.AppSettings.filter({ key: 'resolution_auto_close_minutes' });
  const configMinutes = settings?.[0]?.value ? parseFloat(settings[0].value) : 3;
  const now = Date.now();
  const AUTO_CLOSE_MS = configMinutes * 60 * 1000;

  for (const ticket of tickets || []) {
    if (!ticket.resolution_requested_at) continue;
    const requestedAt = new Date(ticket.resolution_requested_at).getTime();
    if (now - requestedAt >= AUTO_CLOSE_MS) {
      // Auto-close: stop active SLA entry
      const log = [...(ticket.dept_sla_log || [])];
      const activeIdx = log.findIndex(e => e.grade === 'Active');
      if (activeIdx !== -1) {
        const active = log[activeIdx];
        const elapsed = Math.round((now - new Date(active.started_at).getTime()) / 60000);
        log[activeIdx] = { ...active, stopped_at: new Date().toISOString(), elapsed_minutes: elapsed, grade: 'Met' };
      }

      await base44.asServiceRole.entities.Ticket.update(ticket.id, {
        status: 'Closed',
        resolved_at: new Date().toISOString(),
        dept_sla_log: log,
      });

      // Send auto-close system message to customer chat
      await base44.asServiceRole.entities.TicketMessage.create({
        ticket_id: ticket.id,
        sender_email: 'system',
        sender_name: 'System',
        sender_role: 'staff',
        message: '🔒 This ticket has been automatically closed due to no response. If you have other concerns, please submit a new ticket.',
        is_internal: false,
        message_type: 'system_auto_close',
        attachments: [],
      });

      await base44.asServiceRole.entities.TicketHistory.create({
        ticket_id: ticket.id,
        event_type: 'status_changed',
        description: 'Ticket auto-closed due to no customer response after 3 minutes.',
        actor: 'System',
        old_value: 'Pending Resolution',
        new_value: 'Closed',
      });
    }
  }

  return Response.json({ processed: tickets?.length || 0 });
});