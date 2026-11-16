const crypto = require("crypto");
const { getDb } = require("../lib/db");
const config = require("../lib/config");

const WAIT = Math.max(0, Number(config.WAIT_SECONDS || 10));

function sign(code, ts) {
  return crypto
    .createHmac("sha256", String(config.SESSION_SECRET))
    .update(`${code}.${ts}`)
    .digest("hex")
    .slice(0, 32);
}

function safeEqual(a, b) {
  const x = Buffer.from(String(a));
  const y = Buffer.from(String(b));
  return x.length === y.length && crypto.timingSafeEqual(x, y);
}

function notFound(res) {
  res.status(404).setHeader("Content-Type", "text/html; charset=utf-8");
  return res.send(
    '<!doctype html><meta name="viewport" content="width=device-width,initial-scale=1">' +
    '<body style="font-family:system-ui;text-align:center;padding:60px 16px">' +
    '<h2>Link not found or expired</h2><p>Please go back and try again.</p></body>'
  );
}

function page(code, ts, sig) {
  const adHead = config.AD_HEAD || "";
  const adTop = config.AD_TOP || "";
  const adBottom = config.AD_BOTTOM || "";

  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex">
<title>Please wait...</title>
${adHead}
<style>
:root{--bg:#f5f6f8;--card:#fff;--text:#1b1f27;--muted:#6b7280;--accent:#1a6dff;--off:#b9c4d6}
@media(prefers-color-scheme:dark){:root{--bg:#12151b;--card:#1b2029;--text:#e8ebf0;--muted:#98a1b0;--accent:#4d8dff;--off:#3a4455}}
*{box-sizing:border-box}body{margin:0;min-height:100vh;background:var(--bg);color:var(--text);
font-family:system-ui,-apple-system,"Segoe UI",Roboto,sans-serif;display:flex;flex-direction:column;
align-items:center;padding:16px;gap:16px}.card{width:100%;max-width:440px;background:var(--card);
border-radius:14px;padding:28px 22px;text-align:center}h1{font-size:1.15rem;margin:0 0 6px}
p{margin:0 0 18px;color:var(--muted);font-size:.95rem}#count{font-size:3rem;font-weight:700;
line-height:1;margin:6px 0 18px}button{width:100%;border:0;border-radius:10px;padding:14px;
font-size:1rem;font-weight:600;color:#fff;background:var(--accent);cursor:pointer}
button:disabled{background:var(--off);cursor:not-allowed}.ad{width:100%;max-width:440px;text-align:center;overflow:hidden}
</style>
</head>
<body>
<div class="ad">${adTop}</div>
<div class="card">
<h1>Your link is almost ready</h1>
<p>Please wait for the timer to finish.</p>
<div id="count">${WAIT}</div>
<button id="go" disabled>Please wait...</button>
</div>
<div class="ad">${adBottom}</div>
<script>
(function(){
  var left=${WAIT}, c=document.getElementById('count'), b=document.getElementById('go');
  var href='/api/go?code=${code}&t=${ts}&s=${sig}';
  var timer=setInterval(function(){
    left--;
    if(left<=0){clearInterval(timer);c.textContent='0';b.disabled=false;b.textContent='Continue';}
    else c.textContent=left;
  },1000);
  b.addEventListener('click',function(){if(!b.disabled) location.href=href;});
})();
</script>
</body>
</html>`;
}

module.exports = async (req, res) => {
  try {
    const code = String(req.query.code || "");
    if (!/^[A-Za-z0-9]{4,32}$/.test(code)) {
      return notFound(res);
    }

    const db = await getDb();
    const links = db.collection("links");
    const doc = await links.findOne({ _id: code });

    if (!doc) return notFound(res);

    res.setHeader("Cache-Control", "no-store");

    const { t, s } = req.query;

    if (t && s) {
      const ts = Number(t);
      const age = (Date.now() - ts) / 1000;

      const valid =
        Number.isFinite(ts) &&
        safeEqual(sign(code, ts), String(s)) &&
        age >= Math.max(0, WAIT - 1) &&
        age <= 900;

      if (!valid) {
        res.writeHead(302, { Location: `/${code}` });
        return res.end();
      }

      await links.updateOne({ _id: code }, { $inc: { clicks: 1 } });

      res.writeHead(302, { Location: doc.url });
      return res.end();
    }

    const ts = Date.now();
    res.status(200).setHeader("Content-Type", "text/html; charset=utf-8");
    return res.send(page(code, ts, sign(code, ts)));
  } catch (err) {
    console.error(err);
    res.status(500).send("Server error");
  }
};
