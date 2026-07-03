const TRADE_API_BASE = "https://www.pathofexile.com/api/trade2";
const ALLOWED_METHODS = new Set(["GET", "POST", "OPTIONS"]);

module.exports = async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET,POST,OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "content-type,accept");
  res.setHeader("Cache-Control", "no-store");

  if (req.method === "OPTIONS") {
    res.status(204).end();
    return;
  }

  if (!ALLOWED_METHODS.has(req.method)) {
    res.status(405).json({ error: "Method not allowed" });
    return;
  }

  const path = Array.isArray(req.query.path) ? req.query.path.join("/") : req.query.path;
  if (!path) {
    res.status(400).json({ error: "Missing trade API path" });
    return;
  }

  const query = new URLSearchParams(req.query);
  query.delete("path");
  const target = `${TRADE_API_BASE}/${path}${query.size ? `?${query}` : ""}`;

  try {
    const upstream = await fetch(target, {
      method: req.method,
      headers: {
        accept: req.headers.accept || "application/json",
        "content-type": req.headers["content-type"] || "application/json",
        "user-agent": "poe2-flipper-trade-proxy"
      },
      body: req.method === "POST" ? (typeof req.body === "string" ? req.body : JSON.stringify(req.body || {})) : undefined
    });

    const contentType = upstream.headers.get("content-type") || "application/json";
    res.status(upstream.status);
    res.setHeader("Content-Type", contentType);
    res.send(await upstream.text());
  } catch (error) {
    res.status(502).json({ error: "Trade API proxy failed", detail: error.message });
  }
};
