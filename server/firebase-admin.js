import { initializeApp, getApps, cert, applicationDefault } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore } from 'firebase-admin/firestore';

export function services(){
  if(!getApps().length){
    const raw=process.env.FIREBASE_SERVICE_ACCOUNT_JSON;
    if(!raw) throw Object.assign(new Error('Credenciais administrativas Firebase não configuradas'),{status:503});
    let account;
    try { account=JSON.parse(raw); } catch {throw Object.assign(new Error('FIREBASE_SERVICE_ACCOUNT_JSON inválido'),{status:503});}
    initializeApp({ credential:cert(account), projectId:account.project_id, storageBucket:process.env.VITE_FIREBASE_STORAGE_BUCKET||undefined });
  }
  return {auth:getAuth(), db:getFirestore()};
}
