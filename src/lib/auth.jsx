import React,{createContext,useContext,useEffect,useState} from 'react';
import {onAuthStateChanged,signOut} from 'firebase/auth';
import {configured,auth} from './firebase';
import {api,clearApiCache} from './api';
const Context=createContext(null);
export function AuthProvider({children}){
  const [session,setSession]=useState(null),[user,setUser]=useState(null),[loading,setLoading]=useState(configured);
  const refresh=async()=>{clearApiCache();const data=await api('me');setSession(data);return data;};
  useEffect(()=>{
    if(!configured){setLoading(false);return;}
    return onAuthStateChanged(auth(),async u=>{
      clearApiCache();setUser(u);
      if(!u){setSession(null);setLoading(false);return;}
      try{await refresh();}catch(e){setSession({error:e.message});}
      finally{setLoading(false);}
    });
  },[]);
  return <Context.Provider value={{session,user,loading,refresh,logout:()=>{clearApiCache();return signOut(auth())}}}>{children}</Context.Provider>;
}
export const useAuth=()=>useContext(Context);
