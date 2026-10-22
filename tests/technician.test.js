import test from 'node:test';import assert from 'node:assert/strict';
import {completionDate,inLastDays} from '../src/lib/technician.js';
test('nova conclusão usa carimbo do servidor',()=>{assert.equal(completionDate({status:'Pronto para retirada',completedAt:'2026-10-17'}),'2026-10-17');});
test('OS histórica concluída usa evento real de mudança de status',()=>{const o={id:'os-a',status:'Entregue'},events=[{resource:'serviceOrders',resourceId:'os-a',createdAt:'2026-10-15T10:00:00Z',changes:{status:{before:'Em reparo',after:'Pronto para retirada'}}}];assert.equal(completionDate(o,events),'2026-10-15T10:00:00Z');});
test('não inventa conclusão histórica sem evento e exclui OS não concluída',()=>{assert.equal(completionDate({id:'x',status:'Entregue'},[]),null);assert.equal(completionDate({id:'x',status:'Em reparo'},[]),null);assert.equal(inLastDays(null,30),false);});
