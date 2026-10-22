import React,{useState} from 'react';
import {ShieldCheck,Save,LockKeyhole} from 'lucide-react';
import {setPersistence,browserLocalPersistence,browserSessionPersistence} from 'firebase/auth';
import {auth} from '../lib/firebase';
import {api} from '../lib/api';
import {useAuth} from '../lib/auth';
import {Button,ErrorBox,Modal} from './Ui';
export default function PrivacyGate({children}){
 const {session,refresh,logout}=useAuth();
 const [accepted,setAccepted]=useState(false),[drafts,setDrafts]=useState(false),[rememberDevice,setRememberDevice]=useState(false),[busy,setBusy]=useState(false),[error,setError]=useState('');
 if(!session||session.policyAccepted)return children;
 const contract=session.role==='ADMIN'||session.superAdmin;
 async function confirm(e){e.preventDefault();if(!accepted)return;setBusy(true);setError('');try{
  await setPersistence(auth(),rememberDevice?browserLocalPersistence:browserSessionPersistence);await api('privacy.accept',{version:session.policyVersion,drafts,rememberDevice});await refresh();
 }catch(e){setError(e.message)}finally{setBusy(false)}}
 return <div className="auth-screen"><Modal title="Privacidade e boas-vindas" onClose={()=>{logout()}} wide>
 <div className="stack"><div style={{display:'flex',gap:12,alignItems:'center'}}><ShieldCheck size={32} color="#39cfa3"/><div><h3 style={{margin:0}}>Antes de começar no FixFlowOS</h3><p className="muted">{contract?'Leia os termos de uso da plataforma e a política de privacidade.':'Conheça as regras de uso e privacidade estabelecidas para sua conta de funcionário.'}</p></div></div>
 <div className="policy-body"><p>O FixFlowOS utiliza dados necessários ao cadastro, autenticação, ordens de serviço, vendas, estoque e histórico operacional. Os dados de cada loja são isolados e o acesso depende das permissões de sua conta.</p><p>As opções de salvar rascunhos e manter o acesso conectado são independentes. Recusá-las não impede o uso normal do sistema. Em computadores compartilhados, recomendamos manter ambas desativadas.</p><p>Leia os documentos antes de concordar. Modelos de termos e privacidade devem ser adaptados com os dados e a política da empresa antes do uso comercial.</p></div>
 <div className="inline-form"><a className="btn btn-secondary" href="/legal/termos.html" target="_blank" rel="noreferrer">Termos de Uso ↗</a><a className="btn btn-secondary" href="/legal/privacidade.html" target="_blank" rel="noreferrer">Política de Privacidade ↗</a></div>
 <form onSubmit={confirm} className="form-stack"><label className="preference-option"><input type="checkbox" checked={accepted} onChange={e=>setAccepted(e.target.checked)}/> {contract?'Li e concordo com os Termos de Uso e tive acesso à Política de Privacidade.':'Li as regras de utilização e tomei ciência da Política de Privacidade.'}</label>
 <label className="preference-option"><input type="checkbox" checked={drafts} onChange={e=>setDrafts(e.target.checked)}/> <Save size={16}/> Salvar meus rascunhos no servidor para recuperar formulários interrompidos.</label>
 <label className="preference-option"><input type="checkbox" checked={rememberDevice} onChange={e=>setRememberDevice(e.target.checked)}/> <LockKeyhole size={16}/> Prefiro manter a conta conectada neste dispositivo. <small>(Escolha também no login)</small></label>
 <ErrorBox error={error}/><div className="inline-form"><Button type="button" variant="secondary" onClick={logout}>Não concordo / Sair</Button><Button type="submit" disabled={!accepted} loading={busy}>Aceitar e continuar</Button></div></form></div>
 </Modal></div>;
}
