export interface AuthoringUndoHistory<T> {
  recordBeforeProgrammaticChange(snapshot: T): void;
  undoProgrammaticChange(): T | undefined;
  clear(): void;
  invalidate(): void;
  hasPendingSnapshot(): boolean;
}

const cloneSnapshot = <T,>(snapshot: T): T => {
  if (typeof structuredClone === 'function') {
    return structuredClone(snapshot);
  }

  if (Array.isArray(snapshot)) {
    return snapshot.map((item) => cloneSnapshot(item)) as T;
  }

  if (snapshot && typeof snapshot === 'object') {
    const cloned = {} as Record<string, unknown>;
    for (const [key, value] of Object.entries(snapshot)) {
      cloned[key] = cloneSnapshot(value);
    }
    return cloned as T;
  }

  return snapshot;
};

export function createAuthoringUndoHistory<T>(maxSnapshots = 10): AuthoringUndoHistory<T> {
  const limit = Math.max(1, Math.floor(maxSnapshots));
  const snapshots: T[] = [];

  return {
    recordBeforeProgrammaticChange(snapshot) {
      snapshots.push(cloneSnapshot(snapshot));
      if (snapshots.length > limit) {
        snapshots.splice(0, snapshots.length - limit);
      }
    },
    undoProgrammaticChange() {
      const snapshot = snapshots.pop();
      return snapshot === undefined ? undefined : cloneSnapshot(snapshot);
    },
    clear() {
      snapshots.length = 0;
    },
    invalidate() {
      snapshots.length = 0;
    },
    hasPendingSnapshot() {
      return snapshots.length > 0;
    }
  };
}

export const createAuthoringUndo = createAuthoringUndoHistory;
