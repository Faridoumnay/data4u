export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin","*");
  if(req.method==="OPTIONS") return res.status(200).end();
  if(req.method!=="POST") return res.status(405).end();
  const {to,code}=req.body;
  if(!to||!code) return res.status(400).json({error:"Missing fields"});
  try {
    const r = await fetch("https://api.resend.com/emails",{
      method:"POST",
      headers:{"Authorization":`Bearer ${process.env.RESEND_API_KEY}`,"Content-Type":"application/json"},
      body:JSON.stringify({
        from:"DATA4U <onboarding@resend.dev>",
        to:[to],
        subject:"Your DATA4U Verification Code",
        html:`<div style="font-family:Arial,sans-serif;max-width:480px;margin:0 auto;padding:32px;background:#070B14;color:#E8EDF5;border-radius:16px;">
          <h1 style="color:#00D4FF;letter-spacing:3px;text-align:center;">DATA<span>4U</span></h1>
          <p style="color:#8B9BB4;text-align:center;">Turn your data into insights instantly.</p>
          <h2 style="margin-top:24px;">Your Verification Code</h2>
          <div style="background:#111827;border:2px solid #00D4FF44;border-radius:12px;padding:24px;text-align:center;margin:20px 0;">
            <span style="font-size:40px;font-weight:800;letter-spacing:10px;color:#00D4FF;font-family:monospace;">${code}</span>
          </div>
          <p style="color:#4A5568;font-size:12px;text-align:center;">Valid for 10 minutes. Do not share this code.</p>
        </div>`
      })
    });
    const data=await r.json();
    if(!r.ok) return res.status(500).json({error:data});
    return res.status(200).json({success:true});
  } catch(e){ return res.status(500).json({error:e.message}); }
}
