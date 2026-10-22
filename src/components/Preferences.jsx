import React,{useState} from 'react';
import {Settings2} from 'lucide-react';
import {setPersistence,browserLocalPersistence,browserSessionPersistence} from 'firebase/auth';
import {auth} from '../lib/firebase';
import {useAuth} from '../lib/auth';
import {api} from '../lib/api';
import {Button,ErrorBox,Modal,Success} from './Ui';
export default function Preferences(){const {session,refresh}=useAuth();const [open,setOpen]=useState(false),[drafts,setDrafts]=useState(false),[remember,setRemember]=useState(false),[error,setError]=useState(''),[done,setDone]=useState(''),[busy,setBusy]=useState(false);
 const launch=()=>{setDrafts(session?.preferences?.drafts===true);setRemember(session?.preferences?.rememberDevice===true);setOpen(true);setError('');setDone('')};
 async function save(e){e.preventDefault();setBusy(true);setError('');try{await setPersistence(auth(),remember?browserLocalPersistence:browserSessionPersistence);await api('preferences.update',{drafts,rememberDevice:remember});await refresh();setDone('Preferências salvas para sua conta.');}catch(e){setError(e.message)}finally{setBusy(false)}}
 return <><button className="icon-btn" onClick={launch} title="Minhas preferências" aria-label="Minhas preferências"><Settings2 size={19}/></button>{open&&<Modal title="Minhas preferências" onClose={()=>setOpen(false)}><form className="form-stack" onSubmit={save}><p className="muted">Escolha como o FixFlowOS deve se comportar neste dispositivo.</p><label className="preference-option"><input type="checkbox" checked={drafts} onChange={e=>setDrafts(e.target.checked)}/> Salvar rascunhos de cadastros no servidor, disponíveis apenas para minha conta e loja.</label><label className="preference-option"><input type="checkbox" checked={remember} onChange={e=>setRemember(e.target.checked)}/> Manter minha conta conectada neste dispositivo.</label><p className="muted">Em computadores compartilhados, recomendamos deixar as duas opções desativadas. Sair da conta encerra a sessão.</p><ErrorBox error={error}/><Success message={done}/><Button type="submit" loading={busy}>Salvar preferências</Button></form></Modal>}</>}
