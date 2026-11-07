// 悪質商法みやぶりの検査。問題のデータ（形・字数・出典・答えが選び肢にある）・日付の問題（日数の数え方を別の数え方で確かめる）・
// 今日の5件と上級の組み方（3年分）・通しで遊ぶ・まちがい・ヒント・続きから・上級・練習・おさらい・とことん（何百回）・手口帳・実績・
// カレンダー・あとから・古いタブ・スマホ幅・PWA・引き継ぎコード・見やすさを確かめる。
// 使い方: node qa/run.mjs   失敗があれば終了コード 1。結果は qa-report/report.md。
import { chromium } from "playwright";
import { mkdirSync, writeFileSync, readFileSync, existsSync } from "node:fs";
import { createRequire } from "node:module";
import { createServer } from "node:http";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { checkTransfer } from "./transfer-check.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const results = [];
const check = (name, ok, detail = "") => results.push({ name, ok: !!ok, detail: String(detail).slice(0, 400) });
const G = createRequire(import.meta.url)(path.join(root, "data.js"));
const len = (s) => [...String(s)].length;

// ---- 1. 問題のデータ（ブラウザを使わない）----
{
  const bad = [];
  for (const t of G.TE) {
    if (!t.id || !t.name || !t.lead || !t.tip || !t.src.length || t.src.some((k) => !G.SRC[k])) bad.push(t.id + " 形");
    if (t.alt.length < 2 || t.alt.some((a) => !G.BYTE[a] || a === t.id)) bad.push(t.id + " まぎらわしい手口");
    if (len(t.lead) > 60 || len(t.tip) > 60 || len(t.co || "") > 60) bad.push(t.id + " 説明が60字より長い");
  }
  check(`手口は${G.TE.length}つ。どれも説明・断り方・出典があり、60字以内`, G.TE.length >= 12 && bad.length === 0, bad.join(","));
}
{
  const bad = [], ids = new Set();
  for (const c of G.CASES) {
    if (ids.has(c.id)) bad.push(c.id + " 同じid"); ids.add(c.id);
    if (!G.BYTE[c.t] || !G.PEOPLE[c.p]) bad.push(c.id + " 手口・人");
    if (len(c.s) > 80) bad.push(`${c.id} 話${len(c.s)}字`);
    if (c.o.length !== 3 || new Set(c.o).size !== 3 || c.o.some((o) => len(o) > 30)) bad.push(c.id + " 選び肢（3つ・30字以内）");
    if (len(c.why) > 80 || len(c.look) > 30) bad.push(c.id + " 理由80字・ヒント30字");
  }
  for (const j of G.JUDGE) {
    if (ids.has(j.id)) bad.push(j.id + " 同じid"); ids.add(j.id);
    if (typeof j.y !== "boolean" || len(j.s) > 80 || len(j.why) > 80 || len(j.look) > 30 || (j.te && !G.BYTE[j.te])) bad.push(j.id + " 判断の形");
  }
  check(`相談${G.CASES.length}件・判断${G.JUDGE.length}件：話80字・選び肢30字・理由80字・ヒント30字以内（やさしい日本語。一文を短く）`, bad.length === 0, bad.join(","));
  const each = G.TE.filter((t) => G.CASES.filter((c) => c.t === t.id).length < 2).map((t) => t.id);
  check("どの手口にも相談が2件以上（手口帳を全部集められる）", each.length === 0, each.join(","));
  const yn = G.JUDGE.filter((j) => j.y).length;
  check("できる・できないの判断は、どちらも3割以上（当て推量で取れない）", yn / G.JUDGE.length >= 0.3 && yn / G.JUDGE.length <= 0.7, `${yn}/${G.JUDGE.length}`);
  const h = [G.CASES.filter((c) => c.h).length, G.JUDGE.filter((j) => j.h).length];
  check("上級の相談・判断がそれぞれ5件以上", h[0] >= 5 && h[1] >= 5, h.join(","));
}
{
  // 全部の札を作り、正解が選び肢にある・選び肢が重ならない・同じ札で同じ問題
  const bad = [];
  for (const t of G.pool("all")) {
    const P = G.make(t);
    if (!G.ok(t)) bad.push(t + " ok");
    if (!(P.ans >= 0 && P.ans < P.opts.length) || new Set(P.opts).size !== P.opts.length) bad.push(t + " 選び肢");
    if (P.type === "a" && P.opts[P.ans] !== G.CASES.find((c) => c.id === t.slice(2)).o[0]) bad.push(t + " 正解がずれる");
    if (P.type === "n" && P.opts[P.ans] !== G.BYTE[P.te].name) bad.push(t + " 手口の正解");
    if (JSON.stringify(G.make(t)) !== JSON.stringify(P)) bad.push(t + " 同じにならない");
    if (/undefined|NaN|null/.test(JSON.stringify([P.s, P.q, P.opts, P.why, P.look, P.title, P.nm]))) bad.push(t + " 空");
  }
  const pos = [0, 0, 0]; G.pool("a").forEach((t) => pos[G.make(t).ans]++);
  check("全部の問題で、正解が選び肢にあり・選び肢が重ならず・同じ札で同じ問題になる", bad.length === 0, bad.slice(0, 5).join(","));
  check("どうする？の正解の位置がかたよらない（A・B・Cどれも2割以上）", pos.every((n) => n >= G.CASES.length * 0.2), pos.join(","));
  check("練習・とことんで出る問題が300種類以上（日付の問題を入れて）", G.pool("all").length + 6 * 700 >= 300 && G.pool("all").length >= 90, G.pool("all").length);
}
{
  // 日付の問題：受け取った日を1日目に数えて N 日目。別の数え方（1日ずつ足す）で確かめる
  const bad = [];
  for (let s = 0; s < 3000; s++) {
    const t = G.dateTag(s * 104729 + 7), P = G.make(t), co = G.CO[+t.split(":")[1]];
    let d = P.cal.start; for (let i = 1; i < co.days; i++) d = new Date(Date.parse(d) + 864e5).toISOString().slice(0, 10);
    const want = `${+d.slice(5, 7)}月${+d.slice(8, 10)}日`;
    if (!P.opts[P.ans].startsWith(want)) bad.push(`${t}: ${P.opts[P.ans]} ≠ ${want}`);
    if (P.opts.length !== 4 || new Set(P.opts).size !== 4) bad.push(t + " 選び肢4つ");
    if (!G.ok(t)) bad.push(t + " ok");
  }
  check("日付の問題3000問：最後の日は「受け取った日＝1日目」で数えた日（別の数え方と同じ）・選び肢4つ", bad.length === 0, bad.slice(0, 3).join(","));
  check("日数は 8日（訪問販売・電話勧誘・エステ等・訪問購入）と 20日（マルチ・内職商法）", G.CO.map((c) => c.days).join() === "8,8,8,8,20,20");
}
{
  check("札の確かめ：形のちがう札・無い相談は通さない", ["a:zz", "n:tk5", "j:j99", "d:9:1", "d:1:x", "a:tk1:1", "constructor", 5, "n:__proto__"].every((t) => !G.ok(t)) && G.ok("d:3:12") && G.ok("n:tk1"));
}
{
  // 今日の5件・上級の組み方（3年分）
  const bad = [], cover = new Set(); let sameAsPrev = 0, prev = "";
  const d0 = Date.parse("2026-11-07");
  for (let i = 0; i < 365 * 3; i++) {
    const d = new Date(d0 + i * 864e5).toISOString().slice(0, 10), dl = G.dailyTags(d), hl = G.hardTags(d);
    const kinds = dl.map((t) => t[0]).join(""), ids = dl.filter((t) => !t.startsWith("d:")).map((t) => t.split(":")[1]);
    if (dl.length !== 5 || kinds !== "nadaj" || new Set(ids).size !== 4 || !dl.every(G.ok)) bad.push(d + " 今日");
    if (hl.length !== 3 || hl.map((t) => t[0]).join("") !== "ajd" || !hl.every(G.ok) || hl.some((t) => !t.startsWith("d:") && ids.includes(t.split(":")[1])) || G.CO[+hl[2].split(":")[1]].days !== 20) bad.push(d + " 上級");
    if (JSON.stringify(dl) !== JSON.stringify(G.dailyTags(d))) bad.push(d + " 同じにならない");
    if (dl.join() === prev) sameAsPrev++; prev = dl.join();
    if (i < 30) dl.forEach((t) => { const P = G.make(t); if (P.te) cover.add(P.te); });
  }
  check("今日の5件（手口は？・どうする？・最後の日・どうする？・できる？、同じ相談を重ねない）と上級（今日と重ねない・20日の取引）を3年分作れる", bad.length === 0, bad.slice(0, 5).join(","));
  check("1か月のうちに手口が10以上出る・前の日と同じ組の日が無い", cover.size >= 10 && sameAsPrev === 0, `${cover.size}・${sameAsPrev}`);
  // 2週間のうちに同じ「どうする？」が戻らない
  const seen = []; let rep = 0;
  for (let i = 0; i < 365; i++) { const d = new Date(d0 + i * 864e5).toISOString().slice(0, 10), a = G.dailyTags(d).filter((t) => t.startsWith("a:")); for (const t of a) { if (seen.slice(-28).includes(t)) rep++; seen.push(t); } }
  check("どうする？の相談は2週間のうちに同じものが戻らない", rep === 0, rep);
}

