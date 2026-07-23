// Firebase Web SDK initialization (client-side).
// Config values come from NEXT_PUBLIC_* env vars (public by design).
import { initializeApp, getApps, getApp, type FirebaseApp } from "firebase/app";
import { getAuth, type Auth } from "firebase/auth";
import {
  initializeFirestore,
  getFirestore,
  type Firestore,
} from "firebase/firestore";
import { getStorage, type FirebaseStorage } from "firebase/storage";

const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
  measurementId: process.env.NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID,
};

const app: FirebaseApp = getApps().length ? getApp() : initializeApp(firebaseConfig);

export const auth: Auth = getAuth(app);

// ignoreUndefinedProperties: forms pass `undefined` for empty optional fields;
// without this, the Web SDK throws "Unsupported field value: undefined" on write.
// initializeFirestore must run once; fall back to getFirestore on hot-reload.
export const db: Firestore = (() => {
  try {
    return initializeFirestore(app, { ignoreUndefinedProperties: true });
  } catch {
    return getFirestore(app);
  }
})();

export const storage: FirebaseStorage = getStorage(app);
export default app;
