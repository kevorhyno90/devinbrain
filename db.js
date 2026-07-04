// Devin BrainJet - IndexedDB persistence layer
const DB = (() => {
  const DB_NAME = 'devin_brainjet_db';
  const DB_VERSION = 1;
  let db = null;

  function open() {
    return new Promise((resolve, reject) => {
      if (db) return resolve(db);
      const req = indexedDB.open(DB_NAME, DB_VERSION);
      req.onerror = () => reject(req.error);
      req.onsuccess = () => { db = req.result; resolve(db); };
      req.onupgradeneeded = (e) => {
        const d = e.target.result;
        if (!d.objectStoreNames.contains('plans')) {
          const s = d.createObjectStore('plans', { keyPath: 'id' });
          s.createIndex('category', 'category', { unique: false });
          s.createIndex('dueDate', 'dueDate', { unique: false });
          s.createIndex('status', 'status', { unique: false });
        }
        if (!d.objectStoreNames.contains('settings')) {
          d.createObjectStore('settings', { keyPath: 'key' });
        }
        if (!d.objectStoreNames.contains('chatHistory')) {
          d.createObjectStore('chatHistory', { keyPath: 'id', autoIncrement: true });
        }
        if (!d.objectStoreNames.contains('notes')) {
          d.createObjectStore('notes', { keyPath: 'id' });
        }
      };
    });
  }

  async function tx(store, mode = 'readonly') {
    const d = await open();
    return d.transaction(store, mode).objectStore(store);
  }

  // Plans CRUD
  async function getAllPlans() {
    const s = await tx('plans');
    return new Promise((res, rej) => {
      const r = s.getAll();
      r.onsuccess = () => res(r.result || []);
      r.onerror = () => rej(r.error);
    });
  }

  async function getPlan(id) {
    const s = await tx('plans');
    return new Promise((res, rej) => {
      const r = s.get(id);
      r.onsuccess = () => res(r.result);
      r.onerror = () => rej(r.error);
    });
  }

  async function savePlan(plan) {
    if (!plan.id) plan.id = 'p_' + Date.now() + '_' + Math.random().toString(36).slice(2, 8);
    if (!plan.createdAt) plan.createdAt = new Date().toISOString();
    plan.updatedAt = new Date().toISOString();
    const s = await tx('plans', 'readwrite');
    return new Promise((res, rej) => {
      const r = s.put(plan);
      r.onsuccess = () => {
        if (window.Sync) window.Sync.pushPlanToCloud(plan);
        res(plan);
      };
      r.onerror = () => rej(r.error);
    });
  }

  async function deletePlan(id) {
    const s = await tx('plans', 'readwrite');
    return new Promise((res, rej) => {
      const r = s.delete(id);
      r.onsuccess = () => res(true);
      r.onerror = () => rej(r.error);
    });
  }

  async function clearAll() {
    const stores = ['plans', 'notes', 'chatHistory'];
    for (const name of stores) {
      const s = await tx(name, 'readwrite');
      await new Promise((res, rej) => { const r = s.clear(); r.onsuccess = res; r.onerror = rej; });
    }
  }

  // Settings
  async function getSetting(key, fallback = null) {
    const s = await tx('settings');
    return new Promise((res) => {
      const r = s.get(key);
      r.onsuccess = () => res(r.result ? r.result.value : fallback);
      r.onerror = () => res(fallback);
    });
  }

  async function setSetting(key, value) {
    const s = await tx('settings', 'readwrite');
    return new Promise((res, rej) => {
      const r = s.put({ key, value });
      r.onsuccess = () => res(true);
      r.onerror = () => rej(r.error);
    });
  }

  // Notes
  async function getAllNotes() {
    const s = await tx('notes');
    return new Promise((res) => {
      const r = s.getAll();
      r.onsuccess = () => res(r.result || []);
      r.onerror = () => res([]);
    });
  }

  async function saveNote(note) {
    if (!note.id) note.id = 'n_' + Date.now();
    note.updatedAt = new Date().toISOString();
    const s = await tx('notes', 'readwrite');
    return new Promise((res, rej) => {
      const r = s.put(note);
      r.onsuccess = () => res(note);
      r.onerror = () => rej(r.error);
    });
  }

  async function deleteNote(id) {
    const s = await tx('notes', 'readwrite');
    return new Promise((res, rej) => {
      const r = s.delete(id);
      r.onsuccess = () => res(true);
      r.onerror = () => rej(r.error);
    });
  }

  // Export/Import
  async function exportAll() {
    const plans = await getAllPlans();
    const notes = await getAllNotes();
    return { version: 1, exportedAt: new Date().toISOString(), plans, notes };
  }

  async function importAll(data) {
    if (!data || !Array.isArray(data.plans)) throw new Error('Invalid backup');
    for (const p of data.plans) await savePlan(p);
    if (Array.isArray(data.notes)) for (const n of data.notes) await saveNote(n);
    return true;
  }

  return {
    open, getAllPlans, getPlan, savePlan, deletePlan, clearAll,
    getSetting, setSetting,
    getAllNotes, saveNote, deleteNote,
    exportAll, importAll
  };
})();
