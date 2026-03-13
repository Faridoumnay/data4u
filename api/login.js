export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin","*");
  if(req.method==="OPTIONS") return res.status(200).end();
  if(req.method!=="POST") return res.status(405).end();
  const {email, password} = req.body;
  if(!email) return res.status(400).json({error:"Missing email"});
  try {
    const r = await fetch(`${process.env.SUPABASE_URL}/rest/v1/users?email=eq.${encodeURIComponent(email)}`,{
      headers:{"apikey":process.env.SUPABASE_SERVICE_KEY,"Authorization":`Bearer ${process.env.SUPABASE_SERVICE_KEY}`}
    });
    const data = await r.json();
    if(!data.length) return res.status(404).json({error:"No account found. Please register."});
    if(data[0].banned) return res.status(403).json({error:"⛔ Account banned. Contact admin."});
    // Check password (skip for admin)
    if(data[0].is_admin){
      if(password !== process.env.ADMIN_PASSWORD) return res.status(401).json({error:"Incorrect password."});
    } else {
      if(data[0].password && data[0].password !== password) return res.status(401).json({error:"Incorrect password."});
    }
    return res.status(200).json({success:true, user:data[0]});
  } catch(e){ return res.status(500).json({error:e.message}); }
}
