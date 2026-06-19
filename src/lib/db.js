/**
 * Environment-Aware Data Proxy
 * 
 * All Base44 entity calls go through this module.
 * In preview (editor), data is scoped to env='test'.
 * On the published URL, data is scoped to env='prod'.
 * 
 * Usage:
 *   import { db } from '@/lib/db';
 *   db.Ticket.list(...)
 *   db.Ticket.create({ subject: '...' })   // env is auto-injected
 *   db.Ticket.filter({ status: 'Open' })   // env is auto-injected as extra filter
 *   db.Ticket.update(id, data)
 *   db.Ticket.delete(id)
 *   db.Ticket.subscribe(callback)
 */

import { base44 } from '@/api/base44Client';
import { getAppEnv } from '@/lib/appEnv';

const getEnv = () => (getAppEnv() === 'published' ? 'prod' : 'test');

// Cache in-flight requests to prevent duplicate concurrent calls
const inflightRequests = new Map();

/**
 * Builds a proxy for a single entity that transparently injects
 * the current environment into every read/write operation.
 */
function makeEntityProxy(entityName) {
  const entity = base44.entities[entityName];

  return {
    // list — paginates through all pages, then filters client-side by env
    async list(sort, limit) {
      const env = getEnv();
      const cacheKey = `${entityName}:list:${sort || ''}:${limit || '2000'}:${env}`;
      
      // If a request is already in flight, return the same promise
      if (inflightRequests.has(cacheKey)) {
        return inflightRequests.get(cacheKey);
      }
      
      const promise = (async () => {
        const pageSize = 100;
        const maxRecords = limit || 2000;
        let all = [];
        let skip = 0;
        while (all.length < maxRecords) {
          const page = await entity.list(sort, pageSize, skip);
          if (!page || page.length === 0) break;
          all = all.concat(page);
          if (page.length < pageSize) break;
          skip += pageSize;
        }
        return all.filter(r => r.env === env);
      })();
      
      inflightRequests.set(cacheKey, promise);
      
      // Clean up after 5 seconds to allow fresh fetches
      setTimeout(() => inflightRequests.delete(cacheKey), 5000);
      
      return promise;
    },

    // filter — merges env into the query filter
    async filter(query, sort, limit) {
      const env = getEnv();
      const envQuery = { ...(query || {}), env };
      return entity.filter(envQuery, sort, limit);
    },

    // get — direct get by id (no env filter; id is globally unique)
    async get(id) {
      return entity.get ? entity.get(id) : null;
    },

    // create — auto-stamps env onto every new record
    async create(data) {
      const env = getEnv();
      return entity.create({ ...data, env });
    },

    // bulkCreate — stamps env on all records
    async bulkCreate(records) {
      const env = getEnv();
      return entity.bulkCreate(records.map(r => ({ ...r, env })));
    },

    // update — pass-through; env field on existing records stays as-is
    async update(id, data) {
      return entity.update(id, data);
    },

    // delete — pass-through
    async delete(id) {
      return entity.delete(id);
    },

    // subscribe — pass-through; components filter env themselves if needed
    subscribe(callback) {
      return entity.subscribe(callback);
    },

    // schema — pass-through
    schema() {
      return entity.schema ? entity.schema() : null;
    },
  };
}

/**
 * Central db proxy — replace `base44.entities.X` with `db.X` everywhere.
 *
 * Entities NOT proxied (no env isolation needed — they are system-wide config):
 *   - User (built-in, read-only auth entity)
 *   - AppSettings (global config, shared across envs)
 *   - SLAPolicy (global config, shared)
 *   - ChatbotConfig (global config, shared)
 *   - TestAccount (test-only by nature, no env split needed)
 *
 * All operational/transactional entities ARE proxied.
 */
export const db = {
  // Operational entities (env-isolated)
  Ticket:           makeEntityProxy('Ticket'),
  TicketMessage:    makeEntityProxy('TicketMessage'),
  TicketHistory:    makeEntityProxy('TicketHistory'),
  InternalTicket:   makeEntityProxy('InternalTicket'),
  GroupChatMessage: makeEntityProxy('GroupChatMessage'),
  EmployeeAccount:  makeEntityProxy('EmployeeAccount'),
  StaffDirectory:   makeEntityProxy('StaffDirectory'),
  VIPCustomer:      makeEntityProxy('VIPCustomer'),
  StaffRating:      makeEntityProxy('StaffRating'),
  ConversationTag:  makeEntityProxy('ConversationTag'),
  SavedReply:       makeEntityProxy('SavedReply'),
  Permission:       makeEntityProxy('Permission'),

  // Global config entities (pass-through, not env-isolated)
  User:             base44.entities.User,
  AppSettings:      base44.entities.AppSettings,
  SLAPolicy:        base44.entities.SLAPolicy,
  ChatbotConfig:    base44.entities.ChatbotConfig,
  TestAccount:      base44.entities.TestAccount,
};