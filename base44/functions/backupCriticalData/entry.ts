import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

/**
 * APP-WIDE TIMEZONE RULE (server side):
 *  - STORE every timestamp as a UTC instant via `new Date().toISOString()`.
 *  - When formatting a timestamp for HUMANS (notes, messages, labels), always
 *    render it in APP_TIMEZONE (Philippines). Never emit a server-formatted local
 *    time in any other zone. The frontend mirrors this via src/lib/timezone.js.
 */
export const APP_TIMEZONE = 'Asia/Manila';

// Format a UTC instant as a Philippine-time display string, e.g. "Jun 30, 2026 02:22 PM PHT".
export function formatManila(date = new Date()) {
  const d = date instanceof Date ? date : new Date(date);
  const dateStr = d.toLocaleDateString('en-PH', { timeZone: APP_TIMEZONE, year: 'numeric', month: 'short', day: 'numeric' });
  const timeStr = d.toLocaleTimeString('en-PH', { timeZone: APP_TIMEZONE, hour: '2-digit', minute: '2-digit' });
  return `${dateStr} ${timeStr} PHT`;
}

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

    const summary = {
      backup_date: formatManila(now),
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