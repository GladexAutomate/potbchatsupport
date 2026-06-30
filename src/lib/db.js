/**
 * Central Data Proxy
 *
 * All Base44 entity calls go through this module. The app runs as a SINGLE
 * environment — there is no test/prod split. The proxy exists to:
 *   - de-duplicate concurrent identical reads (in-flight request cache)
 *   - give every entity a uniform list/filter/get/create/update/delete surface
 *
 * Usage:
 *   import { db } from '@/lib/db';
 *   db.Ticket.list('-created_date', 100)
 *   db.Ticket.filter({ status: 'Open' })
 *   db.Ticket.create({ subject: '...' })
 *   db.Ticket.update(id, data)
 *   db.Ticket.delete(id)
 *   db.Ticket.subscribe(callback)
 */

import { base44 } from '@/api/base44Client';

// Cache in-flight requests to de-duplicate identical concurrent reads.
const inflightRequests = new Map();

/**
 * Runs `factory` (a function returning a promise) but shares the in-flight
 * promise across identical concurrent callers. Successful results are held for
 * a short window to absorb bursts; FAILURES are evicted immediately so the very
 * next caller can retry instead of inheriting the same rejected promise.
 */
function dedupe(cacheKey, factory) {
  if (inflightRequests.has(cacheKey)) return inflightRequests.get(cacheKey);
  const promise = factory();
  inflightRequests.set(cacheKey, promise);
  promise.then(
    () => setTimeout(() => inflightRequests.delete(cacheKey), 5000),
    () => inflightRequests.delete(cacheKey),
  );
  return promise;
}

/**
 * Builds a uniform proxy for a single entity.
 */
function makeEntityProxy(entityName) {
  const entity = base44.entities[entityName];

  return {
    // list — native server-side list with sort/limit/skip. Single env: no
    // client-side filtering, so the returned count always matches `limit`.
    async list(sort, limit, skip) {
      const resolvedLimit = limit || 100;
      const resolvedSkip = skip || 0;
      const cacheKey = `${entityName}:list:${sort || ''}:${resolvedLimit}:${resolvedSkip}`;
      return dedupe(cacheKey, () =>
        entity.list(sort, resolvedLimit, resolvedSkip).then(page => page || []),
      );
    },

    // filter — native server-side filter.
    async filter(query, sort, limit) {
      const q = query || {};
      const cacheKey = `${entityName}:filter:${JSON.stringify(q)}:${sort || ''}:${limit || ''}`;
      return dedupe(cacheKey, () => entity.filter(q, sort, limit).then(rows => rows || []));
    },

    // get — direct get by id.
    async get(id) {
      return entity.get ? entity.get(id) : null;
    },

    // create — single env: every record is stamped 'prod' so server-side
    // functions that still query by env keep finding new records. Reads never
    // filter by env, so test/prod legacy data all surfaces as one pool.
    async create(data) {
      return entity.create({ env: 'prod', ...data });
    },

    // bulkCreate
    async bulkCreate(records) {
      return entity.bulkCreate(records.map(r => ({ env: 'prod', ...r })));
    },

    // update
    async update(id, data) {
      return entity.update(id, data);
    },

    // delete
    async delete(id) {
      return entity.delete(id);
    },

    // subscribe — pass-through.
    subscribe(callback) {
      return entity.subscribe(callback);
    },

    // schema — pass-through.
    schema() {
      return entity.schema ? entity.schema() : null;
    },
  };
}

/**
 * Central db proxy — use `db.X` instead of `base44.entities.X` everywhere.
 */
 export const db = {
   Ticket:           makeEntityProxy('Ticket'),
   TicketMessage:    makeEntityProxy('TicketMessage'),
   TicketHistory:    makeEntityProxy('TicketHistory'),
   InternalTicket:   makeEntityProxy('InternalTicket'),
   InternalTicketMessage: makeEntityProxy('InternalTicketMessage'),
   InternalTicketHistory: makeEntityProxy('InternalTicketHistory'),
   GroupChatMessage: makeEntityProxy('GroupChatMessage'),
   EmployeeAccount:  makeEntityProxy('EmployeeAccount'),
   StaffDirectory:   makeEntityProxy('StaffDirectory'),
   VIPCustomer:      makeEntityProxy('VIPCustomer'),
   StaffRating:      makeEntityProxy('StaffRating'),
   ConversationTag:  makeEntityProxy('ConversationTag'),
   SavedReply:       makeEntityProxy('SavedReply'),
   Permission:       makeEntityProxy('Permission'),

   Notification:     base44.entities.Notification,

   User:             base44.entities.User,
   AppSettings:      base44.entities.AppSettings,
   SLAPolicy:        base44.entities.SLAPolicy,
   ChatbotConfig:    base44.entities.ChatbotConfig,
   TestAccount:      base44.entities.TestAccount,
 };
