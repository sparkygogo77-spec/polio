"use client";
/**
 * THE REFERENCE RECORDS A SITE KEEPS, in IndexedDB by the site's id, as the
 * Builds cards keep their pictures: a photograph is too big for the Builds
 * list, whose write failing would lose a site's name. Removing the site
 * removes them.
 */
import { withRecord, type ReferenceRecord } from "./model";

const DB = "builder.references";
const SHELF = "records";

function shelf(mode: IDBTransactionMode): Promise<IDBObjectStore> {
  return new Promise((done, no) => {
    if (typeof indexedDB === "undefined") return no(new Error("No storage in this browser."));
    const req = indexedDB.open(DB, 1);
    req.onupgradeneeded = () => { if (!req.result.objectStoreNames.contains(SHELF)) req.result.createObjectStore(SHELF); };
    req.onerror = () => no(req.error ?? new Error("No storage in this browser."));
    req.onsuccess = () => done(req.result.transaction(SHELF, mode).objectStore(SHELF));
  });
}

/** What this site keeps, newest first; nothing when storage is off. */
export async function readRecords(project: string): Promise<ReferenceRecord[]> {
  try {
    const s = await shelf("readonly");
    return await new Promise((done) => {
      const r = s.get(project);
      r.onsuccess = () => done(Array.isArray(r.result) ? (r.result as ReferenceRecord[]) : []);
      r.onerror = () => done([]);
    });
  } catch {
    return [];
  }
}

/** Kept with the site. A browser that refuses still has the record for this ask. */
export async function keepRecord(project: string, rec: ReferenceRecord): Promise<void> {
  const list = await readRecords(project);
  try {
    (await shelf("readwrite")).put(withRecord(list, rec), project);
  } catch { /* see above */ }
}

export async function dropRecords(project: string): Promise<void> {
  try {
    (await shelf("readwrite")).delete(project);
  } catch { /* nothing kept */ }
}
