export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST") return res.status(405).end();

  const { to, code } = req.body;
  if (!to || !code) return res.status(400).json({ error: "Missing fields" });

  try {
    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${process.env.RESEND_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: "DATA4U <onboarding@resend.dev>",
        to: [to],
        subject: "Your DATA4U Verification Code",
        html: `
          <div style="font-family:Arial,sans-serif;max-width:480px;margin:0 auto;padding:32px;background:#070B14;color:#E8EDF5;border-radius:16px;">
            <div style="text-align:center;margin-bottom:24px;">
              <h1 style="color:#00D4FF;font-size:28px;letter-spacing:3px;margin:0;">DATA4U</h1>
              <p style="color:#8B9BB4;font-size:13px;margin:4px 0;">Turn your data into insights instantly.</p>
            </div>
            <h2 style="font-size:18px;margin-bottom:8px;">Your Verification Code</h2>
            <p style="color:#8B9BB4;font-size:14px;margin-bottom:24px;">Use this code to complete your registration:</p>
            <div style="background:#111827;border:2px solid #00D4FF44;border-radius:12px;padding:24px;text-align:center;margin-bottom:24px;">
              <span style="font-size:36px;font-weight:800;letter-spacing:8px;color:#00D4FF;font-family:monospace;">${code}</span>
            </div>
            <p style="color:#4A5568;font-size:12px;text-align:center;">This code expires in 10 minutes. Do not share it with anyone.</p>
          </div>
        `,
      }),
    });

    const data = await response.json();
    if (!response.ok) return res.status(500).json({ error: data });
    return res.status(200).json({ success: true });
  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
}
