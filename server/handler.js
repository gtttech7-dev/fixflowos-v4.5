import { services } from './firebase-admin.js';
import {redactRecord} from './redact.js';
import { describeEvent } from './activity.js';
import { planLimit,planPeriod,installmentAmounts,dueDateFor,financialPosition,settleDocument,cents } from './plans.js';
import { ROLES, COLLECTIONS, PLATFORM_COLLECTIONS, EDITABLE, can, assertCan, stripFields, amount, qty, money, profitability, validPassword, nextDueDates } from './policy.js';

const error=(msg,status=400)=>Object.assign(new Error(msg),{status});
const safeId=id=>typeof id==='string' && /^[\w-]{1,120}$/.test(id);
const refId=(id)=>{if(!safeId(id))throw error('Identificador inválido');return id;};
const str=(x,max=150)=>{if(typeof x!=='string'||!x.trim()||x.length>max) throw error('Texto obrigatório inválido');return x.trim();};
const iso=()=>new Date().toISOString();
const POLICY_VERSION='2026-10-18-v1';
const publicDoc=s=>({id:s.id,...s.data()});
const diffFields=(before={},after={})=>{
  const hidden=/^(cpf|imei|serial|email|phone|whatsapp|address|password|token|secret|credential|photos)$/i;
  const r={}; for(const [k,v] of Object.entries(after)) if(!hidden.test(k)&&JSON.stringify(before[k])!==JSON.stringify(v))r[k]={before:before[k]??null,after:v};
  return r;
};
const event=(tx,db,ctx,type,resource,id,change={})=>{
  const ref=db.collection('stores').doc(ctx.storeId).collection('events').doc();
  tx.create(ref,{type,resource,resourceId:id,actorUid:ctx.uid,actorName:ctx.name||ctx.email,actorEmail:ctx.email,actorRole:ctx.role,summary:describeEvent(type,resource,id,change),changes:diffFields(change.before,change.after),createdAt:iso()});
};
const platformEvent=(tx,db,ctx,type,resource,id,change={})=>{
  tx.create(db.collection('platform').doc('data').collection('events').doc(),{type,resource,resourceId:id,actorUid:ctx.uid,actorEmail:ctx.email,changes:diffFields(change.before,change.after),createdAt:iso()});
};
const scoped=(ctx,db,col,id)=>{
  if(!COLLECTIONS.includes(col))throw error('Coleção inválida');
  const collection=db.collection('stores').doc(ctx.storeId).collection(col);
  return id?collection.doc(refId(id)):collection;
};
const platform=(db,col,id)=>{
  if(!PLATFORM_COLLECTIONS.includes(col))throw error('Coleção da plataforma inválida');
  const collection=db.collection('platform').doc('data').collection(col);
  return id?collection.doc(refId(id)):collection;
};
async function authenticate(req,db,auth){
  const bearer=req.headers.authorization||'';
  if(!bearer.startsWith('Bearer '))throw error('Autenticação obrigatória',401);
  const token=await auth.verifyIdToken(bearer.slice(7),true).catch(()=>{throw error('Sessão inválida ou expirada',401)});
  const [member,global]=await Promise.all([db.collection('memberships').doc(token.uid).get(),db.collection('platform').doc('admins').collection('users').doc(token.uid).get()]);
  const superAdmin=global.exists&&global.data()?.enabled===true&&(!global.data()?.email||global.data().email===token.email);
  const m=member.exists?member.data():null;
  if(!superAdmin&&(!m||!m.active||!safeId(m.storeId)||!ROLES.includes(m.role)))throw error('Usuário sem loja ativa',403);
  if(!superAdmin&&m){const store=await db.collection('stores').doc(m.storeId).get();if(!store.exists||store.data()?.active===false)throw error('Loja suspensa ou inexistente',403);}
  return {uid:token.uid,email:token.email||'',name:m?.name||token.name||token.email||token.uid,superAdmin,storeId:m?.storeId||null,role:m?.role||null};
}
function ensureSuper(ctx){if(!ctx.superAdmin)throw error('Acesso exclusivo do Super Admin',403);}
function ensureRole(ctx,roles){if(!roles.includes(ctx.role))throw error('Sem permissão',403);}
function dateCheck(x){if(x!=null&&x!==''&&Number.isNaN(Date.parse(x)))throw error('Data inválida');}
function validateDoc(col,data){
  for(const key of ['cost','price','estimate','discount','total','acquisitionCost','tradeValue','laborCost','intendedPrice','listedPrice','salePrice','amount','partCost','otherCost','minimum']) if(data[key]!==undefined)data[key]=amount(data[key]);
  if(data.quantity!==undefined){if(!Number.isSafeInteger(Number(data.quantity))||Number(data.quantity)<0)throw error('Quantidade inválida');data.quantity=Number(data.quantity);}
  for(const k of ['dueDate','warrantyStartsAt','warrantyEndsAt','acquiredAt','saleDate','paidAt'])if(data[k])dateCheck(data[k]);
  if(col==='serviceOrders'&&data.total!==undefined&&data.discount!==undefined&&data.total<0)throw error('Total inválido');
  if(data.photos!==undefined&&!Array.isArray(data.photos))throw error('Fotos inválidas');
  if(data.attachments!==undefined&&!Array.isArray(data.attachments))throw error('Anexos inválidos');
  if(col==='finance'&&data.type&& !['receita','despesa'].includes(data.type))throw error('Tipo financeiro inválido');
  if(col==='finance'&&data.status==='Pago'&&!data.paidAt)data.paidAt=iso();
  if(col==='storeDevices' && data.status==='Vendido')throw error('Venda de aparelho deve passar pelo PDV');
  if(data.services&&!Array.isArray(data.services))throw error('Serviços inválidos');
  if(data.parts&&!Array.isArray(data.parts))throw error('Peças inválidas');
  if(data.additionalCosts&&!Array.isArray(data.additionalCosts))throw error('Custos inválidos');
  return data;
}
const recordPage=async(query,limit=250)=> (await query.limit(Math.min(Math.max(Number(limit)||250,1),500)).get()).docs.map(publicDoc);
async function recordList(ctx,db,p){
  const col=str(p.collection);assertCan(ctx.role,col,'read');
  // Listagens comuns retornam só a primeira página; não transferir 500 documentos por clique.
  const requested=Math.min(Math.max(Number(p.limit)||40,1),100);
  const snap=await scoped(ctx,db,col).orderBy('createdAt','desc').limit(requested).get();
  return snap.docs.map(publicDoc).filter(r=>!r.archived).map(r=>redactRecord(col,r,ctx.role,ctx.uid)).filter(Boolean);
}
async function recordsPage(ctx,db,p){
 const col=str(p.collection);assertCan(ctx.role,col,'read');
 const limit=Math.min(Math.max(Number(p.limit)||30,1),60);
 const q=scoped(ctx,db,col).orderBy('createdAt','desc');
 let query=q;
 if(p.cursor){const cursor=await scoped(ctx,db,col,refId(p.cursor)).get();if(!cursor.exists)throw error('Cursor inválido',409);query=query.startAfter(cursor);}
 const snap=await query.limit(limit+1).get();const hasMore=snap.docs.length>limit,docs=snap.docs.slice(0,limit);
 const rows=docs.map(publicDoc).filter(r=>!r.archived).map(r=>redactRecord(col,r,ctx.role,ctx.uid)).filter(Boolean);
 return {rows,nextCursor:hasMore?docs.at(-1).id:null};
}
async function catalogSearch(ctx,db,p){
 const term=str(p.query,70);
 // A pesquisa ocorre em índices por prefixo, sem percorrer o estoque completo.
 const cols=['products','serviceCatalog','storeDevices'];
 const result={};
 // Algumas lojas antigas usam nomes com maiúsculas; duas variantes comuns sem varrer toda a coleção.
 const variants=[...new Set([term,term[0].toUpperCase()+term.slice(1)])];
 for(const col of cols){
  assertCan(ctx.role,col,'read');
  const fields=col==='storeDevices'?['brand','model']:['name'];
  const queries=fields.flatMap(field=>variants.map(value=>scoped(ctx,db,col).where(field,'>=',value).where(field,'<=',value+'\uf8ff').orderBy(field).limit(20).get()));
  const snapshots=await Promise.all(queries);
  const unique=new Map();for(const snap of snapshots)for(const doc of snap.docs)unique.set(doc.id,publicDoc(doc));
  result[col]=[...unique.values()].filter(r=>!r.archived).map(r=>redactRecord(col,r,ctx.role,ctx.uid)).filter(Boolean).slice(0,40);
 }
 return result;
}
/** Paginação real por cursor e filtro server-side para OS. */
async function ordersPage(ctx,db,p){
  assertCan(ctx.role,'serviceOrders','read');
  const limit=Math.min(Math.max(Number(p.limit)||20,1),40);
  const status=String(p.status||'').trim();
  if(status&&!['Aguardando avaliação','Em avaliação','Orçamento enviado','Aguardando aprovação','Aprovado','Aguardando peça','Em reparo','Em testes','Pronto para retirada','Entregue','Cancelado'].includes(status))throw error('Status inválido');
  const search=String(p.search||'').trim().slice(0,80);
  let q=scoped(ctx,db,'serviceOrders');
  if(search){
    if(/^\d+$/.test(search)){
      q=q.where('number','==',search).orderBy('createdAt','desc');
    }else{
      // Busca por prefixo do nome no Firestore; funciona também com OS antigas.
      q=q.where('customerName','>=',search).where('customerName','<=',search+'\uf8ff').orderBy('customerName','asc');
      if(status)q=q.where('status','==',status);
    }
  }else{
    if(status)q=q.where('status','==',status);
    q=q.orderBy('createdAt','desc');
  }
  if(p.cursor){
    const cursor=await scoped(ctx,db,'serviceOrders',refId(p.cursor)).get();
    if(!cursor.exists)throw error('Página anterior não encontrada',409);
    q=q.startAfter(cursor);
  }
  const snap=await q.limit(limit+1).get();
  const hasMore=snap.docs.length>limit;
  const docs=snap.docs.slice(0,limit);
  let rows=docs.map(publicDoc).filter(r=>!r.archived);
  if(status&&/^\d+$/.test(search))rows=rows.filter(x=>x.status===status);
  return {rows:rows.map(r=>redactRecord('serviceOrders',r,ctx.role,ctx.uid)),nextCursor:hasMore?docs.at(-1).id:null};
}
async function dashboardSummary(ctx,db){
  const store=db.collection('stores').doc(ctx.storeId);
  const orders=store.collection('serviceOrders'),products=store.collection('products'),devices=store.collection('storeDevices');
  const statuses=['Aguardando avaliação','Em avaliação','Orçamento enviado','Aguardando aprovação','Aprovado','Aguardando peça','Em reparo','Em testes','Pronto para retirada','Entregue','Cancelado'];
  const [allCount,allStatus,stockOut,own,events,sales]=await Promise.all([
    orders.count().get(),Promise.all(statuses.map(status=>orders.where('status','==',status).count().get())),
    products.where('quantity','==',0).count().get(),
    devices.count().get(),
    store.collection('events').orderBy('createdAt','desc').limit(8).get(),
    ctx.role==='ADMIN'?store.collection('sales').orderBy('createdAt','desc').limit(24).get():Promise.resolve(null)
  ]);
  const counts=Object.fromEntries(statuses.map((st,i)=>[st,allStatus[i].data().count]));
  const recentSales=(sales?.docs||[]).map(publicDoc);
  const sumLastSales=recentSales.filter(s=>s.status==='Concluída').reduce((n,s)=>n+Number(s.total||0),0);
  return {
    counts,ordersTotal:allCount.data().count,activeOrders:Math.max(0,allCount.data().count-(counts['Entregue']||0)-(counts['Cancelado']||0)),
    zeroStock:stockOut.data().count,devices:own.data().count,
    events:events.docs.map(publicDoc).map(r=>redactRecord('events',r,ctx.role,ctx.uid)).filter(Boolean),
    recentSales:ctx.role==='ADMIN'?recentSales.map(r=>redactRecord('sales',r,ctx.role,ctx.uid)):[],
    latestSalesSum:ctx.role==='ADMIN'?money(sumLastSales):null
  };
}
async function recordSave(ctx,db,p,operation){
  const col=str(p.collection);assertCan(ctx.role,col,operation);
  if(operation==='delete'){
    const ref=scoped(ctx,db,col,p.id);
    return db.runTransaction(async tx=>{const s=await tx.get(ref);if(!s.exists)throw error('Registro não encontrado',404);if(col==='products'&&Number(s.data().quantity)>0)throw error('Zere o estoque antes de arquivar');tx.update(ref,{archived:true,updatedAt:iso()});event(tx,db,ctx,`${col}.archive`,col,ref.id);return {id:ref.id};});
  }
  let data=validateDoc(col,stripFields(col,p.data,ctx.role));
  if(ctx.role==='GERENTE'&&['products','storeDevices'].includes(col)&&data.supplier!==undefined)throw error('Dados de fornecedores são exclusivos do Admin',403);
  if(col==='serviceOrders'&&ctx.role==='TECNICO'&&Object.keys(data).some(k=>['estimate','discount','total'].includes(k)))throw error('Técnico não altera valores financeiros da OS',403);
  if(operation==='create'){
    if(!Object.keys(data).length)throw error('Preencha pelo menos um campo');
    if(col==='products'){data.quantity=Number(data.quantity||0);}
    if(col==='serviceOrders'){data.status=data.status||'Aguardando avaliação';data.paymentStatus='Pendente';data.payments=[];data.completedAt=['Pronto para retirada','Entregue'].includes(data.status)?iso():null;data.assignedAt=data.technicianId?iso():null;}
    if(col==='storeDevices'){data.status=data.status||'Comprado';}
    const ref=scoped(ctx,db,col).doc();
    return db.runTransaction(async tx=>{
      let sequence=null,counter=null;
      if(col==='serviceOrders'){counter=db.collection('stores').doc(ctx.storeId).collection('system').doc('counters');const c=await tx.get(counter);sequence=Number(c.exists?c.data().orderSeq:1000)+1;data.number=String(sequence);}
      const row={...data,createdAt:iso(),updatedAt:iso(),createdBy:ctx.uid,updatedBy:ctx.uid,archived:false};
      if(counter)tx.set(counter,{orderSeq:sequence,updatedAt:iso()},{merge:true});
      tx.create(ref,row); event(tx,db,ctx,`${col}.create`,col,ref.id,{after:data});
      if(col==='finance'&&data.dueDate){for(const due of nextDueDates(data.dueDate,data.recurrence,6)){const id=`${ref.id}-${due.replaceAll('-','')}`;tx.create(scoped(ctx,db,'finance',id),{...row,status:'Pendente',paidAt:'',dueDate:due,sourceId:ref.id,recurrenceIndex:due,createdAt:iso()});}}
      if(col==='products' && data.quantity>0){const move=scoped(ctx,db,'stockMovements').doc();tx.create(move,{productId:ref.id,productName:data.name||'',kind:'entrada inicial',delta:data.quantity,before:0,after:data.quantity,unitCost:data.cost||0,actorUid:ctx.uid,createdAt:iso()});}
      return {id:ref.id};
    });
  }
  if(col==='serviceOrders'&&ctx.role==='TECNICO'&&Object.keys(data).some(k=>['total','estimate','discount'].includes(k)))throw error('Técnico não modifica valores financeiros da OS',403);
  if(col==='serviceOrders'&&data.number!==undefined)throw error('Número de OS é gerado pelo servidor e não pode ser alterado');
  if(col==='products'&&data.quantity!==undefined) throw error('Altere a quantidade apenas por movimentação de estoque');
  if(col==='storeDevices'&&data.additionalCosts!==undefined)throw error('Registre custos através do fluxo de custos ou consumo de peças');
  if(col==='serviceOrders'&&data.parts!==undefined)throw error('Registre peças através do fluxo de estoque');
  if(col==='serviceOrders'&&data.paymentStatus!==undefined) throw error('Registrar pagamento somente pelo fluxo de recebimento');
  if(col==='storeDevices'&&['TECNICO','VENDEDOR_TECNICO'].includes(ctx.role)){
    const keys=['technicianId','status','notes','batteryHealth','condition','photos'];
    if(Object.keys(data).some(k=>!keys.includes(k)))throw error('Perfil técnico só altera informações técnicas',403);
  }
  const ref=scoped(ctx,db,col,p.id);
  return db.runTransaction(async tx=>{
    const s=await tx.get(ref);if(!s.exists||s.data().archived)throw error('Registro não encontrado',404);
    const old=s.data();
    if(col==='storeDevices'&&old.status==='Vendido')throw error('Aparelho vendido é imutável; registre devolução',409);
    if(col==='serviceOrders'){
      const paid=money((old.payments||[]).reduce((a,v)=>a+Number(v.amount||0),0));
      if(data.total!==undefined&&data.total<paid)throw error('Novo valor inferior aos pagamentos já recebidos',409);
      if(data.technicianId && data.technicianId!==old.technicianId)data.assignedAt=iso();
      if(data.status && ['Pronto para retirada','Entregue'].includes(data.status) && !['Pronto para retirada','Entregue'].includes(old.status)) data.completedAt=iso();
      if(data.status==='Cancelado'){if(paid>0)throw error('OS com pagamentos confirmados exige estorno antes do cancelamento',409);if(!(data.notes||'').trim())throw error('Informe o motivo do cancelamento em observações');}
    }
    tx.update(ref,{...data,updatedAt:iso(),updatedBy:ctx.uid}); event(tx,db,ctx,`${col}.update`,col,ref.id,{before:old,after:data});return {id:ref.id};
  });
}
async function stock(ctx,db,p){
  ensureRole(ctx,['ADMIN','GERENTE', 'TECNICO','VENDEDOR_TECNICO']);
  const delta=Number(p.delta);if(!Number.isSafeInteger(delta)||delta===0||Math.abs(delta)>100000)throw error('Quantidade inválida');
  const kind=str(p.kind);
  if(['Entrada','Devolução','Suprimento'].includes(kind)&&delta<=0)throw error('Entrada deve ter quantidade positiva');
  if(['Saída','Consumo em OS','Consumo em aparelho próprio'].includes(kind)&&delta>=0)throw error('Saída/consumo deve ter quantidade negativa');
  const consume=p.destinationType==='serviceOrders'||p.destinationType==='storeDevices';
  if(['TECNICO','VENDEDOR_TECNICO'].includes(ctx.role)&&(!consume||delta>=0))throw error('Perfil técnico só pode consumir peças em reparo',403);
  if(consume&&(!p.destinationId||!safeId(p.destinationId)||delta>=0))throw error('Destino/quantidade inválido');
  const product=scoped(ctx,db,'products',p.productId), destination=consume?scoped(ctx,db,p.destinationType,p.destinationId):null;
  return db.runTransaction(async tx=>{
    const item=await tx.get(product);if(!item.exists||item.data().archived)throw error('Produto não encontrado',404);
    const ds=destination?await tx.get(destination):null;
    if(destination&&!ds.exists)throw error('OS/aparelho de destino não encontrado',404);
    const prev=Number(item.data().quantity)||0,next=prev+delta;
    if(next<0)throw error('Estoque insuficiente para esta operação',409);
    const unitCost=money(item.data().cost);const m=scoped(ctx,db,'stockMovements').doc();
    tx.update(product,{quantity:next,updatedBy:ctx.uid,updatedAt:iso()});
    tx.create(m,{productId:product.id,productName:item.data().name,kind,delta,before:prev,after:next,unitCost,totalCost:money(Math.abs(delta)*unitCost),destinationType:p.destinationType||null,destinationId:p.destinationId||null,reason:String(p.reason||'').slice(0,300),actorUid:ctx.uid,actorName:ctx.name,actorRole:ctx.role,createdAt:iso()});
    if(destination){
      const old=ds.data(),cost=money(Math.abs(delta)*unitCost);
      const part={productId:product.id,name:item.data().name,quantity:Math.abs(delta),unitCost,totalCost:cost,createdAt:iso()};
      const key=p.destinationType==='storeDevices'?'additionalCosts':'parts';
      tx.update(destination,{[key]:[...(old[key]||[]),part],updatedAt:iso(),updatedBy:ctx.uid});
    }
    event(tx,db,ctx,'stock.movement','products',product.id,{before:{quantity:prev},after:{quantity:next}});
    return ctx.role==='ADMIN'?{id:m.id,quantity:next}:{id:m.id,availability:next===0?'Esgotado':next===1?'Última unidade':'Disponível'};
  });
}
function sumDeviceCost(d){return money(Number(d.acquisitionCost||d.tradeValue||0)+Number(d.laborCost||0)+(Array.isArray(d.additionalCosts)?d.additionalCosts.reduce((s,x)=>s+Number(x.totalCost??x.amount??0),0):0));}
async function sale(ctx,db,p){
  ensureRole(ctx,['ADMIN','GERENTE','VENDEDOR','VENDEDOR_TECNICO']);
  const items=p.items;if(!Array.isArray(items)||items.length<1||items.length>60)throw error('Adicione itens à venda');
  const method=str(p.method);if(!['Dinheiro','PIX','Cartão','Outro','Troca'].includes(method))throw error('Forma de pagamento inválida');
  const discount=amount(p.discount||0);
  let sellerPolicy=null;
  if(ctx.role==='VENDEDOR'&&discount>0){const cfg=await scoped(ctx,db,'settings').limit(1).get();sellerPolicy=cfg.docs[0]?.data()||{};if(!sellerPolicy.allowSellerDiscount||Number(sellerPolicy.maxSellerDiscount)<=0)throw error('Desconto não autorizado para vendedor',403);}
  const resolved=items.map(it=>{const kind=it.kind||'product';return kind==='avulso'?{kind,id:null,name:str(it.name,150),price:amount(it.price),quantity:qty(it.quantity??1)}:{kind,id:refId(it.id),quantity:qty(it.quantity??1)};});
  const ids=resolved.filter(it=>it.id);const unique=new Set(ids.map(it=>it.kind+it.id));if(unique.size!==ids.length)throw error('Itens duplicados');
  if(resolved.some(it=>!['product','service','storeDevice','avulso'].includes(it.kind)))throw error('Tipo de item inválido');
  const refs=resolved.map(it=>it.kind==='avulso'?null:scoped(ctx,db,it.kind==='product'?'products':it.kind==='service'?'serviceCatalog':'storeDevices',it.id));
  const ref=scoped(ctx,db,'sales').doc();
  return db.runTransaction(async tx=>{
    const docs=[];for(const r of refs)docs.push(r?await tx.get(r):null);
    const current=await tx.get(db.collection('stores').doc(ctx.storeId).collection('system').doc('cash'));
    if(docs.some(s=>s&&(!s.exists||s.data().archived)))throw error('Item não encontrado',404);
    let gross=0,cost=0;
    const purchased=docs.map((s,i)=>{
      const d=s?.data()||{},it=resolved[i];
      if(it.kind==='product'&&(Number(d.quantity)||0)<it.quantity)throw error(`Estoque insuficiente de ${d.name}`,409);
      if(it.kind==='storeDevice'&&(it.quantity!==1||!['Pronto para venda','Anunciado','Reservado'].includes(d.status)))throw error('Aparelho não está disponível para venda',409);
      const price=it.kind==='avulso'?it.price:it.kind==='storeDevice'?amount(d.listedPrice||d.intendedPrice||0):amount(d.price||0);
      if(price<=0)throw error('Item deve ter preço maior que zero',409);
      const line=money(price*it.quantity),unitCost=it.kind==='avulso'?0:it.kind==='storeDevice'?sumDeviceCost(d):amount(d.cost??(Number(d.partCost||0)+Number(d.laborCost||0)+Number(d.otherCost||0)));
      gross+=line;cost+=unitCost*it.quantity;
      return {kind:it.kind,id:it.id||'',name:it.name||d.name||`${d.brand||''} ${d.model||''}`.trim(),quantity:it.quantity,unitPrice:price,unitCost:it.kind==='avulso'?null:unitCost,total:line};
    });
    if(discount>gross)throw error('Desconto maior que a venda');
    if(ctx.role==='VENDEDOR'&&discount>0&&money(discount/gross*100)>Number(sellerPolicy.maxSellerDiscount||0))throw error('Desconto acima do limite do vendedor',403);
    const net=money(gross-discount),costKnown=!purchased.some(i=>i.kind==='avulso'),profit=costKnown?money(net-cost):null;
    let cashSession=null,cashState=null;
    if(current?.exists&&current.data().sessionId){cashSession=scoped(ctx,db,'cashSessions',current.data().sessionId);cashState=await tx.get(cashSession);}
    for(let i=0;i<docs.length;i++){
      const it=resolved[i],d=docs[i];
      if(it.kind==='product'){
        const before=Number(d.data().quantity)||0,after=before-it.quantity;
        tx.update(refs[i],{quantity:after,updatedAt:iso()});
        tx.create(scoped(ctx,db,'stockMovements').doc(),{productId:it.id,kind:'venda',delta:-it.quantity,before,after,saleId:ref.id,actorUid:ctx.uid,createdAt:iso()});
      }
      if(it.kind==='storeDevice'){const realized=money(purchased[i].total-(gross?discount*purchased[i].total/gross:0));tx.update(refs[i],{status:'Vendido',salePrice:realized,saleDate:iso(),buyerId:p.customerId||'',saleId:ref.id,updatedAt:iso()});event(tx,db,ctx,'storeDevices.sold','storeDevices',it.id,{after:{saleId:ref.id,salePrice:realized,status:'Vendido'}});}
    }
    if(cashState?.exists&&cashState.data().status==='Aberto'&&method==='Dinheiro'){
      tx.update(cashSession,{expectedBalance:money(Number(cashState.data().expectedBalance??cashState.data().openingBalance??0)+net)});
    }
    tx.create(scoped(ctx,db,'cashMovements').doc(),{sessionId:cashState?.exists&&cashState.data().status==='Aberto'?cashSession.id:null,kind:'Venda',method,amount:net,saleId:ref.id,actorUid:ctx.uid,actorName:ctx.name,createdAt:iso()});
    tx.create(ref,{items:purchased,customerId:p.customerId||'',method,discount,gross:money(gross),total:net,cost:costKnown?money(cost):null,profit,costKnown,status:'Concluída',notes:String(p.notes||'').slice(0,500),sellerId:ctx.uid,sellerName:ctx.name,sellerEmail:ctx.email,createdBy:ctx.uid,createdAt:iso()});
    const receipt=scoped(ctx,db,'finance').doc();
    tx.create(receipt,{type:'receita',description:`Venda ${ref.id.slice(0,8)}`,category:method==='Troca'?'Permuta':'Vendas',amount:net,status:method==='Troca'?'Troca':'Pago',paidAt:method==='Troca'?'':iso(),sourceId:ref.id,createdAt:iso(),createdBy:ctx.uid,method});
    event(tx,db,ctx,'sales.finalize','sales',ref.id,{after:{total:net,items:purchased.map(x=>x.name),method}});
    return ctx.role==='ADMIN'?{id:ref.id,total:net,profit}:{id:ref.id,total:net};
  });
}
async function returnSale(ctx,db,p){
  ensureRole(ctx,['ADMIN','GERENTE']);
  const reason=str(p.reason,500),saleRef=scoped(ctx,db,'sales',p.id);
  return db.runTransaction(async tx=>{
    const s=await tx.get(saleRef);if(!s.exists)throw error('Venda inexistente',404);if(s.data().status!=='Concluída')throw error('Venda já cancelada/devolvida',409);
    const products=(s.data().items||[]).filter(i=>i.kind==='product');
    const refs=products.map(i=>scoped(ctx,db,'products',i.id));
    const ownRefs=(s.data().items||[]).filter(i=>i.kind==='storeDevice').map(i=>scoped(ctx,db,'storeDevices',i.id));
    const snaps=[];for(const r of refs)snaps.push(await tx.get(r));
    const ownSnaps=[];for(const r of ownRefs)ownSnaps.push(await tx.get(r));
    const current=await tx.get(db.collection('stores').doc(ctx.storeId).collection('system').doc('cash'));
    const cashSession=current?.exists&&current.data().sessionId?scoped(ctx,db,'cashSessions',current.data().sessionId):null;
    const cashState=cashSession?await tx.get(cashSession):null;
    tx.update(saleRef,{status:'Devolvida',returnReason:reason,returnedAt:iso(),returnedBy:ctx.uid});
    for(let i=0;i<products.length;i++){
      if(!snaps[i].exists)continue;
      const before=Number(snaps[i].data().quantity)||0,after=before+products[i].quantity;
      tx.update(refs[i],{quantity:after,updatedAt:iso()});
      tx.create(scoped(ctx,db,'stockMovements').doc(),{productId:products[i].id,kind:'devolução',delta:products[i].quantity,before,after,saleId:saleRef.id,actorUid:ctx.uid,createdAt:iso()});
    }
    for(let i=0;i<ownRefs.length;i++)if(ownSnaps[i].exists){tx.update(ownRefs[i],{status:'Em avaliação',lastReturnAt:iso(),lastReturnReason:reason,lastSalePrice:ownSnaps[i].data().salePrice||0,salePrice:0,saleId:'',updatedAt:iso()});event(tx,db,ctx,'storeDevices.return','storeDevices',ownRefs[i].id,{after:{status:'Em avaliação',reason}});}
    const value=Number(s.data().total||0);
    if(cashState?.exists&&cashState.data().status==='Aberto'&&s.data().method==='Dinheiro')tx.update(cashSession,{expectedBalance:money(Number(cashState.data().expectedBalance??cashState.data().openingBalance??0)-value)});
    tx.create(scoped(ctx,db,'cashMovements').doc(),{sessionId:cashState?.exists&&cashState.data().status==='Aberto'?cashSession.id:null,kind:'Devolução',method:s.data().method,amount:value,saleId:saleRef.id,actorUid:ctx.uid,actorName:ctx.name,createdAt:iso()});
    const reversal=scoped(ctx,db,'finance').doc();
    tx.create(reversal,{type:'despesa',description:`Devolução venda ${saleRef.id.slice(0,8)}`,category:'Estorno',amount:Number(s.data().total||0),status:'Pago',paidAt:iso(),sourceId:saleRef.id,createdAt:iso(),createdBy:ctx.uid});
    // Aparelhos próprios exigem revisão manual antes de colocá-los novamente à venda.
    event(tx,db,ctx,'sales.return','sales',saleRef.id,{after:{reason,status:'Devolvida'}});
    return {id:saleRef.id};
  });
}
async function cash(ctx,db,p,action){
  ensureRole(ctx,['ADMIN','GERENTE']);
  if(action==='cash.open'){
    const balance=amount(p.balance||0),id=scoped(ctx,db,'cashSessions').doc();
    const current=db.collection('stores').doc(ctx.storeId).collection('system').doc('cash');
    return db.runTransaction(async tx=>{const state=await tx.get(current);if(state.exists&&state.data().sessionId)throw error('Já existe caixa aberto',409);tx.set(current,{sessionId:id.id,updatedAt:iso()});tx.create(id,{openedBy:ctx.uid,openedByName:ctx.name,openedAt:iso(),openingBalance:balance,expectedBalance:balance,status:'Aberto',createdAt:iso()});event(tx,db,ctx,action,'cashSessions',id.id);return{id:id.id};});
  }
  const ref=scoped(ctx,db,'cashSessions',p.sessionId);
  if(action==='cash.move'){
    const value=amount(p.amount);if(!value)throw error('Valor deve ser maior que zero');
    const kind=str(p.kind);if(!['Entrada','Saída','Sangria','Suprimento'].includes(kind))throw error('Tipo inválido');
    return db.runTransaction(async tx=>{const s=await tx.get(ref);if(!s.exists||s.data().status!=='Aberto')throw error('Caixa não está aberto',409);
      const r=scoped(ctx,db,'cashMovements').doc();const signed=['Entrada','Suprimento'].includes(kind)?value:-value;
      tx.update(ref,{expectedBalance:money(Number(s.data().expectedBalance??s.data().openingBalance??0)+signed)});
      tx.create(r,{sessionId:ref.id,kind,amount:value,notes:String(p.notes||''),actorUid:ctx.uid,actorName:ctx.name,createdAt:iso()});event(tx,db,ctx,action,'cashMovements',r.id);return{id:r.id};});
  }
  const counted=amount(p.counted||0);
  return db.runTransaction(async tx=>{const s=await tx.get(ref);if(!s.exists||s.data().status!=='Aberto')throw error('Caixa não está aberto',409);
    const current=db.collection('stores').doc(ctx.storeId).collection('system').doc('cash');
    tx.set(current,{sessionId:null,updatedAt:iso()});tx.update(ref,{status:'Fechado',closedAt:iso(),closedBy:ctx.uid,closedByName:ctx.name,counted,expectedBalance:Number(s.data().expectedBalance??s.data().openingBalance??0),difference:money(counted-Number(s.data().expectedBalance??s.data().openingBalance??0)),notes:String(p.notes||'')});event(tx,db,ctx,'cash.close','cashSessions',ref.id,{after:{counted}});return{id:ref.id};});
}
async function ownCost(ctx,db,p){
  ensureRole(ctx,['ADMIN']);
  const value=amount(p.amount);if(value<=0)throw error('Informe custo maior que zero');
  const description=str(p.description,220),category=str(p.category,100);
  const ref=scoped(ctx,db,'storeDevices',p.id);
  return db.runTransaction(async tx=>{
    const s=await tx.get(ref);if(!s.exists||['Vendido','Cancelado'].includes(s.data().status))throw error('Aparelho indisponível para novo custo',409);
    const cost={category,description,amount:value,totalCost:value,createdAt:iso(),actorUid:ctx.uid};
    tx.update(ref,{additionalCosts:[...(s.data().additionalCosts||[]),cost],updatedAt:iso(),updatedBy:ctx.uid});
    event(tx,db,ctx,'storeDevices.cost','storeDevices',ref.id,{after:{category,amount:value,description}});
    return{id:ref.id};
  });
}
async function orderPayment(ctx,db,p){
  ensureRole(ctx,['ADMIN','GERENTE','VENDEDOR','VENDEDOR_TECNICO']);const value=amount(p.amount);if(!value)throw error('Valor de pagamento inválido');
  const recipientId=p.receivedById?refId(p.receivedById):ctx.uid;
  if(recipientId!==ctx.uid&&!['ADMIN','GERENTE'].includes(ctx.role))throw error('Só gerência pode atribuir recebimento a outro funcionário',403);
  const order=scoped(ctx,db,'serviceOrders',p.id),method=str(p.method);
  return db.runTransaction(async tx=>{
    const s=await tx.get(order);if(!s.exists||s.data().status==='Cancelado')throw error('OS não encontrada/ativa',404);
    const recipient=await tx.get(db.collection('memberships').doc(recipientId));
    if(!recipient.exists||recipient.data().storeId!==ctx.storeId||!recipient.data().active||!['ADMIN','GERENTE','VENDEDOR','VENDEDOR_TECNICO'].includes(recipient.data().role))throw error('Responsável pelo recebimento não está autorizado nesta loja',403);
    const receiverName=recipient.data().name||recipient.data().email||recipientId;
    const payments=s.data().payments||[],paid=money(payments.reduce((a,v)=>a+Number(v.amount||0),0));
    if(paid+value>Number(s.data().total||0)+0.005)throw error('Pagamento supera total devido',409);
    if(!['PIX','Dinheiro','Cartão','Outro'].includes(method))throw error('Forma de pagamento inválida');
    const next=[...payments,{amount:value,method,actorUid:ctx.uid,actorName:ctx.name,receivedByUid:recipientId,receivedByName:receiverName,createdAt:iso()}];
    const fin=scoped(ctx,db,'finance').doc();
    const cashDoc=await tx.get(db.collection('stores').doc(ctx.storeId).collection('system').doc('cash'));
    const sessionId=cashDoc.exists?cashDoc.data().sessionId:null;
    const cashRef=sessionId?scoped(ctx,db,'cashSessions',sessionId):null;const cashSnap=cashRef?await tx.get(cashRef):null;
    tx.create(fin,{type:'receita',description:`Recebimento OS ${s.data().number||order.id}`,amount:value,status:'Pago',paidAt:iso(),sourceId:order.id,category:'Conserto',method,receivedByUid:recipientId,receivedByName:receiverName,createdAt:iso(),createdBy:ctx.uid});
    tx.update(order,{payments:next,paymentStatus:money(paid+value)>=Number(s.data().total||0)?'Pago':'Parcial',updatedAt:iso()});
    if(method==='Dinheiro'&&cashSnap?.exists&&cashSnap.data().status==='Aberto')tx.update(cashRef,{expectedBalance:money(Number(cashSnap.data().expectedBalance??cashSnap.data().openingBalance??0)+value)});
    tx.create(scoped(ctx,db,'cashMovements').doc(),{sessionId:cashSnap?.exists&&cashSnap.data().status==='Aberto'?sessionId:null,kind:'Recebimento de OS',method,amount:value,orderId:order.id,actorUid:ctx.uid,actorName:ctx.name,receivedByUid:recipientId,receivedByName:receiverName,createdAt:iso()});
    event(tx,db,ctx,'serviceOrders.payment','serviceOrders',order.id,{after:{number:s.data().number||order.id,amount:value,method,receivedByName:receiverName}});return{id:fin.id};
  });
}
async function team(ctx,db,auth,p,action){
  ensureRole(ctx,['ADMIN']);
  if(action==='users.create'){
    const email=str(p.email,200),password=p.password,role=str(p.role),name=str(p.name);
    if(!ROLES.includes(role))throw error('Perfil inválido');if(!validPassword(password))throw error('Senha: use somente 8 ou mais números (0 a 9)');
    const storeRef=db.collection('stores').doc(ctx.storeId);
    const u=await auth.createUser({email,password,displayName:name,disabled:false});
    try{await db.runTransaction(async tx=>{
      const storeSnap=await tx.get(storeRef);if(!storeSnap.exists)throw error('Loja não encontrada',404);
      let activeCount=storeSnap.data().activeUserCount;
      if(!Number.isSafeInteger(activeCount)){
        const snap=await tx.get(scoped(ctx,db,'users').where('active','==',true));activeCount=snap.size;
      }
      if(storeSnap.data().planId){
        const planSnap=await tx.get(platform(db,'plans',refId(storeSnap.data().planId)));
        const limit=planSnap.exists?(Object.prototype.hasOwnProperty.call(planSnap.data(),'userLimit')?planSnap.data().userLimit:(planSnap.data().limits?.users??null)):null;
        if(limit!==null&&limit!==undefined&&activeCount>=Number(limit))throw error(`Limite de ${limit} usuários ativos atingido. Altere o plano antes de adicionar funcionários.`,403);
      }
      tx.set(storeRef,{activeUserCount:activeCount+1,updatedAt:iso()},{merge:true});
      tx.create(db.collection('memberships').doc(u.uid),{storeId:ctx.storeId,role,active:true,name,email,createdAt:iso()});
      tx.create(scoped(ctx,db,'users',u.uid),{name,email,role,active:true,createdAt:iso(),createdBy:ctx.uid});
      event(tx,db,ctx,'users.create','users',u.uid,{after:{name,role}});
    });}catch(e){await auth.deleteUser(u.uid).catch(()=>{});throw e;}
    return{id:u.uid};
  }
  const uid=refId(p.id),ref=db.collection('memberships').doc(uid),storeUser=scoped(ctx,db,'users',uid);
  if(uid===ctx.uid)throw error('Não é possível editar o próprio acesso',403);
  const current=await ref.get();if(!current.exists||current.data().storeId!==ctx.storeId)throw error('Funcionário não encontrado',404);
  if(action==='users.update'){
    const data={};if(p.name!==undefined)data.name=str(p.name);
    if(p.role!==undefined){if(!ROLES.includes(p.role))throw error('Perfil inválido');data.role=p.role;}
    if(p.active!==undefined)data.active=!!p.active;
    await db.runTransaction(async tx=>{
      const storeRef=db.collection('stores').doc(ctx.storeId),storeSnap=await tx.get(storeRef);
      const usSnap=await tx.get(storeUser);
      if(!usSnap.exists)throw error('Usuário de loja não encontrado',404);
      let currentCount=storeSnap.data().activeUserCount;
      if(!Number.isSafeInteger(currentCount)){const activeUsers=await tx.get(scoped(ctx,db,'users').where('active','==',true));currentCount=activeUsers.size;}
      const delta=typeof data.active==='boolean'&&data.active!==usSnap.data().active?(data.active?1:-1):0;
      if(delta>0&&storeSnap.data().planId){const planSnap=await tx.get(platform(db,'plans',refId(storeSnap.data().planId)));const limit=planSnap.exists?(Object.prototype.hasOwnProperty.call(planSnap.data(),'userLimit')?planSnap.data().userLimit:(planSnap.data().limits?.users??null)):null;if(limit!==null&&limit!==undefined&&currentCount>=Number(limit))throw error('Limite de usuários do plano atingido',403);}
      if(delta)tx.set(storeRef,{activeUserCount:Math.max(0,currentCount+delta),updatedAt:iso()},{merge:true});
      tx.update(ref,data);tx.update(storeUser,{...data,updatedAt:iso()});event(tx,db,ctx,action,'users',uid,{before:current.data(),after:data});
    });
    if(data.active!==undefined)await auth.updateUser(uid,{disabled:!data.active});
    if(data.name)await auth.updateUser(uid,{displayName:data.name});
    return{id:uid};
  }
  throw error('Ação inválida');
}
async function storeCreate(ctx,db,auth,p){
  ensureSuper(ctx); const name=str(p.name),email=str(p.email,200),password=p.password;
  if(!validPassword(password))throw error('Senha do proprietário: 8 ou mais dígitos numéricos');
  if(p.planId){const ps=await platform(db,'plans',refId(p.planId)).get();if(!ps.exists||ps.data().active===false)throw error('Plano não existe ou está inativo');}
  const uidUser=await auth.createUser({email,password,displayName:str(p.ownerName)});
  const store=db.collection('stores').doc();
  try{await db.runTransaction(async tx=>{
    tx.create(store,{name,ownerUid:uidUser.uid,ownerEmail:email,active:true,activeUserCount:1,planId:p.planId||'',trialEnd:p.trialEnd||'',createdAt:iso(),createdBy:ctx.uid});
    tx.create(db.collection('memberships').doc(uidUser.uid),{storeId:store.id,role:'ADMIN',name:p.ownerName,email,active:true,createdAt:iso()});
    tx.create(store.collection('users').doc(uidUser.uid),{name:p.ownerName,email,role:'ADMIN',active:true,createdAt:iso()});
    platformEvent(tx,db,ctx,'stores.create','stores',store.id,{after:{name,email}});
  });}catch(e){await auth.deleteUser(uidUser.uid).catch(()=>{});throw e;}
  return{id:store.id,ownerUid:uidUser.uid};
}
async function storeChange(ctx,db,p){
  ensureSuper(ctx);const ref=db.collection('stores').doc(refId(p.id));const data={};
  for(const k of ['name','active','planId','trialEnd','subscriptionStatus'])if(p[k]!==undefined)data[k]=p[k];
  if('name'in data)data.name=str(data.name);
  if('active'in data){if(data.active&&data.archived)throw error('Restaure loja arquivada antes de ativar');data.active=!!data.active;}
  if(data.planId){const ps=await platform(db,'plans',refId(data.planId)).get();if(!ps.exists||ps.data().active===false)throw error('Plano não existe ou está inativo');}
  return db.runTransaction(async tx=>{const s=await tx.get(ref);if(!s.exists)throw error('Loja inexistente',404);if(s.data().archived&&data.active)throw error('Restaure a loja arquivada antes de reativá-la',409);tx.update(ref,{...data,updatedAt:iso()});platformEvent(tx,db,ctx,'stores.update','stores',ref.id,{before:s.data(),after:data});return{id:ref.id};});
}
/** Fluxo em duas fases: suspende imediatamente, remove contas/vínculos e depois documentos. */
async function storeLifecycle(ctx,db,auth,p,action){
 ensureSuper(ctx);
 const ref=db.collection('stores').doc(refId(p.id));
 const snap=await ref.get();if(!snap.exists)throw error('Loja não encontrada',404);
 const data=snap.data();
 if(action==='stores.archive'){
  await ref.update({active:false,archived:true,archivedAt:iso(),updatedAt:iso()});
  return {id:ref.id,archived:true};
 }
 if(action==='stores.restore'){
  if(data.deleting)throw error('Exclusão permanente em andamento',409);
  await ref.update({active:true,archived:false,updatedAt:iso()});
  return {id:ref.id,archived:false};
 }
 if(action!=='stores.delete')throw error('Ação inválida');
 if(p.confirm!=='EXCLUIR'||String(p.confirmName||'')!==data.name||p.backupConfirmed!==true)throw error('Confirmação de exclusão inválida',400);
 // Primeiro cortar sessões ativas. Não apagar uma conta que participe de outra loja.
 await ref.update({active:false,archived:true,deleting:true,updatedAt:iso()});
 const col=ref.collection('users');let cursor=null;
 for(let page=0;page<50;page++){
  let query=col.orderBy('__name__').limit(50);if(cursor)query=query.startAfter(cursor);
  const users=await query.get();if(!users.size)break;
  for(const user of users.docs){
   const membership=db.collection('memberships').doc(user.id),membershipSnap=await membership.get();
   if(membershipSnap.exists&&membershipSnap.data().storeId===ref.id){
    await auth.deleteUser(user.id).catch(e=>{if(e.code!=='auth/user-not-found')throw e});
    await membership.delete();await db.collection('userPolicies').doc(user.id).delete();
   }
  }
  cursor=users.docs.at(-1);if(users.size<50)break;
 }
 // Requer Firebase Admin Firestore com recursiveDelete. As contas já ficam bloqueadas.
 if(typeof db.recursiveDelete!=='function')throw error('Esta versão do SDK Admin não suporta exclusão recursiva. Loja suspensa; conclua manualmente',503);
 await db.recursiveDelete(ref);
 // Os comprovantes financeiros da plataforma permanecem para cumprimento de obrigações legais.
 return {id:ref.id,deleted:true,notice:'Registros financeiros da plataforma permanecem para fins contábeis. Confirme a remoção de anexos externos, se utilizados.'};
}
async function platformWrite(ctx,db,p,operation){
  ensureSuper(ctx);const col=str(p.collection);if(!['plans','subscriptions','transactions','expenses'].includes(col))throw error('Coleção inválida');
  const fields=col==='plans'?['name','price','active','features','limits','userLimit','period','promoPrice','promoStart','promoEnd','notes']:col==='subscriptions'?['storeId','planId','status','startAt','dueDate','trialEnd','contractedPrice','installments','notes']:['description','category','type','amount','dueDate','paidAt','status','recurrence','notes','storeId'];
  const data={};for(const [k,v] of Object.entries(p.data||{})){if(!fields.includes(k))throw error(`Campo não permitido: ${k}`);data[k]=v;}
  for(const k of ['price','promoPrice','contractedPrice','amount'])if(data[k]!==undefined)data[k]=amount(data[k]);
  if(col==='plans'){
    if(data.period!==undefined)data.period=planPeriod(data.period);
    if(data.userLimit!==undefined)data.userLimit=planLimit(data.userLimit);
  }
  if(col==='subscriptions'&&data.installments!==undefined){
    data.installments=Number(data.installments);
    if(!Number.isSafeInteger(data.installments)||data.installments<1||data.installments>36)throw error('Parcelas: escolha entre 1 e 36');
  }
  if(['transactions','expenses'].includes(col)&&data.status!==undefined&&!['Pendente','Parcialmente pago','Pago','Vencido','Cancelado'].includes(data.status))throw error('Status inválido');
  if(['transactions','expenses'].includes(col)&&data.status==='Pago')throw error('Use Registrar pagamento para confirmar recebimentos ou despesas pagas');
  const ref=operation==='create'?platform(db,col).doc():platform(db,col,p.id);
  return db.runTransaction(async tx=>{
    let before={};if(operation==='update'){const s=await tx.get(ref);if(!s.exists)throw error('Registro inexistente',404);before=s.data();}
    if(operation==='update'&&['expenses','transactions'].includes(col)){
      const already=financialPosition(before).received;
      if(already>0&&data.amount!==undefined&&cents(data.amount)<cents(already))throw error('Não é possível reduzir valor abaixo do total já recebido ou pago');
      if(already>0&&data.status!==undefined&&data.status!==before.status)throw error('Lançamento parcialmente ou totalmente pago: altere o status somente pelo fluxo de pagamento/estorno');
    }
    if(operation==='create'){
      if(col==='subscriptions'){
        const ps=await tx.get(platform(db,'plans',refId(data.planId)));
        if(!ps.exists)throw error('Plano não encontrado');
        const period=ps.data().period||'Mensal';
        const installments=period==='Vitalício'?(data.installments||1):1;
        const chargeCount=period==='Vitalício'?installments:6;
        const values=period==='Vitalício'?installmentAmounts(data.contractedPrice??ps.data().price??0,installments):Array.from({length:chargeCount},()=>amount(data.contractedPrice??ps.data().price??0));
        const start=data.dueDate||data.startAt||iso().slice(0,10);
        values.forEach((value,i)=>{const due=i===0?start:dueDateFor(start,period==='Vitalício'?'Mensal':period,i);const id=`${ref.id}-parcela-${i+1}`;tx.create(platform(db,'transactions',id),{description:period==='Vitalício'?`Plano vitalício — parcela ${i+1}/${values.length}`:`Assinatura ${period} — competência ${i+1}`,storeId:data.storeId,subscriptionId:ref.id,amount:value,status:'Pendente',dueDate:due,paidAmount:0,createdAt:iso(),createdBy:ctx.uid});});
      }
      tx.create(ref,{...data,createdAt:iso(),createdBy:ctx.uid});
      if(['expenses','transactions'].includes(col)&&data.dueDate){for(const due of nextDueDates(data.dueDate,data.recurrence,6))tx.create(platform(db,col,`${ref.id}-${due.replaceAll('-','')}`),{...data,status:'Pendente',paidAt:'',dueDate:due,sourceId:ref.id,recurrenceIndex:due,createdAt:iso(),createdBy:ctx.uid});}
    }else tx.update(ref,{...data,updatedAt:iso(),updatedBy:ctx.uid});
    platformEvent(tx,db,ctx,`${col}.${operation}`,col,ref.id,{before,after:data});return{id:ref.id};
  });
}

