/**
 * Helpers for optimistic chat messages (row-based threads).
 *
 * When a user sends a message we insert an "optimistic" copy (tagged `_optimistic`
 * with a temporary id) so the sender sees it instantly, before the network write.
 * The real row then arrives via reload / poll / websocket. These helpers reconcile
 * the two so the optimistic copy:
 *   - stays visible until its real row actually shows up (no flicker / no vanishing
 *     on a stale read), and
 *   - is dropped the moment the real row appears (no duplicate).
 */

/** Two messages are "the same" if same sender + text + attachments. */
export function sameContent(a, b) {
  return a.sender_email === b.sender_email
    && (a.message || '') === (b.message || '')
    && JSON.stringify(a.attachments || []) === JSON.stringify(b.attachments || []);
}

/**
 * Merge a fresh server list with any still-unconfirmed optimistic messages from the
 * previous state. Returns the server list plus optimistic messages that the server
 * hasn't echoed back yet, sorted by created_date.
 */
export function mergeOptimistic(serverMsgs, prevMsgs) {
  const server = serverMsgs || [];
  const pending = (prevMsgs || []).filter(m => m._optimistic && !server.some(s => sameContent(s, m)));
  if (!pending.length) return server;
  return [...server, ...pending].sort((a, b) => new Date(a.created_date) - new Date(b.created_date));
}
