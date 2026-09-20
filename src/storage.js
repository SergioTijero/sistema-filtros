import { load as loadJsonStore } from '@tauri-apps/plugin-store';
import Database from '@tauri-apps/plugin-sql';

export const STORAGE_KEY = 'filtros-express-v2-data';
export const STORE_PATH = 'filtros_express_pro.json';
export const LEGACY_DB_PATH = 'sqlite:filtros_express_pro.db';
const STORE_DATA_KEY = 'appData';

export const EMPTY_DATA = {
  products: [],
  clients: [],
  specialPrices: [],
};

let jsonStorePromise;
let legacyDatabasePromise;
let storeWriteQueue = Promise.resolve();

export function isTauriRuntime() {
  return typeof window !== 'undefined' && Boolean(window.__TAURI_INTERNALS__?.invoke);
}

export function storageLabel() {
  return isTauriRuntime() ? 'Archivo JSON local' : 'Almacenamiento local';
}

function normalizeData(saved) {
  if (!saved || typeof saved !== 'object') return EMPTY_DATA;
  return {
    products: Array.isArray(saved.products) ? saved.products.map((product) => ({
      code: String(product.code || '').trim().toUpperCase(),
      cost: Number(product.cost) || 0,
      price: Number(product.price) || 0,
      stock: Math.max(0, Math.trunc(Number(product.stock) || 0)),
    })).filter((product) => product.code) : [],
    clients: Array.isArray(saved.clients) ? saved.clients.map((client) => ({
      id: String(client.id || crypto.randomUUID()),
      name: String(client.name || '').trim().toUpperCase(),
    })).filter((client) => client.name) : [],
    specialPrices: Array.isArray(saved.specialPrices) ? saved.specialPrices.map((special) => ({
      clientName: String(special.clientName || '').trim().toUpperCase(),
      productCode: String(special.productCode || '').trim().toUpperCase(),
      price: Number(special.price) || 0,
    })).filter((special) => special.clientName && special.productCode) : [],
  };
}

function parseSnapshot(saved) {
  if (saved?.data && typeof saved.data === 'object') {
    return {
      data: normalizeData(saved.data),
      updatedAt: Number(saved.updatedAt) || 0,
    };
  }
  return { data: normalizeData(saved), updatedAt: 0 };
}

function hasData(data) {
  return Boolean(data.products.length || data.clients.length || data.specialPrices.length);
}

function loadLocalSnapshot() {
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || 'null');
    return parseSnapshot(saved);
  } catch {
    return { data: normalizeData(null), updatedAt: 0 };
  }
}

function saveLocalData(data) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({
      version: 2,
      updatedAt: Date.now(),
      data,
    }));
    return true;
  } catch (error) {
    console.error('No se pudo guardar la copia local del navegador.', error);
    return false;
  }
}

async function getJsonStore() {
  if (!isTauriRuntime()) return null;
  if (!jsonStorePromise) {
    jsonStorePromise = loadJsonStore(STORE_PATH, { autoSave: false }).catch((error) => {
      jsonStorePromise = undefined;
      throw error;
    });
  }
  return jsonStorePromise;
}

async function writeJsonStore(store, data) {
  await store.set(STORE_DATA_KEY, {
    version: 2,
    updatedAt: Date.now(),
    data,
  });
  await store.save();
}

function queueStoreWrite(store, data) {
  const nextWrite = storeWriteQueue
    .catch(() => undefined)
    .then(() => writeJsonStore(store, data));
  storeWriteQueue = nextWrite.catch(() => undefined);
  return nextWrite;
}

// SQLite is only opened when migrating an installation from the first v2
// releases. New installations never read or write the legacy database.
async function getLegacyDatabase() {
  if (!isTauriRuntime()) return null;
  if (!legacyDatabasePromise) {
    legacyDatabasePromise = Database.load(LEGACY_DB_PATH).catch((error) => {
      legacyDatabasePromise = undefined;
      throw error;
    });
  }
  return legacyDatabasePromise;
}

async function readLegacyDatabase() {
  let db;
  try {
    db = await getLegacyDatabase();
    if (!db) return normalizeData(null);

    const tables = await db.select(`
      SELECT name FROM sqlite_master
      WHERE type = 'table'
        AND name IN ('products', 'clients', 'special_prices')
    `);
    const tableNames = new Set((tables || []).map((table) => table.name));
    if (!tableNames.size) return normalizeData(null);

    const [products, clients, specialPrices] = await Promise.all([
      tableNames.has('products') ? db.select('SELECT code, cost, price, stock FROM products ORDER BY code') : [],
      tableNames.has('clients') ? db.select('SELECT id, name FROM clients ORDER BY name') : [],
      tableNames.has('special_prices') ? db.select('SELECT client_name AS clientName, product_code AS productCode, price FROM special_prices ORDER BY client_name, product_code') : [],
    ]);
    return normalizeData({ products, clients, specialPrices });
  } finally {
    if (db) await db.close().catch(() => undefined);
    legacyDatabasePromise = undefined;
  }
}

export async function loadAppData() {
  const localSnapshot = loadLocalSnapshot();
  const localData = localSnapshot.data;
  if (!isTauriRuntime()) return localData;

  try {
    const store = await getJsonStore();
    const saved = await store.get(STORE_DATA_KEY);
    if (saved) {
      const jsonSnapshot = parseSnapshot(saved);
      // localStorage is synchronous, so it may contain a newer change than a
      // JSON store write that was still pending when Windows closed the app.
      if (localSnapshot.updatedAt > jsonSnapshot.updatedAt) {
        await queueStoreWrite(store, localData);
        return localData;
      }
      saveLocalData(jsonSnapshot.data);
      return jsonSnapshot.data;
    }

    // Convert databases created by v2.0.0/v2.0.1 once, then use JSON forever.
    const legacyData = await readLegacyDatabase().catch((error) => {
      console.warn('No se pudo migrar la base anterior; se usará el respaldo local.', error);
      return normalizeData(null);
    });
    if (hasData(legacyData)) {
      saveLocalData(legacyData);
      try {
        await queueStoreWrite(store, legacyData);
      } catch (error) {
        console.warn('No se pudo escribir la migración JSON; se conservará la copia local.', error);
      }
      return legacyData;
    }

    if (hasData(localData)) {
      await queueStoreWrite(store, localData);
      return localData;
    }
    return normalizeData(null);
  } catch (error) {
    console.error('No se pudo abrir el archivo JSON local; se usará la copia local.', error);
    return localData;
  }
}

export async function saveAppData(data) {
  const normalized = normalizeData(data);
  // Keep a synchronous recovery copy before sending the write to Tauri.
  saveLocalData(normalized);
  if (!isTauriRuntime()) return true;

  try {
    const store = await getJsonStore();
    await queueStoreWrite(store, normalized);
    return true;
  } catch (error) {
    console.error('No se pudo guardar el archivo JSON; se conserva una copia local.', error);
    throw error;
  }
}
