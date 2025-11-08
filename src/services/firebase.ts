
import { initializeApp, getApps, FirebaseApp } from "firebase/app";
import { getAuth, setPersistence, browserLocalPersistence } from "firebase/auth";

// TODO: Replace with your own Firebase project configuration
const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_APP_ID
};

// Initialize Firebase (guard so it doesn't re-init in Fast Refresh / multiple imports)
const app: FirebaseApp = getApps().length ? getApps()[0] : initializeApp(firebaseConfig);

// Export the initialized app for other Firebase services (e.g., Firestore)
export const firebaseApp = app;

// Auth instance
export const auth = getAuth(app);

// Set persistence (local keeps user signed in across tabs & reloads)
try {
  void setPersistence(auth, browserLocalPersistence);
} catch (e) {
  // Non-fatal: log for debugging only.
  console.warn('Failed to set auth persistence', e);
}
