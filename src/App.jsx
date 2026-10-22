import React from 'react';
import {Navigate,Route,Routes} from 'react-router-dom';
import {ShieldAlert} from 'lucide-react';
import {configured} from './lib/firebase';
import {useAuth} from './lib/auth';
import {Shell} from './components/Shell';
import PrivacyGate from './components/PrivacyGate';
import {Loading,Panel} from './components/Ui';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import CrudPage from './pages/CrudPage';
import Orders from './pages/Orders';
import Sales from './pages/Sales';
import Inventory from './pages/Inventory';
import OwnDevices from './pages/OwnDevices';
import Cash from './pages/Cash';
import Finance from './pages/Finance';
import Team from './pages/Team';
import Reports from './pages/Reports';
import History from './pages/History';
import Alerts from './pages/Alerts';
import Config from './pages/Config';
import SuperAdmin from './pages/SuperAdmin';
const access={ADMIN:['*'],GERENTE:['/dashboard','/os','/clientes','/aparelhos','/vendas','/estoque','/aparelhos-da-loja','/servicos','/caixa','/equipe','/relatorios','/historico','/alertas'],VENDEDOR:['/dashboard','/os','/clientes','/aparelhos','/vendas','/estoque','/aparelhos-da-loja','/servicos','/caixa','/historico','/alertas'],TECNICO:['/dashboard','/os','/clientes','/aparelhos','/estoque','/aparelhos-da-loja','/servicos','/caixa','/historico','/alertas'],VENDEDOR_TECNICO:['/dashboard','/os','/clientes','/aparelhos','/vendas','/estoque','/aparelhos-da-loja','/servicos','/caixa','/historico','/alertas']};
const configuredMessage=<div className="auth-screen"><Panel title="Configuração do Firebase pendente"><p>Preencha <code>VITE_FIREBASE_API_KEY</code>, <code>VITE_FIREBASE_PROJECT_ID</code> e as demais variáveis de <code>.env.example</code>, conforme o README, para iniciar o FixFlowOS com dados reais. Nenhum dado fictício é exibido.</p></Panel></div>;
function Guard({path,children}){
 const {loading,user,session,logout}=useAuth();
 if(!configured)return configuredMessage;
 if(loading)return <div className="auth-screen"><Loading/></div>;
 if(!user)return <Navigate to="/login" replace/>;
 if(!session||session.error)return <div className="auth-screen"><Panel title="Acesso não autorizado"><p>{session?.error||'Esta conta não possui vínculo de loja.'}</p><button type="button" onClick={logout} className="btn btn-secondary">Sair e usar outra conta</button></Panel></div>;
 if(session.superAdmin&&path!=='/super-admin')return <Navigate to="/super-admin" replace/>;
 if(!session.superAdmin && (path==='/super-admin'||!(access[session.role]||[]).some(x=>x==='*'||x===path)))return <div className="auth-screen"><Panel title="Sem permissão"><ShieldAlert/><p>Este módulo não está liberado para seu perfil.</p></Panel></div>;
 return <PrivacyGate><Shell>{children}</Shell></PrivacyGate>;
}
export default function App(){const {user,session}=useAuth();const pages={
 '/dashboard':<Dashboard/>,'/os':<Orders/>,'/clientes':<CrudPage collection="customers"/>,'/aparelhos':<CrudPage collection="devices"/>,'/vendas':<Navigate to="/caixa" replace/>,'/estoque':<Inventory/>,'/aparelhos-da-loja':<OwnDevices/>,'/servicos':<CrudPage collection="serviceCatalog"/>,'/fornecedores':<CrudPage collection="suppliers"/>,'/caixa':<Cash/>,'/financeiro':<Finance/>,'/equipe':<Team/>,'/relatorios':<Reports/>,'/historico':<History/>,'/alertas':<Alerts/>,'/configuracoes':<Config/>,'/super-admin':<SuperAdmin/>
 };return <Routes><Route path="/login" element={!configured?configuredMessage:user&&session&&!session.error?<Navigate to={session.superAdmin?'/super-admin':'/dashboard'}/>:<Login/>}/><Route path="/" element={<Navigate to="/dashboard"/>}/>{Object.entries(pages).map(([path,element])=><Route key={path} path={path} element={<Guard path={path}>{element}</Guard>}/>)}<Route path="*" element={<Navigate to="/dashboard"/>}/></Routes>}
