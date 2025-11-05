import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";

// जरूरी: नीचे दी गई प्लेसहोल्डर वैल्यूज को अपने खुद के Firebase प्रोजेक्ट कॉन्फ़िगरेशन से बदलें।
// यह जानकारी आपको अपने Firebase प्रोजेक्ट की सेटिंग्स में मिलेगी।
// देखें: https://firebase.google.com/docs/web/setup#available-libraries
const firebaseConfig = {
  apiKey: "AIzaSy_REPLACE_WITH_YOUR_KEY",
  authDomain: "your-project-id.firebaseapp.com",
  projectId: "your-project-id",
  storageBucket: "your-project-id.appspot.com",
  messagingSenderId: "your-sender-id",
  appId: "1:your-sender-id:web:your-app-id"
};

// Firebase को शुरू करें
const app = initializeApp(firebaseConfig);

// डेटाबेस से इंटरैक्ट करने के लिए Firestore इंस्टैंस प्राप्त करें
export const db = getFirestore(app);
