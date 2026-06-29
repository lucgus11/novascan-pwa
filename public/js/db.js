/**
 * NovaScan — Gestionnaire IndexedDB
 * Stockage persistant des produits scannés
 */

'use strict';

const NovaDatabaseDB = (() => {
  const DB_NAME = 'novascan-db';
  const DB_VERSION = 1;
  const STORE_PRODUCTS = 'products';
  const STORE_SETTINGS = 'settings';

  let db = null;

  /** Ouvre / initialise la base de données */
  function open() {
    return new Promise((resolve, reject) => {
      if (db) return resolve(db);

      const request = indexedDB.open(DB_NAME, DB_VERSION);

      request.onupgradeneeded = (event) => {
        const database = event.target.result;

        // Store produits
        if (!database.objectStoreNames.contains(STORE_PRODUCTS)) {
          const store = database.createObjectStore(STORE_PRODUCTS, {
            keyPath: 'id',
            autoIncrement: true,
          });
          store.createIndex('savedAt', 'savedAt', { unique: false });
          store.createIndex('novaClass', 'novaClass', { unique: false });
          store.createIndex('score', 'score', { unique: false });
        }

        // Store paramètres (clé API, préférences)
        if (!database.objectStoreNames.contains(STORE_SETTINGS)) {
          database.createObjectStore(STORE_SETTINGS, { keyPath: 'key' });
        }
      };

      request.onsuccess = (event) => {
        db = event.target.result;
        resolve(db);
      };

      request.onerror = () => reject(request.error);
    });
  }

  /** Sauvegarde un produit */
  async function saveProduct(productData) {
    const database = await open();
    return new Promise((resolve, reject) => {
      const tx = database.transaction(STORE_PRODUCTS, 'readwrite');
      const store = tx.objectStore(STORE_PRODUCTS);

      const record = {
        ...productData,
        savedAt: new Date().toISOString(),
        savedAtTs: Date.now(),
      };

      const request = store.add(record);
      request.onsuccess = () => resolve({ ...record, id: request.result });
      request.onerror = () => reject(request.error);
    });
  }

  /** Met à jour un produit existant */
  async function updateProduct(id, updates) {
    const database = await open();
    return new Promise((resolve, reject) => {
      const tx = database.transaction(STORE_PRODUCTS, 'readwrite');
      const store = tx.objectStore(STORE_PRODUCTS);

      const getReq = store.get(id);
      getReq.onsuccess = () => {
        const existing = getReq.result;
        if (!existing) return reject(new Error('Produit introuvable'));

        const updated = { ...existing, ...updates, updatedAt: new Date().toISOString() };
        const putReq = store.put(updated);
        putReq.onsuccess = () => resolve(updated);
        putReq.onerror = () => reject(putReq.error);
      };
      getReq.onerror = () => reject(getReq.error);
    });
  }

  /** Récupère tous les produits (ordre anti-chronologique) */
  async function getAllProducts() {
    const database = await open();
    return new Promise((resolve, reject) => {
      const tx = database.transaction(STORE_PRODUCTS, 'readonly');
      const store = tx.objectStore(STORE_PRODUCTS);
      const request = store.getAll();
      request.onsuccess = () => {
        const sorted = (request.result || []).sort((a, b) => b.savedAtTs - a.savedAtTs);
        resolve(sorted);
      };
      request.onerror = () => reject(request.error);
    });
  }

  /** Récupère un produit par ID */
  async function getProduct(id) {
    const database = await open();
    return new Promise((resolve, reject) => {
      const tx = database.transaction(STORE_PRODUCTS, 'readonly');
      const store = tx.objectStore(STORE_PRODUCTS);
      const request = store.get(id);
      request.onsuccess = () => resolve(request.result || null);
      request.onerror = () => reject(request.error);
    });
  }

  /** Supprime un produit */
  async function deleteProduct(id) {
    const database = await open();
    return new Promise((resolve, reject) => {
      const tx = database.transaction(STORE_PRODUCTS, 'readwrite');
      const store = tx.objectStore(STORE_PRODUCTS);
      const request = store.delete(id);
      request.onsuccess = () => resolve(true);
      request.onerror = () => reject(request.error);
    });
  }

  /** Efface tous les produits */
  async function clearAllProducts() {
    const database = await open();
    return new Promise((resolve, reject) => {
      const tx = database.transaction(STORE_PRODUCTS, 'readwrite');
      const store = tx.objectStore(STORE_PRODUCTS);
      const request = store.clear();
      request.onsuccess = () => resolve(true);
      request.onerror = () => reject(request.error);
    });
  }

  /** Sauvegarde un paramètre */
  async function setSetting(key, value) {
    const database = await open();
    return new Promise((resolve, reject) => {
      const tx = database.transaction(STORE_SETTINGS, 'readwrite');
      const store = tx.objectStore(STORE_SETTINGS);
      const request = store.put({ key, value, updatedAt: new Date().toISOString() });
      request.onsuccess = () => resolve(true);
      request.onerror = () => reject(request.error);
    });
  }

  /** Lit un paramètre */
  async function getSetting(key, defaultValue = null) {
    const database = await open();
    return new Promise((resolve, reject) => {
      const tx = database.transaction(STORE_SETTINGS, 'readonly');
      const store = tx.objectStore(STORE_SETTINGS);
      const request = store.get(key);
      request.onsuccess = () => resolve(request.result ? request.result.value : defaultValue);
      request.onerror = () => reject(request.error);
    });
  }

  /** Statistiques globales */
  async function getStats() {
    const products = await getAllProducts();
    if (!products.length) return null;

    const scores = products.map(p => p.score).filter(Boolean);
    const avg = scores.reduce((a, b) => a + b, 0) / scores.length;

    const byNova = { 1: 0, 2: 0, 3: 0, 4: 0 };
    products.forEach(p => { if (p.novaClass) byNova[p.novaClass]++; });

    return {
      total: products.length,
      avgScore: Math.round(avg * 10) / 10,
      byNova,
      bestScore: Math.max(...scores),
      worstScore: Math.min(...scores),
    };
  }

  return {
    open,
    saveProduct,
    updateProduct,
    getAllProducts,
    getProduct,
    deleteProduct,
    clearAllProducts,
    setSetting,
    getSetting,
    getStats,
  };
})();

window.NovaDB = NovaDatabaseDB;
