/** Regras puras de planos e liquidação monetária (valores em centavos). */
export const PLAN_PERIODS=['Semanal','Mensal','Trimestral','Anual','Vitalício'];
export function planLimit(value){
 if(value==='unlimited'||value===null)return null;
 const n=Number(value);
 if(!Number.isSafeInteger(n)||n<1||n>100000)throw Object.assign(new Error('Limite de usuários deve ser inteiro positivo ou ilimitado'),{status:400});
 return n;
}
export function planPeriod(value){
 if(!PLAN_PERIODS.includes(value))throw Object.assign(new Error('Periodicidade inválida'),{status:400});
 return value;
}
export function dueDateFor(start,period,index=1){
 const d=new Date(`${String(start).slice(0,10)}T12:00:00Z`);
 if(!Number.isFinite(d.getTime())||!Number.isSafeInteger(index)||index<1)throw new Error('Data de início inválida');
 if(period==='Vitalício')return null;
 if(!PLAN_PERIODS.includes(period))throw new Error('Periodicidade inválida');
 if(period==='Semanal'){d.setUTCDate(d.getUTCDate()+index*7);return d.toISOString().slice(0,10);}
 const months=period==='Mensal'?index:period==='Trimestral'?3*index:12*index;
 const firstDay=new Date(Date.UTC(d.getUTCFullYear(),d.getUTCMonth()+months,1,12));
 firstDay.setUTCDate(Math.min(d.getUTCDate(),new Date(Date.UTC(firstDay.getUTCFullYear(),firstDay.getUTCMonth()+1,0)).getUTCDate()));
 return firstDay.toISOString().slice(0,10);
}
export function cents(v){const n=Number(v);if(!Number.isFinite(n)||n<0||n>1e9)throw new Error('Valor inválido');return Math.round(n*100);}
export function installmentAmounts(price,count){
 if(!Number.isSafeInteger(count)||count<1||count>36)throw new Error('Quantidade de parcelas deve ser de 1 a 36');
 const total=cents(price),base=Math.floor(total/count);return Array.from({length:count},(_,i)=>(base+(i<total%count?1:0))/100);
}
export function paidCents(doc){
 if(Array.isArray(doc.payments))return doc.payments.reduce((v,x)=>v+cents(x.amount),0);
 if(doc.paidAmount!==undefined&&doc.paidAmount!==null)return cents(doc.paidAmount);
 return doc.status==='Pago'?cents(doc.amount||0):0;
}
export function financialPosition(doc){const total=cents(doc.amount||0),paid=Math.min(total,paidCents(doc));return {received:paid/100,outstanding:doc.status==='Cancelado'?0:(total-paid)/100};}
export function settleDocument(doc,value){
 const total=cents(doc.amount||0),paid=paidCents(doc),addition=cents(value);
 if(addition<=0||paid+addition>total)throw Object.assign(new Error('Valor excede o saldo pendente'),{status:400});
 return {paidAmount:(paid+addition)/100,status:paid+addition===total?'Pago':'Parcialmente pago'};
}
