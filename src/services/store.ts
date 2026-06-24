import fs from 'fs/promises';
import path from 'path';
import { getFirestore, isFirebaseConfigured } from '../config/firebase';

const DATA_DIR = path.join(process.cwd(), 'data');

async function ensureDataDir() {
  await fs.mkdir(DATA_DIR, { recursive: true });
}

async function readJson<T>(filename: string, defaultVal: T): Promise<T> {
  try {
    const txt = await fs.readFile(path.join(DATA_DIR, filename), 'utf-8');
    return JSON.parse(txt) as T;
  } catch {
    return defaultVal;
  }
}

async function writeJson(filename: string, data: unknown) {
  await ensureDataDir();
  await fs.writeFile(path.join(DATA_DIR, filename), JSON.stringify(data, null, 2), 'utf-8');
}

export async function isSeeded(): Promise<boolean> {
  const db = getFirestore();
  if (isFirebaseConfigured() && db) {
    const snap = await db.collection('system_config').doc('meta').get();
    return snap.exists && snap.data()?.seeded === true;
  }
  const meta = await readJson<{ seeded?: boolean }>('meta.json', {});
  return meta.seeded === true;
}

export async function markSeeded() {
  const db = getFirestore();
  const payload = { seeded: true, seededAt: Date.now() };
  if (isFirebaseConfigured() && db) {
    await db.collection('system_config').doc('meta').set(payload, { merge: true });
    return;
  }
  await writeJson('meta.json', payload);
}

export async function getDocData<T>(collection: string, docId: string, jsonFile: string, defaultVal: T): Promise<T> {
  const db = getFirestore();
  if (isFirebaseConfigured() && db) {
    const snap = await db.collection(collection).doc(docId).get();
    return snap.exists ? (snap.data() as T) : defaultVal;
  }
  return readJson(jsonFile, defaultVal);
}

export async function setDocData(collection: string, docId: string, jsonFile: string, data: unknown) {
  const db = getFirestore();
  if (isFirebaseConfigured() && db) {
    await db.collection(collection).doc(docId).set(data as Record<string, unknown>, { merge: true });
    return;
  }
  await writeJson(jsonFile, data);
}

export async function getCollection<T>(
  firestoreCollection: string,
  jsonFile: string,
  defaultVal: T[] = []
): Promise<T[]> {
  const db = getFirestore();
  if (isFirebaseConfigured() && db) {
    const snap = await db.collection(firestoreCollection).get();
    return snap.docs.map((d) => ({ id: d.id, ...d.data() }) as T);
  }
  return readJson(jsonFile, defaultVal);
}

export async function setCollectionItem<T extends Record<string, unknown>>(
  firestoreCollection: string,
  jsonFile: string,
  id: string,
  item: T
) {
  const db = getFirestore();
  if (isFirebaseConfigured() && db) {
    await db.collection(firestoreCollection).doc(id).set(item, { merge: true });
    return;
  }
  const existing = await readJson<T[]>(jsonFile, []);
  const idx = existing.findIndex((x) => (x as { id?: string }).id === id);
  if (idx !== -1) existing[idx] = { ...existing[idx], ...item, id } as T;
  else existing.push({ ...item, id } as T);
  await writeJson(jsonFile, existing);
}

export async function deleteCollectionItem(firestoreCollection: string, jsonFile: string, id: string) {
  const db = getFirestore();
  if (isFirebaseConfigured() && db) {
    await db.collection(firestoreCollection).doc(id).delete();
    return;
  }
  const existing = await readJson<Array<{ id: string }>>(jsonFile, []);
  await writeJson(jsonFile, existing.filter((x) => x.id !== id));
}

export async function replaceCollection<T>(firestoreCollection: string, jsonFile: string, items: T[], idField: string) {
  const db = getFirestore();
  if (isFirebaseConfigured() && db) {
    const batch = db.batch();
    const snap = await db.collection(firestoreCollection).get();
    snap.docs.forEach((d) => batch.delete(d.ref));
    items.forEach((item) => {
      const id = String((item as Record<string, unknown>)[idField]);
      batch.set(db.collection(firestoreCollection).doc(id), item as Record<string, unknown>);
    });
    await batch.commit();
    return;
  }
  await writeJson(jsonFile, items);
}
