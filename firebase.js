import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';

const firebaseConfig = {
  apiKey: "AIzaSyCWpzz36TfGiM45DOWScqty4sIgzyKZupM",
  authDomain: "touchbase-f55e5.firebaseapp.com",
  projectId: "touchbase-f55e5",
  storageBucket: "touchbase-f55e5.firebasestorage.app",
  messagingSenderId: "552807892514",
  appId: "1:552807892514:web:df9a8c36a536ca3b252c7b"
};

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);