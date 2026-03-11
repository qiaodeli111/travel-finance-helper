import { AppState } from "../types";

// --- Pure Local Storage Implementation ---

export const saveLedger = (id: string, data: AppState) => {
  localStorage.setItem(`ledger_data_${id}`, JSON.stringify(data));
};

export const loadLedger = (id: string): AppState | null => {
  const s = localStorage.getItem(`ledger_data_${id}`);
  return s ? JSON.parse(s) : null;
};

export const deleteLedger = (id: string) => {
  localStorage.removeItem(`ledger_data_${id}`);
};

export const createLedgerId = () => {
  // crypto.randomUUID() may not be available in all browsers (e.g., non-HTTPS contexts)
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  // Fallback: generate UUID v4
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
};
