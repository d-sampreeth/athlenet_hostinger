import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { initDb, pool, query } from './db.js';
import { requireAuth, issueTokens } from './middleware/auth.js';
import { asyncHandler, clean, validPassword, validMobile, validExperience, normalizePhone, userMini, profileData, postData, notify } from './utils.js';
import { listUserImages, removeStoredAssets, resolveMediaReference, UploadError, uploadAssets, validateUploadFile } from './storage.js';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import multer from 'multer';

const app=express();
const __dirname=path.dirname(fileURLToPath(import.meta.url));
const uploadDir=path.resolve(__dirname,'../uploads');
const upload=multer({storage:multer.memoryStorage(),limits:{fileSize:5*1024*1024,files:3}});
const imageSources=["'self'",'data:','https://images.unsplash.com'];
if(process.env.SUPABASE_URL)imageSources.push(new URL(process.env.SUPABASE_URL).origin);
const validateUploadedFiles=(req,res,next)=>{
 const files=req.file?[req.file]:Object.values(req.files||{}).flat();
 try {
  for(const file of files)validateUploadFile(file,file.fieldname);
  next();
 } catch(error) {
  next(error);
 }
};
const origins=(process.env.FRONTEND_ORIGINS||'http://localhost:5173').split(',').map(x=>x.trim());
app.use(helmet({contentSecurityPolicy:{directives:{imgSrc:imageSources}},crossOriginResourcePolicy:{policy:'cross-origin'}}));
app.use(cors({origin:(origin,cb)=>!origin||origins.includes('*')||origins.includes(origin)?cb(null,true):cb(new Error('Origin not allowed by CORS')),credentials:true}));
app.use(express.json({limit:'2mb'}));app.use(express.urlencoded({extended:true}));
app.use('/media',express.static(uploadDir));
const frontendDist = path.resolve(__dirname, '../frontend/dist');

app.use(express.static(frontendDist));

app.get('/', (req, res) => {
  res.sendFile(path.join(frontendDist, 'index.html'));
});
app.get('/health',(req,res)=>res.json({status:'ok',service:'athlenet-node-backend'}));
app.get('/api/health',(req,res)=>res.json({status:'ok'}));

const auth=(fn)=>[requireAuth,asyncHandler(fn)];
const publicAsync=fn=>asyncHandler(fn);
const userByName=async username=>(await query('SELECT * FROM users WHERE username=$1',[username])).rows[0];
const profileId=async uid=>(await query('SELECT id FROM profiles WHERE user_id=$1',[uid])).rows[0]?.id;
const mini=async id=>userMini(id);

