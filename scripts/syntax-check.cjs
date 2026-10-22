const ts=require('/opt/nvm/versions/node/v22.16.0/lib/node_modules/typescript');
const fs=require('fs'),path=require('path');
const root=path.resolve(__dirname,'..');
let errors=0,checked=0;
function visit(folder){for(const entry of fs.readdirSync(folder,{withFileTypes:true})){const full=path.join(folder,entry.name);if(entry.isDirectory()){if(!['node_modules','dist'].includes(entry.name))visit(full);}else if(/\.(js|jsx|mjs)$/.test(entry.name)){
 const content=fs.readFileSync(full,'utf8');const sf=ts.createSourceFile(full,content,ts.ScriptTarget.Latest,true,entry.name.endsWith('.jsx')?ts.ScriptKind.JSX:ts.ScriptKind.JS);
 checked++;for(const d of sf.parseDiagnostics){errors++;console.error(full,ts.flattenDiagnosticMessageText(d.messageText,'\n'));}
 }} }
visit(root);console.log(`${checked} arquivos JavaScript/JSX verificados: ${errors} erro(s) de sintaxe.`);process.exitCode=errors>0?1:0;
