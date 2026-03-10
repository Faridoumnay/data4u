export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin","*");
  if(req.method==="OPTIONS") return res.status(200).end();
  if(req.method!=="POST") return res.status(405).end();
  const {email, name, plan} = req.body;
  if(!email||!name) return res.status(400).json({error:"Missing fields"});
  try {
    // Check if exists
    const check = await fetch(`${process.env.SUPABASE_URL}/rest/v1/users?email=eq.${encodeURIComponent(email)}`,{
      headers:{"apikey":process.env.SUPABASE_ANON_KEY,"Authorization":`Bearer ${process.env.SUPABASE_ANON_KEY}`}
    });
    const existing = await check.json();
    if(existing.length>0) return res.status(409).json({error:"Email already registered."});
    // Insert
    const r = await fetch(`${process.env.SUPABASE_URL}/rest/v1/users`,{
      method:"POST",
      headers:{
        "apikey":process.env.SUPABASE_ANON_KEY,
        "Authorization":`Bearer ${process.env.SUPABASE_ANON_KEY}`,
        "Content-Type":"application/json",
        "Prefer":"return=representation"
      },
      body: JSON.stringify({email, name, plan:"free", is_admin:false, banned:false})
    });
    const data = await r.json();
    return res.status(200).json({success:true, user:data[0]});
  } catch(e){ return res.status(500).json({error:e.message}); }
}
