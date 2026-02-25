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

export const createLedgerId = () => crypto.randomUUID();
