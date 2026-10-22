import React,{useEffect,useState} from 'react';
import {NavLink,useLocation} from 'react-router-dom';
import {Activity,Archive,BarChart3,Bell,Boxes,BriefcaseBusiness,CalendarCheck,ChevronDown,ChevronRight,ClipboardList,CreditCard,FileClock,FileSpreadsheet,Gauge,HandCoins,HardDrive,LifeBuoy,LogOut,Menu,Moon,Package,Settings,ShieldCheck,ShoppingBag,Smartphone,Sun,Users,Wallet,X} from 'lucide-react';
import {useAuth} from '../lib/auth';
import Preferences from './Preferences';
const all=[
  {group:'PRINCIPAL',items:[['/dashboard','Visão geral',Gauge],['/os','Ordens de serviço',ClipboardList],['/clientes','Clientes',Users],]},
  {group:'LOJA E VENDAS',items:[['/estoque','Estoque',Package],['/aparelhos-da-loja','Aparelhos da loja',HardDrive],['/servicos','Tabela de serviços',BriefcaseBusiness],['/fornecedores','Fornecedores',Boxes]]},
  {group:'GESTÃO',items:[['/caixa','Caixa e vendas',Wallet],['/financeiro','Financeiro',HandCoins],['/equipe','Equipe e RH',Users],['/relatorios','Relatórios',BarChart3],['/historico','Diário da loja',FileClock],['/alertas','Central de alertas',Bell]]},
  {group:'SISTEMA',items:[['/configuracoes','Configurações',Settings]]},
];
const protectedPaths=['/equipe','/relatorios','/configuracoes'];
export function Shell({children}){
  const {session,logout}=useAuth(),location=useLocation();
  const [mobile,setMobile]=useState(false),[theme,setTheme]=useState(localStorage.getItem('fixflow-theme')||'dark');
  useEffect(()=>{document.documentElement.setAttribute('data-theme',theme);localStorage.setItem('fixflow-theme',theme)},[theme]);
  useEffect(()=>{setMobile(false)},[location.pathname]);
  const isSuper=session?.superAdmin;
  const allowed=item=>isSuper?item[0]==='/super-admin':(item[0]!=='/financeiro'||session?.role==='ADMIN')&&(!protectedPaths.includes(item[0])||['ADMIN','GERENTE'].includes(session?.role))&&(!['/configuracoes','/fornecedores'].includes(item[0])||session?.role==='ADMIN');
  const nav=isSuper?[{group:'PLATAFORMA',items:[['/super-admin','Administração global',ShieldCheck]]}]:all;
  return <div className="app-layout">
    {mobile&&<div className="mobile-backdrop" onClick={()=>setMobile(false)} />}
    <aside className={`sidebar ${mobile?'open':''}`}>
      <div className="brand"><div className="brand-icon"><Activity size={22} strokeWidth={2.8}/></div><div><strong>FixFlow<span>OS</span></strong><small>GESTÃO INTELIGENTE</small></div><button className="mobile-close" onClick={()=>setMobile(false)} aria-label="Fechar menu"><X size={21}/></button></div>
      <div className="tenant-widget"><div className="tenant-avatar">{isSuper?'SA':(session?.role||'L').slice(0,2)}</div><div className="tenant-title"><strong>{isSuper?'FixFlowOS · Plataforma':'Sua assistência técnica'}</strong><small>{isSuper?'Super Admin':({ADMIN:'Proprietário',GERENTE:'Gerente',VENDEDOR:'Vendedor',TECNICO:'Técnico',VENDEDOR_TECNICO:'Vendedor técnico'})[session?.role]}</small></div><ChevronDown size={16}/></div>
      <nav className="sidebar-nav">{nav.map(g=><div key={g.group} className="nav-group"><div className="nav-group-title">{g.group}</div>{g.items.filter(allowed).map(([path,label,Icon])=><NavLink key={path} to={path} end={path==='/dashboard'} className={({isActive})=>`nav-item ${isActive?'active':''}`}><Icon size={18}/><span>{label}</span>{path==='/alertas'&&<span className="nav-dot"/>}</NavLink>)}</div>)}</nav>
      <div className="sidebar-foot"><div className="status-indicator"><span/> Firestore protegido</div><button onClick={logout} className="nav-item"><LogOut size={18}/> Sair da conta</button></div>
    </aside>
    <main className="main"><header className="topbar"><div className="topbar-left"><button className="mobile-menu" onClick={()=>setMobile(true)} aria-label="Abrir menu"><Menu size={22}/></button><span className="breadcrumb">FixFlowOS <ChevronRight size={14}/> <strong>{nav.flatMap(g=>g.items).find(item=>item[0]===location.pathname)?.[1]||'Operação'}</strong></span></div><div className="topbar-actions"><span className="live"><span/> Ambiente seguro</span><button className="icon-btn" title="Alterar tema" onClick={()=>setTheme(t=>t==='dark'?'light':'dark')}>{theme==='dark'?<Sun size={19}/>:<Moon size={19}/>}</button><Preferences/><button type="button" className="icon-btn mobile-logout" aria-label="Sair da conta" title="Sair da conta" onClick={logout}><LogOut size={19}/></button>{!isSuper&&<NavLink to="/alertas" className="icon-btn" title="Alertas"><Bell size={19}/></NavLink>}<div className="user-bubble" title={session?.email}>{session?.email?.[0]?.toUpperCase()||'U'}</div></div></header><div className="content">{children}</div><div className="footer-note">FixFlowOS · Gestão de assistência técnica com segurança por loja</div></main>
  </div>;
}