// Authentication: preserves the frontend's /api/auth/register and /api/auth/login contract.
app.post('/api/auth/register',upload.fields([{name:'photo',maxCount:1},{name:'certificate',maxCount:1},{name:'achievement_proof',maxCount:1}]),validateUploadedFiles,publicAsync(async(req,res)=>{
 const d={...req.body};const email=clean(d.email).toLowerCase(),password=d.password;const role=d.role||'user',username=role==='player'?email:(clean(d.username)||email),maritalStatus=clean(d.marital_status),dateOfBirth=clean(d.date_of_birth);
 if(!email||!username||!password)return res.status(400).json({detail:'Username, email and password are required.'});
 if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))return res.status(400).json({detail:'Enter a valid email address.'});
 if(!validPassword(password))return res.status(400).json({detail:'Password must be at least 8 characters and include an uppercase letter, a lowercase letter, and a special character.'});
 if(!['Single','Married','Divorced','Prefer not to share'].includes(maritalStatus))return res.status(400).json({detail:'Select a marital status.'});
 const gender=clean(d.gender);if(role==='player'&&!['Male','Female','Other','Prefer not to say'].includes(gender))return res.status(400).json({detail:'Select a gender.'});
 if(dateOfBirth){const parsed=new Date(`${dateOfBirth}T00:00:00Z`);if(!/^\d{4}-\d{2}-\d{2}$/.test(dateOfBirth)||Number.isNaN(parsed.valueOf())||parsed.toISOString().slice(0,10)!==dateOfBirth||dateOfBirth>new Date().toISOString().slice(0,10))return res.status(400).json({detail:'Enter a valid date of birth that is not in the future.'});}
 if(!['user','player','coach'].includes(role))return res.status(400).json({detail:'Invalid role.'});
 if(d.experience!==undefined&&!validExperience(d.experience))return res.status(400).json({detail:'Experience must be a non-negative whole number.'});
 const pincode=clean(d.pincode);if(!/^[1-9][0-9]{5}$/.test(pincode))return res.status(400).json({pincode:['A 6-digit Indian PIN code is required.']});
 const phone=clean(d.phone),phoneKey=normalizePhone(phone);if(!validMobile(phone))return res.status(400).json({detail:'Enter a 10-digit mobile number starting with 6, 7, 8, or 9. Each digit can appear at most 6 times.'});
 const exists=await query('SELECT 1 FROM users WHERE username=$1 OR lower(email)=lower($2)',[username,email]);if(exists.rowCount)return res.status(400).json({detail:'An account with this username/email already exists.'});
 if(phoneKey&&(await query('SELECT 1 FROM profiles WHERE phone_key=$1',[phoneKey])).rowCount)return res.status(400).json({detail:'An account with this mobile number already exists.'});
 const client=await pool.connect();let storedAssets=[],transactionStarted=false,committed=false;try{
 await client.query('BEGIN');transactionStarted=true;const hash=await bcrypt.hash(password,12);
 const u=(await client.query('INSERT INTO users(username,email,password_hash,first_name,last_name,date_of_birth,marital_status) VALUES($1,$2,$3,$4,$5,$6,$7) RETURNING *',[username,email,hash,clean(d.first_name),clean(d.last_name),dateOfBirth||null,maritalStatus])).rows[0];
 const {references,uploaded}=await uploadAssets({
  photo:req.files?.photo?.[0],
  certificate:role==='coach'?req.files?.certificate?.[0]:undefined,
  achievement_proof:role==='player'&&d.achievement_title?req.files?.achievement_proof?.[0]:undefined,
 },u.id);
 storedAssets=uploaded;
 const p=(await client.query('INSERT INTO profiles(user_id,role,phone,phone_key,location,pincode,bio,interests,photo) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING *',[u.id,role,phone,phoneKey||null,clean(d.location),pincode,clean(d.bio),clean(d.interests),references.photo||''])).rows[0];
 if(role==='coach')await client.query('INSERT INTO coach_profiles(profile_id,age,gender,sport,experience,academy,certificate,government_recognition) VALUES($1,$2,$3,$4,$5,$6,$7,$8)',[p.id,d.age||null,clean(d.gender),clean(d.sport),Number(d.experience)||0,clean(d.academy),references.certificate||'',clean(d.government_recognition)]);
 if(role==='player'){const pp=(await client.query('INSERT INTO player_profiles(profile_id,age,gender,sport,level,district,state,experience,ranking,statistics) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) RETURNING id',[p.id,d.age||null,gender,clean(d.sport),clean(d.level),clean(d.district),clean(d.state),Number(d.experience)||0,clean(d.ranking),clean(d.statistics)])).rows[0];if(d.achievement_title)await client.query('INSERT INTO achievements(player_id,title,description,year,proof) VALUES($1,$2,$3,$4,$5)',[pp.id,clean(d.achievement_title),clean(d.achievement_description),d.achievement_year||null,references.achievement_proof||'']);}
 await client.query('COMMIT');committed=true;const tokens=issueTokens(u);res.status(201).json({...tokens,user:await mini(u.id)});
 }catch(e){if(!committed){if(transactionStarted){try{await client.query('ROLLBACK');}catch(rollbackError){console.error('Failed to roll back registration.',rollbackError);}}if(storedAssets.length){try{await removeStoredAssets(storedAssets);}catch(cleanupError){console.error('Failed to clean up registration uploads.',cleanupError);}}}throw e;}finally{client.release();}
}));
app.post('/api/auth/login',publicAsync(async(req,res)=>{
 const username=clean(req.body.username),password=req.body.password;
 const u=(await query('SELECT * FROM users WHERE username=$1 OR lower(email)=lower($1)',[username])).rows[0];
 if(!u||!u.is_active||!(await bcrypt.compare(password||'',u.password_hash)))return res.status(401).json({detail:'Invalid credentials.'});
 res.json({...issueTokens(u),user:await mini(u.id)});
}));
app.post('/api/token/refresh',publicAsync(async(req,res)=>{
 try{const payload=jwt.verify(req.body.refresh,process.env.JWT_REFRESH_SECRET);const u=(await query('SELECT * FROM users WHERE id=$1 AND is_active=true',[payload.id])).rows[0];if(!u)return res.status(401).json({detail:'Invalid refresh token.'});res.json({access:jwt.sign({id:u.id,username:u.username},process.env.JWT_ACCESS_SECRET,{expiresIn:'4h'})});}
 catch{return res.status(401).json({detail:'Invalid or expired refresh token.'});}
}));

