import { doc, runTransaction } from "firebase/firestore";
import { db } from "@/lib/firebase";

/**
 * Atomically increments a named counter under counters/{name} and returns the new value.
 * Using a transaction (instead of getCountFromServer().count + 1, which two simultaneous
 * submits can both read as the same value) guarantees every invoice/receipt/customer number
 * is unique even under concurrent use by multiple staff members.
 */
export async function nextSequence(counterName: string): Promise<number> {
  const ref = doc(db, "counters", counterName);
  const next = await runTransaction(db, async (tx) => {
    const snap = await tx.get(ref);
    const current = snap.exists() ? (snap.data().value as number) ?? 0 : 0;
    const value = current + 1;
    tx.set(ref, { value }, { merge: true });
    return value;
  });
  return next;
}

export function formatSequence(prefix: string, value: number, padding = 4): string {
  return `${prefix}${String(value).padStart(padding, "0")}`;
}
