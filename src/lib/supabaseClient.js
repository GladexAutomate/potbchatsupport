/**
 * Frontend Supabase client — used ONLY for real-time change notifications on the
 * employee records table. It is NOT the source of truth the UI renders: employee
 * data still flows Supabase → (syncEmployeeAccounts edge fn) → Base44 EmployeeAccount,
 * because app-managed fields (role / blocked / portal access) live in Base44.
 *
 * The URL + publishable key below are public, anon-equivalent values and are safe to
 * ship in the client bundle. The publishable key can only do what RLS grants the anon
 * role (here: read `employeeaccount`), which is exactly what Realtime postgres_changes
 * needs to stream row changes to the browser.
 *
 * NOTE: for the live stream to actually deliver events, the `employeeaccount` table
 * must be added to the `supabase_realtime` publication (see Realtime setup notes).
 * If it isn't, the subscription stays silent and UserManagement falls back to polling.
 */
import { createClient } from '@supabase/supabase-js';

export const SUPABASE_URL = 'https://wuymgnqpkgxxxghvgcbq.supabase.co';
export const SUPABASE_PUBLISHABLE_KEY = 'sb_publishable_R5jGhsaREPJ427X1bRnpog_Iz7odR95';

/** The Supabase table that mirrors employee records. */
export const EMPLOYEE_TABLE = 'employeeaccount';

export const supabase = createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
  // No user auth session needed — this client only listens for table changes.
  auth: { persistSession: false, autoRefreshToken: false },
  // Cap event rate so a bulk import can't flood the browser; the consumer debounces anyway.
  realtime: { params: { eventsPerSecond: 5 } },
});

/**
 * Reads a single employee's LIVE status straight from Supabase, bypassing Base44.
 * Used by auth enforcement so an account flipped to `inactive` kicks the user even
 * if the Base44 sync hasn't run yet. Matches on stable keys first (airtable_record_id,
 * employee_code) and falls back to email, since those are what the synced record carries.
 *
 * @returns {Promise<string|null>} lowercased status (e.g. 'active' | 'inactive'), or
 *   null if the row can't be found / the lookup fails (caller should fall back to Base44).
 */
export async function fetchLiveEmployeeStatus({ airtable_record_id, employee_code, email } = {}) {
  const attempts = [];
  if (airtable_record_id) attempts.push(['data->>airtable_record_id', airtable_record_id]);
  if (employee_code) attempts.push(['data->>employee_code', employee_code]);
  if (email) attempts.push(['data->>email', email]);

  for (const [column, value] of attempts) {
    try {
      const { data, error } = await supabase
        .from(EMPLOYEE_TABLE)
        .select('data')
        .eq(column, value)
        .limit(1);
      if (!error && data && data.length > 0) {
        return (data[0]?.data?.status || '').toString().trim().toLowerCase();
      }
    } catch {
      // Try the next key; on total failure the caller falls back to the Base44 record.
    }
  }
  return null;
}