// Current profile /me/
app.get('/api/me',...auth(async(req,res)=>res.json(await profileData(req.user.id,req.user.id))));
app.get('/api/me/media',...auth(async(req,res)=>res.json(await listUserImages(req.user.id))));
app.patch('/api/me',requireAuth,upload.fields([{name:'photo',maxCount:1},{name:'cover_image',maxCount:1},{name:'certificate',maxCount:1}]),validateUploadedFiles,asyncHandler(async(req,res)=>{
 const d=req.body,uid=req.user.id,pid=await profileId(uid);
 if(d.experience!==undefined&&!validExperience(d.experience))return res.status(400).json({detail:'Experience must be a non-negative whole number.'});
 const userFields=['first_name','last_name'];for(const f of userFields)if(d[f]!==undefined)await query(`UPDATE users SET ${f}=$1 WHERE id=$2`,[clean(d[f]),uid]);
 if(d.email!==undefined){const email=clean(d.email).toLowerCase();if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))return res.status(400).json({detail:'Enter a valid email address.'});if((await query('SELECT 1 FROM users WHERE lower(email)=lower($1) AND id<>$2',[email,uid])).rowCount)return res.status(400).json({detail:'An account with this email address already exists.'});await query('UPDATE users SET email=$1 WHERE id=$2',[email,uid]);}
 const p=(await query('SELECT * FROM profiles WHERE id=$1',[pid])).rows[0];
 const allowed=['phone','location','pincode','bio','interests'];const sets=[],vals=[];for(const f of allowed)if(d[f]!==undefined){if(f==='pincode'&&!/^[1-9][0-9]{5}$/.test(clean(d[f])))return res.status(400).json({pincode:['A 6-digit Indian PIN code is required.']});if(f==='phone'&&d[f]&&!normalizePhone(d[f]))return res.status(400).json({detail:'Enter a 10-digit mobile number starting with 6, 7, 8, or 9; no digit may appear more than 6 times.'});vals.push(f==='phone'?clean(d[f]):clean(d[f]));sets.push(`${f}=$${vals.length}`);}
 if(d.phone!==undefined){vals.push(normalizePhone(d.phone)||null);sets.push(`phone_key=$${vals.length}`);}
 const detailTable=p.role==='coach'?'coach_profiles':p.role==='player'?'player_profiles':null;
 const detail=detailTable?(await query(`SELECT * FROM ${detailTable} WHERE profile_id=$1`,[pid])).rows[0]:null;
 const {references,uploaded}=await uploadAssets({photo:req.files?.photo?.[0],cover_image:req.files?.cover_image?.[0],certificate:p.role==='coach'?req.files?.certificate?.[0]:undefined},uid);
 try {
  if(references.photo){vals.push(references.photo);sets.push(`photo=$${vals.length}`);}
  if(references.cover_image){vals.push(references.cover_image);sets.push(`cover_image=$${vals.length}`);}
  if(sets.length){vals.push(pid);await query(`UPDATE profiles SET ${sets.join(',')} WHERE id=$${vals.length}`,vals);}
  if(detailTable){const fields=detailTable==='coach_profiles'?['age','gender','sport','experience','academy','government_recognition']:['age','gender','sport','experience','level','district','state','ranking','statistics'];const ds=[],dv=[];for(const f of fields)if(d[f]!==undefined){dv.push(f==='age'||f==='experience'?(Number(d[f])||null):clean(d[f]));ds.push(`${f}=$${dv.length}`);}if(detailTable==='coach_profiles'&&references.certificate){dv.push(references.certificate);ds.push(`certificate=$${dv.length}`);}if(ds.length){dv.push(detail.id);await query(`UPDATE ${detailTable} SET ${ds.join(',')} WHERE id=$${dv.length}`,dv);}}
 } catch(error) {
  try { await removeStoredAssets(uploaded); } catch(cleanupError) { console.error('Failed to clean up profile uploads.',cleanupError); }
  throw error;
 }
 res.json(await profileData(uid,uid));
}));

