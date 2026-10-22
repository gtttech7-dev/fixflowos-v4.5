import React,{useEffect,useState} from 'react';
import {ClipboardList,Package,HardDrive,ShoppingBag,RefreshCcw} from 'lucide-react';
import {Link} from 'react-router-dom';
import {api,clearApiCache} from '../lib/api';
import {useAuth} from '../lib/auth';
import {brl,dateTime} from '../lib/helpers';
import {Button,Empty,ErrorBox,KPI,Loading,PageTitle,Panel} from '../components/Ui';
export default function Dashboard(){
 const {session}=useAuth();const owner=session?.role==='ADMIN';
 const [info,setInfo]=useState(null),[error,setError]=useState(''),[loading,setLoading]=useState(true);
 async function load(force=false){if(force)clearApiCache();setLoading(true);setError('');try{setInfo(await api('dashboard.summary'))}catch(e){setError(e.message)}finally{setLoading(false)}}
 useEffect(()=>{load()},[]);
 const statuses=info?.counts||{};
 const statusList=['Aguardando avaliação','Em avaliação','Orçamento enviado','Aguardando aprovação','Aprovado','Aguardando peça','Em reparo','Em testes','Pronto para retirada','Entregue'];
 return <><PageTitle eyebrow="PAINEL DE CONTROLE" title="Visão geral da loja" description="Indicadores compactos calculados no servidor, sem carregar listas inteiras de OS e estoque." action={<Button variant="secondary" icon={RefreshCcw} onClick={()=>load(true)}>Atualizar</Button>}/><ErrorBox error={error}/>{loading?<Loading/>:<div className="stack"><div className="kpi-grid"><KPI label="OS em andamento" value={info?.activeOrders??0} icon={ClipboardList} sub="Não entregues nem canceladas"/><KPI label="Prontas para retirada" value={statuses['Pronto para retirada']||0} icon={ClipboardList} tone="green"/><KPI label="Produtos esgotados" value={info?.zeroStock??0} icon={Package}/><KPI label="Aparelhos da loja" value={info?.devices??0} icon={HardDrive}/></div>
 <div className="dashboard-grid"><Panel title="Etapas das ordens de serviço"><div className="status-list">{statusList.map(st=>{const count=statuses[st]||0;return <Link className="status-row" to={`/os?status=${encodeURIComponent(st)}`} key={st}><div><span>{st}</span><small>{count} OS</small></div><div className="status-meter"><span style={{width:`${count/Math.max(1,info?.ordersTotal||1)*100}%`}}/></div></Link>})}</div><p className="muted">Clique em uma etapa para abrir apenas as OS daquele status.</p></Panel>
 <Panel title="Atividade recente"><div className="timeline">{(info?.events||[]).map(ev=><div className="timeline-item" key={ev.id}><span className="timeline-dot"/><div><strong>{ev.actorName||'Equipe'}</strong><p>{ev.summary||'Atualização registrada'}</p><small>{dateTime(ev.createdAt)}</small></div></div>)}{!info?.events?.length&&<Empty message="Nenhuma atividade recente."/>}</div><Link className="panel-link" to="/historico">Ver histórico →</Link></Panel></div>
 {owner&&<Panel title="Últimas vendas registradas"><p className="muted">Valores somente das últimas 24 vendas consultadas; para indicadores completos use Financeiro. Não representam o faturamento total da loja.</p><KPI label="Soma das últimas vendas concluídas" icon={ShoppingBag} value={brl(info?.latestSalesSum||0)} sub="Amostra recente, não total contábil"/></Panel>}
 </div>}</>;
}
