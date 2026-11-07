// アプリのアイコン（icon-192.png・icon-512.png）を作る。生成りの相談票に、朱の「みやぶり」の判。
// 使い方: node tools/make-icons.cjs（qa/ の playwright を使う）
const path = require("path");
const { chromium } = require(path.join(__dirname, "..", "qa", "node_modules", "playwright"));
(async () => {
  const b = await chromium.launch(process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {});
  for (const s of [192, 512]) {
    const p = await b.newPage({ viewport: { width: s, height: s } });
    await p.setContent(`<body style="margin:0"><svg width="${s}" height="${s}" viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg">
      <rect width="100" height="100" fill="#f3ede0"/>
      <rect x="16" y="18" width="62" height="68" rx="5" fill="#fffdf7" stroke="#1d2b26" stroke-width="2.5"/>
      <rect x="16" y="18" width="62" height="12" rx="5" fill="#1f5c4a"/>
      <line x1="24" y1="42" x2="70" y2="42" stroke="#1d2b2655" stroke-width="3" stroke-linecap="round"/>
      <line x1="24" y1="53" x2="62" y2="53" stroke="#1d2b2655" stroke-width="3" stroke-linecap="round"/>
      <line x1="24" y1="64" x2="54" y2="64" stroke="#1d2b2655" stroke-width="3" stroke-linecap="round"/>
      <g transform="rotate(-12 68 68)"><circle cx="68" cy="68" r="19" fill="#fff8" stroke="#b23a24" stroke-width="3.5"/>
      <text x="68" y="74" font-size="17" text-anchor="middle" fill="#b23a24" font-family="'Noto Sans CJK JP',sans-serif" font-weight="900">見抜</text></g></svg></body>`);
    await p.screenshot({ path: path.join(__dirname, "..", `icon-${s}.png`), clip: { x: 0, y: 0, width: s, height: s } });
  }
  await b.close();
})();
