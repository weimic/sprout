
import { initializeApp, getApps, FirebaseApp } from "firebase/app";
import { getAuth, setPersistence, browserLocalPersistence } from "firebase/auth";

// TODO: Replace with your own Firebase project configuration
const firebaseConfig = {
  apiKey: "YOUR_API_KEY",
  authDomain: "YOUR_AUTH_DOMAIN",
  projectId: "YOUR_PROJECT_ID",
  storageBucket: "YOUR_STORAGE_BUCKET",
  messagingSenderId: "YOUR_MESSAGING_SENDER_ID",
  appId: "YOUR_APP_ID"
};

// Initialize Firebase (guard so it doesn't re-init in Fast Refresh / multiple imports)
const app: FirebaseApp = getApps().length ? getApps()[0] : initializeApp(firebaseConfig);

// Auth instance
export const auth = getAuth(app);

// Set persistence (local keeps user signed in across tabs & reloads)
try {
  void setPersistence(auth, browserLocalPersistence);
} catch (e) {
  // Non-fatal: log for debugging only.
  // eslint-disable-next-line no-console
  console.warn('Failed to set auth persistence', e);
}
