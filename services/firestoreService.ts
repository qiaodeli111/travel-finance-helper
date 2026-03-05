import {
  collection,
  doc,
  setDoc,
  getDoc,
  getDocs,
  updateDoc,
  deleteDoc,
  query,
  where,
  orderBy,
  onSnapshot,
  serverTimestamp,
  Timestamp,
  writeBatch,
} from 'firebase/firestore';
import { db } from './firebaseConfig';
import {
  UserProfile,
  CloudLedger,
  LedgerMember,
  Invitation,
  CloudExpense,
  COLLECTIONS,
} from '../types/firestore';
import { Family, Category } from '../types';
import {
  queueOperation,
  getQueuedOperations,
  removeQueuedOperation,
  isOnline,
  setupOnlineListener,
} from './offlineService';

// Re-export types for convenience
export type { CloudLedger, CloudExpense, LedgerMember, Invitation } from '../types/firestore';

// Helper function to generate 8-character alphanumeric invite code
export function generateInviteCode(): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let code = '';
  for (let i = 0; i < 8; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return code;
}

// Convert Firestore timestamp to plain object
function convertTimestamp(timestamp: Timestamp | null): { seconds: number; nanoseconds: number } | null {
  if (!timestamp) return null;
  return {
    seconds: timestamp.seconds,
    nanoseconds: timestamp.nanoseconds,
  };
}

// ==================== USER OPERATIONS ====================

/**
 * Create a new user profile document
 */
