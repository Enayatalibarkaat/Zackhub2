// Import the functions you need from the SDKs you need
import { initializeApp } from "firebase/app";
import { getAnalytics } from "firebase/analytics";
// TODO: Add SDKs for Firebase products that you want to use
// https://firebase.google.com/docs/web/setup#available-libraries

// Your web app's Firebase configuration
// For Firebase JS SDK v7.20.0 and later, measurementId is optional
const firebaseConfig = {
  apiKey: "AIzaSyB_CE95Hyc_KLU4LljAwicTT7UOIaA1T_c",
  authDomain: "zackhub2.firebaseapp.com",
  projectId: "zackhub2",
  storageBucket: "zackhub2.firebasestorage.app",
  messagingSenderId: "96379295937",
  appId: "1:96379295937:web:7e466c3d401fb54e0b9c40",
  measurementId: "G-5VHBYL13TQ"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const analytics = getAnalytics(app);
