import axios from 'axios';
const configuredApiUrl=import.meta.env.VITE_API_URL||'/api';
const apiUrl=configuredApiUrl.startsWith('/')||/^https?:\/\//i.test(configuredApiUrl)
  ? configuredApiUrl
  : `https://${configuredApiUrl}`;
export const API_ORIGIN=new URL(apiUrl,window.location.origin).origin;
const apiBaseUrl=apiUrl.endsWith('/api')?apiUrl:`${apiUrl.replace(/\/+$/,'')}/api`;
export const API=axios.create({baseURL:apiBaseUrl});
API.interceptors.request.use(c=>{const t=localStorage.getItem('athlenet_access');if(t)c.headers.Authorization=`Bearer ${t}`;return c});
API.interceptors.response.use(r=>r,async e=>{if(e.response?.status===401&&localStorage.getItem('athlenet_refresh')){try{const r=await axios.post(`${API.defaults.baseURL}/token/refresh/`,{refresh:localStorage.getItem('athlenet_refresh')});localStorage.setItem('athlenet_access',r.data.access);e.config.headers.Authorization=`Bearer ${r.data.access}`;return axios(e.config)}catch{localStorage.clear();window.location='/login'}}return Promise.reject(e)});
