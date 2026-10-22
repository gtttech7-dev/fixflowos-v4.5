import React,{useEffect,useState} from 'react';
import {AlertCircle,AlertTriangle,Bell,CheckCheck,Info,RefreshCcw} from 'lucide-react';
import {Link} from 'react-router-dom';
import {api} from '../lib/api';
import {Button,Chip,Empty,ErrorBox,Loading,PageTitle,Panel} from '../components/Ui';
export default function Alerts(){const [rows,setRows]=useState([]),[loading,setLoading]=useState(true),[error,setError]=useState('');const [busy,setBusy]=useState('');
 const refresh=async()=>{setLoading(true);setError('');try{setRows(await api('alerts.list'))}catch(e){setError(e.message)}finally{setLoading(false)}};useEffect(()=>{refresh()},[]);
 const mark=async id=>{setBusy(id);try{await api('alerts.ack',{id,read:true});setRows(old=>old.map(r=>r.id===id?{...r,read:true}:r));}catch(e){setError(e.message)}finally{setBusy('')}};
 const linkFor={serviceOrders:'/os',products:'/estoque',finance:'/financeiro',storeDevices:'/aparelhos-da-loja'};
 return <><PageTitle title="Central de alertas" description="Alertas calculados com os dados atuais da loja: estoque, OS, contas e aparelhos próprios." action={<Button icon={RefreshCcw} variant="secondary" onClick={refresh}>Atualizar</Button>}/><ErrorBox error={error}/><Panel title={`${rows.filter(r=>!r.read).length} alerta(s) não lidos neste navegador`}>{loading?<Loading/>:<div className="alerts-list">{rows.filter(r=>!r.read).map(r=><div key={r.id} className="alert-row"><div className={`alert-icon ${r.level}`}><AlertTriangle size={18}/></div><div><strong>{r.title}</strong><p>{r.description}</p><Link to={linkFor[r.module]||'/dashboard'}>Abrir registro relacionado →</Link></div><Button variant="ghost" onClick={()=>mark(r.id)} loading={busy===r.id} icon={CheckCheck}>Marcar lido</Button></div>)}{!rows.filter(r=>!r.read).length&&<Empty message="Sem alertas pendentes para este navegador."/>}</div>}</Panel><p className="muted note">Os alertas são calculados a partir dos registros da loja e a leitura é persistida por funcionário no Firestore.</p></>
}
