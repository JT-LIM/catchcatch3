import { initializeApp, getApps, getApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";

const firebaseConfig = {
  apiKey: "AIzaSyA5bUoUqMg5tQwFosC3VgFU8LR7sOQNTm8",
  authDomain: "deoksoms-jt.firebaseapp.com",
  projectId: "deoksoms-jt",
  storageBucket: "deoksoms-jt.firebasestorage.app",
  messagingSenderId: "216235168634",
  appId: "1:216235168634:web:65b5495b840352feb03cc3",
  measurementId: "G-65R7RYW951"
};

// Next.js SSR 환경에서 앱 중복 초기화 방지
const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApp();
const db = getFirestore(app);

export { app, db };
