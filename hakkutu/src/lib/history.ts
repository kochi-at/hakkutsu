import { openDB, type DBSchema } from 'idb';
import type { RelicRecord } from '../../shared/schema';

interface RelicDB extends DBSchema {
  relics: { key: string; value: RelicRecord; indexes: { date: string } };
}

function database() {
  return openDB<RelicDB>('relic-bureau', 1, {
    upgrade(db) { db.createObjectStore('relics', { keyPath: 'id' }).createIndex('date', 'createdAt'); },
  });
}

export async function getHistory() {
  const db = await database();
  try { return (await db.getAllFromIndex('relics', 'date')).reverse(); }
  finally { db.close(); }
}
export async function saveRelic(record: RelicRecord) {
  const db = await database();
  try { await db.put('relics', record); }
  finally { db.close(); }
}
export async function deleteRelic(id: string) {
  const db = await database();
  try { await db.delete('relics', id); }
  finally { db.close(); }
}