/** Liquidação parcial ou integral com trilha de auditoria. Valor devido jamais aumenta por esta rota. */
async function platformPayment(ctx,db,p){
  ensureSuper(ctx);
  const col=str(p.collection);
  if(!['expenses','transactions'].includes(col))throw error('Tipo de lançamento inválido');
  const ref=platform(db,col,refId(p.id));
  return db.runTransaction(async tx=>{
    const snap=await tx.get(ref);if(!snap.exists)throw error('Lançamento não encontrado',404);
    if(snap.data().status==='Cancelado')throw error('Lançamento cancelado');
    const paymentId=str(p.operationId,80);if(!/^[a-zA-Z0-9_-]{8,80}$/.test(paymentId))throw error('Identificador de pagamento inválido');
    const existing=(snap.data().payments||[]).find(x=>x.operationId===paymentId);if(existing)return {id:ref.id,repeated:true};
    const updated=settleDocument(snap.data(),p.amount);
    const receipts=[...(snap.data().payments||[])];
    const at=p.paidAt?String(p.paidAt):iso();dateCheck(at);
    const method=['PIX','Dinheiro','Cartão','Boleto','Transferência','Outro'].includes(p.method)?p.method:'Outro';
    receipts.push({operationId:paymentId,amount:amount(p.amount),paidAt:at,method,actorUid:ctx.uid});
    tx.update(ref,{...updated,payments:receipts,paidAt:updated.status==='Pago'?at:(snap.data().paidAt||null),updatedAt:iso(),updatedBy:ctx.uid});
    platformEvent(tx,db,ctx,`${col}.payment`,col,ref.id,{after:{amount:p.amount,method,status:updated.status}});
    return{id:ref.id,...updated};
  });
}
async function loadFull(query){
  const results=[];let cursor=null;
  for(let i=0;i<200;i++){
    let q=query.limit(250);if(cursor)q=q.startAfter(cursor);
    const snap=await q.get();if(!snap.size)break;
    results.push(...snap.docs.map(publicDoc));cursor=snap.docs.at(-1);
    if(snap.size<250)break;
  }
  return results;
}
async function platformMetrics(ctx,db,p){
  ensureSuper(ctx);
  const [transactions,expenses]=await Promise.all(['transactions','expenses'].map(col=>loadFull(platform(db,col).orderBy('createdAt','desc'))));
  const start=typeof p.start==='string'?p.start:'',end=typeof p.end==='string'?p.end:'';
  const inPeriod=(x,date)=>{const d=String(date||'').slice(0,10);return !!d&&(!start||d>=start)&&(!end||d<=end)};
  let received=0,expensesPaid=0,expected=0,expensesPending=0,overdue=0;
  const months=new Map();const add=(stamp,key,value)=>{const month=String(stamp||'').slice(0,7);if(!/^\d{4}-\d{2}$/.test(month))return;const v=months.get(month)||{month,received:0,spent:0,pending:0};v[key]=Math.round((v[key]+value)*100)/100;months.set(month,v);};
  for(const r of transactions){if(r.status==='Cancelado')continue;const pos=financialPosition(r);const receipts=Array.isArray(r.payments)?r.payments:(r.status==='Pago'?[{amount:r.amount,paidAt:r.paidAt||r.createdAt}]:[]);
    for(const pay of receipts){if(inPeriod(r,pay.paidAt)){received+=Number(pay.amount||0);}add(pay.paidAt,'received',Number(pay.amount||0));}
    if(inPeriod(r,r.dueDate||r.createdAt))expected+=pos.outstanding;
    if(r.dueDate&&r.dueDate<iso().slice(0,10))overdue+=pos.outstanding;
    add(r.dueDate||r.createdAt,'pending',pos.outstanding);
  }
  for(const r of expenses){if(r.status==='Cancelado')continue;const pos=financialPosition(r);const receipts=Array.isArray(r.payments)?r.payments:(r.status==='Pago'?[{amount:r.amount,paidAt:r.paidAt||r.createdAt}]:[]);
    for(const pay of receipts){if(inPeriod(r,pay.paidAt))expensesPaid+=Number(pay.amount||0);add(pay.paidAt,'spent',Number(pay.amount||0));}
    if(inPeriod(r,r.dueDate||r.createdAt))expensesPending+=pos.outstanding;
  }
  return {received:money(received),expensesPaid:money(expensesPaid),expected:money(expected),expensesPending:money(expensesPending),overdue:money(overdue),result:money(received-expensesPaid),months:[...months.values()].sort((a,b)=>a.month.localeCompare(b.month)).slice(-12)};
}

