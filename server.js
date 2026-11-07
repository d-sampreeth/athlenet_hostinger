
import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import pg from 'pg';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();
const { Pool } = pg;
const PORT = Number(process.env.PORT || 8000);
const JWT_SECRET = process.env.JWT_SECRET;
if (!JWT_SECRET) console.warn('WARNING: Set JWT_SECRET in your environment before production use.');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.DATABASE_SSL === 'true' ? { rejectUnauthorized: false } : undefined,
});
const q = (sql, params=[]) => pool.query(sql, params);
const uploadsDir = path.resolve(process.env.UPLOAD_DIR || path.join(__dirname, 'uploads'));
fs.mkdirSync(uploadsDir, { recursive: true });
const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, uploadsDir),
  filename: (_req, file, cb) => cb(null, `${Date.now()}-${Math.random().toString(36).slice(2)}${path.extname(file.originalname).toLowerCase()}`),
});
const upload = multer({ storage, limits: { fileSize: 5 * 1024 * 1024 } });

app.use(helmet({ crossOriginResourcePolicy: { policy: 'cross-origin' } }));
app.use(cors({
  origin: (process.env.CORS_ORIGINS || 'http://localhost:5173,http://127.0.0.1:5173').split(',').map(s=>s.trim()),
  credentials: true,
}));
app.use(express.json({ limit: '2mb' }));
app.use(express.urlencoded({ extended: true }));
app.use('/media', express.static(uploadsDir));

