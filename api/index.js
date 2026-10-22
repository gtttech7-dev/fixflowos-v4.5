import { handleAction } from '../server/handler.js';
export default async function handler(req,res){
  res.setHeader('Cache-Control','no-store, max-age=0');
  res.setHeader('X-Content-Type-Options','nosniff');
  res.setHeader('Content-Type','application/json; charset=utf-8');
  if(req.method==='OPTIONS')return res.status(405).json({ok:false,error:'Método inválido'});
  if(req.method!=='POST')return res.status(405).json({ok:false,error:'Método inválido'});
  try {
    const max=JSON.stringify(req.body||{}).length;
    if(max>160000)return res.status(413).json({ok:false,error:'Requisição muito grande'});
    const data=await handleAction(req);
    return res.status(200).json({ok:true,data});
  }catch(e){
    const status=Number.isInteger(e.status)&&e.status>=400&&e.status<600?e.status:500;
    if(status===500)console.error('FixFlowOS API error:',{message:e.message,stack:e.stack?.slice(0,1000)});
    return res.status(status).json({ok:false,error:status===500?'Erro interno. Verifique os logs do servidor.':e.message});
  }
}
