import { normalizeState } from './engine.js';

const SAVE_KEY = 'ashen-relics-save-v1';
const BACKUP_KEY = 'ashen-relics-save-backup-v1';

export function hasSave() {
  try {
    return Boolean(localStorage.getItem(SAVE_KEY));
  } catch {
    return false;
  }
}

export function loadSave() {
  const read = (key) => {
    try {
      const saved = localStorage.getItem(key);
      return saved ? normalizeState(JSON.parse(saved)) : null;
    } catch (error) {
      console.warn('Save data could not be loaded.', error);
      return null;
    }
  };

  return read(SAVE_KEY) ?? read(BACKUP_KEY);
}

export function saveGame(state) {
  try {
    const current = localStorage.getItem(SAVE_KEY);
    if (current) localStorage.setItem(BACKUP_KEY, current);
    state.updatedAt = Date.now();
    localStorage.setItem(SAVE_KEY, JSON.stringify(state));
    return true;
  } catch (error) {
    console.warn('Save data could not be written.', error);
    return false;
  }
}

export function deleteSave() {
  try {
    localStorage.removeItem(SAVE_KEY);
    localStorage.removeItem(BACKUP_KEY);
    return true;
  } catch {
    return false;
  }
}

export function exportSave(state) {
  return btoa(unescape(encodeURIComponent(JSON.stringify(state))));
}

export function importSave(encoded) {
  try {
    return normalizeState(JSON.parse(decodeURIComponent(escape(atob(encoded.trim())))));
  } catch {
    return null;
  }
}
