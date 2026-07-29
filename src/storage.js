import Database from '@tauri-apps/plugin-sql';

export const STORAGE_KEY = 'filtros-express-v2-data';
export const DB_PATH = 'sqlite:filtros_express_pro.db';

export const EMPTY_DATA = {
  products: [],
  clients: [],
  specialPrices: [],
};

let databasePromise;

export function isTauriRuntime() {
  return Boolean(window.__TAURI_INTERNALS__);
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

function loadLocalData() {
  try {
    return normalizeData(JSON.parse(localStorage.getItem(STORAGE_KEY) || 'null'));
  } catch {
    return EMPTY_DATA;
  }
}

function saveLocalData(data) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
}

async function getDatabase() {
  if (!isTauriRuntime()) return null;
  if (!databasePromise) {
    databasePromise = Database.load(DB_PATH).then(async (db) => {
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
    });
  }
  return databasePromise;
}

async function writeDatabase(db, data) {
  await db.execute('BEGIN TRANSACTION');
  try {
    await db.execute('DELETE FROM special_prices');
    await db.execute('DELETE FROM clients');
    await db.execute('DELETE FROM products');
    for (const product of data.products) {
      await db.execute('INSERT INTO products (code, cost, price, stock) VALUES (?, ?, ?, ?)', [product.code, product.cost, product.price, product.stock]);
    }
    for (const client of data.clients) {
      await db.execute('INSERT INTO clients (id, name) VALUES (?, ?)', [client.id, client.name]);
    }
    for (const special of data.specialPrices) {
      await db.execute('INSERT INTO special_prices (client_name, product_code, price) VALUES (?, ?, ?)', [special.clientName, special.productCode, special.price]);
    }
    await db.execute('COMMIT');
  } catch (error) {
    await db.execute('ROLLBACK');
    throw error;
  }
}

export async function loadAppData() {
  const db = await getDatabase();
  if (!db) return loadLocalData();

  const [products, clients, specialPrices] = await Promise.all([
    db.select('SELECT code, cost, price, stock FROM products ORDER BY code'),
    db.select('SELECT id, name FROM clients ORDER BY name'),
    db.select('SELECT client_name AS clientName, product_code AS productCode, price FROM special_prices ORDER BY client_name, product_code'),
  ]);
  const databaseData = normalizeData({ products, clients, specialPrices });
  const localData = loadLocalData();
  if (!databaseData.products.length && !databaseData.clients.length && !databaseData.specialPrices.length && (localData.products.length || localData.clients.length || localData.specialPrices.length)) {
    await writeDatabase(db, localData);
    return localData;
  }
  return databaseData;
}

export async function saveAppData(data) {
  const normalized = normalizeData(data);
  const db = await getDatabase();
  if (!db) {
    saveLocalData(normalized);
    return;
  }
  try {
    await writeDatabase(db, normalized);
  } catch (error) {
    console.error('No se pudo guardar en SQLite; se conserva una copia local.', error);
    saveLocalData(normalized);
    throw error;
  }
}
