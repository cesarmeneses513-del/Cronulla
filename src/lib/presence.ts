import { useEffect, useState } from 'react';
import type { RealtimeChannel } from '@supabase/supabase-js';
import { supabase } from './supabase';
import type { Profile } from './auth';

// Who has the app open right now (Supabase Realtime presence), plus "last seen" kept in the
// profile (supabase/team-presence.sql). Signed-in accounts join; the Users panel listens.
let channel: RealtimeChannel | null = null;
let online = new Set<string>();
const listeners = new Set<(ids: Set<string>) => void>();
const notify = () => listeners.forEach(l => l(new Set(online)));

const touchLastSeen = () => {
  supabase?.rpc('touch_last_seen').then(
    () => {},
    () => {}
  );
};

export function joinPresence(profile: Profile): () => void {
  if (!supabase) return () => {};
  leavePresence();
  channel = supabase.channel('online-users', { config: { presence: { key: profile.id } } });
  channel
    .on('presence', { event: 'sync' }, () => {
      online = new Set(Object.keys(channel?.presenceState() || {}));
      notify();
    })
    .subscribe(status => {
      if (status === 'SUBSCRIBED') channel?.track({ name: profile.name, role: profile.role });
    });
  touchLastSeen();
  const timer = window.setInterval(touchLastSeen, 5 * 60 * 1000);
  const onVisible = () => document.visibilityState === 'visible' && touchLastSeen();
  document.addEventListener('visibilitychange', onVisible);
  return () => {
    window.clearInterval(timer);
    document.removeEventListener('visibilitychange', onVisible);
    leavePresence();
  };
}

function leavePresence() {
  if (channel && supabase) supabase.removeChannel(channel);
  channel = null;
  online = new Set();
  notify();
}

// Ids of the accounts that have the app open now.
export function useOnlineIds(): Set<string> {
  const [ids, setIds] = useState(() => new Set(online));
  useEffect(() => {
    listeners.add(setIds);
    setIds(new Set(online));
    return () => {
      listeners.delete(setIds);
    };
  }, []);
  return ids;
}
