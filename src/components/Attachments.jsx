import React,{useState} from 'react';
import {getBlob,ref,uploadBytes} from 'firebase/storage';
import {FileImage,Paperclip,UploadCloud} from 'lucide-react';
import {useAuth} from '../lib/auth';
import {storage} from '../lib/firebase';
import {api} from '../lib/api';
import {Button,ErrorBox} from './Ui';
export default function Attachments({collection,row,onSaved}){
 const {session}=useAuth(),[uploading,setUploading]=useState(false),[error,setError]=useState(''),[files,setFiles]=useState(row?.[collection==='storeDevices'?'photos':'attachments']||[]);
 const key=collection==='storeDevices'?'photos':'attachments';
 const upload=async ev=>{
  const file=ev.target.files?.[0];if(!file)return;
  setError('');if(file.size>10*1024*1024){setError('Limite de 10MB por arquivo.');return;}
  if(!(file.type.startsWith('image/')||file.type==='application/pdf')){setError('Envie apenas imagem ou PDF.');return;}
  setUploading(true);
  try{
   const safeName=file.name.replace(/[^\w.\-]/g,'_').slice(0,90);
   const path=`stores/${session.storeId}/${collection}/${row.id}/${crypto.randomUUID()}-${safeName}`;
   await uploadBytes(ref(storage(),path),file,{contentType:file.type});
   const next=[...files,{name:file.name,path,type:file.type,createdAt:new Date().toISOString()}];
   await api('records.update',{collection,id:row.id,data:{[key]:next}});
   setFiles(next);onSaved?.();
  }catch(e){setError(`Falha no anexo: ${e.message}`)}finally{setUploading(false);ev.target.value='';}
 };
 const open=async f=>{setError('');try{const b=await getBlob(ref(storage(),f.path));const url=URL.createObjectURL(b);window.open(url,'_blank','noopener,noreferrer');setTimeout(()=>URL.revokeObjectURL(url),60000)}catch(e){setError(`Não foi possível abrir o anexo. Verifique permissões e CORS do Storage. ${e.message}`)}};
 return <div className="subsection"><h3>Fotos e documentos</h3><p>Anexos armazenados na área protegida da loja (Firebase Storage).</p><ErrorBox error={error}/><div className="attachment-list">{files.map(f=><button type="button" onClick={()=>open(f)} className="attachment" key={f.path}><Paperclip size={16}/>{f.name}</button>)}</div><label className="file-upload"><UploadCloud size={18}/>{uploading?'Enviando...':'Anexar foto ou PDF'}<input aria-label="Enviar foto ou documento" disabled={uploading} type="file" accept="image/*,.pdf" onChange={upload}/></label></div>
}