const sports = ['Cricket','Football','Athletics','Basketball','Kabaddi','Badminton','Volleyball','Tennis','Other'];
const roles = ['user','player','coach'];
const mediaUrl = (file) => file ? `/media/${path.basename(file)}` : null;
const fullName = (u) => `${u.first_name || ''} ${u.last_name || ''}`.trim() || u.username;
const normalizePhone = (v='') => {
  let d = String(v).replace(/\D/g,'');
  if (d.length===12 && d.startsWith('91')) d=d.slice(2);
  if (!/^[6-9]\d{9}$/.test(d)) return '';
  const counts = new Map();
  for (const digit of d) {
    const count = (counts.get(digit) || 0) + 1;
    if (count > 6) return '';
    counts.set(digit, count);
  }
  return d;
};
const validPassword = (p) => typeof p==='string' && p.length>=8 && /[a-z]/.test(p) && /[A-Z]/.test(p) && /[^A-Za-z0-9]/.test(p);
const validPin = (p) => /^[1-9][0-9]{5}$/.test(String(p||''));
const tokenPair = (user) => ({
  access: jwt.sign({ sub: String(user.id), username: user.username }, JWT_SECRET, { expiresIn: '4h' }),
  refresh: jwt.sign({ sub: String(user.id), type: 'refresh' }, JWT_SECRET, { expiresIn: '7d' }),
});
async function userMini(userId) {
  const { rows } = await q(`SELECT u.id,u.username,u.first_name,u.last_name,p.role,p.photo
    FROM users u LEFT JOIN profiles p ON p.user_id=u.id WHERE u.id=$1`,[userId]);
  const u=rows[0]; if(!u) return null;
  return { id:u.id, username:u.username, name:fullName(u), first_name:u.first_name, last_name:u.last_name, role:u.role || 'user', photo:mediaUrl(u.photo) };
}
async function notify(userId,message,link='') {
  await q('INSERT INTO notifications(user_id,message,link) VALUES($1,$2,$3)',[userId,message,link]);
}
async function profileFor(userId) {
  const { rows } = await q(`SELECT p.*,u.email,u.username,u.first_name,u.last_name
    FROM profiles p JOIN users u ON u.id=p.user_id WHERE p.user_id=$1`,[userId]);
  return rows[0] || null;
}
async function profileDetails(profile) {
  if(!profile) return null;
  const user=await userMini(profile.user_id);
  const followers=await q('SELECT COUNT(*)::int AS n FROM follows WHERE following_id=$1',[profile.user_id]);
  const following=await q('SELECT COUNT(*)::int AS n FROM follows WHERE follower_id=$1',[profile.user_id]);
  const coach=await q('SELECT * FROM coach_profiles WHERE profile_id=$1',[profile.id]);
  const player=await q('SELECT * FROM player_profiles WHERE profile_id=$1',[profile.id]);
  let pd=null, cd=null;
  if(player.rows[0]) {
    const d=player.rows[0], a=await q('SELECT * FROM achievements WHERE player_id=$1 ORDER BY created_at DESC',[d.id]);
    pd={age:d.age,sport:d.sport,level:d.level,district:d.district,state:d.state,experience:d.experience,ranking:d.ranking,statistics:d.statistics,achievements:a.rows.map(x=>({...x,proof:mediaUrl(x.proof)}))};
  }
  if(coach.rows[0]) { const d=coach.rows[0]; cd={age:d.age,gender:d.gender,sport:d.sport,experience:d.experience,academy:d.academy,government_recognition:d.government_recognition,verified:d.verified}; }
  return { user, role:profile.role, email:profile.email, phone:profile.phone, location:profile.location, pincode:profile.pincode,
    bio:profile.bio, interests:profile.interests, photo:mediaUrl(profile.photo), coach_details:cd, player_details:pd,
    followers_count:followers.rows[0].n, following_count:following.rows[0].n };
}
async function memberShape(profile, viewerId) {
  const u=await userMini(profile.user_id);
  const {rows}=await q(`SELECT sport FROM player_profiles WHERE profile_id=$1 UNION ALL SELECT sport FROM coach_profiles WHERE profile_id=$1 LIMIT 1`,[profile.id]);
  const fc=await q('SELECT COUNT(*)::int AS n FROM follows WHERE following_id=$1',[profile.user_id]);
  const f=await q('SELECT 1 FROM follows WHERE follower_id=$1 AND following_id=$2',[viewerId,profile.user_id]);
  return {user:u,role:profile.role,location:profile.location,bio:profile.bio,photo:mediaUrl(profile.photo),sport:rows[0]?.sport||'',followers_count:fc.rows[0].n,is_following:!!f.rowCount};
}
async function postShape(post, viewerId) {
  const author=await userMini(post.author_id);
  const likes=await q('SELECT COUNT(*)::int AS n FROM likes WHERE post_id=$1',[post.id]);
  const comments=await q('SELECT COUNT(*)::int AS n FROM comments WHERE post_id=$1',[post.id]);
  const liked=await q('SELECT 1 FROM likes WHERE post_id=$1 AND user_id=$2',[post.id,viewerId]);
  return {id:post.id,author_id:post.author_id,author,content:post.content,image:mediaUrl(post.image),post_type:post.post_type,sport:post.sport,created_at:post.created_at,updated_at:post.updated_at,likes_count:likes.rows[0].n,comments_count:comments.rows[0].n,liked:!!liked.rowCount};
}
async function opportunityShape(row, viewerId=null) {
  const c=await q(`SELECT u.id,u.username,u.first_name,u.last_name,cp.verified
    FROM coach_profiles cp JOIN profiles p ON p.id=cp.profile_id JOIN users u ON u.id=p.user_id WHERE cp.id=$1`,[row.coach_id]);
  const coach=c.rows[0];
  const count=await q('SELECT COUNT(*)::int AS n FROM opportunity_applications WHERE opportunity_id=$1',[row.id]);
  let applied=false;
  if(viewerId) {
    const a=await q(`SELECT 1 FROM opportunity_applications oa JOIN player_profiles pp ON pp.id=oa.player_id
      JOIN profiles p ON p.id=pp.profile_id WHERE oa.opportunity_id=$1 AND p.user_id=$2`,[row.id,viewerId]);
    applied=!!a.rowCount;
  }
  return {...row,coach_name:coach?fullName(coach):'',coach_verified:coach?.verified||false,application_count:count.rows[0].n,applied};
}
function auth(required=true) {
  return async (req,res,next)=>{
    const h=req.headers.authorization||'';
    if(!h.startsWith('Bearer ')) return required?res.status(401).json({detail:'Authentication credentials were not provided.'}):next();
    try {
      const token=jwt.verify(h.slice(7),JWT_SECRET);
      if(token.type==='refresh') throw new Error('Refresh token cannot authenticate API requests');
      const r=await q('SELECT id,username,email,first_name,last_name FROM users WHERE id=$1',[token.sub]);
      if(!r.rowCount) return res.status(401).json({detail:'Invalid token.'});
      req.user=r.rows[0]; next();
    } catch { return res.status(401).json({detail:'Invalid or expired token.'}); }
  };
}
function asyncRoute(fn) { return (req,res,next)=>Promise.resolve(fn(req,res,next)).catch(next); }
function pickFile(req,name) { return req.files?.[name]?.[0]?.path || req.file?.path || null; }
const fields = upload.fields([{name:'photo',maxCount:1},{name:'certificate',maxCount:1},{name:'achievement_proof',maxCount:1},{name:'image',maxCount:1}]);
const validatePhotoSize = (req,res,next) => {
  const photo=req.files?.photo?.[0];
  if(!photo||photo.size<=1024*1024)return next();
  Promise.all(Object.values(req.files).flat().map(file=>fs.promises.unlink(file.path)))
    .then(()=>res.status(400).json({detail:'Profile photos must not exceed 1 MB.'}),next);
};
const fieldsWithPhotoLimit = [fields,validatePhotoSize];

app.get('/',(_req,res)=>res.json({status:'ok',service:'athlenet-node-backend'}));
app.get('/health',(_req,res)=>res.json({status:'ok',service:'athlenet-node-backend'}));
app.get('/api/health/',(_req,res)=>res.json({status:'ok'}));

