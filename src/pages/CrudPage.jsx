import React,{useMemo,useState} from 'react';
import {Archive,Download,Edit3,FilePlus,Plus,RefreshCcw} from 'lucide-react';
import {api} from '../lib/api';
import Attachments from '../components/Attachments';
import {useData,useBundle} from '../lib/useData';
import {useAuth} from '../lib/auth';
import {brl,date,safeError} from '../lib/helpers';
import {schemas,fieldLabel} from '../lib/schema';
import {Button,Chip,DataTable,Empty,ErrorBox,FilterSearch,FormRenderer,Loading,Modal,PageTitle,Panel,Success} from '../components/Ui';
export default function CrudPage({collection,subtitle,onSaved,external,hideTitle=false,hideSearch=false}){
  const schema=schemas[collection],{session}=useAuth(),local=useData(collection,!external),{rows,loading,error,refresh,loadMore,hasMore,moreLoading}=external||local,[filter,setFilter]=useState(''),[editing,setEditing]=useState(null),[creating,setCreating]=useState(false),[busy,setBusy]=useState(false),[msg,setMsg]=useState(''),[localError,setLocalError]=useState('');
  const referenceNames=[...new Set(schema.fields.filter(f=>f.type==='relation').map(f=>f.reference))].filter(x=>x!==collection);
  const {data:refs}=useBundle(referenceNames,referenceNames.length>0);
  const filtered=useMemo(()=>rows.filter(r=>!r.archived&&JSON.stringify(r).toLowerCase().includes(filter.toLowerCase())),[rows,filter]);
  const technicalOwn=collection==='storeDevices'&&['TECNICO','VENDEDOR_TECNICO'].includes(session?.role);
  const hiddenOwn=technicalOwn?['acquisitionCost','tradeValue','laborCost','intendedPrice','listedPrice','supplier','origin','acquiredAt','technicianId','imei','serial','color','capacity','accessories','number','brand','model']:[];
  const supplierHidden=session?.role!=='ADMIN'&&['products','storeDevices'].includes(collection)?['supplier']:[];
  const privateFields=session?.role!=='ADMIN'?({products:['cost','minimum','quantity'],storeDevices:['acquisitionCost','tradeValue','laborCost','additionalCosts','salePrice','buyerId'],serviceCatalog:['partCost','laborCost','otherCost']})[collection]||[]:[];
  const noEdit=[...(['products'].includes(collection)?['quantity']:[]),...privateFields,...supplierHidden,...hiddenOwn,...(collection==='serviceOrders'&&session?.role==='TECNICO'?['estimate','discount','total']:[])];
  const readable=session?.role==='ADMIN', canEdit=['serviceOrders','customers','devices'].includes(collection)||['ADMIN','GERENTE'].includes(session?.role)||(collection==='storeDevices'&&['TECNICO','VENDEDOR_TECNICO'].includes(session?.role)), canCreate=collection==='serviceOrders'||collection==='customers'||collection==='devices'||(['ADMIN','GERENTE'].includes(session?.role));
  const cols=schema.columns.filter(key=>!(collection==='products'&& !readable && ['minimum'].includes(key))&&!(['cost','acquisitionCost'].includes(key)&&!readable)&&!(key==='total'&&session?.role==='TECNICO')).map(key=>({key,label:fieldLabel(schema,key),render:r=>{
    if(key==='quantity' && collection==='products' && !readable)return r.availability||'Indisponível';
    if(['total','estimate','price','cost','amount','acquisitionCost','intendedPrice','listedPrice'].includes(key))return brl(r[key]);
    if(['dueDate','paidAt','acquiredAt'].includes(key))return date(r[key]);
    if(key==='status')return <Chip tone={['Pronto para retirada','Pago','Pronto para venda','Entregue'].includes(r[key])?'green':['Cancelado','Aguardando peça'].includes(r[key])?'orange':'muted'}>{r[key]||'—'}</Chip>;
    if(key==='customerId')return refs.customers?.find(x=>x.id===r[key])?.name||'—';
    if(key==='technicianId')return refs.users?.find(x=>x.id===r[key])?.name||'—';
    return r[key]??'—';
  }}));
  const save=async data=>{setBusy(true);setLocalError('');try{const isEdit=!!editing;await api(`records.${isEdit?'update':'create'}`,{collection,id:editing?.id,data});setEditing(null);setCreating(false);setMsg(isEdit?'Registro atualizado e auditado.':'Registro criado e auditado.');await refresh();onSaved?.();}catch(e){setLocalError(e.message);throw e;}finally{setBusy(false)}};
  const archive=async()=>{if(!editing||!window.confirm('Arquivar este registro? O histórico será preservado.'))return;setBusy(true);setLocalError('');try{await api('records.delete',{collection,id:editing.id});setEditing(null);await refresh();setMsg('Registro arquivado.')}catch(e){setLocalError(e.message)}finally{setBusy(false)}};
  const exportCsv=()=>{const exported=cols.map(c=>c.key);const values=[exported.map(k=>fieldLabel(schema,k)),...filtered.map(r=>exported.map(k=>k==='quantity'&&!readable&&collection==='products'?r.availability:r[k]??''))];const content='\uFEFF'+values.map(row=>row.map(v=>`"${String(v).replaceAll('"','""')}"`).join(';')).join('\n');const a=document.createElement('a');a.href=URL.createObjectURL(new Blob([content],{type:'text/csv;charset=utf-8'}));a.download=`fixflowos-${collection}.csv`;a.click();URL.revokeObjectURL(a.href)};
  return <>{!hideTitle&&<PageTitle title={schema.title} description={subtitle||schema.subtitle} action={<><Button variant="secondary" icon={Download} onClick={exportCsv}>Exportar</Button>{canCreate&&<Button icon={Plus} onClick={()=>{setCreating(true);setMsg('')}}>Novo registro</Button>}</>}/>}<div className="stack"><Success message={msg}/><ErrorBox error={error||localError}/><Panel><div className="toolbar">{hideTitle&&canCreate&&<Button icon={Plus} onClick={()=>{setCreating(true);setMsg('')}}>Nova OS</Button>}{!hideSearch&&<FilterSearch value={filter} onChange={setFilter} placeholder={`Buscar em ${schema.title.toLowerCase()}...`}/>}<div className="toolbar-right"><span className="muted">{filtered.length} registro(s) nesta página</span><Button variant="ghost" icon={RefreshCcw} onClick={refresh}>Atualizar</Button></div></div>{loading?<Loading/>:<DataTable rows={filtered} columns={cols} onRow={canEdit?r=>{setEditing(r);setLocalError('');}:undefined} empty={`Nenhum cadastro em ${schema.title.toLowerCase()}. Use “Novo registro” quando autorizado.`}/>} {!external&&hasMore&&<div className="pager"><span>Carregue mais registros somente se necessário.</span><Button variant="secondary" loading={moreLoading} onClick={loadMore}>Carregar mais 40</Button></div>}</Panel></div>
  {(creating||editing)&&<Modal title={editing?`Editar ${schema.title.toLowerCase()}`:`Cadastrar em ${schema.title.toLowerCase()}`} onClose={()=>{setEditing(null);setCreating(false);setLocalError('')}} wide><ErrorBox error={localError}/><FormRenderer key={editing?.id||'new'} draftKey={`${collection}_${editing?.id||'novo'}`} fields={schema.fields} initial={editing||{status:collection==='serviceOrders'?'Aguardando avaliação':undefined}} references={refs} busy={busy} onSubmit={save} exclude={editing?[...noEdit,...(collection==='serviceOrders'?['number']:[])]:[...supplierHidden,...hiddenOwn,...privateFields,...(collection==='serviceOrders'?['number',...(session?.role==='TECNICO'?['estimate','discount','total']:[])]:[])]}/>{editing&&<div className="modal-actions"><small>Atualizações ficam registradas no diário da loja.</small>{session?.role==='ADMIN'&&!['serviceOrders'].includes(collection)&&<Button variant="danger" icon={Archive} onClick={archive} disabled={busy}>Arquivar</Button>}</div>}{editing&&['serviceOrders','storeDevices'].includes(collection)&&<Attachments key={editing.id} collection={collection} row={editing} onSaved={refresh}/>}
  {collection==='serviceOrders'&&editing&&session?.role!=='TECNICO'&&<OrderPayment order={editing} onSuccess={()=>{setEditing(null);refresh();}}/>}</Modal>}
  </>;
}
export function OrderPayment({order,onSuccess}){
 const {session}=useAuth();
 const manager=['ADMIN','GERENTE'].includes(session?.role);
 const {rows:users}=useData('users',manager);
 const [value,setValue]=useState(''),[method,setMethod]=useState('PIX'),[receiver,setReceiver]=useState(''),[busy,setBusy]=useState(false),[err,setErr]=useState('');
 const paid=(order.payments||[]).reduce((s,p)=>s+Number(p.amount||0),0);
 const remaining=Math.max(0,Number(order.total||0)-paid);
 return <div className="subsection"><h3>Pagamentos registrados nesta OS</h3><div className="order-payment-summary"><div>Total da OS<strong>{brl(order.total||0)}</strong></div><div>Já recebido<strong>{brl(paid)}</strong></div><div>Falta receber<strong>{brl(remaining)}</strong></div></div>{(order.payments||[]).length>0?<div className="table-scroll"><table><thead><tr><th>Data</th><th>Valor</th><th>Forma</th><th>Quem recebeu</th></tr></thead><tbody>{order.payments.map((p,i)=><tr key={i}><td>{new Date(p.createdAt||Date.now()).toLocaleDateString('pt-BR')}</td><td>{brl(p.amount)}</td><td>{p.method||'—'}</td><td>{p.receivedByName||p.actorName||'—'}</td></tr>)}</tbody></table></div>:<p className="muted">Ainda não há recebimentos confirmados.</p>}<h3>Registrar novo recebimento</h3><p>A autoria da operação é sempre registrada com a conta autenticada.</p><div className="inline-form">
 <input type="number" aria-label="Valor recebido" min="0.01" max={remaining} step="0.01" value={value} placeholder="Valor R$" onChange={e=>setValue(e.target.value)}/>
 <select aria-label="Forma de pagamento" value={method} onChange={e=>setMethod(e.target.value)}>{['PIX','Dinheiro','Cartão','Outro'].map(x=><option key={x}>{x}</option>)}</select>
 {manager&&<select aria-label="Funcionário que recebeu" value={receiver} onChange={e=>setReceiver(e.target.value)}><option value="">Eu recebi o pagamento</option>{users.filter(u=>u.active&&['ADMIN','GERENTE','VENDEDOR','VENDEDOR_TECNICO'].includes(u.role)).map(u=><option key={u.id} value={u.id}>{u.name||u.email}</option>)}</select>}
 <Button disabled={!value||Number(value)<=0||Number(value)>remaining||order.status==='Cancelado'} loading={busy} onClick={async()=>{setBusy(true);setErr('');try{await api('orders.payment',{id:order.id,amount:Number(value),method,...(receiver?{receivedById:receiver}:{})});onSuccess?.();}catch(e){setErr(e.message);}finally{setBusy(false)}}}>Confirmar recebimento</Button></div><ErrorBox error={err}/>
 <small className="muted">Se o responsável selecionado for outro funcionário, o histórico mostrará quem registrou e quem recebeu. O Técnico não possui autorização para registrar pagamentos.</small></div>
}