// Profile serialization helper for lists.
app.get('/api/users/:username',...auth(async(req,res)=>{const u=await userByName(req.params.username);if(!u)return res.status(404).json({detail:'Not found.'});const p=await profileData(u.id,req.user.id);res.json(p);}));
app.get('/api/users',...auth(async(req,res)=>{
 const q=clean(req.query.q);const r=await query(`SELECT u.id FROM users u JOIN profiles p ON p.user_id=u.id WHERE u.id<>$1 AND ($2='' OR u.username ILIKE '%'||$2||'%' OR u.first_name ILIKE '%'||$2||'%' OR u.last_name ILIKE '%'||$2||'%' OR p.location ILIKE '%'||$2||'%') ORDER BY p.created_at DESC LIMIT 100`,[req.user.id,q]);
 res.json(await Promise.all(r.rows.map(x=>profileData(x.id,req.user.id))));
}));
app.post('/api/users/:username/follow',...auth(async(req,res)=>{
 const u=await userByName(req.params.username);if(!u)return res.status(404).json({detail:'Not found.'});if(u.id===req.user.id)return res.status(400).json({detail:'You cannot follow yourself.'});
 const found=await query('SELECT id FROM follows WHERE follower_id=$1 AND following_id=$2',[req.user.id,u.id]);
 let following;
 if(found.rowCount){await query('DELETE FROM follows WHERE id=$1',[found.rows[0].id]);following=false;}
 else{await query('INSERT INTO follows(follower_id,following_id) VALUES($1,$2) ON CONFLICT DO NOTHING',[req.user.id,u.id]);following=true;await notify(u.id,`${req.user.username} started following you.`,`/users/${req.user.username}`);}
 const counts=await query(`SELECT (SELECT COUNT(*) FROM follows WHERE following_id=$1) followers_count,
 (SELECT COUNT(*) FROM follows WHERE follower_id=$1) following_count`,[u.id]);
 res.json({following,followers_count:Number(counts.rows[0].followers_count),following_count:Number(counts.rows[0].following_count)});
}));
app.get('/api/connections',...auth(async(req,res)=>{const r=await query('SELECT following_id id FROM follows WHERE follower_id=$1',[req.user.id]);res.json(await Promise.all(r.rows.map(x=>profileData(x.id,req.user.id))));}));
app.get('/api/followers',...auth(async(req,res)=>{const r=await query('SELECT follower_id id FROM follows WHERE following_id=$1',[req.user.id]);res.json(await Promise.all(r.rows.map(x=>profileData(x.id,req.user.id))));}));

// Opportunities
app.get('/api/opportunities',...auth(async(req,res)=>{
 let sql=`SELECT o.*,cp.verified,u.username,u.first_name,u.last_name,(SELECT COUNT(*) FROM opportunity_applications a WHERE a.opportunity_id=o.id) application_count,
 EXISTS(SELECT 1 FROM opportunity_applications a JOIN player_profiles pp ON pp.id=a.player_id WHERE a.opportunity_id=o.id AND pp.profile_id=(SELECT id FROM profiles WHERE user_id=$1)) applied
 FROM opportunities o JOIN coach_profiles cp ON cp.id=o.coach_id JOIN profiles p ON p.id=cp.profile_id JOIN users u ON u.id=p.user_id WHERE o.active=true`;
 const vals=[req.user.id];for(const k of ['sport','location'])if(req.query[k]){vals.push(`%${req.query[k]}%`);sql+=` AND o.${k} ILIKE $${vals.length}`;}
 if(req.query.q){vals.push(`%${req.query.q}%`);sql+=` AND (o.title ILIKE $${vals.length} OR o.description ILIKE $${vals.length} OR o.sport ILIKE $${vals.length} OR o.location ILIKE $${vals.length} OR o.eligibility ILIKE $${vals.length})`;}
 sql+=' ORDER BY o.created_at DESC';const r=await query(sql,vals);res.json(r.rows.map(o=>({...o,image:resolveMediaReference(o.image),coach_name:`${o.first_name||''} ${o.last_name||''}`.trim()||o.username,coach_verified:o.verified})));
}));
app.post('/api/opportunities',...auth(upload.single('image')),validateUploadedFiles,asyncHandler(async(req,res)=>{
 const cp=(await query('SELECT id FROM coach_profiles WHERE profile_id=(SELECT id FROM profiles WHERE user_id=$1)',[req.user.id])).rows[0];if(!cp)return res.status(403).json({detail:'Only coaches can create opportunities.'});
 const d=req.body;if(!d.title||!d.description||!d.sport||!d.location||!d.event_date||!d.last_date)return res.status(400).json({detail:'Please provide all required opportunity fields.'});
 const {references,uploaded}=await uploadAssets({image:req.file},req.user.id);
 try {
  const r=await query(`INSERT INTO opportunities(coach_id,title,description,sport,location,event_date,last_date,eligibility,slots,image) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) RETURNING *`,[cp.id,d.title,d.description,d.sport,d.location,d.event_date,d.last_date,d.eligibility||'',Number(d.slots)||20,references.image||'']);
  res.status(201).json({...r.rows[0],image:resolveMediaReference(r.rows[0].image)});
 } catch(error) {
  try { await removeStoredAssets(uploaded); } catch(cleanupError) { console.error('Failed to clean up opportunity uploads.',cleanupError); }
  throw error;
 }
}));
app.get('/api/opportunities/:id',...auth(async(req,res)=>{const r=await query(`SELECT o.*,cp.verified,u.username,(SELECT COUNT(*) FROM opportunity_applications a WHERE a.opportunity_id=o.id) application_count FROM opportunities o JOIN coach_profiles cp ON cp.id=o.coach_id JOIN profiles p ON p.id=cp.profile_id JOIN users u ON u.id=p.user_id WHERE o.id=$1`,[req.params.id]);if(!r.rowCount)return res.status(404).json({detail:'Not found.'});res.json({...r.rows[0],image:resolveMediaReference(r.rows[0].image)});}));
app.post('/api/opportunities/:id',...auth(async(req,res)=>{
 const d=req.body;const pp=(await query('SELECT id FROM player_profiles WHERE profile_id=(SELECT id FROM profiles WHERE user_id=$1)',[req.user.id])).rows[0];if(!pp)return res.status(403).json({detail:'Only players can apply.'});
 const o=(await query('SELECT * FROM opportunities WHERE id=$1 AND active=true',[req.params.id])).rows[0];if(!o)return res.status(404).json({detail:'Opportunity not found.'});
 try{const r=await query('INSERT INTO opportunity_applications(opportunity_id,player_id,message) VALUES($1,$2,$3) RETURNING *',[o.id,pp.id,d.message||'']);await notify((await query('SELECT p.user_id FROM coach_profiles cp JOIN profiles p ON p.id=cp.profile_id WHERE cp.id=$1',[o.coach_id])).rows[0].user_id,`${req.user.username} applied for ${o.title}.`,`/opportunities/${o.id}`);res.status(201).json(r.rows[0]);}catch(e){if(e.code==='23505')return res.status(400).json({detail:'You have already applied.'});throw e;}
}));

