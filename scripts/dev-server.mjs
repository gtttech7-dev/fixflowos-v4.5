import http from 'node:http';
import { createServer, loadEnv } from 'vite';
import apiHandler from '../api/index.js';
Object.assign(process.env,loadEnv('development',process.cwd(),''));
const vite=await createServer({server:{middlewareMode:true},appType:'spa'});
const server=http.createServer(async(req,res)=>{
  if(req.url?.split('?')[0]==='/api/index'){
    let body='';for await(const chunk of req){body+=chunk;if(body.length>160000){res.writeHead(413);res.end('Requisição muito grande');return;}}
    try{req.body=body?JSON.parse(body):{};}catch{res.writeHead(400);res.end('JSON inválido');return;}
    const bridge={setHeader:(...args)=>res.setHeader(...args),status(n){res.statusCode=n;return this;},json(data){res.end(JSON.stringify(data));return this;}};
    await apiHandler(req,bridge);return;
  }
  vite.middlewares(req,res);
});
server.listen(process.env.PORT||5173,'0.0.0.0',()=>console.log(`FixFlowOS desenvolvimento: http://localhost:${process.env.PORT||5173}`));
