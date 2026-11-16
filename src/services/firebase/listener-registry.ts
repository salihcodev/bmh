type Unsubscribe = () => void;

const active = new Set<Unsubscribe>();

/** Registers an unsubscribe so sign-out can stop every listener, even ones a screen forgot. */
export function trackListener(unsubscribe: Unsubscribe): Unsubscribe {
  let done = false;
  const wrapped = () => {
    if (done) return;
    done = true;
    active.delete(wrapped);
    unsubscribe();
  };
  active.add(wrapped);
  return wrapped;
}

export function unsubscribeAll(): number {
  const all = [...active];
  all.forEach((unsubscribe) => unsubscribe());
  return all.length;
}

export function activeListenerCount(): number {
  return active.size;
}