// Posts, feed, comments, likes
app.get('/api/posts',...auth(async(req,res)=>{
 const vals=[];let sql='SELECT p.id FROM posts p';if(req.query.author){vals.push(req.query.author);sql+=' JOIN users u ON u.id=p.author_id WHERE u.username=$1';}sql+=' ORDER BY p.created_at DESC,p.id DESC LIMIT 100';const r=await query(sql,vals);res.json(await Promise.all(r.rows.map(x=>postData(x.id,req.user.id))));
}));
app.post('/api/posts',...auth(upload.single('image')),validateUploadedFiles,asyncHandler(async(req,res)=>{
 const d=req.body; if(!clean(d.content))return res.status(400).json({detail:'Post content is required.'});
 const {references,uploaded}=await uploadAssets({image:req.file},req.user.id);
 let postId;
 try { const r=await query('INSERT INTO posts(author_id,content,image,post_type,sport) VALUES($1,$2,$3,$4,$5) RETURNING id',[req.user.id,d.content,references.image||'',d.post_type||'discussion',d.sport||'']);postId=r.rows[0].id; }
 catch(error) { try { await removeStoredAssets(uploaded); } catch(cleanupError) { console.error('Failed to clean up post upload.',cleanupError); } throw error; }
 res.status(201).json(await postData(postId,req.user.id));
}));
app.delete('/api/posts/:id',...auth(async(req,res)=>{
 const client=await pool.connect();let transactionStarted=false,committed=false;
 try{
  await client.query('BEGIN');transactionStarted=true;
  const post=await client.query('SELECT id FROM posts WHERE id=$1 AND author_id=$2 FOR UPDATE',[req.params.id,req.user.id]);
  if(!post.rowCount){await client.query('ROLLBACK');transactionStarted=false;return res.status(404).json({detail:'Post not found or not yours.'});}
  await client.query('DELETE FROM comments WHERE post_id=$1',[req.params.id]);
  await client.query('DELETE FROM likes WHERE post_id=$1',[req.params.id]);
  await client.query('DELETE FROM notifications WHERE link=$1',[`/posts/${req.params.id}`]);
  await client.query('DELETE FROM posts WHERE id=$1',[req.params.id]);
  await client.query('COMMIT');committed=true;
  res.status(204).end();
 }catch(error){
  if(!committed&&transactionStarted){try{await client.query('ROLLBACK');}catch(rollbackError){console.error('Failed to roll back post deletion.',rollbackError);}}
  throw error;
 }finally{client.release();}
}));
app.post('/api/posts/:id/like',...auth(async(req,res)=>{
 const post=(await query('SELECT author_id FROM posts WHERE id=$1',[req.params.id])).rows[0];if(!post)return res.status(404).json({detail:'Post not found.'});
 const found=await query('SELECT id FROM likes WHERE post_id=$1 AND user_id=$2',[req.params.id,req.user.id]);let liked;
 if(found.rowCount){await query('DELETE FROM likes WHERE id=$1',[found.rows[0].id]);liked=false;}
 else{await query('INSERT INTO likes(post_id,user_id) VALUES($1,$2) ON CONFLICT DO NOTHING',[req.params.id,req.user.id]);liked=true;if(post.author_id!==req.user.id)await notify(post.author_id,`${req.user.username} liked your post.`,`/posts/${req.params.id}`);}
 const count=await query('SELECT COUNT(*) AS count FROM likes WHERE post_id=$1',[req.params.id]);res.json({liked,count:Number(count.rows[0].count)});
}));
app.get('/api/posts/:id/comments',...auth(async(req,res)=>{const r=await query(`SELECT c.*,u.username,u.first_name,u.last_name,p.photo FROM comments c JOIN users u ON u.id=c.user_id LEFT JOIN profiles p ON p.user_id=u.id WHERE c.post_id=$1 ORDER BY c.created_at`,[req.params.id]);res.json(r.rows.map(c=>({...c,user:{id:c.user_id,username:c.username,first_name:c.first_name,last_name:c.last_name,photo:c.photo}})));}));
app.post('/api/posts/:id/comments',...auth(async(req,res)=>{if(!clean(req.body.text))return res.status(400).json({detail:'Comment text is required.'});const r=await query('INSERT INTO comments(post_id,user_id,text) VALUES($1,$2,$3) RETURNING *',[req.params.id,req.user.id,req.body.text]);const author=(await query('SELECT author_id FROM posts WHERE id=$1',[req.params.id])).rows[0]?.author_id;if(author&&author!==req.user.id)await notify(author,`${req.user.username} commented on your post.`,`/posts/${req.params.id}`);res.status(201).json({...r.rows[0],user:await mini(req.user.id)});}));
app.get('/api/feed',...auth(async(req,res)=>{
 const page=Math.max(Math.floor(Number(req.query.page)||1),1),limit=Math.min(Math.max(Math.floor(Number(req.query.limit)||10),1),50),offset=(page-1)*limit;
 const source=clean(req.query.source||'all').toLowerCase();
 if(!['all','interest','nearby','connections'].includes(source))return res.status(400).json({detail:'Invalid feed source.'});
 const profile=(await query(`SELECT p.pincode,p.location,p.interests,cp.sport AS coach_sport,
 pp.sport AS player_sport,pp.district,pp.state
 FROM profiles p LEFT JOIN coach_profiles cp ON cp.profile_id=p.id LEFT JOIN player_profiles pp ON pp.profile_id=p.id
 WHERE p.user_id=$1`,[req.user.id])).rows[0];
 if(!profile)return res.status(404).json({detail:'Profile not found.'});

 const sports=[...new Set([...(profile.interests||'').split(',').map(s=>s.trim().toLowerCase()),profile.coach_sport?.trim().toLowerCase(),profile.player_sport?.trim().toLowerCase()].filter(Boolean))];
 const reason=source==='interest'?"'interest'::text":source==='nearby'?"'nearby'::text":'NULL::text';
 let sql=`SELECT p.id,${reason} AS reason FROM posts p JOIN users u ON u.id=p.author_id WHERE u.is_active=true`;
 const values=[];
 let nearbyPriority=false;
 if(source==='interest'){
  if(!sports.length)sql+=' AND false';
  else{values.push(sports);sql+=` AND lower(trim(p.sport))=ANY($${values.length}::text[])`;}
 }else if(source==='nearby'){
  const matches=[],priorities=[];
  if(profile.pincode){values.push(profile.pincode);const match=`ap.pincode=$${values.length}`;matches.push(match);priorities.push(`WHEN ${match} THEN 0`);}
  if(profile.location?.trim()){values.push(profile.location.trim());const match=`lower(trim(ap.location))=lower(trim($${values.length}))`;matches.push(match);priorities.push(`WHEN ${match} THEN 1`);}
  if(profile.district?.trim()){values.push(profile.district.trim());const match=`lower(trim(app.district))=lower(trim($${values.length}))`;matches.push(match);priorities.push(`WHEN ${match} THEN 2`);}
  if(profile.state?.trim()){values.push(profile.state.trim());const match=`lower(trim(app.state))=lower(trim($${values.length}))`;matches.push(match);priorities.push(`WHEN ${match} THEN 3`);}
  if(!matches.length)sql+=' AND false';
  else{
   nearbyPriority=true;
   sql=`SELECT p.id,'nearby'::text AS reason,CASE ${priorities.join(' ')} ELSE 4 END AS location_priority
    FROM posts p JOIN users u ON u.id=p.author_id
    JOIN profiles ap ON ap.user_id=p.author_id LEFT JOIN player_profiles app ON app.profile_id=ap.id
    WHERE u.is_active=true AND (${matches.join(' OR ')})`;
  }
 }else if(source==='connections'){
  values.push(req.user.id);
  sql=`WITH connection_counts AS (
   SELECT user_id,COUNT(*) AS connection_count FROM (
    SELECT follower_id AS user_id,following_id AS connection_id FROM follows
    UNION SELECT following_id AS user_id,follower_id AS connection_id FROM follows
   ) edges GROUP BY user_id
  )
   SELECT p.id,'connection'::text AS reason,COALESCE(cc.connection_count,0) AS connection_count,
   CASE pr.role WHEN 'coach' THEN 0 WHEN 'player' THEN 1 ELSE 2 END AS role_priority
   FROM posts p JOIN users u ON u.id=p.author_id LEFT JOIN profiles pr ON pr.user_id=p.author_id
   LEFT JOIN connection_counts cc ON cc.user_id=p.author_id
   WHERE u.is_active=true AND EXISTS(SELECT 1 FROM follows mine WHERE mine.follower_id=$1 AND mine.following_id=p.author_id)`;
 }
 sql+=source==='connections'
  ?' ORDER BY connection_count DESC,role_priority ASC,p.created_at DESC,p.id DESC'
  :nearbyPriority?' ORDER BY location_priority ASC,p.created_at DESC,p.id DESC'
  :' ORDER BY p.created_at DESC,p.id DESC';
 values.push(limit+1,offset);
 sql+=` LIMIT $${values.length-1} OFFSET $${values.length}`;
 const r=await query(sql,values),hasNext=r.rows.length>limit,rows=r.rows.slice(0,limit);
 const results=await Promise.all(rows.map(async row=>({...await postData(row.id,req.user.id),reasons:row.reason?[row.reason]:[]})));
 const notice=source==='interest'&&!sports.length?'Select at least one sport in your profile to personalize this feed.':
  source==='nearby'&&!nearbyPriority?'Add your PIN code, location, district, or state to find nearby posts.':'';
 res.json({results,page,has_next:hasNext,has_more:hasNext,fallback:source==='all'&&(!sports.length||!(profile.pincode||profile.location?.trim())),notice});
}));

