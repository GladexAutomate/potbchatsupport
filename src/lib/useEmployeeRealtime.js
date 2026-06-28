import { useEffect, useRef, useState } from 'react';
import { supabase, EMPLOYEE_TABLE } from '@/lib/supabaseClient';

/**
 * Subscribes to live INSERT/UPDATE/DELETE on the Supabase `employeeaccount` table
 * and invokes `onChange` (debounced) whenever a row changes — so the caller can pull
 * the change into Base44 and refresh the UI. This turns the 5-minute polling sync into
 * an event-driven, near-real-time one.
 *
 * Returns the connection status so the UI can show a live indicator:
 *   'connecting' | 'live' | 'error'
 *
 * @param {() => void} onChange  Called after a change is detected (debounced).
 * @param {{ debounceMs?: number, enabled?: boolean }} [opts]
 */
export function useEmployeeRealtime(onChange, { debounceMs = 1500, enabled = true } = {}) {
  const [status, setStatus] = useState('connecting');

  // Keep the latest callback without re-subscribing on every render.
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;
  const debounceTimer = useRef(null);

  useEffect(() => {
    if (!enabled) return undefined;

    const fire = () => {
      clearTimeout(debounceTimer.current);
      // Coalesce a burst of row changes (e.g. a bulk import) into a single sync.
      debounceTimer.current = setTimeout(() => onChangeRef.current?.(), debounceMs);
    };

    const channel = supabase
      .channel('employeeaccount-changes')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: EMPLOYEE_TABLE },
        fire
      )
      .subscribe((channelStatus) => {
        if (channelStatus === 'SUBSCRIBED') setStatus('live');
        else if (channelStatus === 'CHANNEL_ERROR' || channelStatus === 'TIMED_OUT') setStatus('error');
        else if (channelStatus === 'CLOSED') setStatus('connecting');
      });

    return () => {
      clearTimeout(debounceTimer.current);
      supabase.removeChannel(channel);
    };
  }, [debounceMs, enabled]);

  return status;
}
