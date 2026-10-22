import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const file=p=>fs.readFileSync(path.join(root,p),'utf8');
test('estrutura principal presente e documentação original preservada',()=>{
 for(const p of ['package.json','README.md','index.html','vite.config.js','vercel.json','firebase.json','firestore.rules','firestore.indexes.json','storage.rules','.env.example','api/index.js','server/handler.js','src/main.jsx','src/App.jsx','docs/ESPECIFICACAO_ORIGINAL_V3.txt'])
  assert.ok(fs.existsSync(path.join(root,p)),`${p} faltando`);
});
test('regras do Firestore negam escrita direta; backend usa UID verificado',()=>{
 const rules=file('firestore.rules');const server=file('server/handler.js');
 assert.match(rules,/allow read, write: if false/);assert.doesNotMatch(rules,/allow write: if true/);
 assert.match(server,/verifyIdToken\(bearer\.slice\(7\),true\)/);
 assert.match(server,/storeId:m\?\.storeId/);
 assert.match(server,/stores'\)\.doc\(ctx\.storeId\)/);
});
test('não existe cadastro público do Super Admin e autorização consulta documento seguro',()=>{
 assert.match(file('server/handler.js'),/collection\('platform'\)\.doc\('admins'\)\.collection\('users'\)/);
 assert.doesNotMatch(file('src/pages/Login.jsx'),/createUserWithEmailAndPassword/);
});
test('credencial do servidor não é pública no arquivo de exemplo',()=>{
 const env=file('.env.example');assert.match(env,/FIREBASE_SERVICE_ACCOUNT_JSON=/);
 assert.doesNotMatch(env,/VITE_FIREBASE_SERVICE_ACCOUNT_JSON/);
 assert.doesNotMatch(env,/-----BEGIN PRIVATE KEY-----/);
});
test('rotas de módulos operacionais, financeiro e Super Admin presentes',()=>{
 const app=file('src/App.jsx');for(const route of ['/os','/estoque','/vendas','/caixa','/financeiro','/super-admin','/aparelhos-da-loja','/historico','/relatorios','/equipe','/alertas'])assert.ok(app.includes(route),route);
});
test('todos os imports relativos do código JavaScript e JSX resolvem para arquivos locais',()=>{
 const roots=['src','server','api','scripts','tests'];const found=[];
 const recurse=dir=>{for(const ent of fs.readdirSync(dir,{withFileTypes:true})){const p=path.join(dir,ent.name);if(ent.isDirectory())recurse(p);else if(/\.(jsx|js|mjs|cjs)$/.test(ent.name))found.push(p)}};
 roots.forEach(r=>recurse(path.join(root,r)));
 for(const p of found){const code=fs.readFileSync(p,'utf8');for(const match of code.matchAll(/(?:from\s+|import\s*\(|require\()['"](\.{1,2}\/[^'"()]+)['"]/g)){
 const imp=match[1],resolved=path.resolve(path.dirname(p),imp);
 const options=[resolved,resolved+'.js',resolved+'.jsx',resolved+'.mjs',resolved+'.css',path.join(resolved,'index.js')];
 assert.ok(options.some(x=>fs.existsSync(x)),`${p}: import não resolvido ${imp}`);
 }}
});