// ---- 2. ファイルの中身 ----
const html = readFileSync(path.join(root, "index.html"), "utf8"), data = readFileSync(path.join(root, "data.js"), "utf8"), readme = readFileSync(path.join(root, "README.md"), "utf8");
const ext = [...html.matchAll(/(?:src|href)="(https?:[^"]+)"/g)].map((m) => m[1]).filter((u) => !/^https:\/\/fonts\.googleapis\.com(\/|$)|^https:\/\/ko-fi\.com\/satouaaaaa$/.test(u));
check("外から読むのは文字（Google Fonts）だけ。スクリプト・広告・解析を入れない", ext.length === 0 && ![...html.matchAll(/<script[^>]+src="([^"]+)"/g)].some((m) => /^https?:/.test(m[1])), ext.join(","));
check("出典はすべて公的機関（国・自治体・警察）のページ", Object.values(G.SRC).every(([, u]) => /^https:\/\/www\.([a-z-]+\.)*(go|lg)\.jp\/|^https:\/\/www\.(pref|city)\.[a-z]+(\.[a-z]+)?\.jp\//.test(u)));
check("CSP で通信先を自分だけにしている", /connect-src 'self'/.test(html) && !/connect-src[^;"]*https/.test(html));
check("Math.random は練習・とことんだけ（今日の5件・上級は日付の乱数。data.js には無い）", (html.match(/Math\.random/g) || []).length === 5 && !/Math\.random/.test(data));
check("乱数は sort の比較の中で引かない（ブラウザで引く回数が変わる）", !/\.sort\(\s*\([^)]*\)\s*=>[^\n;]*\b(R|rng|rand|Math\.random)\s*\(/.test(html + data));
check("一行の式の途中にコメント // を足さない（行の残りが消える。rosen-hitofude 2026-11-04）", !/;\s*\/\/[^\n]*;\s*\w/.test(data.split("\n").filter((l) => !l.trim().startsWith("//")).join("\n")));
check("法律相談にしない：「このゲームについて」に法律相談ではないこと・188・出典がある", /法律相談ではありません/.test(html) && /188/.test(html) && /法律相談/.test(readme));
check("チケット・回数制限・🔒で開くモードを入れない（好きなだけ遊べる）", !/🎫|チケット|🔒|すると開く|あとで開く|スタミナ|回復まで/.test(html));
check("画面にお笑いの言葉を入れない（本物っぽく）", !/お笑い|ギャグ|ツッコミ|なんでやねん|（うそ）|ｗｗ/.test(html + data));
check("実在の会社名・人名・ブランドを出さない（人物は名字＋年代だけ）", !/株式会社|有限会社|Amazon|楽天|メルカリ|LINEヤフー/.test(data));
check("引き継ぎ：transfer.js をゲームの script より前に、このゲームの記録のキーだけで読む", /<script src="transfer\.js" data-game="akushitsu-miyaburi" data-keys="miyaburi-v1"><\/script>\s*<\/head>/.test(html) && html.indexOf('src="transfer.js"') < html.indexOf('src="data.js"') && /data-hk/.test(html) && existsSync(path.join(root, "transfer.js")));
{ const og = (k) => (html.match(new RegExp(`<meta (?:property|name)="${k}" content="([^"]+)"`)) || [])[1] || "";
  const png = readFileSync(path.join(root, "og.png"));
  check("SNS で貼ると絵と題が出る（OGP・1200×630・絶対URL）", og("og:title") && og("og:description") && og("og:image") === "https://satou-aaaaa.github.io/akushitsu-miyaburi/og.png" && og("twitter:card") === "summary_large_image" && png.readUInt32BE(16) === 1200 && png.readUInt32BE(20) === 630); }
{ const fy = readFileSync(path.join(root, ".github/ISSUE_TEMPLATE/feedback.yml"), "utf8");
  check("感想フォームの name が3字以上（2字だとフォームが出ない。shared-workflows incidents/2026-11-05-feedback-form-not-shown.md）", [...((fy.match(/^name:\s*(.+)$/m) || [])[1] || "").trim()].length >= 3);
  check("感想フォームは名前・メールを聞かない", /id: fun/.test(fy) && !/id: (name|email|mail)/.test(fy) && /labels: \["感想"\]/.test(fy)); }
check("README の URL のすぐ後ろに全角の字を続けない（Link check が URL の一部と読む）", !/https?:\/\/[\x21-\x7e]*[^\x00-\x7f]/.test(readme.replace(/\]\(https?:\/\/[^)\s]+\)/g, "").replace(/<https?:\/\/[^>\s]+>/g, "")));
{ const sw = readFileSync(path.join(root, "sw.js"), "utf8"), mf = JSON.parse(readFileSync(path.join(root, "manifest.webmanifest"), "utf8"));
  const shell = JSON.parse(sw.match(/SHELL = (\[[^\]]+\])/)[1]);
  check("PWA：sw.js は画面のファイルを全部保存し（引き継ぎの transfer.js も）、取り直して入れ、外へ何も送らない", ["./index.html", "./data.js", "./transfer.js", "./manifest.webmanifest", "./icon-192.png", "./icon-512.png"].every((f) => shell.includes(f)) && /cache: "reload"/.test(sw) && !/https?:\/\//.test(sw.replace(/^\/\/.*$/gm, "")));
  check("PWA：manifest にアイコン2つと名前がある", mf.name === "悪質商法みやぶり" && mf.icons.length >= 2 && mf.start_url === "./"); }

// ---- 3. ブラウザで遊ぶ ----
const TYPES = { ".html": "text/html; charset=utf-8", ".js": "text/javascript; charset=utf-8", ".png": "image/png", ".webmanifest": "application/manifest+json" };
const server = createServer((req, res) => {
  const p = decodeURIComponent(new URL(req.url, "http://x").pathname), f = path.join(root, p === "/" ? "index.html" : p);
  if (!f.startsWith(root) || !existsSync(f)) { res.writeHead(404); return res.end(); }
  res.writeHead(200, { "content-type": TYPES[path.extname(f)] || "application/octet-stream" }); res.end(readFileSync(f));
}).listen(0);
const url = `http://127.0.0.1:${server.address().port}/`;
const browser = await chromium.launch(process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {});
const errors = [];
const TODAY = new Date(Date.now() + 9 * 3600e3).toISOString().slice(0, 10);
const dayBefore = (n) => new Date(Date.parse(TODAY) - n * 864e5).toISOString().slice(0, 10);
async function newPage(w = 390, ctx) {
  const c = ctx || await browser.newContext({ viewport: { width: w, height: 800 } });
  await c.route(/fonts\.(googleapis|gstatic)\.com/, (r) => r.abort());
  const p = await c.newPage();
  p.on("pageerror", (e) => errors.push(e.message));
  p.on("console", (m) => { if (m.type() === "error" && !/ERR_FAILED|net::/.test(m.text())) errors.push(m.text()); });
  await p.goto(url); await p.waitForTimeout(200);
  return p;
}
const closeHow = async (p) => { if (await p.locator("#howto[open]").count()) await p.click("#howto-ok"); };
const ansIdx = (p) => p.evaluate(() => __mb.cur().P.ans);
const wrongIdx = (p) => p.evaluate(() => { const c = __mb.cur(); return c.P.opts.findIndex((_, j) => j !== c.P.ans && !c.wrong.includes(j)); });
const mem = (p) => p.evaluate(() => JSON.parse(localStorage.getItem("miyaburi-v1") || "{}"));
async function solve(p, { wrong = 0 } = {}) {
  for (let i = 0; i < wrong; i++) await p.click(`.ch[data-j="${await wrongIdx(p)}"]`);
  await p.click(`.ch[data-j="${await ansIdx(p)}"]`);
  await p.waitForSelector(".verdict");
}

try {
  const p = await newPage();
  check("はじめて開くと遊び方が出る", await p.locator("#howto[open]").count() === 1);
  await p.click("#howto-ok");
  check("ホームに今日の心得と、こまったときの 188 が出る", (await p.textContent("#tip")).includes("今日の心得") && (await p.textContent(".help")).includes("188"));
  check("はじめての日から上級・とことん・練習を押せる（鍵なし）", await p.locator("#go-h:not([disabled])").count() === 1 && await p.locator("#go-e:not([disabled])").count() === 1 && await p.locator("#go-p:not([disabled])").count() === 1);

  // 今日の5件：1件目はまちがえる、2件目はヒント2回、ほかはそのまま
  await p.click("#go-d");
  const tags = await p.evaluate(() => __mb.load().runs.d.list);
  check("今日の5件は日付から決まる（data.js の dailyTags と同じ）", JSON.stringify(tags) === JSON.stringify(G.dailyTags(TODAY)));
  check("相談の画面：人・話の吹き出し・問い・選び肢（高さ44px以上）", await p.locator(".ava").count() === 1 && (await p.textContent(".bubble")).length > 10 && (await p.$$eval(".ch", (b) => b.map((x) => x.getBoundingClientRect().height))).every((h) => h >= 44));
  await p.click(`.ch[data-j="${await wrongIdx(p)}"]`);
  check("まちがえると ✕ の印と「ちがう」の文字（色だけで分けない）・知らせは role=status", await p.locator(".ch.ng").count() === 1 && (await p.evaluate(() => getComputedStyle(document.querySelector(".ch.ng"), "::after").content)).includes("ちがう") && (await p.textContent("#msg")).includes("ちがいます") && await p.getAttribute("#msg", "role") === "status");
  check("まちがえた問題はおさらいに入る", (await mem(p)).miss.includes(tags[0]));
  await p.reload(); await p.waitForTimeout(150); await p.click("#go-d");
  check("途中で閉じても続きから（同じ問題・まちがえた印のまま）", await p.locator(".ch.ng").count() === 1 && await p.evaluate(() => __mb.cur().i) === 0);
  await solve(p);
  check("正解すると ✓ の印・理由・手口の説明・判・★2（まちがい1回）", await p.locator(".ch.ok").count() === 1 && (await p.textContent(".verdict .why")).length > 8 && await p.locator(".verdict .te").count() === 1 && await p.locator(".seal").count() === 1 && (await p.getAttribute(".verdict .stars", "aria-label")) === "星2つ");
  await p.click("#next");
  await p.click("#hint");
  check("ヒント1は見るところを言う（選び肢は消さない）", (await p.textContent("#hintbox")).includes("💡") && await p.locator(".ch.ng").count() === 0);
  await p.click("#hint");
  check("ヒント2はまちがいの選び肢を1つ消す・ヒントは2回まで", await p.locator(".ch.ng").count() === 1 && await p.locator("#hint:disabled").count() === 1);
  await solve(p);
  check("ヒント2回は★1", (await p.getAttribute(".verdict .stars", "aria-label")) === "星1つ");
  await p.click("#next");
  // 3件目は日付の問題：カレンダーが出て、答えると数えた日に番号
  check("日付の問題はカレンダーと「受」の印・選び肢4つ", await p.locator("#mcal .st").count() === 1 && await p.locator(".ch").count() === 4);
  await solve(p);
  const nIn = await p.locator("#mcal .in").count(), nLast = await p.locator("#mcal .last").count();
  check("日付の問題に答えると、受け取った日から最後の日まで番号が付く", nIn + nLast + 1 === G.make(tags[2]).cal.days && nLast === 1, `${nIn}+${nLast}`);
  await p.click("#next");
  for (let i = 3; i < 5; i++) { await solve(p); await p.click("#next"); }
  await p.waitForTimeout(150);
  const s1 = await mem(p);
  check("5件で結果：今日の記録に1件ごとのまちがい（1・2・0・0・0）", JSON.stringify(s1.days[TODAY]?.m) === "[1,2,0,0,0]");
  const share = await p.textContent(".share");
  check("シェアの文に相談の中身・答えを出さない（印だけ）", /第\d+回/.test(share) && /🟢/.test(share) && !G.TE.some((t) => share.includes(t.name)) && !/クーリング|月\d+日/.test(share), share);
  check("まちがいのある日は Ko-fi の一言を出さない", await p.locator(".kofi").count() === 0);
  check("結果に「今日覚えたこと」・あと少しの実績・続けて遊ぶ・上級", await p.locator(".rlist div").count() === 5 && await p.locator("#achnext").count() === 1 && await p.locator("#go-e").count() === 1 && await p.locator("#go-h").count() === 1);
  check("手口帳に見抜いた手口が載る・クーリング・オフの問題を数える", Object.keys(s1.dex).length >= 2 && s1.co >= 2);
  await p.click("#back");
  check("今日を終えたら、ホームは「今日の結果を見る」", (await p.textContent("#go-d")).includes("結果"));
  // 上級：ヒントなし・3件
  await p.click("#go-h");
  check("上級はヒントのボタンが無い・3件", await p.locator("#hint").count() === 0 && (await p.evaluate(() => __mb.load().runs.h.list.length)) === 3);
  for (let i = 0; i < 3; i++) { await solve(p); await p.click("#next"); }
  await p.waitForTimeout(150);
  check("上級の記録は hdays に入る", (await mem(p)).hdays[TODAY]?.m.length === 3);
  // 練習：記録を増やさない
  await p.click("#back"); await p.click("#go-p"); await p.click('.lv button[data-c="co"]');
  const before = await mem(p);
  check("練習のクーリング・オフは、できる？と日付の問題だけ", (await p.evaluate(() => __mb.load().runs.p.list)).every((t) => /^[jd]:/.test(t)));
  for (let i = 0; i < 5; i++) { await solve(p); await p.click("#next"); }
  await p.waitForTimeout(150);
  const after = await mem(p);
  check("練習は今日の記録を増やさない（クーリング・オフの数はふえる）", JSON.stringify(after.days) === JSON.stringify(before.days) && after.co === before.co + 5);
  // おさらい：一度で正解すると外れる
  await p.click("#back"); await p.click("#go-p");
  check("おさらいのボタンが出る", await p.locator('.lv button[data-c="miss"]').count() === 1);
  await p.click('.lv button[data-c="miss"]'); await solve(p);
  check("おさらいで一度で正解すると、おさらいから外れる", !(await mem(p)).miss.includes(tags[0]));
  // 手口帳：説明と出典、その手口だけで練習
  await p.goto(url); await p.waitForTimeout(150); await p.click("#go-dex");
  const te = await p.getAttribute(".book button", "data-t");
  await p.click(".book button");
  check("手口帳を押すと、どんな手口・こうする・出典（公的機関のリンク）", (await p.textContent("#tecard")).includes("こうする") && await p.locator("#tecard a").count() >= 1);
  await p.click("#go-tp");
  check("手口帳から、その手口だけで練習", await p.evaluate((te) => __mb.load().runs.p.list.every((t) => __mb.G.make(t).te === te), te));
  // とことん：まちがえても続く・ここで降りる・一度で正解した数が自己ベスト
  await p.goto(url); await p.waitForTimeout(150); await p.click("#go-e");
  check("とことんにチケット・残りの数が無い", !/🎫|のこり|残り/.test(await p.textContent("header")));
  await solve(p); await p.click("#next"); await solve(p); await p.click("#next");
  await solve(p, { wrong: 1 }); await p.click("#next");
  await p.click(`.ch[data-j="${await wrongIdx(p)}"]`);
  check("とことんはまちがえても終わらない", await p.locator(".verdict").count() === 0 && await p.locator(".ch").count() >= 2 && await p.locator("#quit").count() === 1);
  await p.click("#quit"); await p.waitForTimeout(150);
  check("「ここで降りる」で終わり、一度で正解した数（2件）が自己ベスト", (await mem(p)).ebest === 2 && (await p.textContent("#eres")).includes("2件"));
  {
    // 古いタブで終えた回を、別のタブがもう一度終えても書き戻さない
    const q = await newPage(); await closeHow(q);
    await q.evaluate(() => { const s = __mb.load(); s.ebest = 2; s.edone = ["old1"]; s.runs.e = { mode: "e", date: __mb.todayKey(), list: __mb.endlessList(), res: [{ m: 0 }], cur: null, first: 9, miss: 0, id: "old1" }; localStorage.setItem("miyaburi-v1", JSON.stringify(s)); });
    await q.reload(); await q.waitForTimeout(150); await q.click("#go-e"); await q.click("#quit"); await q.waitForTimeout(150);
    check("別のタブで終えたとことんの回は、自己ベストに書き戻さない", (await mem(q)).ebest === 2);
    await q.context().close();
  }
  {
    // 記録の形を直す：数の所の文字・壊れた途中経過・札を HTML として出さない
    const q = await newPage(); await closeHow(q);
    await q.evaluate(() => { const s = JSON.parse(localStorage.getItem("miyaburi-v1")) || { v: 1 }; s.ebest = '<img id="xss" src=x>'; s.co = "x"; s.dex = { tenken: '"><b id="xss2">', zzz: 3 }; s.miss = ['"><i id="xss3">', "a:tk1"]; s.runs = { e: { mode: "e", id: "x", date: "2026-11-07", list: ['<b id="xss4">'], res: [] }, h: { list: "bad", res: [] }, d: { mode: "d", id: "z", date: "x", list: ["a:tk1"], res: [] }, p: { mode: "p", id: "y", date: "2026-11-07", list: ["a:tk1", "j:j1"], res: [{ m: 0 }], cur: { i: 1, tag: "j:j1", wrong: "x", hints: 0 } } }; s.days = { "2026-11-07": { m: "x" }, bad: { m: [0] }, "2026-02-30": { m: [0] } }; localStorage.setItem("miyaburi-v1", JSON.stringify(s)); });
    await q.reload(); await q.waitForTimeout(250);
    const st = await q.evaluate(() => __mb.load());
    check("記録の形を直す：数の所の文字は0に・知らない手口と壊れた途中経過・日ごとの記録は捨てる", st.ebest === 0 && st.co === 0 && st.dex.tenken === 0 && !("zzz" in st.dex) && JSON.stringify(st.miss) === '["a:tk1"]' && !("e" in st.runs) && !("h" in st.runs) && !("d" in st.runs) && st.runs.p && st.runs.p.cur === null && Object.keys(st.days).length === 0);
    await q.click("#go-dex").catch(() => {}); await q.waitForTimeout(150);
    check("記録の文字を HTML として出さない", await q.locator("#xss, #xss2, #xss3, #xss4").count() === 0);
    await q.context().close();
  }
  // 実績・このゲームについて
  await p.goto(url); await p.waitForTimeout(150); await p.click("#go-ach");
  check("実績は14個で、腕前・集める・続けるの3つの組・まだのものは いま/目標", await p.locator(".ach").count() === 14 && await p.locator(".agrp").count() === 3 && await p.locator(".ach.got").count() >= 3 && await p.locator(".ach:not(.got) .bar").count() >= 5);
  check("達成した実績は ✓ の文字も付く（色だけで分けない）", (await p.textContent(".ach.got b")).startsWith("✓"));
  await p.click("#back"); await p.click("#f-about");
  check("このゲームについて：法律相談ではないこと・188・出典", (await p.textContent("#about")).includes("法律相談ではありません") && await p.locator("#about a").count() >= 5);
  await p.context().close();

  // まちがいなしの日は Ko-fi を1回だけ
  {
    const q = await newPage(); await closeHow(q); await q.click("#go-d");
    for (let i = 0; i < 5; i++) { await solve(q); await q.click("#next"); }
    await q.waitForTimeout(150);
    check("全部一度で正解して初めて終えたときだけ Ko-fi の一言", await q.locator(".kofi").count() === 1 && (await q.textContent(".big")).includes("全部見抜きました"));
    await q.click("#back"); await q.click("#go-d");
    check("結果をもう一度見ても Ko-fi は出さない", await q.locator(".kofi").count() === 0);
    await q.context().close();
  }
  // 遊ぶ前・途中に Ko-fi の一言を出さない
  {
    const q = await newPage(); await closeHow(q);
    const a = await q.locator(".kofi").count(); await q.click("#go-d"); const b = await q.locator(".kofi").count();
    check("遊ぶ前・途中には Ko-fi の一言を出さない（下のリンクだけ）", a === 0 && b === 0);
    await q.context().close();
  }

  // カレンダー・あとから：過去の日の記録を置いて見る
  {
    const q = await newPage();
    await q.evaluate(([d2, d3]) => { localStorage.setItem("miyaburi-v1", JSON.stringify({ v: 1, tut: true, days: { [d2]: { m: [0, 0, 0, 0, 0] }, [d3]: { m: [1, 0, 0, 2, 0] } }, hdays: {}, adays: {}, dex: {}, co: 0, miss: [], runs: {}, kofi: {}, ach: {}, ebest: 0, edone: [] })); }, [dayBefore(2), dayBefore(3)]);
    await q.reload(); await q.waitForTimeout(150);
    check("ホームの「続けて」は、きのうを休んだら — （休んだ日を責めない）", (await q.textContent(".stats")).includes("—"));
    await q.click("#go-cal");
    const lateList = await q.evaluate(() => __mb.lateDays(__mb.load()));
    const exp = [1, 4, 5, 6, 7].map(dayBefore).filter((d) => d >= "2026-11-07");
    check("カレンダー：取りこぼした過去7日（第1回より後）だけを押せる", JSON.stringify(lateList) === JSON.stringify(exp), lateList.join(","));
    if (lateList.length) {
      const d = lateList[0];
      await q.evaluate((d) => { const b = document.querySelector(`.cal .miss[data-k="${d}"]`); if (b) b.click(); else document.querySelector(".calnav #prev").click(); }, d);
      if (!(await q.locator(".ch").count())) await q.click(`.cal .miss[data-k="${d}"]`);
      check("あとから：その日の今日の5件と同じ問題", JSON.stringify(await q.evaluate((d) => __mb.load().runs["a:" + d].list, d)) === JSON.stringify(G.dailyTags(d)));
      for (let i = 0; i < 5; i++) { await solve(q); await q.click("#next"); }
      await q.waitForTimeout(150);
      const s = await mem(q);
      check("あとからは adays に入り、今日の記録・シェア・Ko-fi には数えない", s.adays[d] && !s.days[d] && (await q.locator(".share").count()) === 0 && (await q.locator(".kofi").count()) === 0);
    } else check("あとから：第1回の日（2026-11-07）より前の日は出さない", lateList.length === 0 && TODAY <= "2026-11-08");
    await q.context().close();
  }

  // 古いタブ：同じ問題を2つのタブで開き、片方で答えたら、もう片方は二重に入れない
  {
    const ctx = await browser.newContext({ viewport: { width: 390, height: 800 } });
    const a = await newPage(390, ctx); await closeHow(a); await a.click("#go-d");
    const b = await ctx.newPage(); b.on("pageerror", (e) => errors.push(e.message)); await b.goto(url); await b.waitForTimeout(150); await b.click("#go-d");
    await solve(a);
    await b.click(`.ch[data-j="${await ansIdx(b)}"]`);
    await b.waitForTimeout(200);
    const s = await mem(a);
    check("古いタブで同じ問題に答えても二重に数えない", s.runs.d.res.length === 1 && Object.values(s.dex).reduce((x, y) => x + y, 0) === 1);
    await a.click("#next"); await b.goto(url); await b.waitForTimeout(150); await b.click("#go-d");
    await a.click("#hint"); await a.click("#hint");
    await b.click("#hint");
    check("別のタブで使ったヒントの数を減らさない", (await mem(a)).runs.d.cur.hints === 2);
    await ctx.close();
  }

  // とことんの並び（何百回）：1つの並びの中で同じ問題を出さない・つなぎ目で同じ問題を続けない
  {
    const q = await newPage(); await closeHow(q);
    const r = await q.evaluate(() => { let bad = 0, joint = 0, n = 0; for (let i = 0; i < 400; i++) { const a = __mb.endlessList(), nd = a.filter((t) => !t.startsWith("d:")); n = nd.length; if (new Set(nd).size !== nd.length) bad++; const b = __mb.endlessList(a[a.length - 1]); if (b[0] === a[a.length - 1]) joint++; } return [bad, joint, n]; });
    check("とことんの並び400回：1つの並びの中で同じ問題を出さず・全部の問題を出し・つなぎ目で続けない", r[0] === 0 && r[1] === 0 && r[2] === G.pool("all").length, r.join(","));
    const pr = await q.evaluate(() => { let bad = 0; for (let i = 0; i < 300; i++) for (const c of ["n", "a", "co", "all"]) { const l = __mb.practiceList(c); if (l.length !== 5 || new Set(l).size !== 5) bad++; } return bad; });
    check("練習の5件を300回×4種類作っても、5件そろい重ならない", pr === 0, pr);
    await q.context().close();
  }

  // スマホ幅でもはみ出さない・押す所は44px以上
  {
    const bad = [], small = [];
    for (const w of [320, 390]) {
      const q = await newPage(w); await closeHow(q);
      for (const go of [null, "#go-d", "solve", "#go-cal", "#go-dex", "#go-ach", "#go-e", "#go-p"]) {
        if (go === "solve") { await solve(q); }
        else if (go) { await q.goto(url); await q.waitForTimeout(100); await q.click(go); }
        await q.waitForTimeout(100);
        const ov = await q.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
        if (ov > 0) bad.push(`${w}px ${go || "ホーム"} ${ov}px`);
        small.push(...(await q.$$eval("button:not([disabled]), a[href]", (bs) => bs.filter((b) => b.checkVisibility() && !b.closest(".cal")).filter((b) => b.getBoundingClientRect().height < 44).map((b) => (b.id || b.className || b.textContent).slice(0, 20)))).map((x) => `${w}/${go}:${x}`));
      }
      await q.context().close();
    }
    check("幅320pxでも横にはみ出さない", bad.length === 0, bad.join(" / "));
    check("押せる所は高さ44px以上", small.length === 0, [...new Set(small)].slice(0, 8).join(","));
  }
  // 画面を撮る（自分で見る）
  {
    mkdirSync(path.join(root, "qa-report"), { recursive: true });
    const q = await newPage(390); await closeHow(q);
    await q.screenshot({ path: path.join(root, "qa-report/home.png"), fullPage: true });
    await q.click("#go-d"); await q.screenshot({ path: path.join(root, "qa-report/q1.png"), fullPage: true });
    await solve(q); await q.screenshot({ path: path.join(root, "qa-report/a1.png"), fullPage: true });
    await q.click("#next"); await solve(q); await q.click("#next");
    await q.screenshot({ path: path.join(root, "qa-report/date.png"), fullPage: true });
    await solve(q); await q.screenshot({ path: path.join(root, "qa-report/date-a.png"), fullPage: true });
    await q.context().close();
  }
  // 見やすさの設定を全部入れても、ページの一番下まで動ける
  {
    const ctx = await browser.newContext({ viewport: { width: 390, height: 700 } });
    await ctx.addInitScript(() => localStorage.setItem("a11y-v1", JSON.stringify({ read: true, cvd: true, calm: true, say: true, ruby: true })));
    const q = await newPage(390, ctx); await closeHow(q);
    const r = await q.evaluate(() => { window.scrollTo(0, 1e5); const f = document.querySelector("footer").getBoundingClientRect(); return [scrollY, Math.round(f.bottom), innerHeight, getComputedStyle(document.documentElement).position]; });
    check("見やすさの設定を全部入れても、いちばん下まで動ける（html が固定されない）", r[0] > 0 && r[1] <= r[2] && r[3] === "static", r.join(","));
    await ctx.close();
  }
  // キーボードだけで遊べる（Tab と Enter）
  {
    const q = await newPage(); await closeHow(q);
    await q.focus("#go-d"); await q.keyboard.press("Enter"); await q.waitForTimeout(100);
    const j = await ansIdx(q);
    await q.focus(`.ch[data-j="${j}"]`); await q.keyboard.press("Enter"); await q.waitForTimeout(100);
    check("キーボードだけで選んで答えられる", await q.locator(".verdict").count() === 1);
    await q.context().close();
  }
} catch (e) { check("ブラウザでの検査が最後まで動く", false, e.stack.split("\n").slice(0, 3).join(" ")); }

// 引き継ぎコード（shared-workflows template/qa/transfer-check.mjs）
try {
  const sample = { "miyaburi-v1": JSON.stringify({ v: 1, tut: true, days: { "2026-11-07": { m: [0, 1, 0, 0, 2] } }, hdays: {}, adays: {}, dex: { tenken: 2, okuri: 1 }, co: 3, miss: ["a:tk1"], runs: {}, kofi: {}, ach: {}, ebest: 7, edone: [], t: 1 }) };
  await checkTransfer({ browser, url, game: "akushitsu-miyaburi", sample, check, open: async (pg) => { if (await pg.locator("#howto[open]").count()) await pg.click("#howto-ok"); } });
} catch (e) { check("引き継ぎの検査が最後まで動く", false, e.message.split("\n")[0]); }
await browser.close();
server.close();
check("画面のエラーが無い", errors.length === 0, errors.slice(0, 3).join(" | "));

{ // 見やすさ・読みやすさ・偏り（shared-workflows template/qa/a11y.mjs の写し）
  const { spawnSync } = await import("node:child_process");
  const a = spawnSync(process.execPath, [path.join(root, "qa", "a11y.mjs")], { encoding: "utf8", env: process.env });
  check("見やすさ・読みやすさの検査（qa/a11y.mjs。中身は qa-report/a11y.md）", a.status === 0, (a.stdout.match(/^- ❌.*$/gm) || []).join(" / ") || (a.status ? a.stderr.slice(-300) : ""));
}

const ng = results.filter((r) => !r.ok);
const md = `# 悪質商法みやぶり QA\n\n${results.map((r) => `- ${r.ok ? "✅" : "❌"} ${r.name}${r.detail ? `（${r.detail}）` : ""}`).join("\n")}\n\n${ng.length ? `❌ ${ng.length}件` : `✅ ${results.length}項目すべて通過`}\n`;
mkdirSync(path.join(root, "qa-report"), { recursive: true });
writeFileSync(path.join(root, "qa-report/report.md"), md);
console.log(md);
process.exit(ng.length ? 1 : 0);