app.post('/api/auth/register/',fieldsWithPhotoLimit,asyncRoute(async(req,res)=>{
  const d=req.body, email=String(d.email||'').trim().toLowerCase(), username=String(d.username||email).trim(), password=d.password||'';
  if(!username||!email||!password) return res.status(400).json({detail:'Username, email and password are required.'});
  if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return res.status(400).json({detail:'Enter a valid email address.'});
  if(!validPassword(password)) return res.status(400).json({detail:'Password must be at least 8 characters and include an uppercase letter, a lowercase letter, and a special character.'});
  const phone=String(d.phone||'').trim(), phoneKey=phone?normalizePhone(phone):'';
  if(phone&&!phoneKey) return res.status(400).json({detail:'Enter a 10-digit mobile number starting with 6, 7, 8, or 9; no digit may appear more than 6 times.'});
  if(!validPin(d.pincode)) return res.status(400).json({pincode:['A 6-digit Indian PIN code is required.']});
  const role=d.role||'user';
  if(!roles.includes(role)) return res.status(400).json({detail:'Invalid role.'});
  if(!sports.includes(d.sport||'') && d.sport) return res.status(400).json({detail:'Invalid sport.'});
  const exists=await q('SELECT 1 FROM users WHERE lower(username)=lower($1) OR lower(email)=lower($2)',[username,email]);
  if(exists.rowCount) return res.status(400).json({detail:'An account with this username/email already exists.'});
  if(phoneKey && (await q('SELECT 1 FROM profiles WHERE phone_key=$1',[phoneKey])).rowCount) return res.status(400).json({detail:'An account with this mobile number already exists.'});
  const client=await pool.connect();
  try {
    await client.query('BEGIN');
    const u=(await client.query('INSERT INTO users(username,email,password_hash,first_name,last_name) VALUES($1,$2,$3,$4,$5) RETURNING *',[username,email,await bcrypt.hash(password,12),d.first_name||'',d.last_name||''])).rows[0];
    const p=(await client.query(`INSERT INTO profiles(user_id,role,phone,phone_key,location,pincode,bio,interests,photo)
      VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING *`,[u.id,role,phone,phoneKey||null,d.location||'',d.pincode,d.bio||'',String(d.interests||'').split(',').filter(x=>sports.includes(x.trim())).join(','),pickFile(req,'photo')])).rows[0];
    if(role==='coach') await client.query(`INSERT INTO coach_profiles(profile_id,age,gender,sport,experience,academy,certificate,government_recognition)
      VALUES($1,$2,$3,$4,$5,$6,$7,$8)`,[p.id,d.age||null,d.gender||'',d.sport||'',Number(d.experience||0),d.academy||'',pickFile(req,'certificate'),d.government_recognition||'']);
    if(role==='player') {
      const pp=(await client.query(`INSERT INTO player_profiles(profile_id,age,sport,level,district,state,experience,ranking,statistics)
        VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING id`,[p.id,d.age||null,d.sport||'',d.level||'',d.district||'',d.state||'',Number(d.experience||0),d.ranking||'',d.statistics||''])).rows[0];
      if(pickFile(req,'achievement_proof')&&d.achievement_title) await client.query('INSERT INTO achievements(player_id,title,description,year,proof) VALUES($1,$2,$3,$4,$5)',[pp.id,d.achievement_title,d.achievement_description||'',d.achievement_year||null,pickFile(req,'achievement_proof')]);
    }
    await client.query('COMMIT');
    const t=tokenPair(u);
    return res.status(201).json({...t,user:await userMini(u.id)});
  } catch(e) { await client.query('ROLLBACK'); throw e; } finally { client.release(); }
}));
app.post('/api/auth/login/',asyncRoute(async(req,res)=>{
  const {username,password}=req.body||{};
  const {rows}=await q('SELECT * FROM users WHERE lower(username)=lower($1) OR lower(email)=lower($1) LIMIT 1',[username||'']);
  const u=rows[0];
  if(!u||!(await bcrypt.compare(password||'',u.password_hash))) return res.status(401).json({detail:'Invalid credentials.'});
  return res.json({...tokenPair(u),user:await userMini(u.id)});
}));
app.post('/api/token/refresh/',asyncRoute(async(req,res)=>{
  try { const t=jwt.verify(req.body?.refresh||'',JWT_SECRET); if(t.type!=='refresh') throw new Error(); return res.json({access:jwt.sign({sub:String(t.sub)},JWT_SECRET,{expiresIn:'4h'})}); }
  catch { return res.status(401).json({detail:'Invalid or expired refresh token.'}); }
}));

