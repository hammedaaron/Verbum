import { initializeApp, getApps, getApp } from 'firebase/app';
import {
  getAuth,
  GoogleAuthProvider,
  signInWithPopup,
  signOut,
  onAuthStateChanged,
  User,
} from 'firebase/auth';
import {
  getFirestore,
  doc,
  setDoc,
  getDoc,
  getDocs,
  collection,
  deleteDoc,
  getDocFromServer,
  Firestore,
} from 'firebase/firestore';
import config from '../../firebase-applet-config.json';
import { Manuscript, Milestone, ManuscriptFolder } from '../types/manuscript';

// Initialize Firebase App
const app = getApps().length === 0 ? initializeApp(config) : getApp();

// Initialize Auth
export const auth = getAuth(app);
export const googleProvider = new GoogleAuthProvider();
googleProvider.setCustomParameters({
  prompt: 'select_account',
});

// Initialize Firestore targeting the specific provisioned database
export const db: Firestore = config.firestoreDatabaseId
  ? getFirestore(app, config.firestoreDatabaseId)
  : getFirestore(app);

// Connectivity health-check required by skill guidelines
export async function testFirebaseConnection(): Promise<boolean> {
  try {
    await getDocFromServer(doc(db, 'test', 'connection'));
    return true;
  } catch (error: any) {
    // If permission-denied or document not found, connection itself succeeded
    if (error?.code === 'permission-denied' || error?.code === 'not-found') {
      return true;
    }
    if (error instanceof Error && error.message.includes('the client is offline')) {
      console.warn('Firebase client is offline. Local cache active.');
    }
    return false;
  }
}

// Initial connection test
testFirebaseConnection().catch(() => {});

// Auth Actions
export async function signInWithGoogle(): Promise<User> {
  const result = await signInWithPopup(auth, googleProvider);
  const user = result.user;

  // Sync user profile document in Firestore
  try {
    const userRef = doc(db, 'users', user.uid);
    await setDoc(
      userRef,
      {
        uid: user.uid,
        email: user.email || '',
        displayName: user.displayName || 'Author',
        photoURL: user.photoURL || '',
        updatedAt: Date.now(),
      },
      { merge: true }
    );
  } catch (err) {
    console.error('Failed to sync user profile:', err);
  }

  return user;
}

export async function logOut(): Promise<void> {
  await signOut(auth);
}

export function subscribeToAuthState(callback: (user: User | null) => void) {
  return onAuthStateChanged(auth, callback);
}

// Cloud Manuscript Storage
export async function saveManuscriptToCloud(userId: string, manuscript: Manuscript): Promise<void> {
  const ref = doc(db, 'users', userId, 'manuscripts', manuscript.id);
  await setDoc(ref, {
    ...manuscript,
    userId,
    updatedAt: Date.now(),
  });
}

export async function getManuscriptsFromCloud(userId: string): Promise<Manuscript[]> {
  const colRef = collection(db, 'users', userId, 'manuscripts');
  const snapshot = await getDocs(colRef);
  const manuscripts: Manuscript[] = [];
  snapshot.forEach((d) => {
    manuscripts.push(d.data() as Manuscript);
  });
  manuscripts.sort((a, b) => (a.orderIndex ?? 0) - (b.orderIndex ?? 0));
  return manuscripts;
}

export async function deleteManuscriptFromCloud(userId: string, manuscriptId: string): Promise<void> {
  const ref = doc(db, 'users', userId, 'manuscripts', manuscriptId);
  await deleteDoc(ref);
}

// Cloud Milestone Storage
export async function saveMilestoneToCloud(userId: string, milestone: Milestone): Promise<void> {
  const ref = doc(db, 'users', userId, 'manuscripts', milestone.manuscriptId, 'milestones', milestone.id);
  await setDoc(ref, {
    ...milestone,
    userId,
  });
}

export async function getMilestonesFromCloud(userId: string, manuscriptId: string): Promise<Milestone[]> {
  const colRef = collection(db, 'users', userId, 'manuscripts', manuscriptId, 'milestones');
  const snapshot = await getDocs(colRef);
  const milestones: Milestone[] = [];
  snapshot.forEach((d) => {
    milestones.push(d.data() as Milestone);
  });
  milestones.sort((a, b) => b.createdAt - a.createdAt);
  return milestones;
}

export async function deleteMilestoneFromCloud(
  userId: string,
  manuscriptId: string,
  milestoneId: string
): Promise<void> {
  const ref = doc(db, 'users', userId, 'manuscripts', manuscriptId, 'milestones', milestoneId);
  await deleteDoc(ref);
}

// Cloud Folders Storage
export async function saveFolderToCloud(userId: string, folder: ManuscriptFolder): Promise<void> {
  const ref = doc(db, 'users', userId, 'folders', folder.id);
  await setDoc(ref, {
    ...folder,
    userId,
  });
}

export async function getFoldersFromCloud(userId: string): Promise<ManuscriptFolder[]> {
  const colRef = collection(db, 'users', userId, 'folders');
  const snapshot = await getDocs(colRef);
  const folders: ManuscriptFolder[] = [];
  snapshot.forEach((d) => {
    folders.push(d.data() as ManuscriptFolder);
  });
  return folders;
}

export async function deleteFolderFromCloud(userId: string, folderId: string): Promise<void> {
  const ref = doc(db, 'users', userId, 'folders', folderId);
  await deleteDoc(ref);
}
