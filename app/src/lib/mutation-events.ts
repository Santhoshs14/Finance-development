"use client";

/**
 * Decouples the API layer from the sync engine: `services/api.ts` announces
 * successful mutations, the sync engine listens. Importing one from the other
 * directly would be circular.
 */
type Listener = (collectionHint: string | null) => void;

const listeners = new Set<Listener>();

export function onMutation(listener: Listener): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function announceMutation(collectionHint: string | null = null): void {
  for (const listener of listeners) listener(collectionHint);
}