app.get('/api/me/',auth(),asyncRoute(async(req,res)=>{
  const p=await profileFor(req.user.id); const data=await profileDetails(p); data.email=req.user.email; data.pincode=p.pincode; res.json(data);
}));
app.patch('/api/me/',auth(),fieldsWithPhotoLimit,asyncRoute(async(req,res)=>{
  const p=await profileFor(req.user.id), d=req.body;
  if(d.username && d.username!==req.user.username) return res.status(400).json({username:['Username cannot be changed.']});
  if(d.role && d.role!==p.role) return res.status(400).json({role:['Account role cannot be changed.']});
  const email=String(d.email??req.user.email).trim().toLowerCase();
  if(d.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return res.status(400).json({detail:'Enter a valid email address.'});
  if(d.email && (await q('SELECT 1 FROM users WHERE lower(email)=lower($1) AND id<>$2',[email,req.user.id])).rowCount) return res.status(400).json({detail:'An account with this email address already exists.'});
  const phone=String(d.phone??p.phone).trim(), key=phone?normalizePhone(phone):'';
  if(d.phone&&phone&&!key) return res.status(400).json({detail:'Enter a 10-digit mobile number starting with 6, 7, 8, or 9; no digit may appear more than 6 times.'});
  if(key&&(await q('SELECT 1 FROM profiles WHERE phone_key=$1 AND user_id<>$2',[key,req.user.id])).rowCount) return res.status(400).json({detail:'An account with this mobile number already exists.'});
  if(d.pincode!==undefined&&!validPin(d.pincode)) return res.status(400).json({pincode:['Enter a valid 6-digit Indian PIN code.']});
  await q(`UPDATE users SET email=$1,first_name=$2,last_name=$3 WHERE id=$4`,[email,d.first_name??req.user.first_name,d.last_name??req.user.last_name,req.user.id]);
  await q(`UPDATE profiles SET phone=$1,phone_key=$2,location=$3,pincode=$4,bio=$5,interests=$6,photo=COALESCE($7,photo) WHERE user_id=$8`,
    [phone,key||null,d.location??p.location,d.pincode??p.pincode,d.bio??p.bio,String(d.interests??p.interests).split(',').map(x=>x.trim()).filter(x=>sports.includes(x)).join(','),pickFile(req,'photo'),req.user.id]);
  const table=p.role==='coach'?'coach_profiles':p.role==='player'?'player_profiles':null;
  if(table) {
    const detailFields=p.role==='coach'?['age','gender','sport','experience','academy','government_recognition']:['age','sport','level','district','state','experience','ranking','statistics'];
    const current=(await q(`SELECT * FROM ${table} WHERE profile_id=$1`,[p.id])).rows[0];
    if(current) {
      const vals=detailFields.map(k=>d[k]===undefined?current[k]:(d[k]===''&&['age','experience'].includes(k)?(k==='age'?null:0):d[k]));
      const sets=detailFields.map((k,i)=>`${k}=$${i+1}`).join(',');
      await q(`UPDATE ${table} SET ${sets}${p.role==='coach'&&pickFile(req,'certificate')?`,certificate=$${detailFields.length+1}`:''} WHERE profile_id=$${detailFields.length+(p.role==='coach'&&pickFile(req,'certificate')?2:1)}`,
        [...vals,...(p.role==='coach'&&pickFile(req,'certificate')?[pickFile(req,'certificate')]:[]),p.id]);
    }
  }
  res.json(await profileDetails(await profileFor(req.user.id)));
}));

app.get('/api/dashboard/',auth(),asyncRoute(async(req,res)=>{
  const p=await profileFor(req.user.id),loc=req.query.location||p.location;
  const opp=await q("SELECT * FROM opportunities WHERE active=true AND last_date>=CURRENT_DATE ORDER BY event_date LIMIT 6");
  let news=await q("SELECT * FROM news WHERE active=true AND (($1<>'' AND (pincode=$1 OR pincode='')) OR ($1='' AND ($2='' OR location ILIKE $2 OR location=''))) ORDER BY published_at DESC LIMIT 6",[p.pincode||'',loc||'']);
  const posts=await q('SELECT * FROM posts ORDER BY created_at DESC LIMIT 10');
  res.json({opportunities:await Promise.all(opp.rows.map(x=>opportunityShape(x,req.user.id))),news:news.rows.map(x=>({...x,image:mediaUrl(x.image)})),posts:await Promise.all(posts.rows.map(x=>postShape(x,req.user.id)))});
}));
app.get('/api/opportunities/',auth(),asyncRoute(async(req,res)=>{
  const {sport='',location='',q:term=''}=req.query;
  const r=await q(`SELECT o.* FROM opportunities o WHERE active=true
    AND ($1='' OR sport ILIKE $2) AND ($3='' OR location ILIKE $4)
    AND ($5='' OR title ILIKE $6 OR description ILIKE $6 OR sport ILIKE $6 OR location ILIKE $6 OR eligibility ILIKE $6)
    ORDER BY created_at DESC`,[sport,`%${sport}%`,location,`%${location}%`,term,`%${term}%`]);
  res.json(await Promise.all(r.rows.map(x=>opportunityShape(x,req.user.id))));
}));
app.post('/api/opportunities/',auth(),asyncRoute(async(req,res)=>{
  const p=await profileFor(req.user.id);
  const cp=await q('SELECT id FROM coach_profiles WHERE profile_id=$1',[p.id]);
  if(!cp.rowCount) return res.status(403).json({detail:'Only coaches can create opportunities.'});
  const d=req.body;
  const required=['title','description','sport','location','event_date','last_date'];
  if(required.some(k=>!d[k])) return res.status(400).json({detail:'Please provide all required opportunity fields.'});
  const r=await q(`INSERT INTO opportunities(coach_id,title,description,sport,location,event_date,last_date,eligibility,slots)
    VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING *`,[cp.rows[0].id,d.title,d.description,d.sport,d.location,d.event_date,d.last_date,d.eligibility||'',Number(d.slots||20)]);
  res.status(201).json(await opportunityShape(r.rows[0],req.user.id));
}));
app.get('/api/opportunities/:id/',auth(),asyncRoute(async(req,res)=>{
  const r=await q('SELECT * FROM opportunities WHERE id=$1',[req.params.id]); if(!r.rowCount) return res.status(404).json({detail:'Not found.'});
  res.json(await opportunityShape(r.rows[0],req.user.id));
}));
app.post('/api/opportunities/:id/',auth(),asyncRoute(async(req,res)=>{
  const p=await profileFor(req.user.id), pp=await q('SELECT id FROM player_profiles WHERE profile_id=$1',[p.id]);
  if(!pp.rowCount) return res.status(403).json({detail:'Only players can apply.'});
  const o=await q('SELECT * FROM opportunities WHERE id=$1',[req.params.id]); if(!o.rowCount) return res.status(404).json({detail:'Not found.'});
  try { await q('INSERT INTO opportunity_applications(opportunity_id,player_id,message) VALUES($1,$2,$3)',[req.params.id,pp.rows[0].id,req.body.message||'']); }
  catch(e) { if(e.code==='23505') return res.status(400).json({detail:'You already applied.'}); throw e; }
  const c=await q('SELECT p.user_id FROM coach_profiles cp JOIN profiles p ON p.id=cp.profile_id WHERE cp.id=$1',[o.rows[0].coach_id]);
  await notify(c.rows[0].user_id,`${fullName(req.user)} applied for ${o.rows[0].title}.`);
  res.status(201).json({detail:'Application submitted.'});
}));
app.get('/api/local-hub/',auth(),asyncRoute(async(req,res)=>{
  const p=await profileFor(req.user.id);
  if(!p.pincode&&!p.location) return res.json({posts:[],opportunities:[]});
  const users=await q(`SELECT user_id FROM profiles WHERE role IN ('player','coach') AND
    (($1<>'' AND pincode=$1) OR ($1='' AND lower(location)=lower($2)))`,[p.pincode||'',p.location||'']);
  const ids=users.rows.map(x=>x.user_id);
  if(!ids.length) return res.json({posts:[],opportunities:[]});
  const posts=await q('SELECT * FROM posts WHERE author_id=ANY($1::bigint[]) ORDER BY created_at DESC',[ids]);
  const opp=await q('SELECT o.* FROM opportunities o JOIN coach_profiles cp ON cp.id=o.coach_id JOIN profiles p ON p.id=cp.profile_id WHERE p.user_id=ANY($1::bigint[]) AND o.active=true ORDER BY o.created_at DESC',[ids]);
  res.json({posts:await Promise.all(posts.rows.map(x=>postShape(x,req.user.id))),opportunities:await Promise.all(opp.rows.map(x=>opportunityShape(x,req.user.id)))});
}));
app.get('/api/posts/',auth(),asyncRoute(async(req,res)=>{
  const r=await q('SELECT * FROM posts WHERE ($1=\'\' OR author_id=(SELECT id FROM users WHERE username=$1)) ORDER BY created_at DESC',[req.query.author||'']);
  res.json(await Promise.all(r.rows.map(x=>postShape(x,req.user.id))));
}));
app.post('/api/posts/',auth(),upload.single('image'),asyncRoute(async(req,res)=>{
  const content=req.body.content||''; if(!content.trim()) return res.status(400).json({detail:'Post content is required.'});
  const p=await profileFor(req.user.id), cp=await q('SELECT sport FROM player_profiles WHERE profile_id=$1 UNION ALL SELECT sport FROM coach_profiles WHERE profile_id=$1 LIMIT 1',[p.id]);
  const sport=sports.includes(req.body.sport)?req.body.sport:(cp.rows[0]?.sport||'');
  const r=await q('INSERT INTO posts(author_id,content,image,post_type,sport) VALUES($1,$2,$3,$4,$5) RETURNING *',[req.user.id,content,req.file?.path||null,req.body.post_type||'discussion',sport]);
  res.status(201).json(await postShape(r.rows[0],req.user.id));
}));
app.delete('/api/posts/:id/',auth(),asyncRoute(async(req,res)=>{
  const r=await q('DELETE FROM posts WHERE id=$1 AND author_id=$2',[req.params.id,req.user.id]);
  if(!r.rowCount) return res.status(404).json({detail:'Not found.'}); res.status(204).end();
}));
app.get('/api/feed/',auth(),asyncRoute(async(req,res)=>{
  const p=await profileFor(req.user.id),page=Math.max(Number(req.query.page||1),1),limit=Math.min(Math.max(Number(req.query.limit||20),1),50),source=req.query.source||'all';
  const followed=await q('SELECT following_id FROM follows WHERE follower_id=$1',[req.user.id]);
  const following=new Set(followed.rows.map(x=>Number(x.following_id)));
  const detail=await q(`SELECT sport FROM player_profiles pp JOIN profiles p ON p.id=pp.profile_id WHERE p.user_id=$1
    UNION SELECT sport FROM coach_profiles cp JOIN profiles p ON p.id=cp.profile_id WHERE p.user_id=$1`,[req.user.id]);
  const sportsList=[...detail.rows.map(x=>x.sport),...(p.interests||'').split(',')].filter(Boolean);
  const all=await q('SELECT po.*,pr.pincode AS author_pin,pr.role AS author_role FROM posts po LEFT JOIN profiles pr ON pr.user_id=po.author_id ORDER BY po.created_at DESC LIMIT 400');
  let candidates=all.rows.filter(x=>(source==='all'||source==='interest')&&sportsList.some(s=>s.toLowerCase()===x.sport.toLowerCase()) ||
    (source==='all'||source==='nearby')&&p.pincode&&x.author_pin?.slice(0,3)===p.pincode.slice(0,3) ||
    (source==='all'||source==='connections')&&following.has(Number(x.author_id)));
  let fallback=false; if(!candidates.length&&source==='all'){candidates=all.rows;fallback=true;}
  const now=Date.now();
  const ranked=candidates.map(x=>{const reasons=[];let score=0;
    if(sportsList.some(s=>s.toLowerCase()===x.sport.toLowerCase())){reasons.push('interest');score+=3;}
    if(following.has(Number(x.author_id))){reasons.push('connection');score+=3;}
    if(p.pincode&&x.author_pin===p.pincode){reasons.push('nearby');score+=3;} else if(p.pincode&&x.author_pin?.slice(0,3)===p.pincode.slice(0,3)){reasons.push('nearby');score+=2;}
    score+=3*Math.pow(.5,((now-new Date(x.created_at).getTime())/3600000)/24);
    return {x,reasons,score,rank:{coach:1,player:2,user:3}[x.author_role]||3};
  }).sort((a,b)=>b.score-a.score||a.rank-b.rank);
  const slice=ranked.slice((page-1)*limit,page*limit);
  res.json({results:await Promise.all(slice.map(async r=>({...await postShape(r.x,req.user.id),reasons:r.reasons,feed_score:Number(r.score.toFixed(2))}))),page,has_next:ranked.length>page*limit,fallback});
}));
app.post('/api/posts/:id/like/',auth(),asyncRoute(async(req,res)=>{
  const p=await q('SELECT * FROM posts WHERE id=$1',[req.params.id]); if(!p.rowCount) return res.status(404).json({detail:'Not found.'});
  const existing=await q('SELECT id FROM likes WHERE post_id=$1 AND user_id=$2',[req.params.id,req.user.id]);
  let liked;
  if(existing.rowCount){await q('DELETE FROM likes WHERE id=$1',[existing.rows[0].id]);liked=false;}
  else {await q('INSERT INTO likes(post_id,user_id) VALUES($1,$2)',[req.params.id,req.user.id]);liked=true;if(Number(p.rows[0].author_id)!==Number(req.user.id)) await notify(p.rows[0].author_id,`${fullName(req.user)} liked your post.`);}
  const count=await q('SELECT COUNT(*)::int AS n FROM likes WHERE post_id=$1',[req.params.id]); res.json({liked,count:count.rows[0].n});
}));
app.get('/api/posts/:id/comments/',auth(),asyncRoute(async(req,res)=>{
  const r=await q(`SELECT c.*,u.username,u.first_name,u.last_name,pr.role,pr.photo FROM comments c JOIN users u ON u.id=c.user_id LEFT JOIN profiles pr ON pr.user_id=u.id WHERE c.post_id=$1 ORDER BY c.created_at`,[req.params.id]);
  res.json(r.rows.map(x=>({id:x.id,post:x.post_id,user:{id:x.user_id,username:x.username,name:fullName(x),first_name:x.first_name,last_name:x.last_name,role:x.role,photo:mediaUrl(x.photo)},text:x.text,created_at:x.created_at})));
}));
app.post('/api/posts/:id/comments/',auth(),asyncRoute(async(req,res)=>{
  const text=String(req.body.text||'').trim(); if(!text) return res.status(400).json({text:['This field may not be blank.']});
  const r=await q('INSERT INTO comments(post_id,user_id,text) VALUES($1,$2,$3) RETURNING *',[req.params.id,req.user.id,text]);
  res.status(201).json({id:r.rows[0].id,post:Number(req.params.id),user:await userMini(req.user.id),text,created_at:r.rows[0].created_at});
}));
app.get('/api/users/',auth(),asyncRoute(async(req,res)=>{
  const {q:term='',location='',role='',sport=''}=req.query;
  const r=await q(`SELECT p.* FROM profiles p JOIN users u ON u.id=p.user_id
    WHERE p.user_id<>$1 AND ($2='' OR (u.username ILIKE $3 OR u.first_name ILIKE $3 OR u.last_name ILIKE $3 OR p.bio ILIKE $3 OR p.location ILIKE $3))
    AND ($4='' OR p.location ILIKE $5) AND ($6='' OR p.role=$6)
    AND ($7='' OR EXISTS(SELECT 1 FROM player_profiles pp WHERE pp.profile_id=p.id AND pp.sport ILIKE $8) OR EXISTS(SELECT 1 FROM coach_profiles cp WHERE cp.profile_id=p.id AND cp.sport ILIKE $8))
    ORDER BY p.created_at DESC LIMIT 60`,[req.user.id,term,`%${term}%`,location,`%${location}%`,role,sport,`%${sport}%`]);
  res.json(await Promise.all(r.rows.map(x=>memberShape(x,req.user.id))));
}));
app.get('/api/connections/',auth(),asyncRoute(async(req,res)=>{
  const r=await q('SELECT p.* FROM profiles p JOIN follows f ON f.following_id=p.user_id WHERE f.follower_id=$1 ORDER BY p.created_at DESC',[req.user.id]);
  res.json(await Promise.all(r.rows.map(x=>memberShape(x,req.user.id))));
}));
app.get('/api/followers/',auth(),asyncRoute(async(req,res)=>{
  const r=await q('SELECT p.* FROM profiles p JOIN follows f ON f.follower_id=p.user_id WHERE f.following_id=$1 ORDER BY p.created_at DESC',[req.user.id]);
  res.json(await Promise.all(r.rows.map(x=>memberShape(x,req.user.id))));
}));
app.post('/api/users/:username/follow/',auth(),asyncRoute(async(req,res)=>{
  const u=await q('SELECT id FROM users WHERE username=$1',[req.params.username]); if(!u.rowCount) return res.status(404).json({detail:'Not found.'});
  const target=u.rows[0].id; if(Number(target)===Number(req.user.id)) return res.status(400).json({detail:'You cannot follow yourself.'});
  const old=await q('SELECT id FROM follows WHERE follower_id=$1 AND following_id=$2',[req.user.id,target]);
  if(old.rowCount){await q('DELETE FROM follows WHERE id=$1',[old.rows[0].id]);return res.json({following:false});}
  await q('INSERT INTO follows(follower_id,following_id) VALUES($1,$2)',[req.user.id,target]); await notify(target,`${fullName(req.user)} started following you.`); res.json({following:true});
}));
app.get('/api/users/:username/',auth(),asyncRoute(async(req,res)=>{
  const r=await q('SELECT p.* FROM profiles p JOIN users u ON u.id=p.user_id WHERE u.username=$1',[req.params.username]);
  if(!r.rowCount) return res.status(404).json({detail:'Not found.'});
  const data=await profileDetails(r.rows[0]); const viewer=Number(req.user.id)===Number(r.rows[0].user_id);
  if(!viewer){data.email='';data.pincode='';data.phone='';}
  const follow=await q('SELECT 1 FROM follows WHERE follower_id=$1 AND following_id=$2',[req.user.id,r.rows[0].user_id]);
  data.is_following=!!follow.rowCount; res.json(data);
}));
app.get('/api/news/',asyncRoute(async(req,res)=>{
  const r=await q(`SELECT * FROM news WHERE active=true AND
    (($1<>'' AND (pincode=$1 OR pincode='')) OR ($1='' AND ($2='' OR lower(location)=lower($2) OR location='')))
    ORDER BY featured DESC,published_at DESC`,[req.query.pincode||'',req.query.location||'']);
  res.json(r.rows.map(x=>({...x,image:mediaUrl(x.image)})));
}));
app.get('/api/notifications/',auth(),asyncRoute(async(req,res)=>{
  const r=await q('SELECT * FROM notifications WHERE user_id=$1 ORDER BY created_at DESC LIMIT 50',[req.user.id]); res.json(r.rows);
}));
app.post('/api/notifications/',auth(),asyncRoute(async(req,res)=>{
  await q('UPDATE notifications SET read=true WHERE user_id=$1 AND read=false',[req.user.id]); res.json({ok:true});
}));
app.get('/api/search/',auth(),asyncRoute(async(req,res)=>{
  const term=String(req.query.q||'').trim(); if(!term) return res.json({users:[],opportunities:[],news:[]});
  const like=`%${term}%`;
  const u=await q(`SELECT u.id FROM users u WHERE username ILIKE $1 OR first_name ILIKE $1 OR last_name ILIKE $1 LIMIT 15`,[like]);
  const o=await q(`SELECT * FROM opportunities WHERE active=true AND (title ILIKE $1 OR description ILIKE $1 OR sport ILIKE $1 OR location ILIKE $1) LIMIT 15`,[like]);
  const n=await q(`SELECT * FROM news WHERE active=true AND (title ILIKE $1 OR summary ILIKE $1 OR sport ILIKE $1 OR location ILIKE $1) ORDER BY featured DESC,published_at DESC LIMIT 15`,[like]);
  res.json({users:await Promise.all(u.rows.map(async x=>userMini(x.id))),opportunities:await Promise.all(o.rows.map(x=>opportunityShape(x,req.user.id))),news:n.rows.map(x=>({...x,image:mediaUrl(x.image)}))});
}));
app.get('/api/conversations/',auth(),asyncRoute(async(req,res)=>{
  const r=await q(`SELECT c.*,CASE WHEN c.user1_id=$1 THEN c.user2_id ELSE c.user1_id END AS other_id,
    (SELECT text FROM messages m WHERE m.conversation_id=c.id ORDER BY created_at DESC LIMIT 1) AS last_message
    FROM conversations c WHERE c.user1_id=$1 OR c.user2_id=$1 ORDER BY c.updated_at DESC`,[req.user.id]);
  res.json(await Promise.all(r.rows.map(async x=>({id:x.id,other:await userMini(x.other_id),last_message:x.last_message}))));
}));
app.post('/api/conversations/',auth(),asyncRoute(async(req,res)=>{
  const other=Number(req.body.user_id); if(!other||other===Number(req.user.id)) return res.status(400).json({detail:'Valid user_id is required.'});
  const a=Math.min(other,Number(req.user.id)),b=Math.max(other,Number(req.user.id));
  let r=await q('SELECT id FROM conversations WHERE user1_id=$1 AND user2_id=$2',[a,b]);
  if(!r.rowCount) r=await q('INSERT INTO conversations(user1_id,user2_id) VALUES($1,$2) RETURNING id',[a,b]);
  res.status(201).json({id:r.rows[0].id});
}));
app.get('/api/conversations/:id/messages/',auth(),asyncRoute(async(req,res)=>{
  const c=await q('SELECT * FROM conversations WHERE id=$1 AND (user1_id=$2 OR user2_id=$2)',[req.params.id,req.user.id]);
  if(!c.rowCount) return res.status(403).json({detail:'Forbidden'});
  const r=await q(`SELECT m.*,u.username,u.first_name,u.last_name,p.role,p.photo FROM messages m JOIN users u ON u.id=m.sender_id LEFT JOIN profiles p ON p.user_id=u.id WHERE conversation_id=$1 ORDER BY created_at`,[req.params.id]);
  res.json(r.rows.map(x=>({id:x.id,sender:{id:x.sender_id,username:x.username,name:fullName(x),first_name:x.first_name,last_name:x.last_name,role:x.role,photo:mediaUrl(x.photo)},text:x.text,created_at:x.created_at,read:x.read})));
}));
app.post('/api/conversations/:id/messages/',auth(),asyncRoute(async(req,res)=>{
  const c=await q('SELECT * FROM conversations WHERE id=$1 AND (user1_id=$2 OR user2_id=$2)',[req.params.id,req.user.id]);
  if(!c.rowCount) return res.status(403).json({detail:'Forbidden'});
  const text=String(req.body.text||'').trim(); if(!text) return res.status(400).json({detail:'Message is required.'});
  const m=await q('INSERT INTO messages(conversation_id,sender_id,text) VALUES($1,$2,$3) RETURNING *',[req.params.id,req.user.id,text]);
  await q('UPDATE conversations SET updated_at=NOW() WHERE id=$1',[req.params.id]);
  const other=Number(c.rows[0].user1_id)===Number(req.user.id)?c.rows[0].user2_id:c.rows[0].user1_id;
  await notify(other,`New message from ${fullName(req.user)}.`);
  res.status(201).json({id:m.rows[0].id,sender:await userMini(req.user.id),text,created_at:m.rows[0].created_at,read:false});
}));

app.use((err,_req,res,_next)=>{
  console.error(err);
  if(err.code==='23505') return res.status(400).json({detail:'A record with these details already exists.'});
  if(err.code==='23503') return res.status(400).json({detail:'Related record was not found.'});
  if(err instanceof multer.MulterError) return res.status(400).json({detail:err.message});
  res.status(500).json({detail:process.env.NODE_ENV==='production'?'Internal server error.':err.message});
});

async function start() {
  const schema=fs.readFileSync(path.join(__dirname,'schema.sql'),'utf8');
  await q(schema);
  app.listen(PORT,()=>console.log(`AthleNet Node API running on http://localhost:${PORT}`));
}
start().catch(err=>{console.error('Backend startup failed:',err);process.exit(1);});
