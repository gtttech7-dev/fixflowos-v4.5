import {useCallback,useEffect,useState} from 'react';
import {api,clearApiCache} from './api';
export function useData(collection,enabled=true,limit=40){
 const [rows,setRows]=useState([]),[loading,setLoading]=useState(true),[moreLoading,setMoreLoading]=useState(false),[cursor,setCursor]=useState(null),[error,setError]=useState('');
 const refresh=useCallback(async(force=false)=>{if(!enabled){setRows([]);setCursor(null);setLoading(false);return;}if(force)clearApiCache();setLoading(true);setError('');
  try{const page=await api('records.page',{collection,limit,cursor:null});setRows(page.rows||[]);setCursor(page.nextCursor||null)}catch(e){setError(e.message)}finally{setLoading(false)}
 },[collection,enabled,limit]);
 const loadMore=useCallback(async()=>{if(!cursor||moreLoading||!enabled)return;setMoreLoading(true);setError('');try{const page=await api('records.page',{collection,limit,cursor});setRows(old=>[...old,...(page.rows||[])]);setCursor(page.nextCursor||null)}catch(e){setError(e.message)}finally{setMoreLoading(false)}},[collection,enabled,limit,cursor,moreLoading]);
 useEffect(()=>{refresh()},[refresh]);return{rows,loading,error,refresh,loadMore,hasMore:!!cursor,moreLoading};
}
export function usePlatform(collection,enabled=true){
 const [rows,setRows]=useState([]),[loading,setLoading]=useState(true),[error,setError]=useState('');
 const refresh=useCallback(async(force=false)=>{if(!enabled){setLoading(false);return;}if(force)clearApiCache();setLoading(true);setError('');try{setRows(await api('platform.list',{collection,limit:75}));}catch(e){setError(e.message)}finally{setLoading(false)}},[collection,enabled]);
 useEffect(()=>{refresh()},[refresh]);return{rows,loading,error,refresh};
}
export function useBundle(collections,enabled=true,limit=40){
 const key=collections.join('|'),[state,setState]=useState({data:{},loading:true,error:''});
 const refresh=useCallback(async(force=false)=>{if(!enabled){setState({data:{},loading:false,error:''});return;}if(force)clearApiCache();setState(old=>({...old,loading:true,error:''}));
  const results=await Promise.allSettled(key.split('|').filter(Boolean).map(collection=>api('records.list',{collection,limit})));
  const data={};let error='';results.forEach((r,i)=>{const name=key.split('|').filter(Boolean)[i];if(r.status==='fulfilled')data[name]=r.value;else error+=`${name}: ${r.reason?.message} `;});
  setState({data,loading:false,error});
 },[key,enabled,limit]);useEffect(()=>{refresh()},[refresh]);return{...state,refresh};
}