// Dashboard and local hub
app.get('/api/dashboard',...auth(async(req,res)=>{
 const p=(await query('SELECT * FROM profiles WHERE user_id=$1',[req.user.id])).rows[0];const opp=await query('SELECT * FROM opportunities WHERE active=true AND last_date>=CURRENT_DATE ORDER BY event_date LIMIT 6');
 let news=await query(`SELECT * FROM news WHERE active=true AND (pincode=$1 OR (pincode='' AND (location ILIKE $2 OR location=''))) ORDER BY published_at DESC LIMIT 6`,[p.pincode,`%${req.query.location||p.location}%`]);
 const posts=await query('SELECT id FROM posts ORDER BY created_at DESC LIMIT 10');res.json({opportunities:opp.rows.map(o=>({...o,image:resolveMediaReference(o.image)})),news:news.rows,posts:await Promise.all(posts.rows.map(x=>postData(x.id,req.user.id)))});
}));
app.get('/api/local-hub',...auth(async(req,res)=>{
 const p=(await query('SELECT * FROM profiles WHERE user_id=$1',[req.user.id])).rows[0];const posts=await query(`SELECT p.id FROM posts p JOIN users u ON u.id=p.author_id JOIN profiles pr ON pr.user_id=u.id WHERE pr.pincode=$1 OR (pr.pincode='' AND pr.location ILIKE $2) ORDER BY p.created_at DESC LIMIT 30`,[p.pincode,`%${p.location}%`]);
 const opp=await query('SELECT * FROM opportunities WHERE active=true AND location ILIKE $1 ORDER BY created_at DESC LIMIT 20',[`%${p.location}%`]);res.json({posts:await Promise.all(posts.rows.map(x=>postData(x.id,req.user.id))),opportunities:opp.rows.map(o=>({...o,image:resolveMediaReference(o.image)}))});
}));

