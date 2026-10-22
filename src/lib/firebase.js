import { initializeApp, getApps } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getStorage } from 'firebase/storage';
const config={
  apiKey:import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain:import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId:import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket:import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId:import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId:import.meta.env.VITE_FIREBASE_APP_ID,
};
export const configured=Boolean(config.apiKey&&config.authDomain&&config.projectId&&config.appId);
let firebaseApp;
export function app(){if(!configured)throw new Error('Preencha as variáveis públicas Firebase no .env');return firebaseApp||(firebaseApp=getApps()[0]||initializeApp(config));}
export function auth(){return getAuth(app());}
export function storage(){return getStorage(app());}
