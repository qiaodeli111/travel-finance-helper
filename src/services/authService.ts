import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signInAnonymously as firebaseSignInAnonymously,
  signOut as firebaseSignOut,
  sendPasswordResetEmail,
  updateProfile as firebaseUpdateProfile,
  onAuthStateChanged,
  User as FirebaseUser,
} from 'firebase/auth';
import { auth, isCloudEnabled } from '../../services/firebaseConfig';
import { User } from '../types/auth';

export const mapFirebaseUserToUser = (firebaseUser: FirebaseUser): User => ({
  uid: firebaseUser.uid,
  email: firebaseUser.email,
  displayName: firebaseUser.displayName,
  photoURL: firebaseUser.photoURL,
  phoneNumber: firebaseUser.phoneNumber,
  isAnonymous: firebaseUser.isAnonymous,
  createdAt: new Date(firebaseUser.metadata.creationTime || Date.now()),
  lastLoginAt: new Date(firebaseUser.metadata.lastSignInTime || Date.now()),
});

// Check if Firebase is available
const checkFirebaseAvailable = (): boolean => {
  if (!isCloudEnabled || !auth) {
    throw new Error('Firebase is not configured. Cloud sync features are disabled.');
  }
  return true;
};

export const signUp = async (email: string, password: string): Promise<User> => {
  checkFirebaseAvailable();
  const userCredential = await createUserWithEmailAndPassword(auth, email, password);
  return mapFirebaseUserToUser(userCredential.user);
};

export const signIn = async (email: string, password: string): Promise<User> => {
  checkFirebaseAvailable();
  const userCredential = await signInWithEmailAndPassword(auth, email, password);
  return mapFirebaseUserToUser(userCredential.user);
};

export const signInAnonymously = async (): Promise<User> => {
  checkFirebaseAvailable();
  const userCredential = await firebaseSignInAnonymously(auth);
  return mapFirebaseUserToUser(userCredential.user);
};

export const signOut = async (): Promise<void> => {
  checkFirebaseAvailable();
  await firebaseSignOut(auth);
};

export const resetPassword = async (email: string): Promise<void> => {
  checkFirebaseAvailable();
  await sendPasswordResetEmail(auth, email);
};

export const updateUserProfile = async (displayName?: string, photoURL?: string): Promise<void> => {
  checkFirebaseAvailable();
  const currentUser = auth.currentUser;
  if (currentUser) {
    await firebaseUpdateProfile(currentUser, { displayName, photoURL });
  } else {
    throw new Error('No user is currently signed in');
  }
};

export const subscribeToAuthChanges = (
  callback: (user: User | null) => void
): (() => void) => {
  if (!isCloudEnabled || !auth) {
    // Return a no-op unsubscribe function if Firebase is not configured
    callback(null);
    return () => {};
  }

  const unsubscribe = onAuthStateChanged(auth, (firebaseUser: FirebaseUser | null) => {
    if (firebaseUser) {
      callback(mapFirebaseUserToUser(firebaseUser));
    } else {
      callback(null);
    }
  });
  return unsubscribe;
};

export { auth, isCloudEnabled };