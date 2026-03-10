export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin","*");
  if(req.method==="OPTIONS") return res.status(200).end();
  if(req.method!=="POST") return res.status(405).end();
  const {email, action, banned, plan} = req.body;
  if(!email) return res.status(400).json({error:"Missing email"});
  try {
    if(action==="delete"){
      await fetch(`${process.env.SUPABASE_URL}/rest/v1/users?email=eq.${encodeURIComponent(email)}`,{
        method:"DELETE",
        headers:{
          "apikey": process.env.SUPABASE_SERVICE_KEY,
          "Authorization": `Bearer ${process.env.SUPABASE_SERVICE_KEY}`
        }
      });
    } else {
      const body = {};
      if(banned!==undefined) body.banned = banned;
      if(plan) body.plan = plan;
      await fetch(`${process.env.SUPABASE_URL}/rest/v1/users?email=eq.${encodeURIComponent(email)}`,{
        method:"PATCH",
        headers:{
          "apikey": process.env.SUPABASE_SERVICE_KEY,
          "Authorization": `Bearer ${process.env.SUPABASE_SERVICE_KEY}`,
          "Content-Type":"application/json"
        },
        body: JSON.stringify(body)
      });
    }
    return res.status(200).json({success:true});
  } catch(e){ return res.status(500).json({error:e.message}); }
}
