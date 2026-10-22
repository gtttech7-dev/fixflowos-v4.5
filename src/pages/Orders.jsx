import React,{useEffect,useState} from 'react';
import {useSearchParams} from 'react-router-dom';
import {ChevronLeft,ChevronRight,RefreshCcw} from 'lucide-react';
import {api,clearApiCache} from '../lib/api';
import {orderStatuses} from '../lib/schema';
import {Button,ErrorBox,FilterSearch,PageTitle} from '../components/Ui';
import CrudPage from './CrudPage';
const quick=['','Aguardando avaliação','Aguardando aprovação','Aguardando peça','Em reparo','Em testes','Pronto para retirada','Entregue'];
export default function Orders(){
 const [params,setParams]=useSearchParams();const status=params.get('status')||'';
 const [input,setInput]=useState(''),[search,setSearch]=useState('');
 const [pages,setPages]=useState([null]),[index,setIndex]=useState(0),[rows,setRows]=useState([]),[next,setNext]=useState(null),[loading,setLoading]=useState(true),[error,setError]=useState('');
 useEffect(()=>{const t=setTimeout(()=>setSearch(input.trim()),350);return()=>clearTimeout(t)},[input]);
 useEffect(()=>{setPages([null]);setIndex(0)},[status,search]);
 const cursor=pages[index]??null;
 async function load(force=false){
  if(force)clearApiCache();setLoading(true);setError('');
  try{const data=await api('orders.page',{status,search,cursor,limit:20});setRows(data.rows||[]);setNext(data.nextCursor||null)}
  catch(e){setError(e.message)}finally{setLoading(false)}
 }
 useEffect(()=>{let active=true;setLoading(true);api('orders.page',{status,search,cursor,limit:20}).then(x=>{if(active){setRows(x.rows||[]);setNext(x.nextCursor||null);setError('')}}).catch(e=>{if(active)setError(e.message)}).finally(()=>{if(active)setLoading(false)});return()=>{active=false}},[status,search,cursor]);
 function changeStatus(value){setParams(value?{status:value}:{})}
 return <>
 <PageTitle eyebrow="ATENDIMENTO" title="Ordens de serviço" description="Encontre OS rapidamente sem carregar todos os registros da assistência."/>
 <div className="os-status-tabs" role="tablist" aria-label="Filtrar por etapa">{quick.map(st=><button type="button" role="tab" aria-selected={st===status} className={st===status?'active':''} key={st||'all'} onClick={()=>changeStatus(st)}>{st||'Todas'}</button>)}</div>
 <div className="os-filters"><FilterSearch value={input} onChange={setInput} placeholder="Número da OS ou início do nome do cliente..."/><select value={status} aria-label="Filtrar pelo status" onChange={e=>changeStatus(e.target.value)}><option value="">Todos os status</option>{orderStatuses.map(st=><option key={st}>{st}</option>)}</select><Button icon={RefreshCcw} variant="secondary" onClick={()=>load(true)}>Atualizar</Button></div>
 <ErrorBox error={error}/>
 <CrudPage collection="serviceOrders" external={{rows,loading,error,refresh:()=>load(true)}} hideTitle hideSearch/>
 <div className="os-pager"><span className="muted">Página {index+1} · {rows.length} OS nesta página</span><Button variant="secondary" icon={ChevronLeft} disabled={index===0||loading} onClick={()=>setIndex(i=>Math.max(0,i-1))}>Anterior</Button><Button variant="secondary" disabled={!next||loading} onClick={()=>{setPages(old=>{const copy=old.slice();copy[index+1]=next;return copy});setIndex(i=>i+1)}}>Próxima <ChevronRight size={14}/></Button></div>
 <p className="muted">A pesquisa por número é exata; por cliente, procura nomes que começam pelo texto digitado (diferencia maiúsculas). Use as abas e o filtro para consultar apenas a etapa desejada.</p>
 </>;
}
