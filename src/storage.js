import Database from '@tauri-apps/plugin-sql';

export const STORAGE_KEY = 'filtros-express-v2-data';
export const DB_PATH = 'sqlite:filtros_express_pro.db';

export const EMPTY_DATA = {
  products: [],
  clients: [],
  specialPrices: [],
};

let databasePromise;
let databaseWriteQueue = Promise.resolve();

export function isTauriRuntime() {
  return typeof window !== 'undefined' && Boolean(window.__TAURI_INTERNALS__?.invoke);
}

export function storageLabel() {
  return isTauriRuntime() ? 'SQLite local' : 'Almacenamiento local';
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

function loadLocalSnapshot() {
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || 'null');
    // v2.0.0 stored the data object directly. Accept that format while
    // upgrading future writes to a timestamped recovery snapshot.
    if (saved?.data && typeof saved.data === 'object') {
      return {
        data: normalizeData(saved.data),
        updatedAt: Number(saved.updatedAt) || 0,
      };
    }
    return { data: normalizeData(saved), updatedAt: 0 };
  } catch {
    return { data: normalizeData(null), updatedAt: 0 };
  }
}

function loadLocalData() {
  return loadLocalSnapshot().data;
}

function saveLocalData(data) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({
      version: 1,
      updatedAt: Date.now(),
      data,
    }));
    return true;
  } catch (error) {
    console.error('No se pudo guardar la copia local del navegador.', error);
    return false;
  }
}

async function getDatabase() {
  if (!isTauriRuntime()) return null;
  if (!databasePromise) {
    databasePromise = Database.load(DB_PATH).then(async (db) => {
      // Keep one compact JSON snapshot as the source of truth. This avoids
      // partial writes when the app is closed while several rows are updated.
      await db.execute(`
        CREATE TABLE IF NOT EXISTS app_state (
          id INTEGER PRIMARY KEY NOT NULL,
          payload TEXT NOT NULL,
          updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
        )
      `);
      await db.execute(`
        CREATE TABLE IF NOT EXISTS products (
          code TEXT PRIMARY KEY NOT NULL,
          cost REAL NOT NULL DEFAULT 0,
          price REAL NOT NULL DEFAULT 0,
          stock INTEGER NOT NULL DEFAULT 0
        )
      `);
      await db.execute(`
        CREATE TABLE IF NOT EXISTS clients (
          id TEXT PRIMARY KEY NOT NULL,
          name TEXT NOT NULL UNIQUE
        )
      `);
      await db.execute(`
        CREATE TABLE IF NOT EXISTS special_prices (
          client_name TEXT NOT NULL,
          product_code TEXT NOT NULL,
          price REAL NOT NULL DEFAULT 0,
          PRIMARY KEY (client_name, product_code)
        )
      `);
      return db;
    }).catch((error) => {
      // A failed connection must not poison all future retries in this run.
      databasePromise = undefined;
      throw error;
    });
  }
  return databasePromise;
}

async function writeDatabase(db, data) {
  await db.execute(`
    INSERT INTO app_state (id, payload, updated_at)
    VALUES (1, $1, CURRENT_TIMESTAMP)
    ON CONFLICT(id) DO UPDATE SET
      payload = excluded.payload,
      updated_at = excluded.updated_at
  `, [JSON.stringify({ version: 1, updatedAt: Date.now(), data })]);
}

function queueDatabaseWrite(db, data) {
  const nextWrite = databaseWriteQueue
    .catch(() => undefined)
    .then(() => writeDatabase(db, data));
  databaseWriteQueue = nextWrite.catch(() => undefined);
  return nextWrite;
}

function hasData(data) {
  return data.products.length || data.clients.length || data.specialPrices.length;
}

async function readLegacyTables(db) {
  const [products, clients, specialPrices] = await Promise.all([
    db.select('SELECT code, cost, price, stock FROM products ORDER BY code'),
    db.select('SELECT id, name FROM clients ORDER BY name'),
    db.select('SELECT client_name AS clientName, product_code AS productCode, price FROM special_prices ORDER BY client_name, product_code'),
  ]);
  return normalizeData({ products, clients, specialPrices });
}

export async function loadAppData() {
  const localSnapshot = loadLocalSnapshot();
  const localData = localSnapshot.data;
  try {
    const db = await getDatabase();
    if (!db) return localData;

    const stateRows = await db.select('SELECT payload FROM app_state WHERE id = $1', [1]);
    const payload = stateRows?.[0]?.payload;
    if (payload) {
      try {
        const saved = JSON.parse(payload);
        const databaseSnapshot = saved?.data && typeof saved.data === 'object'
          ? { data: normalizeData(saved.data), updatedAt: Number(saved.updatedAt) || 0 }
          : { data: normalizeData(saved), updatedAt: 0 };
        // The local snapshot is synchronous, so it can be newer than a
        // SQLite write that was still queued when Windows closed the app.
        if (localSnapshot.updatedAt > databaseSnapshot.updatedAt) {
          await queueDatabaseWrite(db, localData);
          return localData;
        }
        const databaseData = databaseSnapshot.data;
        saveLocalData(databaseData);
        return databaseData;
      } catch (error) {
        console.warn('La copia SQLite no tiene un formato válido; se revisarán las tablas anteriores.', error);
      }
    }

    // Migrate databases created by the first v2 build, which stored each
    // collection in a separate table.
    const legacyData = await readLegacyTables(db);
    if (hasData(legacyData)) {
      await queueDatabaseWrite(db, legacyData);
      saveLocalData(legacyData);
      return legacyData;
    }

    if (hasData(localData)) {
      await queueDatabaseWrite(db, localData);
      return localData;
    }
    return legacyData;
  } catch (error) {
    // SQLite can be temporarily unavailable after an installer update or when
    // a profile is not writable. The local snapshot keeps the user's work.
    console.error('No se pudo abrir SQLite; se usará la copia local.', error);
    return localData;
  }
}

export async function saveAppData(data) {
  const normalized = normalizeData(data);
  // Always write the browser/WebView snapshot first. It is the recovery copy
  // if SQLite is locked, unavailable, or the process closes during a write.
  saveLocalData(normalized);
  if (!isTauriRuntime()) return true;
  try {
    const db = await getDatabase();
    if (!db) return true;
    await queueDatabaseWrite(db, normalized);
    return true;
  } catch (error) {
    console.error('No se pudo guardar en SQLite; se conserva una copia local.', error);
    throw error;
  }
}
