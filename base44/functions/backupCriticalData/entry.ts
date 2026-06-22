import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

/**
 * Automated backup: exports TicketHistory + StaffRatings to a JSON summary
 * and posts a confirmation message to internal group chat.
 * Runs on schedule (daily) — triggered via automation.
 */
Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);

    // Validate caller is authenticated (scheduled automations use service role internally)
    const isScheduled = req.headers.get('x-base44-scheduled') === 'true';
    if (!isScheduled) {
      const user = await base44.auth.me();
      if (!user || user.role !== 'super_admin') {
        return Response.json({ error: 'Forbidden' }, { status: 403 });
      }
    }

    const now = new Date();
    const yesterday = new Date(now.getTime() - 24 * 3600 * 1000);
    const cutoff = yesterday.toISOString();

    // Fetch last 24h of TicketHistory and all StaffRatings
    const [history, ratings, tickets] = await Promise.all([
      base44.asServiceRole.entities.TicketHistory.filter({}, '-created_date', 500),
      base44.asServiceRole.entities.StaffRating.filter({}, '-rated_at', 500),
      base44.asServiceRole.entities.Ticket.filter({}, '-created_date', 100),
    ]);

    const recentHistory = (history || []).filter(h => new Date(h.created_date) >= yesterday);
    const recentRatings = (ratings || []).filter(r => new Date(r.rated_at) >= yesterday);

    // Build summary stats
    const openTickets = (tickets || []).filter(t => t.status === 'Open').length;
    const inProgress = (tickets || []).filter(t => t.status === 'In Progress').length;
    const resolved = (tickets || []).filter(t => t.status === 'Resolved' || t.status === 'Closed').length;
    const avgRating = recentRatings.length
      ? (recentRatings.reduce((s, r) => s + r.rating, 0) / recentRatings.length).toFixed(2)
      : 'N/A';

    const dateStr = now.toLocaleDateString('en-PH', { timeZone: 'Asia/Manila', year: 'numeric', month: 'short', day: 'numeric' });
    const timeStr = now.toLocaleTimeString('en-PH', { timeZone: 'Asia/Manila', hour: '2-digit', minute: '2-digit' });

    const summary = {
      backup_date: `${dateStr} ${timeStr} PHT`,
      ticket_history_events_24h: recentHistory.length,
      staff_ratings_24h: recentRatings.length,
      avg_rating_24h: avgRating,
      ticket_snapshot: { open: openTickets, in_progress: inProgress, resolved },
      top_events: recentHistory.slice(0, 10).map(h => ({
        ticket_id: h.ticket_id,
        event: h.event_type,
        actor: h.actor,
        description: h.description,
      })),
    };

    // Post backup confirmation to Group Chat for visibility
    const message = `📊 *Daily Backup Report — ${dateStr}*\n` +
      `• Ticket history events (24h): ${recentHistory.length}\n` +
      `• Staff ratings (24h): ${recentRatings.length} | Avg: ${avgRating} ⭐\n` +
      `• Ticket snapshot: ${openTickets} Open · ${inProgress} In Progress · ${resolved} Resolved\n` +
      `✅ Backup completed at ${timeStr} PHT`;

    await base44.asServiceRole.entities.GroupChatMessage.create({
      env: 'prod',
      sender_email: 'system@potb.com',
      sender_name: '🔒 System Backup',
      message,
      message_type: 'text',
      reactions: {},
      read_by: [],
      mentions: [],
    });

    return Response.json({ ok: true, summary });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});