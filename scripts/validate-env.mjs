import {readFileSync,existsSync} from 'node:fs';
const required=['VITE_FIREBASE_API_KEY','VITE_FIREBASE_AUTH_DOMAIN','VITE_FIREBASE_PROJECT_ID','VITE_FIREBASE_STORAGE_BUCKET','VITE_FIREBASE_MESSAGING_SENDER_ID','VITE_FIREBASE_APP_ID','FIREBASE_SERVICE_ACCOUNT_JSON'];
let vals={...process.env};
if(existsSync('.env'))for(const line of readFileSync('.env','utf8').split(/\r?\n/)){const m=line.match(/^\s*([A-Z][A-Z0-9_]*)=(.*)$/);if(m)vals[m[1]]=m[2].trim().replace(/^['"]|['"]$/g,'');}
const missing=required.filter(k=>!vals[k]);
if(missing.length){console.error('Variáveis ausentes:',missing.join(', '));process.exitCode=1;}
else{console.log('Todas as variáveis obrigatórias estão definidas.');try{const doc=JSON.parse(vals.FIREBASE_SERVICE_ACCOUNT_JSON);if(!doc.project_id||!doc.private_key||!doc.client_email)throw new Error();console.log('Formato do JSON administrativo: OK (conteúdo não exibido).')}catch{console.error('JSON administrativo inválido/incompleto.');process.exitCode=1}}
