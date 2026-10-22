import React,{useMemo,useState} from 'react';
import {CalendarDays,TrendingDown,TrendingUp,Wallet} from 'lucide-react';
import {useBundle} from '../lib/useData';
import {storeLedger} from '../lib/ledger';
import {storeFinanceMonths} from '../lib/finance-chart.js';
import FinanceChart from '../components/FinanceChart';
import {brl,date} from '../lib/helpers';
import {DataTable,ErrorBox,KPI,PageTitle,Panel} from '../components/Ui';
import CrudPage from './CrudPage';
export default function Finance(){
 const {data,error}=useBundle(['finance','serviceOrders']);const [filter,setFilter]=useState('month'),[start,setStart]=useState(''),[end,setEnd]=useState('');
 const ledger=useMemo(()=>storeLedger(data.finance||[],data.serviceOrders||[],{filter,start,end}),[data,filter,start,end]);
 const openLedger=useMemo(()=>storeLedger(data.finance||[],data.serviceOrders||[],{filter:'all'}),[data]);
 const pending=[...openLedger.pendingOrders.map(o=>({id:'os-'+o.id,description:`OS ${o.number||o.id.slice(0,8)} · ${o.customerName||o.model||''}`,amount:o.outstanding,dueDate:o.dueDate||'',status:'Pendente',type:'OS'})),...openLedger.manualPending];
 return <><PageTitle title="Financeiro da loja" description="A receber desde a criação da OS; recebido somente após pagamento confirmado. Não mistura valores da plataforma SaaS."/>
 <ErrorBox error={error}/><div className="toolbar filters"><select value={filter} onChange={e=>setFilter(e.target.value)}><option value="month">OS criadas / pagamentos deste mês</option><option value="7">Últimos 7 dias</option><option value="year">Ano atual</option><option value="all">Todo o histórico carregado</option><option value="custom">Personalizado</option></select>{filter==='custom'&&<><input aria-label="Data inicial" type="date" value={start} onChange={e=>setStart(e.target.value)}/><input aria-label="Data final" type="date" value={end} onChange={e=>setEnd(e.target.value)}/></>}</div>
 <div className="kpi-grid"><KPI label="Receita recebida" value={brl(ledger.received)} icon={TrendingUp} tone="green" sub="Pagamentos confirmados no período"/><KPI label="Despesas pagas" value={brl(ledger.expenses)} icon={TrendingDown} tone="orange"/><KPI label="Resultado por caixa" value={brl(ledger.result)} icon={Wallet} sub="Entradas confirmadas menos despesas pagas"/><KPI label="Total a receber de OS e lançamentos" value={brl(openLedger.outstanding)} icon={CalendarDays} sub="Saldo de todas as OS, desde a criação, independente do filtro"/></div>
 <Panel title="Evolução de recebimentos, despesas e pendências · últimos seis meses"><FinanceChart rows={storeFinanceMonths(data.finance||[],data.serviceOrders||[])}/></Panel>
 <Panel title="Pendências de todo o histórico (não são receitas recebidas)"><DataTable rows={pending} columns={[{key:'description',label:'Origem'},{key:'dueDate',label:'Prazo',render:r=>date(r.dueDate)},{key:'amount',label:'Saldo a receber',render:r=>brl(r.amount)},{key:'status',label:'Situação'}]}/></Panel>
 <CrudPage collection="finance" subtitle="Lançamentos manuais e recebimentos confirmados, sem duplicar valores de OS"/>
</>
}
