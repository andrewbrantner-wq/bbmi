import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';

// Replace these with your actual Firebase config values
// Get these from: Firebase Console > Project Settings > Your apps > Web app
// Import the functions you need from the SDKs you need
// TODO: Add SDKs for Firebase products that you want to use
// https://firebase.google.com/docs/web/setup#available-libraries

// Your web app's Firebase configuration
const firebaseConfig = {
  apiKey: "AIzaSyCCrpVipTj6BBy9jFsgrsHoXzgY9kXLW3A",
  authDomain: "bbmi-hoops.firebaseapp.com",
  projectId: "bbmi-hoops",
  storageBucket: "bbmi-hoops.firebasestorage.app",
  messagingSenderId: "670661718938",
  appId: "1:670661718938:web:e7b974ef841c885596c023"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);


// Initialize Firebase Authentication
export const auth = getAuth(app);
