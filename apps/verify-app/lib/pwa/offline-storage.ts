import { openDB } from "idb";

const DB_NAME = "0xstack-offline";
const DB_VERSION = 1;

type OfflineDB = {
  "pending-requests": { key: string; value: { id: string; bodyJson: any; createdAt: number } };
};

let dbPromise: ReturnType<typeof openDB<OfflineDB>> | null = null;

function getDb() {
  if (!dbPromise) {
    dbPromise = openDB<OfflineDB>(DB_NAME, DB_VERSION, {
      upgrade(db) {
        db.createObjectStore("pending-requests", { keyPath: "id" });
      },
    });
  }
  return dbPromise;
}

export async function savePendingRequest(bodyJson: any) {
  const db = await getDb();
  await db.put("pending-requests", { id: crypto.randomUUID(), bodyJson, createdAt: Date.now() });
}
