import React,{useEffect,useState} from 'react';
import {api} from '../lib/api';
import {useAuth} from '../lib/auth';
import {AlertTriangle,CheckCircle2,LoaderCircle,Plus,Search,X,Info,ChevronLeft,ChevronRight} from 'lucide-react';
import {brl,date,cls} from '../lib/helpers';
export function Button({children,variant='primary',loading=false,icon:Icon,block=false,className='',...props}){return <button {...props} disabled={props.disabled||loading} className={cls('btn',`btn-${variant}`,block&&'btn-block',className)}>{loading?<LoaderCircle size={16} className="spin"/>:Icon?<Icon size={16}/>:null}{children}</button>}
export function Panel({title,action,children,className=''}){return <div className={cls('panel',className)}>{title&&<div className="panel-heading"><h3>{title}</h3>{action}</div>}{children}</div>}
export function PageTitle({eyebrow='OPERAÇÃO',title,description,action}){return <div className="page-heading"><div><div className="eyebrow">{eyebrow}</div><h1>{title}</h1>{description&&<p>{description}</p>}</div>{action&&<div className="heading-actions">{action}</div>}</div>}
export function KPI({label,value,sub,icon:Icon,tone}){return <div className="kpi"><div className="kpi-top"><span>{label}</span>{Icon&&<span className={cls('kpi-icon',tone)}><Icon size={18}/></span>}</div><strong>{value}</strong><small>{sub||'Dados registrados'}</small></div>}
export function Loading(){return <div className="empty"><LoaderCircle className="spin" size={28}/><p>Carregando registros...</p></div>}
export function Empty({message='Nenhum registro encontrado.'}){return <div className="empty"><Info size={22}/><p>{message}</p></div>}
export function ErrorBox({error}){return error?<div className="error-box"><AlertTriangle size={16}/>{error}</div>:null}
export function Success({message}){return message?<div className="success-box"><CheckCircle2 size={16}/>{message}</div>:null}
export function Modal({title,onClose,children,wide=false}){return <div className="modal-overlay" onMouseDown={e=>{if(e.target===e.currentTarget)onClose()}}><div className={cls('modal',wide&&'modal-wide')} role="dialog" aria-modal="true" aria-label={title}><div className="modal-top"><h2>{title}</h2><button type="button" className="icon-btn" onClick={onClose} aria-label="Fechar"><X size={20}/></button></div><div className="modal-body">{children}</div></div></div>}
export function Field({label,children,hint}){return <label className="field"><span>{label}</span>{children}{hint&&<small>{hint}</small>}</label>}
export function DataTable({rows,columns,onRow,empty='Nenhum registro encontrado.',limit=12}){
  const [page,setPage]=useState(0);const total=Math.max(1,Math.ceil(rows.length/limit));const view=rows.slice(Math.min(page,total-1)*limit,(Math.min(page,total-1)+1)*limit);
  if(!rows.length)return <Empty message={empty}/>;
  return <><div className="table-scroll"><table><thead><tr>{columns.map(c=><th key={c.key}>{c.label}</th>)}{onRow&&<th/>}</tr></thead><tbody>{view.map((r,i)=><tr key={r.id||i} onClick={()=>onRow?.(r)} className={onRow?'clickable':''}>{columns.map(c=><td key={c.key}>{c.render?c.render(r):r[c.key]??'—'}</td>)}{onRow&&<td style={{textAlign:'right'}}><ChevronRight size={16}/></td>}</tr>)}</tbody></table></div>{rows.length>limit&&<div className="pager"><span>{rows.length} registros</span><div><Button variant="ghost" disabled={page===0} onClick={()=>setPage(n=>n-1)} icon={ChevronLeft}>Anterior</Button><span>{Math.min(page,total-1)+1}/{total}</span><Button variant="ghost" disabled={page>=total-1} onClick={()=>setPage(n=>n+1)}>Próxima <ChevronRight size={14}/></Button></div></div>}</>
}
export function FormRenderer({fields,initial={},references={},onSubmit,busy,submitText='Salvar',exclude=[],draftKey=''}){
  const {session}=useAuth();const enabled=!!draftKey&&session?.preferences?.drafts===true;
  const [form,setForm]=useState(()=>Object.fromEntries(fields.map(f=>[f.key,initial[f.key]??''])));
  const [draftReady,setDraftReady]=useState(!enabled);
  useEffect(()=>{if(!enabled){setDraftReady(true);return;}
    let active=true;api('drafts.get',{key:draftKey}).then(result=>{if(active&&result?.data&&Object.keys(result.data).length)setForm(old=>({...old,...result.data}));}).catch(()=>{}).finally(()=>{if(active)setDraftReady(true)});
    return()=>{active=false};
  },[enabled,draftKey]);
  useEffect(()=>{if(!enabled||!draftReady)return;const timeout=setTimeout(()=>{api('drafts.save',{key:draftKey,data:form}).catch(()=>{});},1200);return()=>clearTimeout(timeout);},[enabled,draftKey,draftReady,form]);
  const [error,setError]=useState('');
  const update=(key,v)=>setForm(old=>({...old,[key]:v}));
  const submit=async e=>{e.preventDefault();setError('');try{
    const data={};for(const field of fields){if(exclude.includes(field.key))continue;const v=form[field.key];if(v===''||v===undefined)continue;
      if(field.type==='number'){if(!Number.isFinite(Number(v)))throw new Error(`Número inválido em ${field.label}`);data[field.key]=Number(v);}
      else if(field.key==='active'||field.key==='warrantyCovered') data[field.key]=v==='true'; else data[field.key]=v;
    }await onSubmit(data);if(enabled)await api('drafts.clear',{key:draftKey}).catch(()=>{});
  }catch(e){setError(e.message)}};
  return <form onSubmit={submit} className="form-stack"><div className="form-grid">{fields.filter(f=>!exclude.includes(f.key)).map(f=>{
    const val=form[f.key]===null?'':form[f.key];
    return <label className={cls('field',f.type==='textarea'&&'field-span')} key={f.key}><span>{f.label}{f.required&&' *'}</span>
      {f.type==='textarea'?<textarea rows="3" value={val} onChange={e=>update(f.key,e.target.value)} />:
      f.type==='select'||f.type==='relation'?<select value={String(val)} onChange={e=>update(f.key,e.target.value)} required={f.required}><option value="">Selecione...</option>{(f.type==='relation'?(references[f.reference]||[]).map(r=>({value:r.id,label:r[f.labelKey]||r.name||r.number||r.id})):f.options.map(o=>typeof o==='string'?{value:o,label:o}:o)).map(o=><option key={o.value} value={o.value}>{o.label}</option>)}</select>:
      <input type={f.type||'text'} min={f.min} step={f.step} required={f.required} value={val} onChange={e=>update(f.key,e.target.value)} />}</label>
  })}</div><ErrorBox error={error}/>{enabled&&<small className="muted">Rascunho salvo automaticamente em sua conta enquanto você preenche. O registro definitivo só será criado quando clicar em Salvar.</small>}<div className="form-actions"><Button type="submit" loading={busy}>{submitText}</Button></div></form>
}
export function FilterSearch({value,onChange,placeholder='Pesquisar...'}){return <div className="search"><Search size={16}/><input aria-label="Pesquisar" placeholder={placeholder} value={value} onChange={e=>onChange(e.target.value)}/></div>}
export function Chip({children,tone='muted'}){return <span className={cls('chip',`chip-${tone}`)}>{children}</span>}
export const currencyCell=(r,k)=>brl(r[k]);
export const dateCell=(r,k)=>date(r[k]);
