export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST,OPTIONS");
  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST") return res.status(405).end();

  const { plan } = req.body;
  const prices = { pro: "19.00", enterprise: "99.00" };
  const amount = prices[plan] || "19.00";

  try {
    const auth = Buffer.from(
      `${process.env.PAYPAL_CLIENT_ID}:${process.env.PAYPAL_SECRET}`
    ).toString("base64");

    const tokenRes = await fetch("https://api-m.paypal.com/v1/oauth2/token", {
      method: "POST",
      headers: {
        Authorization: `Basic ${auth}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: "grant_type=client_credentials",
    });
    const { access_token } = await tokenRes.json();

    const orderRes = await fetch("https://api-m.paypal.com/v2/checkout/orders", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${access_token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        intent: "CAPTURE",
        purchase_units: [{
          amount: { currency_code: "USD", value: amount },
          description: `DATA4U ${plan} Plan`,
        }],
        application_context: {
          return_url: `https://data4u-blush.vercel.app`,
          cancel_url: `https://data4u-blush.vercel.app`,
          brand_name: "DATA4U",
          user_action: "PAY_NOW",
        },
      }),
    });

    const order = await orderRes.json();
    const approveUrl = order.links?.find(l => l.rel === "approve")?.href;
    return res.status(200).json({ orderId: order.id, approveUrl });
  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
}
