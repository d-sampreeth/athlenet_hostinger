import jwt from 'jsonwebtoken';
export function requireAuth(req,res,next) {
  const header=req.headers.authorization||'';
  const token=header.startsWith('Bearer ')?header.slice(7):null;
  if(!token) return res.status(401).json({detail:'Authentication credentials were not provided.'});
  try { req.user=jwt.verify(token,process.env.JWT_ACCESS_SECRET); next(); }
  catch { return res.status(401).json({detail:'Invalid or expired access token.'}); }
}
export function issueTokens(user) {
  const payload={id:user.id,username:user.username};
  return {
    access:jwt.sign(payload,process.env.JWT_ACCESS_SECRET,{expiresIn:'4h'}),
    refresh:jwt.sign(payload,process.env.JWT_REFRESH_SECRET,{expiresIn:'7d'}),
  };
}
