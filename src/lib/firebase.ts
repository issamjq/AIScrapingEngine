import { initializeApp } from "firebase/app"
import { getAuth, GoogleAuthProvider } from "firebase/auth"
import { getAnalytics } from "firebase/analytics"

const firebaseConfig = {
  apiKey: "AIzaSyBZt_ZCEUyZOV8ZS4KsnBSzjf_mIE4_FYg",
  authDomain: "ai-scraping-engine.firebaseapp.com",
  projectId: "ai-scraping-engine",
  storageBucket: "ai-scraping-engine.firebasestorage.app",
  messagingSenderId: "249544421091",
  appId: "1:249544421091:web:6a7c2cdfa62412997adfd6",
  measurementId: "G-M8CJ37BQPN",
}

export const app = initializeApp(firebaseConfig)
export const auth = getAuth(app)
export const analytics = typeof window !== "undefined" ? getAnalytics(app) : null

// Google provider — Gmail enforcement is done in AuthContext after sign-in
export const googleProvider = new GoogleAuthProvider()
googleProvider.addScope("email")
googleProvider.addScope("profile")