// News, notifications, search
app.get('/api/news',publicAsync(async(req,res)=>{const vals=[];let sql='SELECT * FROM news WHERE active=true';if(req.query.location){vals.push(`%${req.query.location}%`);sql+=` AND location ILIKE $${vals.length}`;}if(req.query.sport){vals.push(`%${req.query.sport}%`);sql+=` AND sport ILIKE $${vals.length}`;}sql+=' ORDER BY featured DESC,published_at DESC LIMIT 100';res.json((await query(sql,vals)).rows);}));
app.get('/api/notifications',...auth(async(req,res)=>res.json((await query('SELECT * FROM notifications WHERE user_id=$1 ORDER BY created_at DESC LIMIT 50',[req.user.id])).rows)));
app.post('/api/notifications',...auth(async(req,res)=>{await query('UPDATE notifications SET read=true WHERE user_id=$1',[req.user.id]);res.json({success:true});}));
app.get('/api/search',...auth(async(req,res)=>{
 const q=clean(req.query.q);if(!q)return res.json({users:[],opportunities:[],news:[]});const like=`%${q}%`;
 const us=await query(`SELECT u.id FROM users u WHERE u.username ILIKE $1 OR u.first_name ILIKE $1 OR u.last_name ILIKE $1 LIMIT 20`,[like]);
 const op=await query('SELECT * FROM opportunities WHERE active=true AND (title ILIKE $1 OR description ILIKE $1 OR sport ILIKE $1 OR location ILIKE $1) LIMIT 20',[like]);
 const nw=await query('SELECT * FROM news WHERE active=true AND (title ILIKE $1 OR summary ILIKE $1 OR location ILIKE $1) LIMIT 20',[like]);
 res.json({users:await Promise.all(us.rows.map(x=>profileData(x.id,req.user.id))),opportunities:op.rows.map(o=>({...o,image:resolveMediaReference(o.image)})),news:nw.rows});
}));