export async function createUserProfile(uid: string, data: Partial<UserProfile>): Promise<void> {
  try {
    const userRef = doc(db, COLLECTIONS.USERS, uid);
    const now = serverTimestamp() as Timestamp;

    await setDoc(userRef, {
      uid,
      email: data.email || null,
      displayName: data.displayName || null,
      photoURL: data.photoURL || null,
      phoneNumber: data.phoneNumber || null,
      isAnonymous: data.isAnonymous || false,
      createdAt: now,
      updatedAt: now,
    });
  } catch (error) {
    console.error('Error creating user profile:', error);
    throw new Error(`Failed to create user profile: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * Get a user profile by UID
 */
export async function getUserProfile(uid: string): Promise<UserProfile | null> {
  try {
    const userRef = doc(db, COLLECTIONS.USERS, uid);
    const userSnap = await getDoc(userRef);

    if (!userSnap.exists()) {
      return null;
    }

    const data = userSnap.data();
    return {
      uid: data.uid,
      email: data.email,
      displayName: data.displayName,
      photoURL: data.photoURL,
      phoneNumber: data.phoneNumber,
      isAnonymous: data.isAnonymous,
      createdAt: data.createdAt,
      updatedAt: data.updatedAt,
    } as UserProfile;
  } catch (error) {
    console.error('Error getting user profile:', error);
    throw new Error(`Failed to get user profile: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * Update a user profile
 */
export async function updateUserProfile(uid: string, data: Partial<UserProfile>): Promise<void> {
  try {
    const userRef = doc(db, COLLECTIONS.USERS, uid);

    const updateData: Record<string, unknown> = {
      updatedAt: serverTimestamp(),
    };

    if (data.email !== undefined) updateData.email = data.email;
    if (data.displayName !== undefined) updateData.displayName = data.displayName;
    if (data.photoURL !== undefined) updateData.photoURL = data.photoURL;
    if (data.phoneNumber !== undefined) updateData.phoneNumber = data.phoneNumber;
    if (data.isAnonymous !== undefined) updateData.isAnonymous = data.isAnonymous;

    await updateDoc(userRef, updateData);
  } catch (error) {
    console.error('Error updating user profile:', error);
    throw new Error(`Failed to update user profile: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * Update user's default ledger ID
 */
export async function updateUserDefaultLedger(uid: string, ledgerId: string): Promise<void> {
  try {
    const userRef = doc(db, COLLECTIONS.USERS, uid);
    await updateDoc(userRef, {
      defaultLedgerId: ledgerId,
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    console.error('Error updating default ledger:', error);
    throw new Error(`Failed to update default ledger: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * Get user's default ledger ID
 */
export async function getUserDefaultLedger(uid: string): Promise<string | null> {
  try {
    const userRef = doc(db, COLLECTIONS.USERS, uid);
    const userSnap = await getDoc(userRef);

    if (!userSnap.exists()) {
      return null;
    }

    const data = userSnap.data();
    return data.defaultLedgerId || null;
  } catch (error) {
    console.error('Error getting default ledger:', error);
    return null;
  }
}

/**
 * Subscribe to user profile changes (for real-time default ledger sync)
 * @param uid - User ID
 * @param callback - Callback function called when user profile changes
 * @returns Unsubscribe function
 */
export function subscribeToUserProfile(
  uid: string,
  callback: (data: { defaultLedgerId: string | null }) => void
): () => void {
  const userRef = doc(db, COLLECTIONS.USERS, uid);

  const unsubscribe = onSnapshot(
    userRef,
    (snapshot) => {
      if (snapshot.exists()) {
        const data = snapshot.data();
        callback({
          defaultLedgerId: data.defaultLedgerId || null,
        });
      } else {
        callback({ defaultLedgerId: null });
      }
    },
    (error) => {
      console.error('Error subscribing to user profile:', error);
    }
  );

  return unsubscribe;
}

// ==================== LEDGER OPERATIONS ====================

/**
 * Check if a ledger name already exists for a user
 * @param userId - The user ID to check for
 * @param name - The ledger name to check
 * @param excludeLedgerId - Optional ledger ID to exclude (for rename scenario)
 * @returns true if name already exists, false otherwise
 */
export async function checkLedgerNameExists(
  userId: string,
  name: string,
  excludeLedgerId?: string
): Promise<boolean> {
  try {
    // Get all ledgers the user is a member of
    const membersQuery = query(
      collection(db, COLLECTIONS.MEMBERS),
      where('userId', '==', userId)
    );
    const membersSnapshot = await getDocs(membersQuery);

    if (membersSnapshot.empty) {
      return false;
    }

    // Get all ledger IDs the user belongs to
    const ledgerIds = membersSnapshot.docs.map(doc => doc.data().ledgerId);

    // Check each ledger for name conflict
    for (const ledgerId of ledgerIds) {
      // Skip the ledger being renamed
      if (excludeLedgerId && ledgerId === excludeLedgerId) {
        continue;
      }

      const ledgerRef = doc(db, COLLECTIONS.LEDGERS, ledgerId);
      const ledgerSnap = await getDoc(ledgerRef);

      if (ledgerSnap.exists()) {
        const ledgerData = ledgerSnap.data();
        if (ledgerData.name === name) {
          return true;
        }
      }
    }

    return false;
  } catch (error) {
    console.error('Error checking ledger name:', error);
    throw new Error(`Failed to check ledger name: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * Create a new ledger
 */
export async function createLedger(ledger: CloudLedger): Promise<void> {
  try {
    const ledgerRef = doc(db, COLLECTIONS.LEDGERS, ledger.id);

    await setDoc(ledgerRef, {
      ...ledger,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    console.error('Error creating ledger:', error);
    throw new Error(`Failed to create ledger: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * Get a ledger by ID
 */
export async function getLedger(ledgerId: string): Promise<CloudLedger | null> {
  try {
    const ledgerRef = doc(db, COLLECTIONS.LEDGERS, ledgerId);
    const ledgerSnap = await getDoc(ledgerRef);

    if (!ledgerSnap.exists()) {
      return null;
    }

    const data = ledgerSnap.data();
    return {
      id: ledgerSnap.id,
      name: data.name,
      ownerId: data.ownerId,
      destination: data.destination,
      currencyCode: data.currencyCode,
      baseCurrency: data.baseCurrency,
      exchangeRate: data.exchangeRate,
      families: data.families,
      originCountry: data.originCountry,
      status: data.status,
      archivedAt: data.archivedAt,
      archivedBy: data.archivedBy,
      createdAt: data.createdAt,
      updatedAt: data.updatedAt,
    } as CloudLedger;
  } catch (error) {
    console.error('Error getting ledger:', error);
    throw new Error(`Failed to get ledger: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * Update a ledger
 */
export async function updateLedger(ledgerId: string, data: Partial<CloudLedger>): Promise<void> {
  try {
    const ledgerRef = doc(db, COLLECTIONS.LEDGERS, ledgerId);

    const updateData: Record<string, unknown> = {
      updatedAt: serverTimestamp(),
    };

    if (data.name !== undefined) updateData.name = data.name;
    if (data.destination !== undefined) updateData.destination = data.destination;
    if (data.currencyCode !== undefined) updateData.currencyCode = data.currencyCode;
    if (data.baseCurrency !== undefined) updateData.baseCurrency = data.baseCurrency;
    if (data.exchangeRate !== undefined) updateData.exchangeRate = data.exchangeRate;
    if (data.families !== undefined) updateData.families = data.families;
    if (data.originCountry !== undefined) updateData.originCountry = data.originCountry;
    if (data.status !== undefined) updateData.status = data.status;
    if (data.archivedAt !== undefined) updateData.archivedAt = data.archivedAt;
    if (data.archivedBy !== undefined) updateData.archivedBy = data.archivedBy;

    await updateDoc(ledgerRef, updateData);
  } catch (error) {
    console.error('Error updating ledger:', error);
    throw new Error(`Failed to update ledger: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * Delete a ledger and all related data (members, invitations, expenses)
 */
export async function deleteLedger(ledgerId: string): Promise<void> {
  try {
    const batch = writeBatch(db);

    // Delete all members
    const membersQuery = query(collection(db, COLLECTIONS.MEMBERS), where('ledgerId', '==', ledgerId));
    const membersSnapshot = await getDocs(membersQuery);
    membersSnapshot.forEach((memberDoc) => {
      batch.delete(memberDoc.ref);
    });

    // Delete all invitations
    const invitationsQuery = query(collection(db, COLLECTIONS.INVITATIONS), where('ledgerId', '==', ledgerId));
    const invitationsSnapshot = await getDocs(invitationsQuery);
    invitationsSnapshot.forEach((invitationDoc) => {
      batch.delete(invitationDoc.ref);
    });

    // Delete all expenses
    const expensesQuery = query(collection(db, COLLECTIONS.EXPENSES), where('ledgerId', '==', ledgerId));
    const expensesSnapshot = await getDocs(expensesQuery);
    expensesSnapshot.forEach((expenseDoc) => {
      batch.delete(expenseDoc.ref);
    });

    // Delete the ledger itself
    const ledgerRef = doc(db, COLLECTIONS.LEDGERS, ledgerId);
    batch.delete(ledgerRef);

    await batch.commit();
  } catch (error) {
    console.error('Error deleting ledger:', error);
    throw new Error(`Failed to delete ledger: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * Subscribe to real-time updates of user's ledgers
 */
export function subscribeToUserLedgers(
  userId: string,
  callback: (ledgers: CloudLedger[]) => void
): () => void {
  console.log('[subscribeToUserLedgers] Setting up subscription for user:', userId);

  const membersQuery = query(
    collection(db, COLLECTIONS.MEMBERS),
    where('userId', '==', userId)
  );

  const unsubscribe = onSnapshot(membersQuery, async (membersSnapshot) => {
    const ledgerIds = membersSnapshot.docs.map((doc) => doc.data().ledgerId);
    console.log('[subscribeToUserLedgers] Found member records:', ledgerIds.length, 'ledgers:', ledgerIds);

    if (ledgerIds.length === 0) {
      callback([]);
      return;
    }

    const ledgers: CloudLedger[] = [];
    for (const ledgerId of ledgerIds) {
      try {
        const ledger = await getLedger(ledgerId);
        if (ledger) {
          console.log('[subscribeToUserLedgers] Successfully fetched ledger:', ledgerId, ledger.name);
          ledgers.push(ledger);
        } else {
          console.warn('[subscribeToUserLedgers] Ledger not found:', ledgerId);
        }
      } catch (err) {
        // Log the error but continue with other ledgers
        console.error('[subscribeToUserLedgers] Error fetching ledger:', ledgerId, err);
      }
    }

    console.log('[subscribeToUserLedgers] Returning', ledgers.length, 'ledgers');
    callback(ledgers);
  }, (error) => {
    console.error('[subscribeToUserLedgers] Error subscribing to user ledgers:', error);
    callback([]);
  });

  return unsubscribe;
}

// ==================== MEMBER OPERATIONS ====================

/**
 * Add a member to a ledger
 */
export async function addMember(ledgerId: string, member: LedgerMember): Promise<void> {
  try {
    const memberRef = doc(db, COLLECTIONS.MEMBERS, member.id);

    await setDoc(memberRef, {
      ...member,
      joinedAt: serverTimestamp(),
    });
  } catch (error) {
    console.error('Error adding member:', error);
    throw new Error(`Failed to add member: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * Get all members of a ledger
 */
export async function getLedgerMembers(ledgerId: string): Promise<LedgerMember[]> {
  try {
    const membersQuery = query(
      collection(db, COLLECTIONS.MEMBERS),
      where('ledgerId', '==', ledgerId)
    );

    const membersSnapshot = await getDocs(membersQuery);

    return membersSnapshot.docs.map((doc) => {
      const data = doc.data();
      return {
        id: doc.id,
        ledgerId: data.ledgerId,
        userId: data.userId,
        role: data.role,
        joinedAt: data.joinedAt,
        displayName: data.displayName,
      } as LedgerMember;
    });
  } catch (error) {
    console.error('Error getting ledger members:', error);
    throw new Error(`Failed to get ledger members: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * Update a member's role
 */
export async function updateMemberRole(
  ledgerId: string,
  userId: string,
  role: 'owner' | 'admin' | 'member' | 'viewer'
): Promise<void> {
  try {
    const membersQuery = query(
      collection(db, COLLECTIONS.MEMBERS),
      where('ledgerId', '==', ledgerId),
      where('userId', '==', userId)
    );

    const membersSnapshot = await getDocs(membersQuery);

    if (membersSnapshot.empty) {
      throw new Error('Member not found');
    }

    const memberRef = membersSnapshot.docs[0].ref;
    await updateDoc(memberRef, { role });
  } catch (error) {
    console.error('Error updating member role:', error);
    throw new Error(`Failed to update member role: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * Remove a member from a ledger
 */
export async function removeMember(ledgerId: string, userId: string): Promise<void> {
  try {
    const membersQuery = query(
      collection(db, COLLECTIONS.MEMBERS),
      where('ledgerId', '==', ledgerId),
      where('userId', '==', userId)
    );

    const membersSnapshot = await getDocs(membersQuery);

    if (membersSnapshot.empty) {
      throw new Error('Member not found');
    }

    const memberRef = membersSnapshot.docs[0].ref;
    await deleteDoc(memberRef);
  } catch (error) {
    console.error('Error removing member:', error);
    throw new Error(`Failed to remove member: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * Subscribe to real-time updates of ledger members
 */
export function subscribeToLedgerMembers(
  ledgerId: string,
  callback: (members: LedgerMember[]) => void
): () => void {
  const membersQuery = query(
    collection(db, COLLECTIONS.MEMBERS),
    where('ledgerId', '==', ledgerId)
  );

  const unsubscribe = onSnapshot(membersQuery, (snapshot) => {
    const members = snapshot.docs.map((doc) => {
      const data = doc.data();
      return {
        id: doc.id,
        ledgerId: data.ledgerId,
        userId: data.userId,
        role: data.role,
        joinedAt: data.joinedAt,
        displayName: data.displayName,
      } as LedgerMember;
    });

    callback(members);
  }, (error) => {
    console.error('Error subscribing to ledger members:', error);
    callback([]);
  });

  return unsubscribe;
}

// ==================== EXPENSE OPERATIONS ====================

/**
 * Create a new expense
 */
export async function createExpense(ledgerId: string, expense: CloudExpense): Promise<void> {
  try {
    const expenseRef = doc(collection(db, COLLECTIONS.EXPENSES), expense.id);

    await setDoc(expenseRef, {
      ...expense,
      version: expense.version || 1,  // Initialize version
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    console.error('Error creating expense:', error);
    throw new Error(`Failed to create expense: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * Get all expenses for a ledger
 */
export async function getExpenses(ledgerId: string): Promise<CloudExpense[]> {
  try {
    // Remove orderBy to avoid needing composite index
    const expensesQuery = query(
      collection(db, COLLECTIONS.EXPENSES),
      where('ledgerId', '==', ledgerId)
    );

    const expensesSnapshot = await getDocs(expensesQuery);

    const expenses = expensesSnapshot.docs.map((doc) => {
      const data = doc.data();
      return {
        id: doc.id,
        ledgerId: data.ledgerId,
        createdBy: data.createdBy,
        createdByDisplayName: data.createdByDisplayName,
        date: data.date,
        description: data.description,
        amount: data.amount,
        category: data.category,
        payerId: data.payerId,
        sharedWithFamilyIds: data.sharedWithFamilyIds,
        createdAt: data.createdAt,
        updatedAt: data.updatedAt,
        version: data.version || 1,  // Include version
        deletedAt: data.deletedAt || null,  // Include deletedAt for soft delete
      } as CloudExpense;
    });

    // Sort locally by date descending
    return expenses.sort((a, b) => (b.date || 0) - (a.date || 0));
  } catch (error) {
    console.error('Error getting expenses:', error);
    // Return empty array instead of throwing - allows partial sync
    return [];
  }
}

/**
 * Update an expense
 */
export async function updateExpense(
  ledgerId: string,
  expenseId: string,
  data: Partial<CloudExpense>
): Promise<void> {
  try {
    const expenseRef = doc(db, COLLECTIONS.EXPENSES, expenseId);

    const updateData: Record<string, unknown> = {
      updatedAt: serverTimestamp(),
    };

    if (data.date !== undefined) updateData.date = data.date;
    if (data.description !== undefined) updateData.description = data.description;
    if (data.amount !== undefined) updateData.amount = data.amount;
    if (data.category !== undefined) updateData.category = data.category;
    if (data.payerId !== undefined) updateData.payerId = data.payerId;
    if (data.sharedWithFamilyIds !== undefined) updateData.sharedWithFamilyIds = data.sharedWithFamilyIds;
    if (data.version !== undefined) updateData.version = data.version;

    await updateDoc(expenseRef, updateData);
  } catch (error) {
    console.error('Error updating expense:', error);
    throw new Error(`Failed to update expense: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * Soft delete an expense (sets deletedAt timestamp)
 */
export async function softDeleteExpense(
  ledgerId: string,
  expenseId: string,
  currentVersion: number
): Promise<void> {
  try {
    const expenseRef = doc(db, COLLECTIONS.EXPENSES, expenseId);

    await updateDoc(expenseRef, {
      deletedAt: serverTimestamp(),
      version: currentVersion + 1,
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    console.error('Error soft deleting expense:', error);
    throw new Error(`Failed to delete expense: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * Delete an expense
 */
export async function deleteExpense(ledgerId: string, expenseId: string): Promise<void> {
  try {
    const expenseRef = doc(db, COLLECTIONS.EXPENSES, expenseId);
    await deleteDoc(expenseRef);
  } catch (error) {
    console.error('Error deleting expense:', error);
    throw new Error(`Failed to delete expense: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * Subscribe to real-time updates of ledger expenses
 */
export function subscribeToExpenses(
  ledgerId: string,
  callback: (expenses: CloudExpense[]) => void
): () => void {
  const expensesQuery = query(
    collection(db, COLLECTIONS.EXPENSES),
    where('ledgerId', '==', ledgerId),
    orderBy('date', 'desc')
  );

  const unsubscribe = onSnapshot(expensesQuery, (snapshot) => {
    const expenses = snapshot.docs.map((doc) => {
      const data = doc.data();
      return {
        id: doc.id,
        ledgerId: data.ledgerId,
        createdBy: data.createdBy,
        createdByDisplayName: data.createdByDisplayName,
        date: data.date,
        description: data.description,
        amount: data.amount,
        category: data.category,
        payerId: data.payerId,
        sharedWithFamilyIds: data.sharedWithFamilyIds,
        createdAt: data.createdAt,
        updatedAt: data.updatedAt,
        version: data.version || 1,  // Include version for conflict resolution
        deletedAt: data.deletedAt || null,  // Include deletedAt for soft delete
      } as CloudExpense;
    });

    callback(expenses);
  }, (error) => {
    console.error('Error subscribing to expenses:', error);
    callback([]);
  });

  return unsubscribe;
}

// ==================== INVITATION OPERATIONS ====================

/**
 * Create a new invitation
 */
export async function createInvitation(invitation: Invitation): Promise<void> {
  try {
    const invitationRef = doc(db, COLLECTIONS.INVITATIONS, invitation.id);

    await setDoc(invitationRef, {
      ...invitation,
      createdAt: serverTimestamp(),
    });
  } catch (error) {
    console.error('Error creating invitation:', error);
    throw new Error(`Failed to create invitation: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * Get an invitation by code
 */
export async function getInvitationByCode(code: string): Promise<Invitation | null> {
  try {
    const invitationsQuery = query(
      collection(db, COLLECTIONS.INVITATIONS),
      where('inviteCode', '==', code)
    );

    const invitationSnapshot = await getDocs(invitationsQuery);

    if (invitationSnapshot.empty) {
      return null;
    }

    const doc = invitationSnapshot.docs[0];
    const data = doc.data();

    return {
      id: doc.id,
      ledgerId: data.ledgerId,
      ledgerName: data.ledgerName,
      inviterId: data.inviterId,
      inviterName: data.inviterName,
      inviteCode: data.inviteCode,
      expiresAt: data.expiresAt,
      usedAt: data.usedAt,
      createdAt: data.createdAt,
    } as Invitation;
  } catch (error) {
    console.error('Error getting invitation by code:', error);
    throw new Error(`Failed to get invitation: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * Mark an invitation as used
 */
export async function useInvitation(code: string, userId: string): Promise<void> {
  try {
    const invitationsQuery = query(
      collection(db, COLLECTIONS.INVITATIONS),
      where('inviteCode', '==', code)
    );

    const invitationSnapshot = await getDocs(invitationsQuery);

    if (invitationSnapshot.empty) {
      throw new Error('Invitation not found');
    }

    const invitationRef = invitationSnapshot.docs[0].ref;
    await updateDoc(invitationRef, {
      usedAt: serverTimestamp(),
    });
  } catch (error) {
    console.error('Error using invitation:', error);
    throw new Error(`Failed to use invitation: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * Subscribe to real-time updates of ledger invitations
 */
export function subscribeToLedgerInvitations(
  ledgerId: string,
  callback: (invitations: Invitation[]) => void
): () => void {
  const invitationsQuery = query(
    collection(db, COLLECTIONS.INVITATIONS),
    where('ledgerId', '==', ledgerId)
  );

  const unsubscribe = onSnapshot(invitationsQuery, (snapshot) => {
    const invitations = snapshot.docs.map((doc) => {
      const data = doc.data();
      return {
        id: doc.id,
        ledgerId: data.ledgerId,
        ledgerName: data.ledgerName,
        inviterId: data.inviterId,
        inviterName: data.inviterName,
        inviteCode: data.inviteCode,
        expiresAt: data.expiresAt,
        usedAt: data.usedAt,
        createdAt: data.createdAt,
      } as Invitation;
    });

    callback(invitations);
  }, (error) => {
    console.error('Error subscribing to invitations:', error);
    callback([]);
  });

  return unsubscribe;
}

// ==================== OFFLINE SUPPORT ====================

/**
 * Setup offline queue processing when coming back online
 */
export function useOfflineQueue(): void {
  setupOnlineListener(() => {
    processOfflineQueue();
  });
}

/**
 * Process all queued operations when back online
 */
export async function processOfflineQueue(): Promise<void> {
  if (!isOnline()) {
    console.log('Still offline, cannot process queue');
    return;
  }

  const operations = getQueuedOperations();

  if (operations.length === 0) {
    console.log('No queued operations to process');
    return;
  }

  console.log(`Processing ${operations.length} queued operations`);

  for (const op of operations) {
    try {
      switch (op.type) {
        case 'create':
          await processCreateOperation(op);
          break;
        case 'update':
          await processUpdateOperation(op);
          break;
        case 'delete':
          await processDeleteOperation(op);
          break;
      }
      removeQueuedOperation(op.id);
      console.log(`Successfully processed operation: ${op.id}`);
    } catch (error) {
      console.error(`Failed to process operation ${op.id}:`, error);
      // Keep the operation in queue for retry
    }
  }
}

/**
 * Process a create operation from the queue
 */
async function processCreateOperation(op: any): Promise<void> {
  const docRef = doc(db, op.collection, op.data.id);
  await setDoc(docRef, {
    ...op.data,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
}

/**
 * Process an update operation from the queue
 */
async function processUpdateOperation(op: any): Promise<void> {
  const docRef = doc(db, op.collection, op.data.id);
  await updateDoc(docRef, {
    ...op.data,
    updatedAt: serverTimestamp(),
  });
}

/**
 * Process a delete operation from the queue
 */
async function processDeleteOperation(op: any): Promise<void> {
  const docRef = doc(db, op.collection, op.data.id);
  await deleteDoc(docRef);
}

/**
 * Wrap a create operation to work offline
 */
export async function createWithOfflineSupport(
  collectionName: string,
  id: string,
  data: any
): Promise<void> {
  try {
    const docRef = doc(db, collectionName, id);
    await setDoc(docRef, {
      ...data,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    if (!isOnline()) {
      console.log('Offline: queueing create operation');
      queueOperation({
        type: 'create',
        collection: collectionName,
        data: { ...data, id },
      });
    } else {
      throw error;
    }
  }
}

/**
 * Wrap an update operation to work offline
 */
export async function updateWithOfflineSupport(
  collectionName: string,
  id: string,
  data: any
): Promise<void> {
  try {
    const docRef = doc(db, collectionName, id);
    await updateDoc(docRef, {
      ...data,
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    if (!isOnline()) {
      console.log('Offline: queueing update operation');
      queueOperation({
        type: 'update',
        collection: collectionName,
        data: { ...data, id },
      });
    } else {
      throw error;
    }
  }
}

/**
 * Wrap a delete operation to work offline
 */
export async function deleteWithOfflineSupport(
  collectionName: string,
  id: string
): Promise<void> {
  try {
    const docRef = doc(db, collectionName, id);
    await deleteDoc(docRef);
  } catch (error) {
    if (!isOnline()) {
      console.log('Offline: queueing delete operation');
      queueOperation({
        type: 'delete',
        collection: collectionName,
        data: { id },
      });
    } else {
      throw error;
    }
  }
}