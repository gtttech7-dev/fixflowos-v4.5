/** Série financeira para visualização — não mistura previsões com pagamentos. */
import {orderBalance} from './ledger.js';
const num=v=>Math.round((Number(v)||0)*100)/100;
export function storeFinanceMonths(finance,orders,now=new Date(),length=6){
 const keys=Array.from({length},(_,i)=>{const d=new Date(Date.UTC(now.getUTCFullYear(),now.getUTCMonth()-(length-1-i),1,12));return d.toISOString().slice(0,7)});
 const map=new Map(keys.map(month=>[month,{month,received:0,spent:0,pending:0}]));
 const put=(date,key,value)=>{const item=map.get(String(date||'').slice(0,7));if(item)item[key]=num(item[key]+Number(value||0))};
 for(const f of finance||[]){
  if(f.status==='Cancelado')continue;
  if(f.status==='Pago')put(f.paidAt||f.createdAt,f.type==='receita'?'received':'spent',f.amount);
  else if(f.type==='receita'&&!f.sourceId)put(f.dueDate||f.createdAt,'pending',f.amount);
 }
 for(const o of orders||[]){if(o.status==='Cancelado')continue;const left=orderBalance(o).outstanding;if(left>0)put(o.createdAt,'pending',left);}
 return [...map.values()];
}
