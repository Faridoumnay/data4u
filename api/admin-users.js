export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin","*");
  if(req.method==="OPTIONS") return res.status(200).end();
  try {
    const r = await fetch(`${process.env.SUPABASE_URL}/rest/v1/users?select=*&order=created_at.desc`,{
      headers:{
        "apikey": process.env.SUPABASE_SERVICE_KEY,
        "Authorization": `Bearer ${process.env.SUPABASE_SERVICE_KEY}`
      }
    });
    const data = await r.json();
    return res.status(200).json(data);
  } catch(e){ return res.status(500).json({error:e.message}); }
}
