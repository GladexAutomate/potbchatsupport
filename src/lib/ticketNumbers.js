/**
 * Single source of truth for ticket numbering.
 *
 * Format (used everywhere): PREFIX-00000001 — a zero-padded, 8-digit sequential
 * number. Customer tickets use `TKT-`, internal tickets use `INT-`.
 *
 * Why one helper:
 *  - Previously two formats coexisted (sequential vs `PREFIX-YYYYMMDD-<random>`),
 *    and `parseInt` on the date format corrupted the sequence (e.g. it jumped to
 *    20260631). A STRICT regex below ignores any non-conforming legacy number, so
 *    a stray old-format value can never poison the running max.
 *  - A uniqueness re-check loop closes most of the concurrent-submit race window.
 */

import { db } from '@/lib/db';

// Strict: PREFIX + exactly 8 digits. Legacy/date-format numbers won't match and
// are therefore ignored when computing the next sequential value.
function nextSequential(prefix, records) {
  const re = new RegExp(`^${prefix}-(\\d{8})$`);
  const nums = (records || [])
    .map(t => {
      const m = t.ticket_number?.match(re);
      return m ? parseInt(m[1], 10) : NaN;
    })
    .filter(n => !Number.isNaN(n));
  return nums.length ? Math.max(...nums) + 1 : 1;
}

async function generateUniqueNumber(entity, prefix) {
  const recent = await entity.list('-created_date', 200);
  let n = nextSequential(prefix, recent);
  // Verify the candidate is free; bump on clash to absorb concurrent submits.
  for (let attempt = 0; attempt < 5; attempt++) {
    const candidate = `${prefix}-${String(n).padStart(8, '0')}`;
    const clash = await entity.filter({ ticket_number: candidate }, undefined, 1);
    if (!clash || clash.length === 0) return candidate;
    n += 1;
  }
  return `${prefix}-${String(n).padStart(8, '0')}`;
}

export const generateCustomerTicketNumber = () => generateUniqueNumber(db.Ticket, 'TKT');
export const generateInternalTicketNumber = () => generateUniqueNumber(db.InternalTicket, 'INT');
