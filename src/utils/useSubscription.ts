import { useEffect, useState } from 'react';

import type { Unsubscribe } from '@/services/notesService';

export interface StreamState<T> {
  data: T | undefined;
  error: Error | null;
  waiting: boolean;
}

/// Subscribes to a Firestore listener on mount / when `deps` change and
/// unsubscribes on cleanup. While a new subscription hasn't delivered
/// yet, `waiting` is true and the previous `data` is kept.
export function useSubscription<T>(
  subscribe: (onData: (value: T) => void, onError: (e: Error) => void) => Unsubscribe,
  deps: readonly (string | number | boolean | null | undefined)[],
): StreamState<T> {
  const key = JSON.stringify(deps);
  const [state, setState] = useState<{ key: string | null; data?: T; error: Error | null }>({
    key: null,
    error: null,
  });

  useEffect(
    () =>
      subscribe(
        (data) => setState({ key, data, error: null }),
        (error) => setState({ key, data: undefined, error }),
      ),
    // `subscribe` is an inline closure; `key` captures everything it reads.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [key],
  );

  const current = state.key === key;
  return { data: state.data, error: current ? state.error : null, waiting: !current };
}
