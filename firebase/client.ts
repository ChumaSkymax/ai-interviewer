// Import the functions you need from the SDKs you need
import { initializeApp, getApp, getApps } from "firebase/app";
import { getFirestore } from "firebase/firestore";
import { getAuth } from "firebase/auth";

// Your web app's Firebase configuration
const firebaseConfig = {
  apiKey: "AIzaSyCVb7tVpzbPhMJoZhFphO12x37msSTMbdk",
  authDomain: "ai-interviewer-13a81.firebaseapp.com",
  projectId: "ai-interviewer-13a81",
  storageBucket: "ai-interviewer-13a81.firebasestorage.app",
  messagingSenderId: "648929479100",
  appId: "1:648929479100:web:5c75fd8e6d5cb47b4003b9",
};

// Initialize Firebase
const app = !getApps().length ? initializeApp(firebaseConfig) : getApp();

export const auth = getAuth(app);
export const db = getFirestore(app);