// Direct messaging / conversations
app.get('/api/conversations',...auth(async(req,res)=>{
 const r=await query('SELECT * FROM conversations WHERE user1_id=$1 OR user2_id=$1 ORDER BY updated_at DESC',[req.user.id]);const out=[];
 for(const c of r.rows){const other=c.user1_id===req.user.id?c.user2_id:c.user1_id;const last=(await query('SELECT * FROM messages WHERE conversation_id=$1 ORDER BY created_at DESC LIMIT 1',[c.id])).rows[0];out.push({...c,other_user:await mini(other),last_message:last||null});}res.json(out);
}));
app.get('/api/conversations/:id/messages',...auth(async(req,res)=>{
 const c=(await query('SELECT * FROM conversations WHERE id=$1',[req.params.id])).rows[0];if(!c)return res.status(404).json({detail:'Conversation not found.'});if(![c.user1_id,c.user2_id].includes(req.user.id))return res.status(403).json({detail:'Forbidden'});
 const r=await query('SELECT * FROM messages WHERE conversation_id=$1 ORDER BY created_at',[c.id]);await query('UPDATE messages SET read=true WHERE conversation_id=$1 AND sender_id<>$2',[c.id,req.user.id]);res.json(await Promise.all(r.rows.map(async m=>({...m,sender:await mini(m.sender_id)}))));
}));
app.post('/api/conversations/:id/messages',...auth(async(req,res)=>{
 const c=(await query('SELECT * FROM conversations WHERE id=$1',[req.params.id])).rows[0];if(!c)return res.status(404).json({detail:'Conversation not found.'});if(![c.user1_id,c.user2_id].includes(req.user.id))return res.status(403).json({detail:'Forbidden'});if(!clean(req.body.text))return res.status(400).json({detail:'Message text is required.'});
 const r=await query('INSERT INTO messages(conversation_id,sender_id,text) VALUES($1,$2,$3) RETURNING *',[c.id,req.user.id,req.body.text]);await query('UPDATE conversations SET updated_at=NOW() WHERE id=$1',[c.id]);const other=c.user1_id===req.user.id?c.user2_id:c.user1_id;await notify(other,`New message from ${req.user.username}.`,`/messages/${c.id}`);res.status(201).json({...r.rows[0],sender:await mini(req.user.id)});
}));
app.post('/api/conversations',...auth(async(req,res)=>{
 const target=Number(req.body.user_id);if(!target||target===req.user.id)return res.status(400).json({detail:'Valid user_id is required.'});if(!(await query('SELECT 1 FROM users WHERE id=$1',[target])).rowCount)return res.status(404).json({detail:'User not found.'});
 const a=Math.min(target,req.user.id),b=Math.max(target,req.user.id);const r=await query('INSERT INTO conversations(user1_id,user2_id) VALUES($1,$2) ON CONFLICT(user1_id,user2_id) DO UPDATE SET updated_at=NOW() RETURNING *',[a,b]);res.status(201).json(r.rows[0]);
}));
// React SPA fallback
app.get('*', (req, res, next) => {
  if (
    req.path.startsWith('/api/') ||
    req.path.startsWith('/media/') ||
    req.path === '/health'
  ) {
    return next();
  }

  res.sendFile(path.join(frontendDist, 'index.html'));
});
app.use((err,req,res,next)=>{console.error(err);if(res.headersSent)return next(err);if(err instanceof UploadError)return res.status(err.status).json({detail:err.message});if(err instanceof multer.MulterError){const detail=err.code==='LIMIT_FILE_SIZE'?'Uploaded files must not exceed 5 MB.':err.message;return res.status(400).json({detail});}if(err.code==='23505')return res.status(400).json({detail:'A record with these details already exists.'});if(err.code==='23503')return res.status(400).json({detail:'Referenced record does not exist.'});res.status(500).json({detail:process.env.NODE_ENV==='production'?'Internal server error.':err.message});});
const port=process.env.PORT||5000;
await initDb();
app.listen(port,()=>console.log(`AthleNet Node API running on http://localhost:${port}`));
