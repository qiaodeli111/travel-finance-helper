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
import { auth } from '../../services/firebaseConfig';
import { User } from '../types/auth';

const mapFirebaseUserToUser = (firebaseUser: FirebaseUser): User => ({
  uid: firebaseUser.uid,
  email: firebaseUser.email,
  displayName: firebaseUser.displayName,
  photoURL: firebaseUser.photoURL,
  phoneNumber: firebaseUser.phoneNumber,
  isAnonymous: firebaseUser.isAnonymous,
  createdAt: new Date(firebaseUser.metadata.creationTime || Date.now()),
  lastLoginAt: new Date(firebaseUser.metadata.lastSignInTime || Date.now()),
});

export const signUp = async (email: string, password: string): Promise<User> => {
  const userCredential = await createUserWithEmailAndPassword(auth, email, password);
  return mapFirebaseUserToUser(userCredential.user);
};

export const signIn = async (email: string, password: string): Promise<User> => {
  const userCredential = await signInWithEmailAndPassword(auth, email, password);
  return mapFirebaseUserToUser(userCredential.user);
};

export const signInAnonymously = async (): Promise<User> => {
  const userCredential = await firebaseSignInAnonymously(auth);
  return mapFirebaseUserToUser(userCredential.user);
};

export const signOut = async (): Promise<void> => {
  await firebaseSignOut(auth);
};

export const resetPassword = async (email: string): Promise<void> => {
  await sendPasswordResetEmail(auth, email);
};

export const updateUserProfile = async (displayName?: string, photoURL?: string): Promise<void> => {
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
  const unsubscribe = onAuthStateChanged(auth, (firebaseUser: FirebaseUser | null) => {
    if (firebaseUser) {
      callback(mapFirebaseUserToUser(firebaseUser));
    } else {
      callback(null);
    }
  });
  return unsubscribe;
};

export { auth };