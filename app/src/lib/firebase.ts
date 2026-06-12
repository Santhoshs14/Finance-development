import { initializeApp, getApps, type FirebaseApp } from "firebase/app";
import { getAuth, type Auth } from "firebase/auth";
import {
  getFirestore,
  type Firestore,
} from "firebase/firestore";

const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY || "mock_key",
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN || "mock_domain",
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || "mock_project_id",
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET || "mock_bucket",
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID || "mock_sender",
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID || "mock_app_id",
  measurementId: process.env.NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID || "mock_measurement_id",
};

// Initialize Firebase (singleton pattern for hot-reload)
function getFirebaseApp(): FirebaseApp {
  const existing = getApps()[0];
  if (existing) return existing;
  return initializeApp(firebaseConfig);
}

export const app: FirebaseApp = getFirebaseApp();
export const auth: Auth = getAuth(app);
export const db: Firestore = getFirestore(app);

export default app;
