export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin","*");
  if(req.method==="OPTIONS") return res.status(200).end();
  if(req.method!=="POST") return res.status(405).end();
  const {email, plan} = req.body;
  if(!email||!plan) return res.status(400).json({error:"Missing fields"});
  try {
    const r = await fetch(`${process.env.SUPABASE_URL}/rest/v1/users?email=eq.${encodeURIComponent(email)}`,{
      method:"PATCH",
      headers:{
        "apikey": process.env.SUPABASE_ANON_KEY,
        "Authorization":`Bearer ${process.env.SUPABASE_ANON_KEY}`,
        "Content-Type":"application/json",
        "Prefer":"return=representation"
      },
      body: JSON.stringify({plan})
    });
    const data = await r.json();
    return res.status(200).json({success:true, user:data[0]});
  } catch(e){ return res.status(500).json({error:e.message}); }
}
