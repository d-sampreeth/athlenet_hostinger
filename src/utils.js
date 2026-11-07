import { query } from './db.js';
export const asyncHandler = fn => (req,res,next)=>Promise.resolve(fn(req,res,next)).catch(next);
export const clean = v => String(v ?? '').trim();
export function validPassword(p){return typeof p==='string'&&p.length>=8&&/[a-z]/.test(p)&&/[A-Z]/.test(p)&&/[^A-Za-z0-9]/.test(p);}
export function validMobile(phone){const value=String(phone??'');return /^[6-9]\d{9}$/.test(value)&&[...value].every(digit=>value.split(digit).length-1<=6);}
export function normalizePhone(phone){
 let d=String(phone||'').replace(/\D/g,'');if(d.length===12&&d.startsWith('91'))d=d.slice(2);
 if(!/^[6-9]\d{9}$/.test(d))return '';
 const counts=new Map();for(const digit of d){const count=(counts.get(digit)||0)+1;if(count>6)return '';counts.set(digit,count);}
 return d;
}
export async function userMini(id){
 const r=await query(`SELECT u.id,u.username,u.first_name,u.last_name,p.role,p.photo,p.location
 FROM users u LEFT JOIN profiles p ON p.user_id=u.id WHERE u.id=$1`,[id]);
 const user=r.rows[0];if(!user)return null;
 return {...user,name:`${user.first_name||''} ${user.last_name||''}`.trim()||user.username};
}
export async function profileData(userId,viewerId=userId){
 const r=await query(`SELECT u.id AS user_id,u.username,u.email,u.first_name,u.last_name,u.date_of_birth,u.marital_status,p.*,
 cp.age AS coach_age,cp.gender AS coach_gender,cp.sport AS coach_sport,cp.experience AS coach_experience,cp.academy,cp.government_recognition,cp.verified,
 pp.age AS player_age,pp.gender AS player_gender,pp.sport AS player_sport,pp.level,pp.district,pp.state,pp.experience AS player_experience,pp.ranking,pp.statistics
 FROM users u JOIN profiles p ON p.user_id=u.id LEFT JOIN coach_profiles cp ON cp.profile_id=p.id LEFT JOIN player_profiles pp ON pp.profile_id=p.id WHERE u.id=$1`,[userId]);
 if(!r.rowCount)return null; const x=r.rows[0];
 const counts=await query(`SELECT (SELECT COUNT(*) FROM follows WHERE following_id=$1) followers_count,
 (SELECT COUNT(*) FROM follows WHERE follower_id=$1) following_count,
 EXISTS(SELECT 1 FROM follows WHERE follower_id=$2 AND following_id=$1) is_following`,[userId,viewerId]);
 const achievements=x.role==='player'?await query(`SELECT a.id,a.title,a.description,a.year,a.proof FROM achievements a JOIN player_profiles p ON p.id=a.player_id WHERE p.profile_id=$1 ORDER BY a.created_at`,[x.id]):{rows:[]};
 const name=`${x.first_name||''} ${x.last_name||''}`.trim()||x.username;
 return {user:{id:x.user_id,username:x.username,first_name:x.first_name,last_name:x.last_name,name},username:x.username,first_name:x.first_name,last_name:x.last_name,role:x.role,email:viewerId===userId?x.email:'',date_of_birth:viewerId===userId?x.date_of_birth:null,marital_status:viewerId===userId?x.marital_status:'',phone:x.phone,location:x.location,pincode:x.pincode,bio:x.bio,interests:x.interests,photo:x.photo,
 coach_details:x.role==='coach'?{age:x.coach_age,gender:x.coach_gender,sport:x.coach_sport,experience:x.coach_experience,academy:x.academy,government_recognition:x.government_recognition,verified:x.verified}:null,
 player_details:x.role==='player'?{age:x.player_age,gender:x.player_gender,sport:x.player_sport,level:x.level,district:x.district,state:x.state,experience:x.player_experience,ranking:x.ranking,statistics:x.statistics,achievements:achievements.rows}:null,
 followers_count:Number(counts.rows[0].followers_count),following_count:Number(counts.rows[0].following_count),is_following:counts.rows[0].is_following};
}
export async function postData(id,viewerId){
 const r=await query(`SELECT p.*,u.username,u.first_name,u.last_name,pr.role,pr.photo,
 (SELECT COUNT(*) FROM likes l WHERE l.post_id=p.id) likes_count,
 (SELECT COUNT(*) FROM comments c WHERE c.post_id=p.id) comments_count,
 EXISTS(SELECT 1 FROM likes l WHERE l.post_id=p.id AND l.user_id=$2) liked
 FROM posts p JOIN users u ON u.id=p.author_id LEFT JOIN profiles pr ON pr.user_id=u.id WHERE p.id=$1`,[id,viewerId]);
 if(!r.rowCount)return null;const p=r.rows[0];return {...p,author:{id:p.author_id,username:p.username,first_name:p.first_name,last_name:p.last_name,name:`${p.first_name||''} ${p.last_name||''}`.trim()||p.username,role:p.role,photo:p.photo},liked:p.liked,likes_count:Number(p.likes_count),comments_count:Number(p.comments_count)};
}
export async function notify(userId,message,link=''){await query('INSERT INTO notifications(user_id,message,link) VALUES($1,$2,$3)',[userId,message,link]);}
