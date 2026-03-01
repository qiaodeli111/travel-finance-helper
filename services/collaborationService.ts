import * as firestoreService from './firestoreService';
import { generateInviteCode } from './firestoreService';
import { LedgerMember, Invitation, COLLECTIONS } from '../types/firestore';

// Permission types
type PermissionAction = 'edit_expenses' | 'delete_expenses' | 'manage_members' | 'change_settings' | 'delete_ledger';
type MemberRole = 'owner' | 'admin' | 'member' | 'viewer';

// Permission matrix: which roles have which permissions
const PERMISSION_MATRIX: Record<MemberRole, PermissionAction[]> = {
  owner: ['edit_expenses', 'delete_expenses', 'manage_members', 'change_settings', 'delete_ledger'],
  admin: ['edit_expenses', 'delete_expenses', 'manage_members', 'change_settings'],
  member: ['edit_expenses', 'delete_expenses'],
  viewer: [],
};

// ==================== MEMBER MANAGEMENT ====================

/**
 * Get all members of a ledger
 */
export const getLedgerMembers = async (ledgerId: string): Promise<LedgerMember[]> => {
  return firestoreService.getLedgerMembers(ledgerId);
};

/**
 * Add a new member to a ledger
 */
export const addMemberToLedger = async (
  ledgerId: string,
  userId: string,
  displayName: string,
  role: 'owner' | 'admin' | 'member' | 'viewer'
): Promise<LedgerMember> => {
  const memberId = `${ledgerId}_${userId}`;

  const member: LedgerMember = {
    id: memberId,
    ledgerId,
    userId,
    role,
    joinedAt: {
      seconds: Date.now() / 1000,
      nanoseconds: 0,
      toDate: () => new Date(),
    },
    displayName,
  };

  await firestoreService.addMember(ledgerId, member);
  return member;
};

/**
 * Update member role
 */
export const updateMemberRole = async (
  ledgerId: string,
  userId: string,
  newRole: 'admin' | 'member' | 'viewer'
): Promise<void> => {
  await firestoreService.updateMemberRole(ledgerId, userId, newRole);
};

/**
 * Remove member from ledger
 */
export const removeMemberFromLedger = async (
  ledgerId: string,
  userId: string
): Promise<void> => {
  await firestoreService.removeMember(ledgerId, userId);
};

/**
 * Check if user has permission for an action
 */
export const checkPermission = (
  memberRole: 'owner' | 'admin' | 'member' | 'viewer',
  action: PermissionAction
): boolean => {
  const allowedActions = PERMISSION_MATRIX[memberRole] || [];
  return allowedActions.includes(action);
};

// ==================== INVITATION MANAGEMENT ====================

/**
 * Create a new invitation for a ledger
 */
export const createInvitation = async (
  ledgerId: string,
  ledgerName: string,
  inviterId: string,
  inviterName: string,
  expiresInHours?: number
): Promise<Invitation> => {
  const invitationId = `${ledgerId}_${Date.now()}`;
  const inviteCode = generateInviteCode();

  let expiresAt: { seconds: number; nanoseconds: number; toDate: () => Date } | null = null;
  if (expiresInHours && expiresInHours > 0) {
    const expirationTime = Date.now() + expiresInHours * 60 * 60 * 1000;
    expiresAt = {
      seconds: Math.floor(expirationTime / 1000),
      nanoseconds: 0,
      toDate: () => new Date(expirationTime),
    };
  }

  const invitation: Invitation = {
    id: invitationId,
    ledgerId,
    ledgerName,
    inviterId,
    inviterName,
    inviteCode,
    expiresAt,
    usedAt: null,
    createdAt: {
      seconds: Date.now() / 1000,
      nanoseconds: 0,
      toDate: () => new Date(),
    },
  };

  await firestoreService.createInvitation(invitation);
  return invitation;
};

/**
 * Accept an invitation
 */
export const acceptInvitation = async (
  inviteCode: string,
  userId: string,
  displayName: string
): Promise<{ ledgerId: string; ledgerName: string }> => {
  // Get invitation details
  const invitation = await firestoreService.getInvitationByCode(inviteCode);

  if (!invitation) {
    throw new Error('Invitation not found');
  }

  // Check if invitation has already been used
  if (invitation.usedAt) {
    throw new Error('Invitation has already been used');
  }

  // Check if invitation has expired
  if (invitation.expiresAt) {
    const expiresAt = invitation.expiresAt.toDate();
    if (expiresAt < new Date()) {
      throw new Error('Invitation has expired');
    }
  }

  // Check if user is already a member
  const existingMembers = await firestoreService.getLedgerMembers(invitation.ledgerId);
  const existingMember = existingMembers.find((m) => m.userId === userId);
  if (existingMember) {
    throw new Error('You are already a member of this ledger');
  }

  // Add user as a member with 'member' role
  await addMemberToLedger(invitation.ledgerId, userId, displayName, 'member');

  // Mark invitation as used
  await firestoreService.useInvitation(inviteCode, userId);

  return {
    ledgerId: invitation.ledgerId,
    ledgerName: invitation.ledgerName,
  };
};

/**
 * Get invitation details by code
 */
export const getInvitationDetails = async (
  inviteCode: string
): Promise<Invitation | null> => {
  return firestoreService.getInvitationByCode(inviteCode);
};

/**
 * Revoke an invitation
 */
export const revokeInvitation = async (
  invitationId: string
): Promise<void> => {
  // To revoke an invitation, we delete it from Firestore
  // Import deleteDoc from firebase/firestore
  const { doc, deleteDoc } = await import('firebase/firestore');
  const { db } = await import('./firebaseConfig');

  const invitationRef = doc(db, COLLECTIONS.INVITATIONS, invitationId);
  await deleteDoc(invitationRef);
};

// ==================== SHAREABLE LINK ====================

/**
 * Generate a shareable link for an invitation
 */
export const generateShareLink = (inviteCode: string): string => {
  // Check if we're in a browser environment
  if (typeof window !== 'undefined' && window.location) {
    return `${window.location.origin}/join/${inviteCode}`;
  }
  // Fallback for SSR or non-browser environments
  return `/join/${inviteCode}`;
};