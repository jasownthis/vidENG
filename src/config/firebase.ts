import { initializeApp } from 'firebase/app';
import { getAuth, initializeAuth, getReactNativePersistence } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';
import { getStorage } from 'firebase/storage';
import AsyncStorage from '@react-native-async-storage/async-storage';

// Firebase configuration - from your google-services.json
const firebaseConfig = {
  apiKey: "AIzaSyBdnHDWR4TvHRFrGqssjV2Jfb_xYAK-I2g",
  authDomain: "videng-reading-app.firebaseapp.com",
  projectId: "videng-reading-app",
  storageBucket: "videng-reading-app.firebasestorage.app",
  messagingSenderId: "934398802463",
  appId: "1:934398802463:android:be471a9473adb9dcedb32a"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);

// Initialize Auth with AsyncStorage persistence for React Native
const auth = initializeAuth(app, {
  persistence: getReactNativePersistence(AsyncStorage)
});

// Initialize Firestore Database
const db = getFirestore(app);

// Initialize Cloud Storage
const storage = getStorage(app);

export { auth, db, storage };
export default app;
