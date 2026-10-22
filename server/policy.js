// Funções puras testadas no Node, compartilhadas por todos os endpoints.
export const ROLES = ['ADMIN','GERENTE','VENDEDOR','TECNICO','VENDEDOR_TECNICO'];
export const ORDER_STATUSES = ['Aguardando avaliação','Em avaliação','Orçamento enviado','Aguardando aprovação','Aprovado','Aguardando peça','Em reparo','Em testes','Pronto para retirada','Entregue','Cancelado'];
export const OWN_STATUSES = ['Comprado','Em avaliação','Aguardando reparo','Em reparo','Aguardando peça','Em testes','Pronto para venda','Anunciado','Reservado','Vendido','Cancelado'];
export const COLLECTIONS = ['customers','devices','serviceOrders','products','sales','stockMovements','storeDevices','finance','cashSessions','cashMovements','users','events','alerts','serviceCatalog','categories','suppliers','settings'];
export const PLATFORM_COLLECTIONS = ['plans','subscriptions','transactions','expenses','events'];
export const EDITABLE = {
  customers:['name','cpf','phone','whatsapp','email','address','notes'],
  devices:['customerId','kind','brand','model','imei','serial','color','capacity','accessories','notes'],
  serviceOrders:['number','customerId','customerName','customerPhone','deviceId','brand','model','imei','accessories','physicalCondition','complaint','diagnosis','service','technicianId','status','estimate','discount','total','dueDate','notes','warrantyDays','warrantyStartsAt','warrantyEndsAt','parentOrderId','reworkReason','warrantyCovered','services','parts','attachments','paymentStatus'],
  products:['name','sku','barcode','category','supplier','location','cost','price','quantity','minimum','unit','active','notes'],
  storeDevices:['number','brand','model','imei','serial','color','capacity','batteryHealth','accessories','condition','origin','supplier','acquiredAt','acquisitionCost','tradeValue','responsibleId','technicianId','status','additionalCosts','laborCost','intendedPrice','listedPrice','salePrice','saleDate','buyerId','notes','photos'],
  finance:['description','type','category','amount','dueDate','paidAt','status','recurrence','notes','supplier','sourceId'],
  serviceCatalog:['name','description','price','partCost','laborCost','otherCost','active'],
  categories:['name','description','active'],
  suppliers:['name','phone','email','address','notes'],
  alerts:['read','resolved'],
  settings:['lowMargin','staleDeviceDays','defaultWarrantyDays','allowSellerDiscount','maxSellerDiscount'],
};
const readRoles = { sales:['ADMIN','GERENTE','VENDEDOR','VENDEDOR_TECNICO'],finance:['ADMIN'],cashSessions:ROLES,cashMovements:ROLES,users:ROLES,settings:['ADMIN','GERENTE'],suppliers:['ADMIN'],stockMovements:ROLES };
const createRoles = {
  customers:ROLES, devices:ROLES, serviceOrders:ROLES,
  products:['ADMIN','GERENTE'], storeDevices:['ADMIN','GERENTE','TECNICO','VENDEDOR_TECNICO'],
  finance:['ADMIN'], serviceCatalog:['ADMIN','GERENTE'], categories:['ADMIN','GERENTE'],suppliers:['ADMIN'],
  settings:['ADMIN'], alerts:ROLES,
};
export function can(role, collection, operation){
  if (!ROLES.includes(role) || !COLLECTIONS.includes(collection)) return false;
  if (operation==='read') return (readRoles[collection]||ROLES).includes(role);
  if (['events','users','sales','stockMovements','cashSessions','cashMovements'].includes(collection)) return false; // writes via workflows
  if (operation==='create') return (createRoles[collection]||[]).includes(role);
  if (operation==='update') return (createRoles[collection]||[]).includes(role);
  if (operation==='delete') return ['ADMIN'].includes(role) && !['serviceOrders','storeDevices','finance','alerts'].includes(collection);
  return false;
}
export function assertCan(role,collection,op) { if(!can(role,collection,op)) throw Object.assign(new Error('Sem permissão para esta operação'),{status:403}); }
export const MONEY_FIELDS = new Set(['cost','price','quantity','minimum','estimate','discount','total','acquisitionCost','tradeValue','additionalCosts','laborCost','intendedPrice','listedPrice','salePrice','amount','paymentStatus']);
export function stripFields(collection,data,role,old=null){
  if(!data || typeof data!=='object' || Array.isArray(data)) throw Object.assign(new Error('Dados inválidos'),{status:400});
  const allowed=EDITABLE[collection]||[];
  const out={};
  for(const [key,val] of Object.entries(data)){
    if (!allowed.includes(key)) throw Object.assign(new Error(`Campo não permitido: ${key}`),{status:400});
    if (typeof val==='string' && val.length>3000) throw Object.assign(new Error(`Campo muito grande: ${key}`),{status:400});
    if (['__proto__','constructor','prototype'].includes(key)) throw Object.assign(new Error('Campo inválido'),{status:400});
    if(typeof val ==='number' && !Number.isFinite(val)) throw Object.assign(new Error('Número inválido'),{status:400});
    if(role!=='ADMIN' && ((collection==='products'&&key==='cost') || (collection==='serviceCatalog'&&['partCost','laborCost','otherCost'].includes(key)) || (collection==='storeDevices'&&['acquisitionCost','tradeValue','laborCost','additionalCosts','salePrice'].includes(key)))) throw Object.assign(new Error('Custos e lucros são exclusivos do dono'),{status:403});
    if(collection==='storeDevices' && ['TECNICO','VENDEDOR_TECNICO'].includes(role) && MONEY_FIELDS.has(key)) throw Object.assign(new Error('Custos e preços restritos à gerência'),{status:403});
    if(collection==='serviceOrders' && ['TECNICO','VENDEDOR','VENDEDOR_TECNICO'].includes(role) && ['paymentStatus'].includes(key)) throw Object.assign(new Error('Registrar pagamento através do fluxo financeiro'),{status:403});
    out[key]=val;
  }
  if(collection==='serviceOrders' && out.status && !ORDER_STATUSES.includes(out.status)) throw Object.assign(new Error('Status de OS inválido'),{status:400});
  if(collection==='storeDevices' && out.status && !OWN_STATUSES.includes(out.status)) throw Object.assign(new Error('Status de aparelho inválido'),{status:400});
  return out;
}
export function amount(v){ const n=Number(v); if(!Number.isFinite(n)||n<0||n>1e9) throw Object.assign(new Error('Valor monetário inválido'),{status:400}); return Math.round(n*100)/100; }
export function qty(v){ const n=Number(v); if(!Number.isSafeInteger(n)||n<=0||n>100000) throw Object.assign(new Error('Quantidade inválida'),{status:400}); return n; }
export function money(v){return Math.round((Number(v)||0)*100)/100;}
export function profitability(cost,price){const c=money(cost),p=money(price);return {cost:c,price:p,profit:money(p-c),margin:p?money((p-c)/p*100):0};}
export function validPassword(p){return typeof p==='string' && /^[0-9]{8,128}$/.test(p);}
export function scrub(obj){ if(!obj || typeof obj!=='object')return obj; const result={};for(const [k,v] of Object.entries(obj)) if(!/(password|token|secret|credential|privateKey|serviceAccount)/i.test(k))result[k]=v;return result; }
/** Vencimentos futuros determinísticos; o dia do mês é limitado ao último dia disponível. */
export function nextDueDates(dueDate,recurrence,count=6){
  if(!dueDate||!['Semanal','Mensal','Anual'].includes(recurrence))return [];
  const source=new Date(`${String(dueDate).slice(0,10)}T12:00:00Z`);
  if(Number.isNaN(source.getTime()))return [];
  const result=[];
  for(let i=1;i<=count;i++){
    let d;
    if(recurrence==='Semanal'){d=new Date(source);d.setUTCDate(d.getUTCDate()+7*i);}
    else{
      const baseMonth=source.getUTCMonth()+ (recurrence==='Mensal'?i:12*i);
      const year=source.getUTCFullYear()+Math.floor(baseMonth/12),month=(baseMonth%12+12)%12;
      const last=new Date(Date.UTC(year,month+1,0)).getUTCDate();
      d=new Date(Date.UTC(year,month,Math.min(source.getUTCDate(),last),12));
    }
    result.push(d.toISOString().slice(0,10));
  }
  return result;
}
