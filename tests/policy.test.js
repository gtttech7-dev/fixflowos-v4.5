import test from 'node:test';
import assert from 'node:assert/strict';
import {ROLES,ORDER_STATUSES,OWN_STATUSES,can,stripFields,validPassword,amount,qty,profitability,nextDueDates} from '../server/policy.js';

test('perfis de loja são cinco e Super Admin não é concedível como papel',()=>{
 assert.deepEqual(ROLES,['ADMIN','GERENTE','VENDEDOR','TECNICO','VENDEDOR_TECNICO']);
 assert.equal(ROLES.includes('SUPER_ADMIN'),false);
});
test('cada perfil pode editar OS, mas apenas financeiro registra pagamento',()=>{
 for(const role of ROLES)assert.equal(can(role,'serviceOrders','update'),true);
 assert.throws(()=>stripFields('serviceOrders',{paymentStatus:'Pago'},'TECNICO'),{status:403});
});
test('técnico e vendedor técnico não administram estoque',()=>{
 for(const role of ['TECNICO','VENDEDOR_TECNICO']){
  assert.equal(can(role,'products','update'),false);
  assert.equal(can(role,'products','delete'),false);
 }
 assert.equal(can('GERENTE','products','create'),true);
});
test('financeiro só para gestão; consulta do caixa para todos os perfis',()=>{
 for(const role of ['VENDEDOR','TECNICO','VENDEDOR_TECNICO']){
  assert.equal(can(role,'finance','read'),false);
  assert.equal(can(role,'cashSessions','read'),true);
  assert.equal(can(role,'cashMovements','read'),true);
 }
 assert.equal(can('ADMIN','finance','create'),true);
 assert.equal(can('GERENTE','finance','update'),false);
});
test('registros auditáveis não podem ser manipulados com CRUD genérico',()=>{
 for(const col of ['users','events','sales','stockMovements','cashMovements','cashSessions'])
  for(const role of ROLES)assert.equal(can(role,col,'create'),false);
});
test('nega campos fora da lista, como uid de administrador e storeId',()=>{
 assert.throws(()=>stripFields('customers',{storeId:'outra-loja'},'ADMIN'),{status:400});
 assert.throws(()=>stripFields('customers',{role:'SUPER_ADMIN'},'ADMIN'),{status:400});
 assert.deepEqual(stripFields('customers',{name:'Maria'},'VENDEDOR'),{name:'Maria'});
});
test('perfil técnico não altera valores de aparelho próprio',()=>{
 assert.throws(()=>stripFields('storeDevices',{acquisitionCost:0},'TECNICO'),{status:403});
 assert.deepEqual(stripFields('storeDevices',{notes:'Tela substituída',status:'Em reparo'},'TECNICO'),{notes:'Tela substituída',status:'Em reparo'});
});
test('status técnicos permitidos foram definidos na especificação',()=>{
 assert.equal(ORDER_STATUSES.length,11);assert.equal(OWN_STATUSES.length,11);
 assert.throws(()=>stripFields('serviceOrders',{status:'Não existe'},'ADMIN'),{status:400});
});
test('regra de senhas numéricas da equipe e proprietário',()=>{
 assert.equal(validPassword('12345678'),true);assert.equal(validPassword('1234567'),false);
 assert.equal(validPassword('aaa12345678'),false);assert.equal(validPassword('00000000'),true);
});
test('cálculos financeiros não aceitam negativos e expõem lucro e margem',()=>{
 assert.equal(amount(21.239),21.24);assert.throws(()=>amount(-1));
 assert.throws(()=>qty(2.5));assert.equal(qty(2),2);
 assert.deepEqual(profitability(2150,2699),{cost:2150,price:2699,profit:549,margin:20.34});
});
test('recorrência mensal preserva dia útil possível e evita duplicação de vencimentos',()=>{
 assert.deepEqual(nextDueDates('2026-01-31','Mensal',3),['2026-02-28','2026-03-31','2026-04-30']);
 assert.deepEqual(nextDueDates('2026-01-01','Semanal',2),['2026-01-08','2026-01-15']);
 assert.deepEqual(nextDueDates('2024-02-29','Anual',2),['2025-02-28','2026-02-28']);
});

test('fornecedores exclusivos do dono',()=>{for(const role of ROLES)assert.equal(can(role,'suppliers','read'),role==='ADMIN');assert.equal(can('GERENTE','suppliers','create'),false);});
