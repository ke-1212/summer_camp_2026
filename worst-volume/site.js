/* 最悪の通販サイト「ヤスイネ.com」。画面遷移・各画面・実績・タイマーを持つ。
   会員登録の手続きと共通の小道具は signup.js（window.BAD）から使う。 */
(() => {
  "use strict";

  const { $, clamp, toast, ask, listeners, mountControl, runSignup } = BAD;
  const params = new URLSearchParams(location.search);
  const ONLY = params.get("only");
  const yen = (v) => "¥" + v.toLocaleString("ja-JP");

  /* ============ 実績 ============ */
  const ACH = [
    { id: "shame",     name: "定価で買いたい人",     desc: "ポップアップを「定価で買いたい」で断った" },
    { id: "sale",      name: "永遠のタイムセール",   desc: "タイムセールが終わる瞬間を見届けた" },
    { id: "page3",     name: "3ページ目の住人",      desc: "検索結果の3ページ目に行った" },
    { id: "footer",    name: "世界の果て",           desc: "無限スクロールを止めてフッターに到達した" },
    { id: "cancel",    name: "解約したい",           desc: "解約のページを見つけた" },
    { id: "bot",       name: "話が通じない",         desc: "チャットボットに3回話しかけた" },
    { id: "unprotect", name: "保護を解除",           desc: "カートの延長保証を外した" },
    { id: "guest",     name: "ゲストの幻想",         desc: "ゲスト購入を選んだ" },
    { id: "no5",       name: "始めたくない",         desc: "会員登録を始めるかで「いいえ」を5回押した" },
    { id: "reject",    name: "送信しません",         desc: "Cookie を拒否しようとした" },
    { id: "terms",     name: "規約に押し戻された",   desc: "利用規約のスクロールを3回戻された" },
    { id: "captcha",   name: "人間の証明",           desc: "CAPTCHA を突破した" },
    { id: "shout",     name: "買いますと叫んだ",     desc: "声の大きさで本人確認を通した" },
    { id: "forced",    name: "買わされた",           desc: "余計なもの込みで注文した" },
    { id: "bought",    name: "完璧な買い物",         desc: "イヤホン BAD-01 を1つだけ、余計なもの無しで買った" }
  ];
  const ACH_KEY = "yasuine-achievements-v1";
  const loadAch = () => { try { return new Set(JSON.parse(localStorage.getItem(ACH_KEY) || "[]")); } catch (e) { return new Set(); } };
  const got = loadAch();
  const saveAch = () => { try { localStorage.setItem(ACH_KEY, JSON.stringify([...got])); } catch (e) { /* 保存できない環境では、このページを開いている間だけ覚える */ } };

  const achQueue = [];
  let achBusy = false;
  function showNextAch() {
    if (achBusy || !achQueue.length) return;
    achBusy = true;
    const box = $("achv");
    box.textContent = "🏆 実績解除: " + achQueue.shift();
    box.classList.add("on");
    setTimeout(() => { box.classList.remove("on"); setTimeout(() => { achBusy = false; showNextAch(); }, 350); }, 2400);
  }
  BAD.achieve = (id) => {
    const a = ACH.find((x) => x.id === id);
    if (!a || got.has(id)) return;
    got.add(id);
    saveAch();
    drawTrophy();
    achQueue.push(a.name);
    showNextAch();
  };
  const achieve = BAD.achieve;
  const drawTrophy = () => { $("trophy").textContent = "🏆 " + got.size + "/" + ACH.length; };

  function achListHtml() {
    return '<div class="ach-list">' + ACH.map((a) =>
      '<div class="ach' + (got.has(a.id) ? " got" : "") + '"><span>' + (got.has(a.id) ? "🏆" : "🔒") + "</span><span>" +
      (got.has(a.id) ? a.name : "？？？") + "<small>" + a.desc + "</small></span></div>").join("") + "</div>";
  }

  /* ============ ランキング ============
     保存先は config.js の window.YASUINE_RANKING_URL（Google Apps Script）。
     未設定ならこの端末の localStorage だけを使う。取得・送信はすべて非同期で、画面は待たせない。 */
  // ?rank=<URL> を付けると保存先を一時的に差し替えられる（動作確認用）
  const RANK_URL = (params.get("rank") || window.YASUINE_RANKING_URL || "").trim();
  const RANK_KEY = "yasuine-ranking-local-v1";
  const NAME_KEY = "yasuine-name";
  const readLocal = () => { try { return JSON.parse(localStorage.getItem(RANK_KEY) || "[]"); } catch (e) { return []; } };
  const writeLocal = (list) => { try { localStorage.setItem(RANK_KEY, JSON.stringify(list.slice(0, 200))); } catch (e) { /* 保存できない環境は無視 */ } };

  /** 共有ランキングが CORS で読めない環境のための JSONP */
  function jsonp(url, ms = 10000) {
    return new Promise((resolve, reject) => {
      const cb = "yasuineCb" + Date.now();
      const s = document.createElement("script");
      const timer = setTimeout(() => { cleanup(); reject(new Error("timeout")); }, ms);
      const cleanup = () => { clearTimeout(timer); delete window[cb]; s.remove(); };
      window[cb] = (data) => { cleanup(); resolve(data); };
      s.onerror = () => { cleanup(); reject(new Error("jsonp failed")); };
      s.src = url + (url.includes("?") ? "&" : "?") + "callback=" + cb;
      document.head.appendChild(s);
    });
  }

  const RANK = {
    shared: !!RANK_URL,
    cache: null, cacheAt: 0,
    /** 一覧を取る。失敗したらローカルの記録を返す */
    async list() {
      if (!RANK_URL) return { rows: readLocal(), shared: false };
      if (this.cache && performance.now() - this.cacheAt < 5000) return { rows: this.cache, shared: true };
      const url = RANK_URL + (RANK_URL.includes("?") ? "&" : "?") + "action=list";
      try {
        const ctl = new AbortController();
        const t = setTimeout(() => ctl.abort(), 10000);
        const res = await fetch(url, { signal: ctl.signal });
        clearTimeout(t);
        const rows = await res.json();
        this.cache = rows; this.cacheAt = performance.now();
        return { rows, shared: true };
      } catch (e) {
        try {
          const rows = await jsonp(url);
          this.cache = rows; this.cacheAt = performance.now();
          return { rows, shared: true };
        } catch (e2) { return { rows: readLocal(), shared: false, error: true }; }
      }
    },
    /** 記録を送る。共有に送れてもローカルには必ず残す */
    async send(rec) {
      writeLocal(readLocal().concat([rec]));
      if (!RANK_URL) return { ok: true, shared: false };
      this.cache = null;
      try {
        const ctl = new AbortController();
        const t = setTimeout(() => ctl.abort(), 10000);
        // text/plain にして、CORS のプリフライトを避ける
        await fetch(RANK_URL, { method: "POST", headers: { "Content-Type": "text/plain;charset=utf-8" }, body: JSON.stringify(rec), signal: ctl.signal });
        clearTimeout(t);
        return { ok: true, shared: true };
      } catch (e) { return { ok: false, shared: true, error: String(e) }; }
    }
  };

  // 成功者が先。時間の短い順、同じなら実績の多い順
  const rankSort = (a, b) => (b.perfect - a.perfect) || (a.sec - b.sec) || (b.achievements - a.achievements);
  const mmss = (sec) => String(Math.floor(sec / 60)).padStart(2, "0") + ":" + String(Math.floor(sec % 60)).padStart(2, "0");

  function rankTableHtml(rows, mine) {
    if (!rows.length) return '<p class="note">まだ記録がありません。</p>';
    const sorted = rows.slice().sort(rankSort);
    const myIdx = mine ? sorted.findIndex((r) => r.ts === mine.ts && r.name === mine.name) : -1;
    const show = sorted.slice(0, 10);
    if (myIdx >= 10) show.push(sorted[myIdx]);
    return '<table class="rank">' + show.map((r) => {
      const i = sorted.indexOf(r);
      return '<tr class="' + (i === myIdx ? "me" : "") + '"><td>' + (i + 1) + "</td><td>" + String(r.name || "名無し").replace(/[<>&"]/g, "").slice(0, 12) +
        (r.perfect ? "" : ' <span class="note">(余計あり)</span>') + "</td><td>" + mmss(r.sec) + "</td><td>¥" + Number(r.total || 0).toLocaleString("ja-JP") + "</td><td>🏆" + (r.achievements || 0) + "</td></tr>";
    }).join("") + "</table>";
  }

  /** ランキングを非同期で取り、box がまだ画面にあれば差し込む */
  function fillRanking(box, mine) {
    RANK.list().then(({ rows, shared, error }) => {
      if (!box.isConnected) return;   // 画面を離れていたら捨てる
      box.innerHTML = (RANK.shared && !shared ? '<p class="note">共有ランキングに接続できませんでした。この端末の記録を表示しています。</p>' :
        !RANK.shared ? '<p class="note">共有ランキング未設定のため、この端末の記録です。</p>' : "") + rankTableHtml(rows, mine);
    });
  }

  function showRanking() {
    const l = layer('<div class="pop"><h2 style="color:var(--ink);font-size:18px">ランキング</h2>' +
      '<div id="rankBox" class="note">読み込み中…</div>' +
      '<button class="btn" type="button" data-close style="margin-top:12px">閉じる</button></div>', () => l.close());
    l.root.querySelector("[data-close]").onclick = () => l.close();
    fillRanking(l.root.querySelector("#rankBox"), null);
  }

  /* ============ 商品 ============ */
  const TARGET = "bad01";
  const PRODUCTS = [
    { id: "pr1", pr: true, name: "【PR】ふわふわ高級枕「雲の上」", price: 12800, was: 38000, pic: "😴", tags: "寝具 枕" },
    { id: "pr2", pr: true, name: "【PR】浄水器 すごく浄水する", price: 24800, was: 59800, pic: "🚰", tags: "生活家電" },
    { id: "pr3", pr: true, name: "【PR】マッサージチェア お試し版", price: 98000, was: 298000, pic: "💺", tags: "健康" },
    { id: "pr4", pr: true, name: "【PR】青汁 1年分（365袋）", price: 36000, was: 72000, pic: "🥤", tags: "健康" },
    { id: "nc900", name: "ノイズキャンセリングヘッドホン NC-900", price: 39800, was: 49800, pic: "🎧", tags: "オーディオ イヤホン ヘッドホン" },
    { id: "badO1", name: "ワイヤレスイヤホン BAD-O1（オー・ワン）", price: 19800, was: 29800, pic: "🎧", tags: "オーディオ イヤホン ワイヤレス" },
    { id: "bone3", name: "骨伝導イヤホン BONE-3", price: 14800, was: 19800, pic: "🦴", tags: "オーディオ イヤホン" },
    { id: "bad01pro", name: "ワイヤレスイヤホン BAD-01 Pro", price: 12800, was: 16800, pic: "🎧", tags: "オーディオ イヤホン ワイヤレス" },
    { id: "bad10", name: "ワイヤレスイヤホン BAD-10", price: 8800, was: 12800, pic: "🎧", tags: "オーディオ イヤホン ワイヤレス" },
    { id: "wire1", name: "有線イヤホン WIRE-1", price: 4980, was: 6980, pic: "🎵", tags: "オーディオ イヤホン" },
    { id: "cable5", name: "イヤホン用 金メッキ延長ケーブル 5m", price: 3980, was: 5980, pic: "➰", tags: "オーディオ イヤホン" },
    { id: "case01", name: "ワイヤレスイヤホン BAD-01 専用ケース", price: 2480, was: 3980, pic: "👝", tags: "オーディオ イヤホン" },
    { id: "tips01", name: "イヤーピース BAD-01 用（S/M/L）", price: 2200, was: 2980, pic: "🔘", tags: "オーディオ イヤホン" },
    { id: TARGET, name: "ワイヤレスイヤホン BAD-01", price: 1980, was: 39800, pic: "🎧", tags: "オーディオ イヤホン ワイヤレス" },
    { id: "kit", name: "イヤホン用クリーニングキット", price: 480, was: 980, pic: "🧽", tags: "オーディオ イヤホン" },
    { id: "sticker", name: "BAD-01 用 ステッカー", price: 380, was: 500, pic: "🏷️", tags: "オーディオ" },
    { id: "circ", name: "サーキュレーター 強風すぎる", price: 6980, was: 9800, pic: "🌀", tags: "生活家電" },
    { id: "kettle", name: "電気ケトル 沸くのが遅い", price: 4480, was: 5980, pic: "🫖", tags: "生活家電" },
    { id: "blanket", name: "毛布 チクチクしない（当社比）", price: 3980, was: 7980, pic: "🛏️", tags: "寝具" }
  ];
  const P = (id) => PRODUCTS.find((p) => p.id === id);
  const ADDONS = { warranty: { name: "延長保証（5年）", price: 780 }, gift: { name: "ギフト包装", price: 330 }, sub: { name: "定期便（毎月お届け）", price: 0 } };

  /* ============ 状態 ============ */
  const S = {
    t0: 0, endT: 0,          // t0 は説明画面の「はじめる」で動き出す
    member: false,
    cart: [],              // { id, qty, warranty, gift, sub }
    kitAdded: false,       // カートを初めて開いたときに、頼んでいない商品を1つ足す
    popupDeclined: false,
    order: null
  };
  const lineTotal = (l) => P(l.id).price * l.qty + (l.warranty ? ADDONS.warranty.price : 0) + (l.gift ? ADDONS.gift.price : 0);
  const subtotal = () => S.cart.reduce((s, l) => s + lineTotal(l), 0);
  const cartCount = () => S.cart.reduce((s, l) => s + l.qty, 0);
  const drawBadge = () => {
    $("cartBadge").textContent = cartCount();
    $("signupBtn").textContent = S.member ? "会員" : "会員登録";
    drawMission();
  };

  function addToCart(id, qty, opts) {
    const same = S.cart.find((l) => l.id === id);
    if (same) {   // 同じ商品は数量を足す（しかもオプションは付いたほうに寄せる）
      same.qty = clamp(same.qty + qty, 1, 100);
      same.warranty = same.warranty || opts.warranty;
      same.gift = same.gift || opts.gift;
      same.sub = same.sub || opts.sub;
    } else {
      S.cart.push({ id, qty, warranty: !!opts.warranty, gift: !!opts.gift, sub: !!opts.sub });
    }
    drawBadge();
  }

  /* ============ ミッションの進み具合 ============ */
  const hasTarget = () => S.cart.find((l) => l.id === TARGET);
  const extrasInCart = () => {
    const out = [];
    S.cart.forEach((l) => {
      const p = P(l.id);
      if (l.id !== TARGET) out.push(p.name);
      else if (l.qty > 1) out.push(p.name + " が " + l.qty + " 個");
      ["warranty", "gift", "sub"].forEach((k) => { if (l[k]) out.push(ADDONS[k].name + "（" + p.name + "）"); });
    });
    return out;
  };
  const MISSION = () => [
    { label: "BAD-01 をカートに入れる", done: !!hasTarget() },
    { label: "余計なオプション・商品を外す", done: !!hasTarget() && extrasInCart().length === 0 },
    { label: "会員登録をする", done: S.member },
    { label: "注文を確定する", done: !!S.order }
  ];
  function drawMission() {
    const next = MISSION().find((m) => !m.done);
    $("missionNext").textContent = next ? "次: " + next.label : "完了！";
  }
  function showMission() {
    const extras = extrasInCart();
    const l = layer('<div class="pop" style="text-align:left"><h2 style="color:var(--ink);font-size:18px;text-align:center">ミッション</h2>' +
      '<p style="text-align:center">ワイヤレスイヤホン <b>BAD-01</b>（¥1,980）を <b>1つだけ</b> 買う</p>' +
      '<div class="ach-list">' + MISSION().map((m) =>
        '<div class="ach' + (m.done ? " got" : "") + '"><span>' + (m.done ? "✅" : "⬜") + "</span><span>" + m.label + "</span></div>").join("") + "</div>" +
      (extras.length ? '<p class="note" style="margin-top:10px;color:var(--bad)">カートに余計なものが入っています: ' + extras.join(" / ") + "</p>" : "") +
      '<button class="btn" type="button" data-close style="margin-top:12px">閉じる</button></div>', () => l.close());
    l.root.querySelector("[data-close]").onclick = () => l.close();
  }

  /* ============ 共通の部品 ============ */
  const prodCard = (p) =>
    '<button class="prod" type="button" data-go="#item/' + p.id + '">' +
    '<div class="pic">' + p.pic + "</div>" + (p.pr ? '<span class="ad">広告</span>' : "") +
    '<div class="nm">' + p.name + "</div>" +
    '<div class="pr">' + yen(p.price) + "<s>" + yen(p.was) + "</s></div>" +
    '<div class="stars">★★★★★ <span class="note">(' + (p.price % 997) + ")</span></div></button>";

  const footerHtml = () =>
    '<div class="foot"><b>ヤスイネ.com</b>' +
    '<button type="button" data-toast="会社概要は現在準備中です">会社概要</button>' +
    '<button type="button" data-toast="お問い合わせは、チャットボットをご利用ください">お問い合わせ</button>' +
    '<button type="button" data-go="#cancel">定期便の解約・退会</button>' +
    '<span class="note" style="color:#9CA3AF">© YASUINE. 表示価格は予告なく変更されます。</span></div>';

  /** 無限スクロールのおすすめ欄。極小の「停止」を押せたときだけフッターが現れる */
  function infiniteFeed(host) {
    host.innerHTML = '<div class="sec-title">あなたへのおすすめ <small>閲覧履歴に基づいていません</small></div>' +
      '<div class="grid" data-feed></div><div class="feed-loading" data-load>読み込み中… <button type="button" data-stop>自動読み込みを停止</button></div>';
    const grid = host.querySelector("[data-feed]"), load = host.querySelector("[data-load]");
    const pool = PRODUCTS.filter((p) => p.id !== TARGET);
    let n = 0, busy = false, timer = 0, stopped = false;
    const inView = () => { const r = load.getBoundingClientRect(); return r.top < innerHeight && r.bottom > 0; };
    const more = () => {
      if (busy || stopped) return;
      busy = true;
      timer = setTimeout(() => {
        let html = "";
        for (let k = 0; k < 6; k++) html += prodCard(pool[(n++) % pool.length]);
        grid.insertAdjacentHTML("beforeend", html);
        busy = false;
        if (inView()) more();
      }, 900);
    };
    const io = new IntersectionObserver((ents) => { if (ents.some((e) => e.isIntersecting)) more(); });
    io.observe(load);
    more();
    host.querySelector("[data-stop]").addEventListener("click", () => {
      stopped = true;
      io.disconnect();
      clearTimeout(timer);
      load.outerHTML = footerHtml();
      achieve("footer");
    });
    return () => { stopped = true; io.disconnect(); clearTimeout(timer); };
  }

  /* ============ 常駐のチャットボット ============ */
  const BOT_REPLIES = [
    (q) => "「" + q + "」ですね！ ただいまタイムセール会場へご案内します。",
    () => "申し訳ありません、よくわかりませんでした。かわりにメルマガに登録しますか？",
    () => "担当者におつなぎします…ただいま大変混み合っております（待ち時間: 約3時間）",
    (q) => "「" + q + "」に関するよくある質問は 0 件です。"
  ];
  const bot = { open: false, talks: 0, bubbleTimer: 0 };
  function drawBot() {
    const root = $("bot");
    if (bot.open) {
      root.innerHTML = '<div class="bot-panel"><header><span>ヤスイネ AI サポート</span><button type="button" data-min>最小化</button></header>' +
        '<div class="bot-log" id="botLog"><div class="it">こんにちは！何でも聞いてください！</div></div>' +
        '<form class="bot-in" id="botForm"><input type="text" id="botIn" placeholder="メッセージ" autocomplete="off"><button type="submit">送信</button></form></div>';
      root.querySelector("[data-min]").onclick = () => { bot.open = false; drawBot(); };
      $("botForm").onsubmit = (e) => {
        e.preventDefault();
        const q = $("botIn").value.trim();
        if (!q) return;
        const log = $("botLog"), me = document.createElement("div"), it = document.createElement("div");
        me.className = "me"; me.textContent = q;
        it.className = "it"; it.textContent = "入力中…";
        log.append(me, it);
        $("botIn").value = "";
        const reply = BOT_REPLIES[bot.talks % BOT_REPLIES.length](q);
        bot.talks++;
        setTimeout(() => { it.textContent = reply; log.scrollTop = log.scrollHeight; }, 700);
        log.scrollTop = log.scrollHeight;
        if (bot.talks >= 3) achieve("bot");
      };
    } else {
      root.innerHTML = '<button class="bot-face" type="button" aria-label="チャットで質問する">💬</button>';
      root.querySelector(".bot-face").onclick = () => { bot.open = true; drawBot(); };
    }
  }
  // 閉じていると、数秒おきに「お困りですか？」と話しかけてくる
  setInterval(() => {
    const root = $("bot");
    if (bot.open || root.hidden || root.querySelector(".bot-bubble")) return;
    const b = document.createElement("div");
    b.className = "bot-bubble";
    b.textContent = "お困りですか？ 何でも聞いてください！";
    root.prepend(b);
    setTimeout(() => b.remove(), 4000);
  }, 9000);

  /* ============ 重ね表示（ポップアップ・メニュー・実績一覧） ============ */
  function layer(html, onClickOutside) {
    const wrap = document.createElement("div");
    wrap.className = "overlay";
    wrap.innerHTML = html;
    wrap.addEventListener("click", (e) => { if (e.target === wrap && onClickOutside) onClickOutside(); });
    document.body.appendChild(wrap);
    return { root: wrap, close: () => wrap.remove() };
  }

  function showAchievements() {
    const l = layer('<div class="pop"><h2 style="color:var(--ink);font-size:18px">実績 ' + got.size + " / " + ACH.length + "</h2>" + achListHtml() +
      '<button class="btn" type="button" data-close style="margin-top:12px">閉じる</button></div>', () => l.close());
    l.root.querySelector("[data-close]").onclick = () => l.close();
  }

  function showNewsletter() {
    const l = layer('<div class="pop"><button class="x" type="button" data-x aria-label="閉じる">×</button>' +
      "<h2>今だけ 10%OFF！</h2><p>メルマガに登録すると、次回使える10%OFFクーポンをプレゼント（有効期限: 本日中）</p>" +
      '<input type="text" placeholder="メールアドレス" inputmode="email">' +
      '<button class="btn" type="button" data-reg style="margin-top:10px;background:var(--shop)">登録してクーポンを受け取る</button>' +
      '<button class="shame" type="button" data-shame>いいえ、私は定価で買いたいです</button></div>');
    l.root.querySelector("[data-x]").onclick = () => l.close();
    l.root.querySelector("[data-reg]").onclick = () => { toast("メルマガ登録には会員登録が必要です"); l.close(); go("#signup"); };
    l.root.querySelector("[data-shame]").onclick = () => { S.popupDeclined = true; achieve("shame"); l.close(); };
  }

  // PC でもハンバーガー。3階層で、戻るは一番下
  const MENU = { title: "メニュー", items: [
    { label: "カテゴリから探す", sub: { title: "カテゴリ", items: [
      { label: "家電", sub: { title: "家電", items: [
        { label: "オーディオ", go: "#list?q=オーディオ" },
        { label: "生活家電", go: "#list?q=生活家電" },
        { label: "季節家電", toast: "準備中です" }] } },
      { label: "日用品", sub: { title: "日用品", items: [
        { label: "寝具", go: "#list?q=寝具" },
        { label: "健康食品", go: "#list?q=健康" }] } },
      { label: "ファッション", toast: "準備中です" }] } },
    { label: "マイページ", go: "#login" },
    { label: "カート", go: "#cart" },
    { label: "ヘルプ", sub: { title: "ヘルプ", items: [
      { label: "よくある質問", toast: "よくある質問はありません" },
      { label: "お問い合わせ", toast: "お問い合わせはページ最下部のフッターからどうぞ" }] } }
  ] };
  function showMenu() {
    const wrap = document.createElement("div");
    wrap.className = "overlay";
    wrap.style.justifyContent = "flex-start";
    wrap.style.padding = "0";
    const drawer = document.createElement("div");
    drawer.className = "drawer";
    wrap.appendChild(drawer);
    document.body.appendChild(wrap);
    const stack = [MENU];
    const draw = () => {
      const m = stack[stack.length - 1];
      drawer.innerHTML = "<h3>" + m.title + "</h3>" +
        m.items.map((it, i) => '<button class="mi" type="button" data-i="' + i + '"><span>' + it.label + "</span><span>" + (it.sub ? "›" : "") + "</span></button>").join("") +
        '<button class="back" type="button" data-back>' + (stack.length > 1 ? "‹ 戻る" : "閉じる") + "</button>";
    };
    drawer.addEventListener("click", (e) => {
      if (e.target.closest("[data-back]")) { if (stack.length > 1) { stack.pop(); draw(); } else wrap.remove(); return; }
      const b = e.target.closest("[data-i]");
      if (!b) return;
      const it = stack[stack.length - 1].items[Number(b.dataset.i)];
      if (it.sub) { stack.push(it.sub); draw(); }
      else if (it.go) { wrap.remove(); go(it.go); }
      else if (it.toast) toast(it.toast);
    });
    draw();
  }

  /* ============ ご本人確認（音声） ============
     しきい値以上の声を 1.5 秒保つと合格。マイクが使えない環境では「30回連打」に切り替える。 */
  function voiceCheck(root) {
    const NEED = 1.5, TH = 70, TAPS = 30;
    let ok = false, stopLoop = () => {}, taps = 0;
    const ev = listeners();

    const pass = (how) => {
      ok = true;
      stopLoop(); stopLoop = () => {};
      achieve("shout");
      root.innerHTML = '<p class="ok-line">✅ 本人確認が完了しました（' + how + "）</p>";
    };
    const fallback = () => {
      stopLoop(); stopLoop = () => {};
      root.innerHTML = '<p class="note">音声が使えない場合は、下のボタンを ' + TAPS + ' 回押してください。</p>' +
        '<button class="btn" type="button" id="tapBuy">買います（<span id="tapN">0</span>/' + TAPS + "）</button>";
      ev.on($("tapBuy"), "click", () => {
        taps++;
        $("tapN").textContent = taps;
        if (taps >= TAPS) pass("連打");
      });
    };
    const meter = () => {
      root.innerHTML = '<div class="voice"><div class="voice-line" style="bottom:' + TH + '%"></div><i id="vlv"></i>' +
        '<span class="voice-say">「買います」</span></div>' +
        '<div class="note" id="vmsg">声が線を越えた状態を 1.5 秒保ってください。</div>' +
        '<button class="tiny-link" type="button" id="vskip">音が出せない場合はこちら</button>';
      ev.on($("vskip"), "click", fallback);
      const buf = new Float32Array(BAD.SENSORS.analyser.fftSize);
      let x = 0, held = 0;
      stopLoop = BAD.loop((dt) => {
        BAD.SENSORS.analyser.getFloatTimeDomainData(buf);
        let sum = 0;
        for (let i = 0; i < buf.length; i++) sum += buf[i] * buf[i];
        const db = 20 * Math.log10(Math.sqrt(sum / buf.length) + 1e-9);
        x += (clamp((db + 55) / 45 * 100, 0, 100) - x) * Math.min(1, dt * 8);
        held = x >= TH ? held + dt : Math.max(0, held - dt * 2);
        $("vlv").style.height = x + "%";
        $("vlv").style.background = x >= TH ? "var(--ok)" : "var(--accent)";
        $("vmsg").textContent = held > 0 ? "あと " + Math.max(0, NEED - held).toFixed(1) + " 秒…" : "声が線を越えた状態を 1.5 秒保ってください。";
        if (held >= NEED) pass("音声");
      });
    };

    root.innerHTML = '<button class="btn" type="button" id="vgrant">マイクを使って本人確認する</button>' +
      '<div class="note" id="vnote" style="margin-top:8px"></div>' +
      '<button class="tiny-link" type="button" id="vskip0">音声が使えない場合はこちら</button>';
    ev.on($("vskip0"), "click", fallback);
    ev.on($("vgrant"), "click", async () => {
      $("vnote").textContent = "確認中…";
      const res = await BAD.askMic();
      if (res === "ok") meter();
      else { $("vnote").textContent = "マイクが使えません — " + res; }
    });
    return { done: () => ok, stop: () => { stopLoop(); ev.off(); } };
  }

  /* ============ 画面 ============ */
  const VIEWS = {
    // 説明画面。ここでゲームの趣旨を伝え、「はじめる」でタイマーを動かす
    start(root) {
      root.innerHTML =
        '<div class="card intro">' +
        "<h2>これは <b>最悪の UX</b> のサイトです</h2>" +
        '<p class="note">架空のショップです。<b>実際に購入されることはありません。</b></p>' +
        '<div class="goal-box"><div class="lbl">ミッション</div>' +
        "<p>ワイヤレスイヤホン <b>BAD-01</b>（¥1,980）を <b>1つだけ</b> 買う</p></div>" +
        '<p class="note">余計なオプションや商品を買うと失敗です。</p>' +
        '<button class="btn start" type="button" id="startBtn">はじめる</button>' +
        '<button class="tiny-link" type="button" id="seeRank" style="margin-top:10px">ランキングを見る</button></div>';
      $("startBtn").onclick = () => { S.t0 = performance.now(); go("#top"); };
      $("seeRank").onclick = showRanking;
    },

    top(root) {
      const ev = listeners();
      root.innerHTML =
        '<div class="countdown" id="cd">⚡ タイムセール終了まで 00:00:59<small>この機会をお見逃しなく！</small></div>' +
        '<div class="carousel" id="car">' +
        '<div class="slide on" style="background:#D7261E">全品ポイント 0.1倍！<small>※一部対象外の商品がございます</small></div>' +
        '<div class="slide" style="background:#7C3AED">会員限定セール開催中<small>会員登録が必要です</small></div>' +
        '<div class="slide" style="background:#0EA5E9">アプリならもっとお得！<small>アプリは現在配信を停止しています</small></div></div>' +
        '<div class="sec-title">カテゴリ</div><div class="cats">' +
        '<button class="cat" type="button" data-go="#list?q=オーディオ"><span>🎧</span>オーディオ</button>' +
        '<button class="cat" type="button" data-go="#list?q=寝具"><span>🛏️</span>寝具</button>' +
        '<button class="cat" type="button" data-go="#list?q=健康"><span>🍵</span>健康</button>' +
        '<button class="cat" type="button" data-go="#list?q=生活家電"><span>🔌</span>生活家電</button></div>' +
        '<div id="feed"></div>';
      // 偽のカウントダウン。0 になるとまた 59 秒から
      let sec = 59;
      const cd = setInterval(() => {
        sec--;
        if (sec < 0) { achieve("sale"); toast("タイムセールを延長しました！"); sec = 59; }
        $("cd").firstChild.textContent = "⚡ タイムセール終了まで 00:00:" + String(sec).padStart(2, "0");
      }, 1000);
      // 止められない速いカルーセル
      let k = 0;
      const car = setInterval(() => {
        const slides = $("car").children;
        slides[k].classList.remove("on");
        k = (k + 1) % slides.length;
        slides[k].classList.add("on");
      }, 1100);
      ev.on($("car"), "click", () => go("#list?q="));
      const stopFeed = infiniteFeed($("feed"));
      const pop = S.popupDeclined ? 0 : setTimeout(showNewsletter, 700);
      return () => { clearInterval(cd); clearInterval(car); clearTimeout(pop); stopFeed(); ev.off(); };
    },

    list(root, q) {
      const sp = new URLSearchParams(q);
      const query = (sp.get("q") || "").trim(), page = Math.max(1, Number(sp.get("p")) || 1);
      $("q").value = query;
      const hit = (p) => !query || (p.name + " " + p.tags).toLowerCase().includes(query.toLowerCase());
      // 「おすすめ順（当社の）」= 広告が先、あとは高い順
      let results = PRODUCTS.filter((p) => !p.pr && hit(p)).sort((a, b) => b.price - a.price);
      const none = !results.length;
      results = PRODUCTS.filter((p) => p.pr).concat(results);
      const PER = 6, pages = Math.ceil(results.length / PER), cur = clamp(page, 1, pages);
      if (cur === 3) achieve("page3");
      const link = (p) => "#list?q=" + encodeURIComponent(query) + "&p=" + p;
      root.innerHTML =
        (query.includes("イヤホン") ? '<div class="maybe">もしかして: <button type="button" data-go="#list?q=イヤホソ">イヤホソ</button></div>' : "") +
        (none ? '<div class="maybe">「' + query.replace(/[<>&"]/g, "") + "」に一致する商品は見つかりませんでした。こちらはいかがですか？</div>" : "") +
        '<div class="list-tools"><span>' + results.length + "件</span>" +
        "<select><option>おすすめ順（当社の）</option><option disabled>価格の安い順（準備中）</option><option disabled>評価の高い順（準備中）</option></select></div>" +
        '<div class="grid">' + results.slice((cur - 1) * PER, cur * PER).map(prodCard).join("") + "</div>" +
        // 「次へ」が左、「前へ」が右。しかも小さい
        '<div class="pager"><button type="button" data-go="' + link(cur + 1) + '"' + (cur >= pages ? " disabled" : "") + ">次へ ›</button>" +
        "<span>" + cur + " / " + pages + "</span>" +
        '<button type="button" data-go="' + link(cur - 1) + '"' + (cur <= 1 ? " disabled" : "") + ">‹ 前へ</button></div>" +
        '<div id="feed"></div>';
      return infiniteFeed($("feed"));
    },

    item(root, id) {
      const p = P(id);
      if (!p) { root.innerHTML = '<div class="card"><p>この商品は販売を終了しました。</p></div>'; return; }
      let watchers = 30 + (p.price % 17);
      root.innerHTML =
        '<div class="item-pic">' + p.pic + "</div>" +
        '<div class="item-name">' + p.name + "</div>" +
        '<div class="item-price">' + yen(p.price) + "<s>" + yen(p.was) + '</s><span class="off">' + Math.round((1 - p.price / p.was) * 100) + "%OFF</span></div>" +
        '<div class="urgent">残り1点！（ずっと） ・ <span id="watch">' + watchers + "</span> 人が見ています</div>" +
        '<div class="card" style="margin-top:12px">' +
        "<label>数量</label><select id=\"qty\">" + Array.from({ length: 100 }, (_, i) => "<option" + (i + 1 === 3 ? " selected" : "") + ">" + (i + 1) + "</option>").join("") + "</select>" +
        '<label class="opt-row"><input type="checkbox" id="oW" checked><span>延長保証（5年）を付ける +' + yen(ADDONS.warranty.price) + "</span></label>" +
        '<label class="opt-row"><input type="checkbox" id="oG" checked><span>ギフト包装を付ける +' + yen(ADDONS.gift.price) + "</span></label>" +
        '<label class="opt-row"><input type="checkbox" id="oS" checked><span>定期便をやめない（毎月お届け・いつでも解約可※）</span></label>' +
        '<button class="buy-big" type="button" id="subBuy">今すぐ定期購入</button>' +
        '<button class="buy-small" type="button" id="addCart">カートに入れる</button>' +
        '<p class="note" style="margin-top:8px">※解約はお電話でのみ受け付けます。</p></div>' +
        '<div class="card"><b style="font-size:13px">レビュー</b>' +
        '<div class="review"><span class="stars">★★★★★</span> 最高です。（当社スタッフ）</div>' +
        '<div class="review"><span class="stars">★★★★★</span> 家族も喜んでいます。（当社スタッフの家族）</div>' +
        '<div class="review"><span class="stars">★☆☆☆☆</span> このレビューは非表示になりました。</div></div>';
      const w = setInterval(() => { watchers += 1 + (watchers % 3); $("watch").textContent = watchers; }, 2500);
      const opts = () => ({ warranty: $("oW").checked, gift: $("oG").checked, sub: $("oS").checked });
      $("subBuy").onclick = () => { addToCart(p.id, Number($("qty").value), Object.assign(opts(), { sub: true })); go("#cart"); };
      $("addCart").onclick = () => {
        addToCart(p.id, Number($("qty").value), opts());
        ask("こちらの商品も一緒にいかがですか？<br><span class=\"note\">イヤホン用クリーニングキット " + yen(P("kit").price) + "</span>", [
          { label: "追加しない", cls: "no", onClick: () => toast("カートに追加しました") },
          { label: "追加する", cls: "yes", onClick: () => { addToCart("kit", 1, {}); toast("カートに追加しました"); } }
        ]);
      };
      return () => clearInterval(w);
    },

    cart(root) {
      // 初めて開いたときに、頼んでいない商品をこっそり足す
      if (S.cart.length && !S.kitAdded) { S.kitAdded = true; addToCart("kit", 1, {}); }
      const draw = () => {
        drawBadge();
        if (!S.cart.length) {
          root.innerHTML = '<div class="card"><p>カートは空です。</p><button class="btn" type="button" data-go="#top">買い物を続ける</button></div>';
          return;
        }
        root.innerHTML = S.cart.map((l, i) => {
          const p = P(l.id);
          const addon = (key, btn) => l[key] ? '<div class="addon"><span>' + ADDONS[key].name + (ADDONS[key].price ? " " + yen(ADDONS[key].price) : "") + '</span><button type="button" data-rm="' + key + '" data-i="' + i + '">' + btn + "</button></div>" : "";
          return '<div class="card"><div class="line"><div class="pic">' + p.pic + "</div><div>" +
            '<div class="nm">' + p.name + (l.id === "kit" && S.kitAdded ? '<br><span class="note">よく一緒に購入されています（自動で追加しました）</span>' : "") + "</div>" +
            '<div class="pr">' + yen(p.price) + "</div>" +
            '<div style="margin-top:4px">数量 <select data-qty="' + i + '">' + Array.from({ length: 100 }, (_, k) => "<option" + (k + 1 === l.qty ? " selected" : "") + ">" + (k + 1) + "</option>").join("") + "</select> " +
            '<button class="tiny-link" type="button" data-del="' + i + '">削除</button></div></div></div>' +
            addon("warranty", "保護を解除する（おすすめしません）") + addon("gift", "包装を解除") + addon("sub", "定期便を解除") + "</div>";
        }).join("") +
          '<div class="card"><div class="sum"><span>小計（税込）</span><b>' + yen(subtotal()) + "</b></div>" +
          '<button class="btn" type="button" id="toReg" style="margin-top:12px;background:var(--shop)">レジに進む</button>' +
          (S.member ? "" : '<p class="note" style="margin-top:8px">ご注文には <b>会員登録（無料）</b> が必要です。レジに進むと登録画面に進めます。</p>') + "</div>";
        $("toReg").onclick = () => go(S.member ? "#checkout" : "#login");
      };
      const ev = listeners();
      ev.on(root, "change", (e) => {
        const s = e.target.closest("[data-qty]");
        if (s) { S.cart[Number(s.dataset.qty)].qty = Number(s.value); draw(); }
      });
      ev.on(root, "click", (e) => {
        const del = e.target.closest("[data-del]");
        if (del) { S.cart.splice(Number(del.dataset.del), 1); draw(); return; }
        const rm = e.target.closest("[data-rm]");
        if (!rm) return;
        const l = S.cart[Number(rm.dataset.i)], key = rm.dataset.rm;
        const off = () => { l[key] = false; if (key === "warranty") achieve("unprotect"); draw(); };
        if (key === "warranty") ask("保証を外すと、故障時の修理代は全額自己負担になります。本当に外しますか？",
          [{ label: "外す", cls: "no", onClick: off }, { label: "外さない（推奨）", cls: "yes" }]);
        else if (key === "sub") ask("定期便をやめると、毎月届く安心がなくなります。本当にやめますか？",
          [{ label: "やめる", cls: "no", onClick: off }, { label: "やめない（推奨）", cls: "yes" }]);
        else off();
      });
      draw();
      return () => ev.off();
    },

    login(root) {
      if (S.member) { go("#checkout"); return; }
      root.innerHTML =
        '<div class="card rows"><b>はじめての方</b>' +
        '<p class="note">ご注文には会員登録が必要です。登録は無料です。</p>' +
        '<button class="btn" type="button" id="toSignup" style="background:var(--shop)">新規会員登録（無料）に進む</button></div>' +
        '<div class="card rows"><b>登録済みの方（ログイン）</b>' +
        '<div><label>メールアドレス</label><input type="text" id="lm" inputmode="email" autocomplete="off"></div>' +
        '<div><label>パスワード</label><input type="text" id="lp" autocomplete="off"></div>' +
        '<button class="btn" type="button" id="lgo">ログイン</button><div id="lmsg"></div>' +
        '<button class="btn" type="button" id="sso" style="background:#FFF;color:var(--ink);border:1px solid var(--line)">G で続ける</button>' +
        '<button class="tiny-link" type="button" id="guest" style="text-align:right">ゲストとして購入</button></div>';
      $("lgo").onclick = () => { $("lmsg").innerHTML = '<div class="err">メールアドレスまたはパスワードが正しくありません</div>'; };
      $("sso").onclick = () => toast("このログイン方法は現在ご利用いただけません");
      $("toSignup").onclick = () => go("#signup");
      $("guest").onclick = () => { achieve("guest"); toast("ゲスト購入には会員登録が必要です"); setTimeout(() => go("#signup"), 1200); };
    },

    signup(root) {
      if (S.member) { go(S.cart.length ? "#checkout" : "#top"); return; }
      return runSignup(root, {
        onDone: () => { S.member = true; drawBadge(); toast("会員登録が完了しました"); go(S.cart.length ? "#checkout" : "#top"); }
      });
    },

    checkout(root) {
      if (!S.member) { go("#login"); return; }
      if (!S.cart.length) { root.innerHTML = '<div class="card"><p>カートが空です。</p><button class="btn" type="button" data-go="#top">買い物を続ける</button></div>'; return; }
      const PAY = [
        { id: "later", name: "後払い", fee: 980 },
        { id: "card", name: "クレジットカード（準備中）", fee: 0, off: true },
        { id: "cod", name: "代金引換", fee: 660 },
        { id: "konbini", name: "コンビニ払い（対応店舗: 北海道の1店舗のみ）", fee: 0 }
      ];
      let day = 1, calBuys = 0, cleanupCal = () => {};
      const pay = () => PAY.find((x) => x.id === (root.querySelector('input[name="pay"]:checked') || {}).value) || PAY[0];
      root.innerHTML =
        '<div class="card rows"><b>お届け先</b><div><label>お名前</label><input type="text" id="cname" autocomplete="off"></div></div>' +
        '<div class="card"><b>配送希望日</b><p class="note">10月14日 以外はお届けできません。</p>' +
        '<div class="readout"><div><span>現在</span> <b id="cday">10月1日</b></div></div>' +
        '<div class="ctrl-area" id="calArea"></div>' +
        '<button class="tiny-link" type="button" id="rebuy" style="margin-top:6px">めくりすぎた場合: カレンダーを買い直す（' + yen(110) + "）</button></div>" +
        '<div class="card"><b>お支払い方法</b>' + PAY.map((x, i) =>
          '<label class="pay-row"><input type="radio" name="pay" value="' + x.id + '"' + (i === 0 ? " checked" : "") + (x.off ? " disabled" : "") + "><span>" + x.name + (x.fee ? "（手数料 " + yen(x.fee) + "）" : "") + "</span></label>").join("") + "</div>" +
        '<div class="card"><b>ご本人確認（音声）</b>' +
        '<p class="note">最後に、マイクに向かって <b>「買います」</b> と大きな声で言ってください。</p>' +
        '<div id="voiceBox"></div></div>' +
        '<div class="card"><div class="sum" id="sum"></div>' +
        '<button class="btn" type="button" id="order" style="margin-top:12px;background:var(--shop)">注文を確定する</button><div id="omsg"></div></div>';
      const total = () => subtotal() + 220 + pay().fee + calBuys * 110;
      const drawSum = () => {
        $("sum").innerHTML = "<span>商品小計</span><b>" + yen(subtotal()) + "</b>" +
          "<span>システム利用料</span><b>" + yen(220) + "</b>" +
          "<span>お支払い手数料</span><b>" + yen(pay().fee) + "</b>" +
          (calBuys ? "<span>カレンダー代</span><b>" + yen(calBuys * 110) + "</b>" : "") +
          '<span class="total">合計</span><b class="total">' + yen(total()) + "</b>";
      };
      const mountCal = () => {
        cleanupCal();
        day = 1;
        cleanupCal = mountControl($("calArea"), "tearoff", (v) => { day = Math.round(v); $("cday").textContent = "10月" + day + "日"; });
      };
      mountCal(); drawSum();
      const voice = voiceCheck($("voiceBox"));
      const ev = listeners();
      ev.on(root, "change", drawSum);
      ev.on($("rebuy"), "click", () => { calBuys++; mountCal(); drawSum(); toast("カレンダーを購入しました（" + yen(110) + "）"); });
      ev.on($("order"), "click", () => {
        if (!$("cname").value.trim()) { $("omsg").innerHTML = '<div class="err">お名前を入力してください</div>'; return; }
        if (day !== 14) { $("omsg").innerHTML = '<div class="err">配送希望日を 10月14日 にしてください</div>'; return; }
        if (!voice.done()) { $("omsg").innerHTML = '<div class="err">ご本人確認（音声）が完了していません</div>'; return; }
        $("omsg").innerHTML = "";
        // 「確定」が灰色で左、「キャンセル」が青で右
        ask("注文を確定しますか？", [
          { label: "確定する", cls: "no", onClick: () => { S.order = { lines: S.cart.map((l) => Object.assign({}, l)), total: total() }; S.endT = performance.now(); drawBadge(); go("#done"); } },
          { label: "キャンセル", cls: "yes", onClick: () => toast("注文をキャンセルしました") }
        ]);
      });
      return () => { cleanupCal(); voice.stop(); ev.off(); };
    },

    done(root) {
      if (!S.order) { go("#top"); return; }
      const lines = S.order.lines, target = lines.find((l) => l.id === TARGET);
      const extras = [];
      lines.forEach((l) => {
        const p = P(l.id);
        if (l.id !== TARGET) extras.push(p.name + " × " + l.qty);
        else if (l.qty > 1) extras.push(p.name + " を余分に " + (l.qty - 1) + " 個");
        ["warranty", "gift", "sub"].forEach((k) => { if (l[k]) extras.push(ADDONS[k].name + "（" + p.name + "）"); });
      });
      const perfect = !!target && extras.length === 0;
      if (perfect) achieve("bought");
      else achieve("forced");
      const sec = (S.endT - S.t0) / 1000;
      root.innerHTML =
        '<div class="card done"><div class="lbl">ご注文ありがとうございました</div>' +
        '<div class="verdict ' + (perfect ? "ok" : "ng") + '">' + (perfect ? "ミッション成功！" : target ? "余計なものまで買いました" : "イヤホンを買えていません") + "</div>" +
        '<div class="lbl">かかった時間</div><div class="time">' + String(Math.floor(sec / 60)).padStart(2, "0") + ":" + String(Math.floor(sec % 60)).padStart(2, "0") + "</div>" +
        '<div class="lbl">支払総額 ' + yen(S.order.total) + "（最安 " + yen(P(TARGET).price + 220) + "）</div>" +
        (extras.length ? '<div class="card" style="margin-top:12px;text-align:left"><b style="font-size:13px">余計に買ったもの</b><ul class="note" style="margin:6px 0 0;padding-left:18px">' +
          extras.map((x) => "<li>" + x + "</li>").join("") + "</ul></div>" : "") +
        '<div class="card" style="margin-top:12px;text-align:left"><b style="font-size:13px">ランキングに登録</b>' +
        '<div style="display:flex;gap:8px;margin-top:8px"><input type="text" id="rname" maxlength="12" placeholder="ニックネーム（12文字まで）" autocomplete="off">' +
        '<button class="btn" type="button" id="rsend" style="width:auto;white-space:nowrap">登録</button></div>' +
        '<div class="note" id="rmsg" style="margin-top:6px">' + (RANK.shared ? "参加者全員のランキングに登録されます。" : "共有ランキング未設定のため、この端末にだけ保存します。") + "</div>" +
        '<div id="rankBox" class="note" style="margin-top:10px">読み込み中…</div></div>' +
        '<div style="margin-top:14px;text-align:left"><b style="font-size:13px">実績 ' + got.size + " / " + ACH.length + "</b>" + achListHtml() + "</div>" +
        '<button class="btn" type="button" id="again" style="margin-top:16px">もう一度買い物する</button>' +
        '<button class="tiny-link" type="button" id="resetAch" style="margin-top:10px">実績をリセット</button></div>';
      try { $("rname").value = localStorage.getItem(NAME_KEY) || ""; } catch (e) { /* 読めない環境は空のまま */ }
      fillRanking($("rankBox"), null);
      $("rsend").onclick = () => {
        const name = $("rname").value.trim() || "名無し";
        try { localStorage.setItem(NAME_KEY, name); } catch (e) { /* 保存できない環境は無視 */ }
        const rec = { name, sec: Math.round(sec), total: S.order.total, achievements: got.size, perfect, ts: Date.now() };
        $("rsend").disabled = true;
        $("rmsg").textContent = "送信中…";
        // 送信を待たずに画面は動かし、結果だけ後から反映する
        RANK.send(rec).then((res) => {
          if (!$("rmsg").isConnected) return;
          $("rmsg").textContent = res.ok
            ? (res.shared ? "ランキングに登録しました。" : "この端末に保存しました。")
            : "ランキングに送れませんでした（記録はこの端末に保存しました）。";
          RANK.cache = null;
          fillRanking($("rankBox"), rec);
        });
      };
      $("again").onclick = () => { location.hash = "#start"; location.reload(); };
      $("resetAch").onclick = () => { got.clear(); saveAch(); drawTrophy(); toast("実績をリセットしました"); VIEWS.done(root); };
    },

    cancel(root) {
      achieve("cancel");
      root.innerHTML = '<div class="card"><b>定期便の解約・退会</b><p style="margin-top:8px">解約・退会のお手続きは、お電話でのみ受け付けております。</p>' +
        '<p class="note">受付時間: 平日 10:00〜10:05<br>電話番号: 0120-000-000（現在使われておりません）</p>' +
        '<button class="btn" type="button" data-go="#top">解約せずに買い物を続ける</button></div>';
    }
  };

  /* ============ 画面遷移 ============ */
  let cleanupView = null;
  function go(hash) { if (location.hash === hash) render(); else location.hash = hash; }
  function render() {
    if (cleanupView) { cleanupView(); cleanupView = null; }
    BAD.closeDialog();
    const h = location.hash.slice(1) || (S.t0 ? "top" : "start");
    const [name, rest] = h.split(/[/?](.*)/s);
    const view = VIEWS[name] ? name : (S.t0 ? "top" : "start");
    // 登録手続き中と説明画面では、チャットボットは出さない
    $("bot").hidden = view === "signup" || view === "start";
    $("shopHead").hidden = view === "start";
    drawMission();
    const root = $("view");
    root.innerHTML = "";
    window.scrollTo(0, 0);
    cleanupView = VIEWS[view](root, rest || "") || null;
  }

  // data-go / data-toast はどの画面でも効くようにまとめて拾う
  document.addEventListener("click", (e) => {
    const g = e.target.closest("[data-go]");
    if (g) { go(g.dataset.go); return; }
    const t = e.target.closest("[data-toast]");
    if (t) toast(t.dataset.toast);
  });
  $("logo").onclick = () => go("#top");
  $("menuBtn").onclick = showMenu;
  $("cartBtn").onclick = () => go("#cart");
  $("trophy").onclick = showAchievements;
  $("rankBtn").onclick = showRanking;
  $("missionBtn").onclick = showMission;
  $("signupBtn").onclick = () => go(S.member ? "#checkout" : "#signup");
  $("searchForm").onsubmit = (e) => { e.preventDefault(); go("#list?q=" + encodeURIComponent($("q").value.trim())); };

  setInterval(() => {
    const sec = S.t0 ? ((S.endT || performance.now()) - S.t0) / 1000 : 0;
    $("clock").textContent = "⏱ " + mmss(sec);
  }, 500);

  drawTrophy();
  drawBadge();
  drawBot();

  if (ONLY) {
    // ?only=<ステップ id> は登録手続きの単体確認用。サイトは通さない
    $("bot").hidden = true;
    runSignup($("view"), { only: ONLY, onDone: () => { $("view").innerHTML = '<div class="card"><p>ステップ「' + ONLY + "」を突破しました。</p></div>"; } });
  } else {
    window.addEventListener("hashchange", render);
    render();
  }
})();
