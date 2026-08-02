import { initializeApp, getApps, getApp, type FirebaseApp } from "firebase/app";
import { getAuth, type Auth } from "firebase/auth";
import { getFirestore, type Firestore } from "firebase/firestore";
import { getStorage, type FirebaseStorage } from "firebase/storage";

const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID
};

let appInstance: FirebaseApp | undefined;
let authInstance: Auth | undefined;
let dbInstance: Firestore | undefined;
let storageInstance: FirebaseStorage | undefined;

// Every screen in this app is a "use client" component — auth state, dashboard figures,
// products, everything is fetched after mount, in the browser. Nothing here needs Firebase
// during server-side rendering. But `next build`'s static-generation pass still executes the
// full module graph for every route (even client-only ones), so a top-level `getAuth(app)`
// used to run at build time and throw `auth/invalid-api-key` the moment the env vars were
// missing or malformed — crashing the build even though no page actually needed Firebase yet.
// Guarding on `typeof window` keeps initialization out of that server pass entirely.
if (typeof window !== "undefined") {
  appInstance = getApps().length ? getApp() : initializeApp(firebaseConfig);
  authInstance = getAuth(appInstance);
  dbInstance = getFirestore(appInstance);
  storageInstance = getStorage(appInstance);
}

// Cast away `| undefined`: every real call site (inside useEffect / event handlers) only
// ever runs in the browser, where these are always initialized by the block above.
export const app = appInstance as FirebaseApp;
export const auth = authInstance as Auth;
export const db = dbInstance as Firestore;
export const storage = storageInstance as FirebaseStorage;
