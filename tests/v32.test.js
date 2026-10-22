import test from 'node:test';
import assert from 'node:assert/strict';
import {planLimit,planPeriod,PLAN_PERIODS,dueDateFor,installmentAmounts,financialPosition,settleDocument} from '../server/plans.js';
import {can} from '../server/policy.js';
import {storeFinanceMonths} from '../src/lib/finance-chart.js';

test('planos permitem periodicidades e limite personalizado ou ilimitado',()=>{
 assert.deepEqual(PLAN_PERIODS,['Semanal','Mensal','Trimestral','Anual','Vitalício']);
 assert.equal(planPeriod('Trimestral'),'Trimestral');assert.equal(planLimit(7),7);assert.equal(planLimit(null),null);assert.equal(planLimit('unlimited'),null);
 assert.throws(()=>planLimit(0));assert.throws(()=>planLimit(1.3));assert.throws(()=>planPeriod('Mensalmente'));
});
test('datas respeitam periodicidade e plano vitalício sem vencimento periódico',()=>{
 assert.equal(dueDateFor('2026-01-31','Semanal',1),'2026-02-07');
 assert.equal(dueDateFor('2026-01-31','Mensal',1),'2026-02-28');
 assert.equal(dueDateFor('2026-01-31','Trimestral',1),'2026-04-30');
 assert.equal(dueDateFor('2026-02-28','Anual',1),'2027-02-28');
 assert.equal(dueDateFor('2026-01-31','Vitalício',1),null);
});
test('parcelas mantêm somatório exato e nunca criam pagamento recebido',()=>{
 const values=installmentAmounts(100,3);assert.deepEqual(values,[33.34,33.33,33.33]);
 assert.equal(Math.round(values.reduce((a,b)=>a+b,0)*100),10000);
 assert.deepEqual(financialPosition({amount:100,status:'Pendente'}),{received:0,outstanding:100});
});
test('pagamento parcial sem exceder dívida',()=>{
 assert.deepEqual(settleDocument({amount:100,status:'Pendente'},30),{paidAmount:30,status:'Parcialmente pago'});
 assert.deepEqual(settleDocument({amount:100,status:'Parcialmente pago',payments:[{amount:30}]},70),{paidAmount:100,status:'Pago'});
 assert.throws(()=>settleDocument({amount:100,paidAmount:80},30));
});
test('painel financeiro só é lido pelo dono (não gerente)',()=>{
 for(const role of ['GERENTE','VENDEDOR','TECNICO','VENDEDOR_TECNICO'])assert.equal(can(role,'finance','read'),false);
 assert.equal(can('ADMIN','finance','read'),true);
});
test('gráficos de loja separam pagamento confirmado de OS pendente',()=>{
 const dates=storeFinanceMonths([{type:'receita',amount:100,status:'Pago',paidAt:'2026-10-10'},{type:'despesa',amount:40,status:'Pago',paidAt:'2026-10-11'}],[{id:'order',createdAt:'2026-10-08',total:350,payments:[{amount:100}],status:'Em reparo'}],new Date('2026-10-18T00:00:00Z'),1);
 assert.deepEqual(dates,[{month:'2026-10',received:100,spent:40,pending:250}]);
});
