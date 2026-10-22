/** Campos financeiros privados: filtro aplicado na API antes de devolver JSON. */
const privateDevice = new Set(['acquisitionCost','tradeValue','laborCost','additionalCosts','supplier','buyerId','origin','salePrice']);
const privateProduct = new Set(['cost','supplier','location','quantity','minimum']);
const privateSale = new Set(['cost','profit','unitCost','totalCost']);
export function redactRecord(collection,row,role,uid){
  if(role==='ADMIN')return row;
  const omit=(obj,fields)=>Object.fromEntries(Object.entries(obj).filter(([key])=>!fields.has(key)));
  if(collection==='users')return {id:row.id,name:row.name,role:row.role,active:row.active};
  if(collection==='products')return {...omit(row,privateProduct),availability:!Number(row.quantity)?'Esgotado':Number(row.quantity)===1?'Última unidade':'Disponível'};
  if(collection==='storeDevices')return omit(row,privateDevice);
  if(collection==='serviceCatalog')return omit(row,new Set(['partCost','laborCost','otherCost']));
  if(collection==='stockMovements')return omit(row,new Set(['before','after','unitCost','totalCost','delta']));
  if(collection==='sales'){
    if(!['GERENTE','ADMIN'].includes(role)&&row.sellerId!==uid)return null;
    return {...omit(row,privateSale),items:(row.items||[]).map(i=>omit(i,privateSale))};
  }
  if(collection==='events'){
    if(['suppliers','finance'].includes(row.resource)||/storeDevices\.cost|finance|sales\.profit/.test(row.type||''))return null;
    return omit(row,new Set(['changes']));
  }
  if(collection==='serviceOrders'){
    const result={...row,parts:(row.parts||[]).map(p=>omit(p,new Set(['unitCost','totalCost'])))};
    if(role==='TECNICO')return omit(result,new Set(['estimate','discount','total','payments','paymentStatus']));
    return result;
  }
  if(collection==='cashMovements'){
    if(!['ADMIN','GERENTE'].includes(role)&&row.actorUid!==uid)return null;
    return role==='TECNICO'?omit(row,new Set(['amount'])):row;
  }
  if(collection==='cashSessions')return omit(row,new Set(['openingBalance','expectedBalance','counted','difference']));
  return row;
}
export const OWNER_ONLY_DEVICE_FIELDS=new Set(['acquisitionCost','tradeValue','laborCost','additionalCosts','salePrice']);
export const OWNER_ONLY_PRODUCT_FIELDS=new Set(['cost']);
export const OWNER_ONLY_SERVICE_FIELDS=new Set(['partCost','laborCost','otherCost']);
