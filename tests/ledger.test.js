import test from 'node:test';
import assert from 'node:assert/strict';
import {orderBalance,orderReceivables,storeLedger} from '../src/lib/ledger.js';
import {actionLabel,describeEvent} from '../server/activity.js';
const now=new Date('2026-10-17T18:00:00Z');
test('OS recém-criada gera valor a receber e não é receita recebida',()=>{
 const os={id:'abc',status:'Aguardando avaliação',createdAt:'2026-10-17T10:00:00Z',total:500,payments:[]};
 const led=storeLedger([], [os],{filter:'all',now});assert.equal(led.received,0);assert.equal(led.outstanding,500);
});
test('entrada parcial e liquidação de OS reduzem somente valor pendente',()=>{
 const os={id:'abc',status:'Pronto para retirada',createdAt:'2026-10-17T10:00:00Z',total:500,payments:[{amount:200}]};
 const confirmed=[{id:'r1',type:'receita',amount:200,status:'Pago',paidAt:'2026-10-17T11:00:00Z',sourceId:'abc'}];
 const led=storeLedger(confirmed,[os],{filter:'all',now});assert.equal(led.outstanding,300);assert.equal(led.received,200);
 const settled=storeLedger([...confirmed,{...confirmed[0],id:'r2',amount:300}], [{...os,payments:[{amount:200},{amount:300}]}],{filter:'all',now});
 assert.equal(settled.outstanding,0);assert.equal(settled.received,500);
});
test('OS cancelada não gera pendência, cobranças manuais não duplicam OS',()=>{
 const a={id:'a',status:'Cancelado',createdAt:'2026-10-16',total:120};
 const b={id:'b',status:'Em reparo',createdAt:'2026-10-16',total:250,payments:[]};
 const f=[{type:'receita',amount:250,status:'Pendente',sourceId:'b',dueDate:'2026-10-19'},{type:'receita',amount:100,status:'Pendente',dueDate:'2026-10-19'}];
 assert.equal(storeLedger(f,[a,b],{filter:'all',now}).outstanding,350);
});
test('auditoria escreve nomes compreensíveis e não códigos',()=>{
 assert.match(describeEvent('customers.create','customers','xyz',{after:{name:'Maria'}}),/Cadastrou cliente Maria/);
 assert.match(describeEvent('serviceOrders.payment','serviceOrders','abcd',{after:{number:'1045'}}),/recebimento de .* na OS 1045/);
 assert.equal(actionLabel('sales.finalize'),'Venda');
});
test('período usa data de criação da OS e não atribui pagamento futuro ao passado',()=>{
 const os={id:'a',status:'Pronto para retirada',createdAt:'2026-09-29T10:00:00Z',total:500,payments:[]};
 assert.equal(storeLedger([], [os],{filter:'month',now}).outstanding,0);
 assert.equal(storeLedger([], [os],{filter:'all',now}).outstanding,500);
});
