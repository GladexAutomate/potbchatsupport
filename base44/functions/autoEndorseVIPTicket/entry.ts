// DISABLED to prevent DUPLICATE VIP group-chat cards.
//
// `onNewTicket` is the single source of truth for the VIP endorsement: on a new
// ticket it independently detects VIP status, auto-escalates to Critical, logs
// history, AND posts the VIP card to Group Chat. This function used to post a
// SECOND, near-identical card for the same ticket, which is the duplicate the
// staff were seeing. It is now a no-op. (Kept as a registered no-op rather than
// deleted so any existing Base44 automation still resolves cleanly.)

Deno.serve(async (_req) => {
  return Response.json({ ok: true, skipped: 'disabled — onNewTicket posts the VIP endorsement' });
});