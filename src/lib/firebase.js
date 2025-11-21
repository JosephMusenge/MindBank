import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';

// Firebase config from console
// For Firebase JS SDK v7.20.0 and later
const firebaseConfig = {
    apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
    authDomain: "mind-bank-app.firebaseapp.com",
    projectId: "mind-bank-app",
    storageBucket: "mind-bank-app.firebasestorage.app",
    messagingSenderId: "813262607244",
    appId: "1:813262607244:web:e2507dbb067150a4613ca9",
    measurementId: "G-0P2HCV7KYR"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);

// Export the services so other files can use them
export const auth = getAuth(app);
export const db = getFirestore(app);