import { auth } from './firebase';
const cache=new Map();const pending=new Map();let epoch=0;
const TTL=60000;
const samples=[];
export const requestMetrics=()=>samples.filter(x=>Date.now()-x.at<600000);
export function clearApiCache(){epoch++;cache.clear();pending.clear();}
function recordSample(action,ms,status){samples.push({action,ms,status,at:Date.now()});if(samples.length>250)samples.splice(0,samples.length-250);}
const readActions=new Set(['records.list','records.page','catalog.search','orders.page','dashboard.summary','platform.list','platform.metrics','store.info']);
export async function api(action,params={}){
  const user=auth().currentUser;
  if(!user)throw new Error('Faça login para continuar.');
  // O UID impede compartilhamento de cache entre usuários na mesma máquina.
  const key=JSON.stringify([user.uid,action,params]);
  if(readActions.has(action)){
    const old=cache.get(key);const ttl=(action==='records.list'&&['users','products','storeDevices','sales','cashMovements'].includes(params.collection))?15000:TTL;if(old&&Date.now()-old.at<ttl)return old.data;
    if(pending.has(key))return pending.get(key);
  }else if(!['me','drafts.get','preferences.update'].includes(action)){clearApiCache();}
  const started=Date.now(),startedEpoch=epoch;
  const promise=(async()=>{
    const token=await user.getIdToken();let response;
    try{response=await fetch('/api/index',{method:'POST',headers:{'Content-Type':'application/json',Authorization:`Bearer ${token}`},body:JSON.stringify({action,...params})});}
    catch{throw new Error('Não foi possível acessar o servidor. Verifique a conexão e o endereço da API.');}
    let body;try{body=await response.json();}catch{throw new Error('Resposta inválida do servidor.');}
    if(!response.ok||!body.ok)throw new Error(body.error||`Erro ${response.status}`);
    if(readActions.has(action)&&startedEpoch===epoch)cache.set(key,{data:body.data,at:Date.now()});
    return body.data;
  })();
  if(readActions.has(action))pending.set(key,promise);
  try{const data=await promise;recordSample(action,Date.now()-started,'OK');return data;}
  catch(e){recordSample(action,Date.now()-started,'ERRO');throw e;}
  finally{pending.delete(key);}
}
