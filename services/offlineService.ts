const OFFLINE_QUEUE_KEY = 'travel_finance_offline_queue';

export interface QueuedOperation {
  id: string;
  type: 'create' | 'update' | 'delete';
  collection: string;
  data: any;
  timestamp: number;
}

/**
 * Generate a unique ID for queued operations
 */
function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

/**
 * Get all queued operations from localStorage
 */
function getQueue(): QueuedOperation[] {
  try {
    const stored = localStorage.getItem(OFFLINE_QUEUE_KEY);
    return stored ? JSON.parse(stored) : [];
  } catch (error) {
    console.error('Error reading offline queue:', error);
    return [];
  }
}

/**
 * Save the queue to localStorage
 */
function saveQueue(queue: QueuedOperation[]): void {
  try {
    localStorage.setItem(OFFLINE_QUEUE_KEY, JSON.stringify(queue));
  } catch (error) {
    console.error('Error saving offline queue:', error);
  }
}

/**
 * Queue an operation to be processed when back online
 */
export const queueOperation = (operation: Omit<QueuedOperation, 'id' | 'timestamp'>): void => {
  const queue = getQueue();
  const queuedOp: QueuedOperation = {
    ...operation,
    id: generateId(),
    timestamp: Date.now(),
  };
  queue.push(queuedOp);
  saveQueue(queue);
  console.log('Operation queued for offline sync:', queuedOp);
};

/**
 * Get all queued operations
 */
export const getQueuedOperations = (): QueuedOperation[] => {
  return getQueue();
};

/**
 * Remove a specific operation from the queue
 */
export const removeQueuedOperation = (id: string): void => {
  const queue = getQueue();
  const filtered = queue.filter((op) => op.id !== id);
  saveQueue(filtered);
};

/**
 * Clear all queued operations
 */
export const clearQueue = (): void => {
  saveQueue([]);
};

/**
 * Check if the browser is online
 */
export const isOnline = (): boolean => {
  return navigator.onLine;
};

/**
 * Add event listeners for online/offline status
 */
export const setupOnlineListener = (onOnline: () => void): (() => void) => {
  const handleOnline = () => {
    console.log('Browser is now online');
    onOnline();
  };

  window.addEventListener('online', handleOnline);
  window.addEventListener('offline', () => {
    console.log('Browser is now offline');
  });

  // Return cleanup function
  return () => {
    window.removeEventListener('online', handleOnline);
  };
};