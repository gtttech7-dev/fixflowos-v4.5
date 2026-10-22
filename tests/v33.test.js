import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {redactRecord} from '../server/redact.js';
import {stripFields,can} from '../server/policy.js';
const read=path=>readFileSync(new URL(path,import.meta.url),'utf8');
const baseProduct={id:'a',name:'Tela',quantity:2,minimum:5,cost:37,price:80,supplier:'Fornecedor',location:'Armário'};
test('Dono recebe custo, gerente vê só preço de venda e disponibilidade',()=>{
 const owner=redactRecord('products',baseProduct,'ADMIN','1');const manager=redactRecord('products',baseProduct,'GERENTE','2');
 assert.equal(owner.cost,37);assert.equal(manager.price,80);assert.equal(manager.availability,'Disponível');
 for(const key of ['cost','quantity','minimum','supplier','location'])assert.equal(manager[key],undefined);
});
test('Gerente não recebe lucro ou custos de aparelhos da loja',()=>{
 const device={id:'d',brand:'Samsung',model:'A52',intendedPrice:300,listedPrice:310,acquisitionCost:100,tradeValue:10,laborCost:30,additionalCosts:[{totalCost:10}],salePrice:290};
 const redacted=redactRecord('storeDevices',device,'GERENTE','2');
 for(const key of ['acquisitionCost','tradeValue','laborCost','additionalCosts','salePrice'])assert.equal(redacted[key],undefined);
 assert.equal(redacted.listedPrice,310);
});
test('Técnico e gerente não recebem custos internos do catálogo',()=>{
 for(const role of ['GERENTE','VENDEDOR','TECNICO','VENDEDOR_TECNICO']){
  const service=redactRecord('serviceCatalog',{name:'Tela',price:250,partCost:80,laborCost:50,otherCost:20},role,'u');
  assert.equal(service.price,250);assert.equal(service.partCost,undefined);assert.equal(service.laborCost,undefined);
 }
});
test('Vendas não expõem unitCost nem profit aos não proprietários',()=>{
 const sale={id:'s',sellerId:'u',total:100,profit:50,cost:50,items:[{unitPrice:100,unitCost:50,totalCost:50}]};
 const result=redactRecord('sales',sale,'GERENTE','x');assert.equal(result.total,100);assert.equal(result.profit,undefined);assert.equal(result.items[0].unitCost,undefined);
 assert.equal(redactRecord('sales',sale,'VENDEDOR','outro'),null);
});
test('Somente dono pode editar campos de custos',()=>{
 const cases=[['products',{cost:22}],['storeDevices',{acquisitionCost:200}],['serviceCatalog',{partCost:100}]];
 for(const [col,d] of cases)assert.throws(()=>stripFields(col,d,'GERENTE'),/Custos e lucros/);
 assert.deepEqual(stripFields('products',{price:100},'GERENTE'),{price:100});
});
test('Somente dono lê coleção financeira',()=>{
 assert.equal(can('GERENTE','finance','read'),false);assert.equal(can('ADMIN','finance','read'),true);
});
test('Consultas comuns não requisitam 500 por padrão e existe paginação server-side',()=>{
 const source=read('../server/handler.js');
 assert.match(source,/function recordsPage\(/);assert.match(source,/function ordersPage\(/);
 assert.match(source,/function dashboardSummary\(/);assert.match(source,/\.count\(\)\.get\(\)/);
 assert.doesNotMatch(read('../src/lib/useData.jsx'),/limit:500/);
});
test('OS permite filtro de status, busca por nome e página com cursor',()=>{
 const source=read('../server/handler.js');assert.match(source,/customerName/);assert.match(source,/startAfter\(cursor\)/);
 const screen=read('../src/pages/Orders.jsx');assert.match(screen,/Em testes/);assert.match(screen,/Pronto para retirada/);assert.match(screen,/orders.page/);
});
test('Extrato da OS exibe pagamento recebido e saldo pendente',()=>{
 const view=read('../src/pages/CrudPage.jsx');assert.match(view,/Já recebido/);assert.match(view,/Falta receber/);assert.match(view,/order.payments.map/);
});
test('Super Admin pode arquivar, restaurar e iniciar exclusão com confirmação',()=>{
 const source=read('../server/handler.js');for(const action of ['stores.archive','stores.restore','stores.delete'])assert.ok(source.includes(action));
 assert.match(source,/recursiveDelete/);assert.match(source,/backupConfirmed/);
});
test('Botão de saída fica disponível no topo mobile',()=>{
 const shell=read('../src/components/Shell.jsx');assert.match(shell,/mobile-logout/);assert.match(shell,/aria-label="Sair da conta"/);
});
test('Monitor apresenta tempos da API sem inventar leituras Firestore',()=>{
 const source=read('../src/pages/SuperAdmin.jsx');assert.match(source,/NÃO mede leituras cobradas pelo Firestore/);assert.match(source,/requestMetrics/);
});
