const DATABASE_NAME = "hakkutsu-relic-book";
const DATABASE_VERSION = 1;
const STORE_NAME = "relics";

function openDatabase() {
  return new Promise((resolve, reject) => {
    if (!("indexedDB" in window)) {
      reject(new Error("このブラウザは図鑑の保存に対応していません。"));
      return;
    }

    const request = window.indexedDB.open(DATABASE_NAME, DATABASE_VERSION);

    request.onupgradeneeded = () => {
      const database = request.result;
      if (!database.objectStoreNames.contains(STORE_NAME)) {
        const store = database.createObjectStore(STORE_NAME, { keyPath: "id" });
        store.createIndex("createdAt", "createdAt");
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error("図鑑を開けませんでした。"));
  });
}

function createId() {
  return globalThis.crypto?.randomUUID?.()
    ?? `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

export async function saveRelic({ photo, evaluation }) {
  const database = await openDatabase();
  const relic = {
    id: createId(),
    photo,
    evaluation,
    createdAt: Date.now(),
  };

  return new Promise((resolve, reject) => {
    const transaction = database.transaction(STORE_NAME, "readwrite");
    transaction.objectStore(STORE_NAME).put(relic);
    transaction.oncomplete = () => {
      database.close();
      resolve(relic);
    };
    transaction.onerror = () => {
      database.close();
      reject(transaction.error ?? new Error("鑑定結果を保存できませんでした。"));
    };
  });
}

export async function getRelics() {
  const database = await openDatabase();

  return new Promise((resolve, reject) => {
    const request = database.transaction(STORE_NAME, "readonly")
      .objectStore(STORE_NAME)
      .getAll();
    request.onsuccess = () => {
      database.close();
      resolve(request.result.sort((a, b) => b.createdAt - a.createdAt));
    };
    request.onerror = () => {
      database.close();
      reject(request.error ?? new Error("図鑑を読み込めませんでした。"));
    };
  });
}

export async function deleteRelic(id) {
  const database = await openDatabase();

  return new Promise((resolve, reject) => {
    const transaction = database.transaction(STORE_NAME, "readwrite");
    transaction.objectStore(STORE_NAME).delete(id);
    transaction.oncomplete = () => {
      database.close();
      resolve();
    };
    transaction.onerror = () => {
      database.close();
      reject(transaction.error ?? new Error("図鑑から削除できませんでした。"));
    };
  });
}