async function listPlatform(ctx,db,p){ensureSuper(ctx);
  if(p.collection==='stores')return recordPage(db.collection('stores').orderBy('createdAt','desc'),p.limit);
  return recordPage(platform(db,str(p.collection)).orderBy('createdAt','desc'),p.limit);
}
async function makeAlerts(ctx,db){
  const [products,orders,devices,finance]=await Promise.all([
    recordPage(scoped(ctx,db,'products'),400),recordPage(scoped(ctx,db,'serviceOrders'),400),recordPage(scoped(ctx,db,'storeDevices'),400),ctx.role==='ADMIN'?recordPage(scoped(ctx,db,'finance'),400):Promise.resolve([])
  ]);
  const now=Date.now(),alerts=[];
  const cfg=await scoped(ctx,db,'settings').limit(1).get();const preferences=cfg.docs[0]?.data()||{};
  const staleDays=Math.max(1,Number(preferences.staleDeviceDays)||30),marginMin=Math.max(0,Number(preferences.lowMargin)||15);
  for(const p of products)if(!p.archived&&Number(p.minimum)>0&&Number(p.quantity)<=Number(p.minimum))alerts.push({id:`stock-${p.id}`,level:'warning',title:'Estoque baixo',description:ctx.role==='ADMIN'?`${p.name}: ${p.quantity} disponível(is)`:`${p.name}: estoque baixo`,module:'products',resourceId:p.id});
  for(const o of orders){if(['Entregue','Cancelado'].includes(o.status))continue;if(o.dueDate&&Date.parse(o.dueDate)<now)alerts.push({id:`due-${o.id}`,level:'danger',title:'OS atrasada',description:`OS ${o.number||o.id} fora do prazo`,module:'serviceOrders',resourceId:o.id});if(o.status==='Aguardando aprovação')alerts.push({id:`approve-${o.id}`,level:'info',title:'Aguardando aprovação',description:`OS ${o.number||o.id}`,module:'serviceOrders',resourceId:o.id});if(o.status==='Pronto para retirada')alerts.push({id:`ready-${o.id}`,level:'info',title:'Pronto para retirada',description:`OS ${o.number||o.id}`,module:'serviceOrders',resourceId:o.id});}
  for(const d of devices){
    if(d.status!=='Vendido'&&d.status!=='Cancelado'&&now-Date.parse(d.createdAt||iso())>staleDays*86400000)alerts.push({id:`device-${d.id}`,level:'warning',title:'Aparelho parado',description:`${d.brand||''} ${d.model||''} sem venda há mais de ${staleDays} dias`,module:'storeDevices',resourceId:d.id});
    if(ctx.role==='ADMIN'&&Number(d.intendedPrice)>0){const c=sumDeviceCost(d),margin=(Number(d.intendedPrice)-c)/Number(d.intendedPrice)*100;if(margin<marginMin)alerts.push({id:`margin-${d.id}`,level:'warning',title:'Margem abaixo do limite',description:`${d.brand||''} ${d.model||''} · margem ${margin.toFixed(1)}%`,module:'storeDevices',resourceId:d.id});}
  }
  for(const f of finance)if(!['Pago','Cancelado','Troca'].includes(f.status)&&f.dueDate&&Date.parse(f.dueDate)<now)alerts.push({id:`finance-${f.id}`,level:'danger',title:'Conta vencida',description:f.description,module:'finance',resourceId:f.id});
  for(const o of orders){if(o.warrantyEndsAt&&Date.parse(o.warrantyEndsAt)>now&&Date.parse(o.warrantyEndsAt)<now+7*86400000)alerts.push({id:`warranty-${o.id}`,level:'info',title:'Garantia próxima do fim',description:`OS ${o.number||o.id} · garantia até ${o.warrantyEndsAt}`,module:'serviceOrders',resourceId:o.id});}
  const ack=await scoped(ctx,db,'alerts').where('uid','==',ctx.uid).limit(300).get();const map=new Map(ack.docs.map(x=>[x.data().alertId,x.data()]));
  return alerts.slice(0,150).map(a=>({...a,read:map.get(a.id)?.read===true,resolved:map.get(a.id)?.resolved===true}));
}
export async function handleAction(req){
  const {auth,db}=services();
  const ctx=await authenticate(req,db,auth);
  if(req.method!=='POST')throw error('Método inválido',405);
  const p=req.body||{},action=str(p.action);
  if(action==='me'){
    const pref=(await db.collection('userPolicies').doc(ctx.uid).get()).data()||{};
    return {uid:ctx.uid,email:ctx.email,role:ctx.superAdmin?'SUPER_ADMIN':ctx.role,storeId:ctx.storeId,superAdmin:ctx.superAdmin,policyVersion:POLICY_VERSION,policyAccepted:pref.version===POLICY_VERSION,preferences:{drafts:pref.drafts===true,rememberDevice:pref.rememberDevice===true}};
  }
  if(action==='privacy.accept'){
    if(p.version!==POLICY_VERSION)throw error('Atualize a página para acessar a versão atual dos termos');
    const ref=db.collection('userPolicies').doc(ctx.uid);
    await ref.set({version:POLICY_VERSION,acceptedAt:iso(),acceptedRole:ctx.superAdmin?'SUPER_ADMIN':ctx.role,acceptedStoreId:ctx.storeId||null,drafts:p.drafts===true,rememberDevice:p.rememberDevice===true,updatedAt:iso()},{merge:true});
    return {ok:true};
  }
  if(action==='preferences.update'){
    const data={};for(const k of ['drafts','rememberDevice'])if(p[k]!==undefined)data[k]=p[k]===true;
    await db.collection('userPolicies').doc(ctx.uid).set({...data,updatedAt:iso()},{merge:true});return {ok:true};
  }
  if(action==='drafts.get'||action==='drafts.save'||action==='drafts.clear'){
    if(ctx.superAdmin)throw error('Rascunhos disponíveis para usuários de loja');
    const key=str(p.key,100);if(!/^[a-zA-Z0-9_-]{1,100}$/.test(key))throw error('Identificador do rascunho inválido');
    const settings=await db.collection('userPolicies').doc(ctx.uid).get();
    if(settings.data()?.drafts!==true)throw error('Ative a preferência de rascunhos primeiro',403);
    const ref=db.collection('stores').doc(ctx.storeId).collection('userDrafts').doc(ctx.uid).collection('items').doc(key);
    if(action==='drafts.get'){const snap=await ref.get();return snap.exists?{data:snap.data().data||{}}:{data:{}};}
    if(action==='drafts.clear'){await ref.delete();return {ok:true};}
    const data=p.data;
    if(!data||typeof data!=='object'||Array.isArray(data)||JSON.stringify(data).length>25000)throw error('Rascunho inválido');
    for(const k of Object.keys(data))if(/password|secret|token|private|card|cvv/i.test(k))throw error('Dado sensível não permitido em rascunho');
    await ref.set({data,updatedAt:iso(),ownerUid:ctx.uid});return {ok:true};
  }
  if(action==='platform.pay')return platformPayment(ctx,db,p);
  if(action==='store.info'){if(ctx.superAdmin)throw error('Selecione uma loja',400);const s=await db.collection('stores').doc(ctx.storeId).get();return publicDoc(s);}
  if(action==='records.list')return recordList(ctx,db,p);
  if(action==='records.page')return recordsPage(ctx,db,p);
  if(action==='catalog.search')return catalogSearch(ctx,db,p);
  if(action==='orders.page')return ordersPage(ctx,db,p);
  if(action==='dashboard.summary')return dashboardSummary(ctx,db);
  if(action==='records.create')return recordSave(ctx,db,p,'create');
  if(action==='records.update')return recordSave(ctx,db,p,'update');
  if(action==='records.delete')return recordSave(ctx,db,p,'delete');
  if(action==='stock.adjust')return stock(ctx,db,p);
  if(action==='storeDevices.cost')return ownCost(ctx,db,p);
  if(action==='sales.finalize')return sale(ctx,db,p);
  if(action==='sales.return')return returnSale(ctx,db,p);
  if(action==='cash.open'||action==='cash.close'||action==='cash.move')return cash(ctx,db,p,action);
  if(action==='orders.payment')return orderPayment(ctx,db,p);
  if(action==='users.create'||action==='users.update')return team(ctx,db,auth,p,action);
  if(action==='stores.create')return storeCreate(ctx,db,auth,p);
  if(action==='stores.update')return storeChange(ctx,db,p);
  if(['stores.archive','stores.restore','stores.delete'].includes(action))return storeLifecycle(ctx,db,auth,p,action);
  if(action==='platform.list')return listPlatform(ctx,db,p);
  if(action==='platform.create')return platformWrite(ctx,db,p,'create');
  if(action==='platform.update')return platformWrite(ctx,db,p,'update');
  if(action==='platform.metrics')return platformMetrics(ctx,db,p);
  if(action==='alerts.list')return makeAlerts(ctx,db);
  if(action==='alerts.ack'){const id=str(p.id);if(!/^[a-z]+-[\w-]+$/.test(id))throw error('Alerta inválido');const ref=scoped(ctx,db,'alerts').doc(`${ctx.uid}-${id}`);await ref.set({alertId:id,uid:ctx.uid,read:p.read!==false,resolved:p.resolved===true,updatedAt:iso()},{merge:true});return{id};}
  throw error('Ação desconhecida',404);
}
