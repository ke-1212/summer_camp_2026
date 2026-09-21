/* 最悪の UX のカフェ＋オンラインストア「珈琲 和ごころ」。
   画面遷移・各画面・実績・タイマーを持つ。共通の小道具は kit.js（window.KIT）から使う。

   このサイトが最悪な理由（意図した作り）:
   - 店名・見出し・営業時間・住所・電話番号・商品名・価格・ボタンの文字が、すべて画像。
     選択もコピーも検索も翻訳も読み上げもできず、拡大するとぼやける。
   - ナビゲーションはアイコンだけでラベルがない。押すまで行き先が分からない。
   - サイト内検索はある。ただし文字が画像なので、何を入れても 0 件になる。
   - 通販の既定値がすべて店に有利（定期便オン・ギフト包装オン・数量 3・あと払い）。
   - 送料と手数料は最後の最後に足される。
   - 注文中も定期的に「お声掛け確認」が割り込み、声（マイク）を出さないと先に進めない。
   - 豆は自分で挽き（長押し）、確認コードは画像を書き写し、注文はハンコ（長押し）で確定する。 */
(() => {
  "use strict";

  const { $, clamp, esc, yen, mmss, imgText, photo, toast, ask, closeDialog, layer, listeners, loop, longPress, MIC } = KIT;
  const params = new URLSearchParams(location.search);

  /* 画像の文字を作る道具。見出しは明朝、本文はゴシックで、本文の地の文とは書体が揃わない */
  const ti = (s, o) => imgText(s, o);
  const th = (s, o) => imgText(s, Object.assign({ size: 19, weight: "800", family: '"Shippori Mincho", serif' }, o));
  const tp = (v) => imgText(yen(v), { size: 17, weight: "900", color: "#B23A2A" });
  const tw = (s, o) => imgText(s, Object.assign({ color: "#F6EFE3" }, o));   // 濃い背景の上の文字

  /* ============ 実績 ============ */
  const ACH = [
    { id: "imgtext", name: "文字は画像でした",     desc: "画像の文字を選択しようとした" },
    { id: "search0", name: "検索は無力",           desc: "サイト内検索で 0 件を見た" },
    { id: "zoom",    name: "拡大してもぼやける",   desc: "お品書きの拡大を3回押した" },
    { id: "hero",    name: "止まらない看板",       desc: "勝手に切り替わる写真を止めようとした" },
    { id: "cookie",  name: "設定を探した",         desc: "Cookie バナーの「設定」を開いた" },
    { id: "phone",   name: "かけられない電話",     desc: "画像の電話番号を押した" },
    { id: "hours",   name: "今日は何時まで？",     desc: "本日の閉店時刻を当てた" },
    { id: "bean",    name: "豆のまま",             desc: "挽き方のつまみを端まで戻した" },
    { id: "tumbler", name: "頼んでいないタンブラー", desc: "勝手に入った商品をかごから消した" },
    { id: "unsub",   name: "定期便を外した",       desc: "かごの中で定期便を解除した" },
    { id: "guest",   name: "ゲストの幻想",         desc: "ゲスト購入を選んだ" },
    { id: "footer",  name: "世界の果て",           desc: "無限のお知らせを抜けてフッターに着いた" },
    { id: "shout",   name: "いらっしゃいませ",     desc: "お声掛け確認を声で突破した" },
    { id: "tap",     name: "声の代わりに",         desc: "お声掛け確認を画面をたたいて突破した" },
    { id: "shout3",  name: "何度も呼ばれた",       desc: "お声掛け確認を3回突破した" },
    { id: "grind",   name: "自分で挽いた",         desc: "長押しで豆を挽いた" },
    { id: "captcha", name: "書き写した",           desc: "画像の確認コードを入力した" },
    { id: "hanko",   name: "押印",                 desc: "長押しでハンコを押して注文した" },
    { id: "ordered", name: "買わされた",           desc: "余計なもの込みで注文した" },
    { id: "perfect", name: "完璧な一袋",           desc: "朝霧ブレンド 200g を1袋だけ、余計なもの無しで注文した" }
  ];
  const ACH_KEY = "wagokoro-achievements-v1";
  const got = (() => { try { return new Set(JSON.parse(localStorage.getItem(ACH_KEY) || "[]")); } catch (e) { return new Set(); } })();
  const saveAch = () => { try { localStorage.setItem(ACH_KEY, JSON.stringify([...got])); } catch (e) { /* 保存できない環境では、このページを開いている間だけ覚える */ } };
  const drawTrophy = () => { $("trophy").textContent = "🏆 " + got.size + "/" + ACH.length; };

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
  function achieve(id) {
    const a = ACH.find((x) => x.id === id);
    if (!a || got.has(id)) return;
    got.add(id);
    saveAch();
    drawTrophy();
    achQueue.push(a.name);
    showNextAch();
  }

  function achListHtml() {
    return '<div class="ach-list">' + ACH.map((a) =>
      '<div class="ach' + (got.has(a.id) ? " got" : "") + '"><span>' + (got.has(a.id) ? "🏆" : "🔒") + "</span><span>" +
      (got.has(a.id) ? a.name : "？？？") + "<small>" + a.desc + "</small></span></div>").join("") + "</div>";
  }

  /* ============ 商品 ============
     名前が画像なので、見分けのつきにくい名前を並べても検索で絞り込めない。 */
  const TARGET = "asagiri200";
  const PRODUCTS = [
    { id: "pr1", pr: true, name: "【おすすめ】自家焙煎 福袋（豆 1kg）", price: 7800, was: 12000, img: "fukubukuro", cat: "雑貨" },
    { id: "pr2", pr: true, name: "【おすすめ】和ごころ オリジナルタンブラー", price: 2800, was: 3800, img: "tumbler", cat: "雑貨" },
    { id: "asagiriEX", name: "朝霧ブレンド EX 200g（新）", price: 2480, was: 2980, img: "bag-asagiri", cat: "豆" },
    { id: "asagiri500", name: "朝霧ブレンド 500g", price: 3200, was: 3800, img: "bag-asagiri", cat: "豆" },
    { id: "asagiriBox", name: "朝霧ブレンド 200g 化粧箱入り", price: 2480, was: 2900, img: "box", cat: "豆" },
    { id: "asagiri2", name: "朝霧ブレンド 200g ×2袋セット", price: 2780, was: 2960, img: "bag-asagiri", cat: "豆" },
    { id: "yuuhi200", name: "夕陽ブレンド 200g", price: 1580, was: 1800, img: "bag-yuuhi", cat: "豆" },
    { id: "sumibi", name: "深煎り 炭火仕立て 200g", price: 1680, was: 1900, img: "bag-sumibi", cat: "豆" },
    { id: "asagiri100", name: "朝霧ブレンド 100g", price: 880, was: 980, img: "bag-asagiri", cat: "豆" },
    { id: TARGET, name: "朝霧ブレンド 200g", price: 1480, was: 1800, img: "bag-asagiri", cat: "豆" },
    { id: "drip10", name: "ドリップバッグ 10個入り", price: 1280, was: 1500, img: "box", cat: "豆" },
    { id: "tumbler", name: "和ごころ オリジナルタンブラー", price: 2800, was: 3800, img: "tumbler", cat: "雑貨" },
    { id: "cup", name: "美濃焼 コーヒーカップ", price: 3600, was: 4200, img: "cup", cat: "雑貨" },
    { id: "filter", name: "ペーパーフィルター 100枚", price: 480, was: 600, img: "filter", cat: "雑貨" },
    { id: "youkan", name: "自家製 珈琲羊羹（5本）", price: 1200, was: 1400, img: "youkan", cat: "菓子" },
    { id: "cookie", name: "珈琲クッキー 8枚", price: 980, was: 1200, img: "cookie", cat: "菓子" }
  ];
  const P = (id) => PRODUCTS.find((p) => p.id === id);
  const ADDONS = {
    gift: { name: "ギフト包装", price: 330 },
    sub:  { name: "定期便（毎月お届け）", price: 0 }
  };
  const GRINDS = ["豆のまま", "粗挽き", "中挽き", "細挽き", "極細挽き"];
  const SHIP = 660, LATER_FEE = 330;

  /* ============ 状態 ============ */
  const S = {
    t0: 0, endT: 0,          // t0 は説明画面の「はじめる」で動き出す
    member: false,
    cart: [],                // { id, qty, grind, gift, sub }
    tumblerAdded: false,     // カートを初めて開いたときに、頼んでいない商品を1つ足す
    cookieDone: false,
    ground: false,           // 豆を自分で挽いたか（レジに進む前に長押しで挽かせる）
    day: null, time: "",
    pay: "later",            // 既定は手数料のかかる「あと払い」
    order: null
  };
  const lineTotal = (l) => P(l.id).price * l.qty + (l.gift ? ADDONS.gift.price : 0);
  const subtotal = () => S.cart.reduce((s, l) => s + lineTotal(l), 0);
  const grandTotal = () => subtotal() + SHIP + (S.pay === "later" ? LATER_FEE : 0);
  const cartCount = () => S.cart.reduce((s, l) => s + l.qty, 0);
  const drawBadge = () => { $("cartBadge").textContent = cartCount(); };

  function addToCart(id, qty, opts) {
    const o = opts || {};
    const same = S.cart.find((l) => l.id === id && l.gift === !!o.gift && l.sub === !!o.sub && l.grind === (o.grind || 0));
    if (same) same.qty += qty;
    else S.cart.push({ id, qty, grind: o.grind || 0, gift: !!o.gift, sub: !!o.sub });
    drawBadge();
  }

  /* ミッションの達成条件: 朝霧ブレンド 200g を1つだけ、定期便もギフト包装も無しで注文する */
  function isPerfect(order) {
    return order.lines.length === 1 && order.lines[0].id === TARGET && order.lines[0].qty === 1 &&
      !order.lines[0].gift && !order.lines[0].sub;
  }

  /* ============ ランキング ============
     保存先は config.js の window.WAGOKORO_RANKING_URL（Google Apps Script）。
     未設定ならこの端末の localStorage だけを使う。取得・送信はすべて非同期で、画面は待たせない。 */
  // ?rank=<URL> を付けると保存先を一時的に差し替えられる（動作確認用）
  const RANK_URL = (params.get("rank") || window.WAGOKORO_RANKING_URL || "").trim();
  const RANK_KEY = "wagokoro-ranking-local-v1";
  const NAME_KEY = "wagokoro-name";
  const readLocal = () => { try { return JSON.parse(localStorage.getItem(RANK_KEY) || "[]"); } catch (e) { return []; } };
  const writeLocal = (list) => { try { localStorage.setItem(RANK_KEY, JSON.stringify(list.slice(0, 200))); } catch (e) { /* 保存できない環境は無視 */ } };

  /** 共有ランキングが CORS で読めない環境のための JSONP */
  function jsonp(url, ms) {
    return new Promise((resolve, reject) => {
      const cb = "wagokoroCb" + Date.now();
      const s = document.createElement("script");
      const timer = setTimeout(() => { cleanup(); reject(new Error("timeout")); }, ms || 10000);
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

  function rankTableHtml(rows, mine) {
    if (!rows.length) return '<p class="note">まだ記録がありません。</p>';
    const sorted = rows.slice().sort(rankSort);
    const myIdx = mine ? sorted.findIndex((r) => r.ts === mine.ts && r.name === mine.name) : -1;
    const show = sorted.slice(0, 10);
    if (myIdx >= 10) show.push(sorted[myIdx]);
    return '<table class="rank">' + show.map((r) => {
      const i = sorted.indexOf(r);
      return '<tr class="' + (i === myIdx ? "me" : "") + '"><td>' + (i + 1) + "</td><td>" + String(r.name || "名無し").replace(/[<>&"]/g, "").slice(0, 12) +
        (r.perfect ? "" : ' <span class="note">(余計あり)</span>') + "</td><td>" + mmss(r.sec) + "</td><td>" + yen(Number(r.total) || 0) + "</td><td>🏆" + (r.achievements || 0) + "</td></tr>";
    }).join("") + "</table>";
  }

  /** ランキングを非同期で取り、box がまだ画面にあれば差し込む */
  function fillRanking(box, mine) {
    RANK.list().then(({ rows, shared }) => {
      if (!box.isConnected) return;   // 画面を離れていたら捨てる
      box.innerHTML = (RANK.shared && !shared ? '<p class="note">共有ランキングに接続できませんでした。この端末の記録を表示しています。</p>' :
        !RANK.shared ? '<p class="note">共有ランキング未設定のため、この端末の記録です。</p>' : "") + rankTableHtml(rows, mine);
    });
  }

  function showRanking() {
    const l = layer('<div class="pop"><h2>ランキング</h2><div id="rankBox" class="note">読み込み中…</div>' +
      '<button class="btn" type="button" data-close style="margin-top:12px">閉じる</button></div>', () => l.close());
    l.root.querySelector("[data-close]").onclick = () => l.close();
    fillRanking(l.root.querySelector("#rankBox"), null);
  }

  /* ============ ミッションの進み具合 ============ */
  function nextStep() {
    if (S.order) return "注文完了";
    if (!S.cart.some((l) => l.id === TARGET)) return "オンラインストアで「朝霧ブレンド 200g」をかごに入れる";
    if (!S.member) return "レジに進む（会員登録が必要）";
    if (S.day === null) return "お届け日と時間帯を選ぶ";
    return "支払い方法を選んで注文を確定する";
  }
  const drawMission = () => { $("missionNext").textContent = "次: " + nextStep(); };

  function showMission() {
    const l = layer('<div class="pop"><h2>ミッション</h2>' +
      "<p>オンラインストアで <b>朝霧ブレンド 200g（¥1,480）</b> を <b>1袋だけ</b> 注文する。</p>" +
      '<p class="note">定期便・ギフト包装・頼んでいない商品が混ざっていると失敗です。似た名前の商品が並んでいるので気をつけてください。</p>' +
      '<p class="note" style="margin-top:8px">いま: ' + esc(nextStep()) + "</p>" +
      '<button class="btn" type="button" data-close style="margin-top:12px">閉じる</button></div>', () => l.close());
    l.root.querySelector("[data-close]").onclick = () => l.close();
  }

  function showAchievements() {
    const l = layer('<div class="pop"><h2>実績 ' + got.size + " / " + ACH.length + "</h2>" + achListHtml() +
      '<button class="btn" type="button" data-close style="margin-top:12px">閉じる</button></div>', () => l.close());
    l.root.querySelector("[data-close]").onclick = () => l.close();
  }

  /* ============ 共通の部品 ============ */

  /** 画像にする前に、だいたい n 文字で折り返す。近くに空白があればそこで折る */
  function wrap(text, n) {
    if (text.length <= n) return text;
    const head = text.slice(0, n), sp = head.lastIndexOf(" ");
    const cut = sp >= n - 4 ? sp : n;
    return text.slice(0, cut).trim() + "\n" + text.slice(cut).trim();
  }

  /* 商品のカード。名前も価格も画像なので、目で探すしかない */
  const prodCard = (p) =>
    '<button class="prod" type="button" data-go="#item/' + p.id + '">' +
    '<span class="pic">' + photo(p.img, 240, 180) + "</span>" +
    '<span class="nm">' + ti(wrap(p.name, 12), { size: 12, weight: "500" }) + "</span>" +
    "<span>" + tp(p.price) + "</span>" +
    "<span>" + ti("税込・送料別", { size: 8, color: "#A4988C", weight: "400" }) + "</span></button>";

  /** 看板の1枚。写真の上に文字の画像を重ねるので、柄と重なって読みにくい */
  const slide = (name, text, size, on) =>
    '<div class="slide' + (on ? " on" : "") + '">' + photo(name, 640, 360) +
    '<span class="cap">' + tw(text, { size, weight: "800", family: '"Shippori Mincho", serif', align: "center" }) + "</span></div>";

  const NEWS = [
    "本日のおすすめは朝霧ブレンドです。",
    "臨時休業のお知らせ（詳細は店頭の掲示をご覧ください）",
    "焙煎機の点検にともない発送が遅れます。",
    "駐車場は近隣のコインパーキングをご利用ください。",
    "スタンプカードは紙のみのお取り扱いです。",
    "店内はキャッシュレス決済に対応しておりません。",
    "季節の珈琲羊羹が入荷しました。",
    "お席のご予約はお電話のみ承ります。",
    "インスタグラムは現在更新を停止しています。",
    "公式アプリの配信は終了しました。"
  ];

  /** 終わらないお知らせ。フッターは最後まで我慢した人だけが見られる */
  function infiniteFeed(host) {
    let loaded = 0, done = false;
    const sentinel = document.createElement("div");
    sentinel.className = "feed-loading";
    sentinel.textContent = "読み込み中…";

    const addRows = () => {
      const frag = document.createDocumentFragment();
      for (let i = 0; i < 4; i++) {
        const n = NEWS[(loaded * 4 + i) % NEWS.length];
        const d = new Date(Date.now() - (loaded * 4 + i) * 86400000);
        const row = document.createElement("div");
        row.className = "newsrow";
        row.innerHTML = '<span class="d">' + ti((d.getMonth() + 1) + "/" + d.getDate(), { size: 11, color: "#8A7A6C", weight: "400" }) + "</span>" +
          "<span>" + ti(wrap(n, 17), { size: 12, weight: "400" }) + "</span>";
        frag.appendChild(row);
      }
      host.insertBefore(frag, sentinel);
      loaded++;
      if (loaded >= 4 && !done) {
        done = true;
        sentinel.innerHTML = "";
        const b = document.createElement("button");
        b.type = "button";
        b.textContent = "この下を飛ばす";   // 極小で目立たない
        b.onclick = () => { achieve("footer"); sentinel.remove(); host.insertAdjacentHTML("beforeend", footerHtml()); };
        sentinel.appendChild(b);
      }
    };

    host.appendChild(sentinel);
    addRows();
    // 下まで来たら継ぎ足す。読み込み中の表示が画面に入るたびに増える
    const check = () => {
      if (done) return;
      if (sentinel.getBoundingClientRect().top < window.innerHeight + 140) addRows();
    };
    window.addEventListener("scroll", check, { passive: true });
    return () => window.removeEventListener("scroll", check);
  }

  const footerHtml = () =>
    '<div class="foot">' +
    tw("珈琲 和ごころ", { size: 16, weight: "800", family: '"Shippori Mincho", serif' }) +
    tw("東京都架空区架空町一丁目二番三号", { size: 11, weight: "400" }) +
    '<button type="button" data-phone>' + tw("TEL 03-0000-0000", { size: 12 }) + "</button>" +
    tw("営業時間・定休日は店頭の掲示をご確認ください", { size: 10, weight: "400" }) +
    '<button type="button" data-toast="このページは準備中です">' + tw("特定商取引法に基づく表記", { size: 10, weight: "400" }) + "</button>" +
    '<button type="button" data-toast="このページは準備中です">' + tw("プライバシーポリシー", { size: 10, weight: "400" }) + "</button>" +
    '<span class="cr">© 2026 珈琲 和ごころ（架空の店です）</span></div>';

  /* ハンバーガーの中に、もう一つハンバーガーがある */
  function showDrawer(depth) {
    const items = [
      ["#top", "ホーム"], ["#menu", "お品書き"], ["#shop", "オンラインストア"],
      ["#info", "店舗のご案内"], ["#cart", "お買い物かご"]
    ];
    const l = layer('<div class="drawer">' +
      (depth > 1 ? '<p class="note">メニュー ＞ ' + "メニュー ＞ ".repeat(depth - 2) + "メニュー</p>" : "") +
      items.map(([h, n]) => '<button class="row" type="button" data-hash="' + h + '">' + ti(n, { size: 13 }) + "</button>").join("") +
      '<button class="row" type="button" data-deeper>' + ti("☰ メニュー", { size: 13 }) + "</button>" +
      '<button class="tiny-link" type="button" data-close style="margin-top:10px">とじる</button></div>', () => l.close());
    l.root.querySelectorAll("[data-hash]").forEach((b) => { b.onclick = () => { l.close(); go(b.dataset.hash); }; });
    l.root.querySelector("[data-deeper]").onclick = () => { l.close(); showDrawer((depth || 1) + 1); };
    l.root.querySelector("[data-close]").onclick = () => l.close();
  }

  /** 豆を挽く。長押ししている間だけ挽け、離すと戻る */
  function askGrind(onDone) {
    const l = layer('<div class="pop"><h2>豆を挽いてください</h2>' +
      "<p>当店では鮮度のため、<b>お客様ご自身で</b>挽いていただいております。</p>" +
      '<div class="meter"><i id="grBar"></i></div>' +
      '<button class="press" type="button" id="grBtn"><i id="grFill"></i><span>長押しして挽く</span></button>' +
      '<p class="note" style="margin-top:8px">指を離すと元に戻ります。</p></div>', null);
    const bar = l.root.querySelector("#grBar"), fill = l.root.querySelector("#grFill");
    const stop = longPress(l.root.querySelector("#grBtn"), 3000, (pr) => {
      bar.style.width = fill.style.width = Math.round(pr * 100) + "%";
    }, () => {
      stop();
      S.ground = true;
      achieve("grind");
      l.close();
      toast("挽き終わりました");
      onDone();
    });
  }

  /* サイト内検索。文字が画像なので、何を入れても 0 件になる */
  function showSearch() {
    const l = layer('<div class="pop"><h2>サイト内検索</h2>' +
      '<form id="sf"><input type="text" id="sq" placeholder="例: 朝霧ブレンド" autocomplete="off">' +
      '<button class="btn" type="submit" style="margin-top:10px">検索</button></form>' +
      '<div id="sr" style="margin-top:12px"></div>' +
      '<button class="tiny-link" type="button" data-close style="margin-top:12px">とじる</button></div>', () => l.close());
    l.root.querySelector("[data-close]").onclick = () => l.close();
    l.root.querySelector("#sf").onsubmit = (e) => {
      e.preventDefault();
      const q = l.root.querySelector("#sq").value.trim();
      achieve("search0");
      l.root.querySelector("#sr").innerHTML =
        '<p><b>「' + esc(q) + "」に一致するページは 0 件でした。</b></p>" +
        '<p class="note">当サイトのお品書き・商品名・お知らせは画像のため、文字では検索できません。お手数ですが目でお探しください。</p>';
    };
  }

  /* Cookie バナー。「すべて同意する」だけが大きく、「設定」は画像の極小文字 */
  function showCookie() {
    if (S.cookieDone) return;
    const box = $("cookie");
    box.hidden = false;
    box.innerHTML = '<p class="note">当サイトは、より良い体験のために Cookie と類似の技術を使用します。詳しくは準備中のページをご覧ください。</p>' +
      '<button class="agree" type="button" id="ckAgree">すべて同意する</button>' +
      '<button class="settings" type="button" id="ckSet">' + ti("設定", { size: 9, color: "#8A7A6C", weight: "400" }) + "</button>";
    $("ckAgree").onclick = () => { S.cookieDone = true; box.hidden = true; toast("Cookie の設定を保存しました"); };
    $("ckSet").onclick = () => {
      achieve("cookie");
      const l = layer('<div class="pop"><h2>Cookie の設定</h2>' +
        ["必須", "機能", "分析", "広告", "その提供先 1,284 社"].map((n) =>
          '<label class="opt-row"><input type="checkbox" checked disabled><span>' + n + "（変更できません）</span></label>").join("") +
        '<p class="note" style="margin-top:10px">すべて拒否するには、お使いのブラウザの設定をご確認ください。</p>' +
        '<button class="btn" type="button" data-close style="margin-top:12px">同意して閉じる</button></div>', null);
      l.root.querySelector("[data-close]").onclick = () => { l.close(); S.cookieDone = true; box.hidden = true; };
    };
  }

  /* 画面の下に居座る予約バナー。閉じるボタンだけが画像で小さい */
  function drawReserveBar(show) {
    const bar = $("reserveBar");
    if (!show) { bar.hidden = true; return; }
    bar.hidden = false;
    bar.innerHTML = tw("ご予約・お問い合わせは\nお電話のみ承ります", { size: 12, weight: "700" }) +
      '<button type="button" data-phone>' + tw("03-0000-0000", { size: 15, weight: "900", color: "#FFE27A" }) + "</button>" +
      '<button class="x" type="button" id="barX">' + ti("×", { size: 9, color: "#8A7A6C", weight: "400" }) + "</button>";
    $("barX").onclick = () => { bar.hidden = true; toast("次のページでまた表示されます"); };
  }

  /* ============ お声掛け確認 ============
     当店は「お客様確認」のため、買い物の途中でも定期的に声を要求する。
     マイクを断られても詰まないよう、画面をたたく代わりの手を必ず出す。
     ?noshout=1 を付けると割り込まない（動作確認用）。 */
  // ?noshout=1 で割り込みを止め、?shout=1 ですぐ呼び出す（どちらも動作確認用）
  const NOSHOUT = params.has("noshout");
  const SHOUT = { done: 0, timer: 0, open: false };

  function scheduleShout(ms) {
    if (NOSHOUT) return;
    clearTimeout(SHOUT.timer);
    SHOUT.timer = setTimeout(openShout, ms);
  }
  const stopShout = () => clearTimeout(SHOUT.timer);

  function openShout() {
    if (!S.t0 || S.order) return;                        // 説明画面と注文後は呼ばない
    if (SHOUT.open) { scheduleShout(15000); return; }
    SHOUT.open = true;
    const l = layer('<div class="pop"><h2>お声掛けの確認</h2>' +
      "<p>当店ではお客様確認のため、" + (SHOUT.done ? "ふたたび" : "") + "お声掛けをお願いしております。</p>" +
      "<p><b>「いらっしゃいませ」</b>と大きな声でお願いします。</p>" +
      '<div class="meter"><i id="shBar"></i></div>' +
      '<div class="shout-lv" id="shLv">マイクの使用を許可してください。</div>' +
      '<button class="btn" type="button" id="shGo" style="margin-top:10px">マイクを使って声を出す</button>' +
      '<button class="tiny-link" type="button" id="shTap" style="margin-top:10px">声が出せない方はこちら（画面を20回たたく）</button>' +
      '<button class="tiny-link" type="button" id="shLater" style="margin-top:6px">いまは静かにしたい</button></div>', null);

    const bar = l.root.querySelector("#shBar");
    const lv = l.root.querySelector("#shLv");
    const go = l.root.querySelector("#shGo");
    let stopLoop = null, held = 0, taps = 0, mode = "";

    const pass = () => {
      if (stopLoop) { stopLoop(); stopLoop = null; }
      SHOUT.open = false;
      SHOUT.done++;
      achieve(mode === "mic" ? "shout" : "tap");
      if (SHOUT.done >= 3) achieve("shout3");
      l.close();
      toast("ありがとうございます。またお声掛けをお願いします");
      scheduleShout(40000 + Math.floor(Math.random() * 20000));
    };

    const toTapMode = (why) => {
      mode = "tap";
      lv.textContent = why;
      go.textContent = "たたく（のこり 20 回）";
      go.onclick = () => {
        taps++;
        bar.style.width = Math.min(100, taps / 20 * 100) + "%";
        go.textContent = "たたく（のこり " + Math.max(0, 20 - taps) + " 回）";
        if (taps >= 20) pass();
      };
    };

    go.onclick = async () => {
      go.disabled = true;
      const ok = await MIC.ask();
      go.disabled = false;
      if (!ok) { toTapMode("マイクを使えませんでした。画面をたたいてください。"); return; }
      mode = "mic";
      go.textContent = "声を出してください";
      stopLoop = loop((dt) => {
        const v = MIC.level();
        // 端末によってマイクの感度が違うので、少し甘めにしておく
        if (v > 0.3) held += dt; else held = Math.max(0, held - dt * 0.5);
        bar.style.width = Math.min(100, held * 100) + "%";
        lv.textContent = "いまの声の大きさ: " + Math.round(v * 100) + "%（30% 以上を1秒）";
        if (held >= 1) pass();
      });
    };
    l.root.querySelector("#shTap").onclick = () => toTapMode("画面をたたいてください。");
    l.root.querySelector("#shLater").onclick = () => {
      if (stopLoop) stopLoop();
      SHOUT.open = false;
      l.close();
      toast("15秒後にもう一度お伺いします");
      scheduleShout(15000);
    };
  }

  /* ============ お品書き（一枚の画像） ============
     店の「こだわり」で、メニューは1枚の画像にしている。
     文字が選べない・検索できない・翻訳できない・拡大するとぼやける。 */
  const BOARD = [
    "　　　　　お 品 書 き",
    "─────────────────────",
    "［ 珈琲 ］",
    "　本日の珈琲　　　　　　　　　　　520",
    "　朝霧ブレンド　　　　　　　　　　560",
    "　夕陽ブレンド　　　　　　　　　　580",
    "　深煎り 炭火仕立て　　　　　　　 600",
    "　アイス珈琲　　　　　　　　　　　580",
    "　カフェオレ（ホット／アイス）　　620",
    "［ 御茶 ］",
    "　抹茶　　　　　　　　　　　　　　600",
    "　ほうじ茶　　　　　　　　　　　　480",
    "［ 御菓子 ］",
    "　珈琲羊羹　　　　　　　　　　　　380",
    "　季節の和菓子　　　　　　　　　　420",
    "　珈琲クッキー（2枚）　　　　　　 300",
    "［ 御膳 ］",
    "　朝の御膳（11時まで）　　　　　　880",
    "　珈琲と羊羹の御膳　　　　　　　　820",
    "─────────────────────",
    "※価格は税込です。お席料は頂戴しておりません。",
    "※現金のみのお取り扱いです。",
    "※豆の販売はオンラインストアでも承ります。"
  ].join("\n");

  const HOURS = [
    ["日曜日", "10:00 － 17:00"],
    ["月曜日", "08:00 － 18:00"],
    ["火曜日", "08:00 － 18:00"],
    ["水曜日", "定休日"],
    ["木曜日", "08:00 － 18:00"],
    ["金曜日", "08:00 － 20:00"],
    ["土曜日", "10:00 － 17:00"]
  ];
  const closeToday = () => HOURS[new Date().getDay()][1].split("－")[1] ? HOURS[new Date().getDay()][1].split("－")[1].trim() : "定休日";

  /* ============ 画面 ============ */
  const VIEWS = {
    // 説明画面。ここでゲームの趣旨を伝え、「はじめる」でタイマーを動かす
    start(root) {
      root.innerHTML =
        '<div class="card intro">' +
        "<h2>これは <b>最悪の UX</b> のカフェのサイトです</h2>" +
        '<p class="note">架空の喫茶店です。<b>実際に注文が行われることはありません。</b></p>' +
        "<p>このサイトでは、店名・見出し・営業時間・住所・電話番号・商品名・価格が <b>すべて画像</b> です。" +
        "文字を選ぶこともコピーすることも検索することもできません。</p>" +
        '<div class="goal-box"><div class="lbl">ミッション</div>' +
        "<p>オンラインストアで <b>朝霧ブレンド 200g</b>（¥1,480）を <b>1袋だけ</b> 注文する</p></div>" +
        '<p class="note">定期便・ギフト包装・頼んでいない商品が混ざると失敗です。</p>' +
        '<p class="note">買い物の途中で、当店から <b>お声掛けの確認</b>（声を出す or 画面をたたく）が入ります。' +
        "豆は自分で挽き、注文はハンコを長押しして確定します。</p>" +
        '<button class="btn start" type="button" id="startBtn">はじめる</button>' +
        '<button class="tiny-link" type="button" id="seeRank" style="margin-top:10px">ランキングを見る</button></div>';
      $("startBtn").onclick = () => { S.t0 = performance.now(); scheduleShout(25000); go("#top"); };
      $("seeRank").onclick = showRanking;
    },

    top(root) {
      const ev = listeners();
      root.innerHTML =
        '<div class="hero" id="hero">' +
        slide("shop", "　自家焙煎　\n珈琲 和ごころ", 24, true) +
        slide("drip", "朝霧ブレンド\n新豆入荷", 22, false) +
        slide("interior", "店内でのご予約は\nお電話のみ", 20, false) +
        '<div class="dots">● ○ ○</div></div>' +
        '<div class="sec-title">' + th("店のご案内") + "</div>" +
        '<div class="tiles">' +
        '<button class="tile" type="button" data-go="#menu"><span>📜</span>' + ti("お品書き", { size: 10 }) + "</button>" +
        '<button class="tile" type="button" data-go="#shop"><span>🫘</span>' + ti("豆の通販", { size: 10 }) + "</button>" +
        '<button class="tile" type="button" data-go="#info"><span>📍</span>' + ti("店舗案内", { size: 10 }) + "</button></div>" +
        '<div class="sec-title">' + th("営業時間") + "</div>" +
        '<div class="card" style="text-align:center"><div class="sheet">' +
        imgText(HOURS.map(([d, h]) => d + "　" + h).join("\n"), { size: 12, weight: "600", family: '"Shippori Mincho", serif', lh: 1.9, pad: 4 }) +
        '</div><p class="note" style="margin-top:8px">※営業時間の表は画像です。本日の曜日は表示されません。</p></div>' +
        '<div class="sec-title">' + th("店内の様子") + "</div>" +
        '<div class="shot">' + photo("interior", 640, 360) +
        '<span class="cap">' + tw("店内は全席禁煙です", { size: 12 }) + "</span></div>" +
        '<div class="sec-title">' + th("お知らせ") + "</div>" +
        '<div class="card" id="feed"></div>';

      // 1.2 秒で勝手に切り替わる看板。押しても止まらない
      let k = 0;
      const car = setInterval(() => {
        const slides = $("hero").querySelectorAll(".slide");
        slides[k].classList.remove("on");
        k = (k + 1) % slides.length;
        slides[k].classList.add("on");
        $("hero").querySelector(".dots").textContent = ["● ○ ○", "○ ● ○", "○ ○ ●"][k];
      }, 1200);
      ev.on($("hero"), "click", () => { achieve("hero"); toast("写真は自動で切り替わります"); });

      const stopFeed = infiniteFeed($("feed"));
      const ck = setTimeout(showCookie, 600);
      return () => { clearInterval(car); clearTimeout(ck); stopFeed(); ev.off(); };
    },

    menu(root) {
      let zoom = 1, pressed = 0;
      root.innerHTML =
        '<div class="sec-title">' + th("お品書き") + "</div>" +
        '<div class="board"><div class="inner" id="boardInner"><div class="sheet">' +
        imgText(BOARD, { size: 11, weight: "600", family: '"Shippori Mincho", serif', color: "#2B1B12", lh: 1.7, pad: 6 }) +
        "</div></div></div>" +
        '<div class="board-tools"><button type="button" id="zoomOut">－</button><span id="zoomLbl" class="note">100%</span><button type="button" id="zoomIn">＋</button></div>' +
        '<p class="note" style="margin-top:10px">お品書きは1枚の画像です。テキスト版はご用意しておりません。' +
        "読みにくい場合は、拡大してご覧ください。</p>" +
        '<div class="card" style="margin-top:12px"><p class="note">お品書きの中に「豆の販売はオンラインストアでも承ります」と書かれていますが、' +
        "画像なので押せません。</p>" +
        '<button class="tiny-link" type="button" data-go="#shop">オンラインストアへ（この文字だけ本物です）</button></div>';
      const apply = () => {
        $("boardInner").style.zoom = zoom;
        $("zoomLbl").textContent = Math.round(zoom * 100) + "%";
        if (++pressed >= 4) achieve("zoom");   // 最初の描画ぶんを除いて3回
      };
      $("zoomIn").onclick = () => { zoom = clamp(zoom + 0.5, 1, 3); apply(); };
      $("zoomOut").onclick = () => { zoom = clamp(zoom - 0.5, 1, 3); apply(); };
      apply();
    },

    info(root) {
      root.innerHTML =
        '<div class="sec-title">' + th("店舗のご案内") + "</div>" +
        '<div class="card"><div class="rows">' +
        "<div>" + ti("店名", { size: 11, color: "#8A7A6C", weight: "500" }) + "<br>" + ti("珈琲 和ごころ 架空町本店", { size: 14 }) + "</div>" +
        "<div>" + ti("所在地", { size: 11, color: "#8A7A6C", weight: "500" }) + "<br>" + ti("東京都架空区架空町一丁目二番三号\n架空ビル 1階", { size: 13, weight: "500" }) + "</div>" +
        "<div>" + ti("アクセス", { size: 11, color: "#8A7A6C", weight: "500" }) + "<br>" + ti("架空線 架空駅 東口より徒歩7分\n（地図はご用意しておりません）", { size: 13, weight: "500" }) + "</div>" +
        "<div>" + ti("電話番号", { size: 11, color: "#8A7A6C", weight: "500" }) + "<br>" +
        '<button type="button" data-phone>' + ti("03-0000-0000", { size: 17, weight: "900" }) + "</button></div>" +
        "<div>" + ti("定休日", { size: 11, color: "#8A7A6C", weight: "500" }) + "<br>" + ti("水曜日（祝日の場合は営業）", { size: 13, weight: "500" }) + "</div>" +
        '</div><p class="note" style="margin-top:10px">住所・電話番号は画像のため、コピーも発信もできません。お手数ですが手で書き写してください。</p></div>' +
        '<div class="sec-title">' + th("地図") + "</div>" +
        '<div class="shot">' + photo("map", 640, 360) +
        '<span class="cap">' + tw("現在地からの経路はご案内できません", { size: 11 }) + "</span></div>" +
        '<p class="note" style="margin-top:8px">地図は画像です。拡大しても番地は書かれていません。' +
        "印刷してお持ちいただくことをおすすめします。</p>" +
        '<div class="sec-title">' + th("外観") + "</div>" +
        '<div class="shot">' + photo("shop", 640, 360) +
        '<span class="cap">' + tw("水曜日は定休日です", { size: 11 }) + "</span></div>" +
        '<div class="card" style="margin-top:12px"><h2 style="font-size:15px">本日の閉店時刻をご確認ください</h2>' +
        '<p class="note">トップページの営業時間の表（画像）を見て、本日の閉店時刻を選んでください。</p>' +
        '<select id="hq" style="margin-top:8px"><option value="">選択してください</option>' +
        ["17:00", "18:00", "20:00", "定休日", "22:00"].map((h) => '<option value="' + h + '">' + h + "</option>").join("") +
        '</select><button class="btn" type="button" id="hqBtn" style="margin-top:10px">確認する</button>' +
        '<div id="hqOut" class="note" style="margin-top:8px"></div></div>' +
        '<div class="card"><p class="note">お席のご予約・お問い合わせはお電話のみ承ります。' +
        "オンラインでのご予約は準備中です（2019年より準備中）。</p></div>";
      $("hqBtn").onclick = () => {
        const v = $("hq").value;
        const ans = closeToday();
        if (!v) { $("hqOut").textContent = "選択してください。"; return; }
        if (v === ans) { achieve("hours"); $("hqOut").textContent = "正解です。本日は " + ans + " に閉店します。"; }
        else $("hqOut").textContent = "ちがいます。画像の表をもう一度ご確認ください。";
      };
    },

    shop(root) {
      // 「おすすめ順（当社の）」= 宣伝が先、あとは高い順
      const rest = PRODUCTS.filter((p) => !p.pr).sort((a, b) => b.price - a.price);
      const list = PRODUCTS.filter((p) => p.pr).concat(rest);
      root.innerHTML =
        '<div class="sec-title">' + th("オンラインストア") + "</div>" +
        '<div class="list-tools" style="display:flex;gap:8px;align-items:center;margin-bottom:8px">' +
        '<span class="note">' + list.length + "件</span>" +
        '<select style="flex:1"><option>おすすめ順（当社の）</option><option disabled>価格の安い順（準備中）</option>' +
        "<option disabled>新着順（準備中）</option></select></div>" +
        '<div class="grid">' + list.map(prodCard).join("") + "</div>" +
        '<p class="note" style="margin-top:12px">商品名は画像です。似た名前の商品が並んでいますので、よくお確かめのうえお選びください。</p>';
    },

    item(root, id) {
      const p = P(id);
      if (!p) { root.innerHTML = '<div class="card"><p>この商品は取り扱いを終了しました。</p></div>'; return; }
      let watchers = 12 + (p.price % 9);
      root.innerHTML =
        '<div class="item-pic">' + photo(p.img, 480, 288) + "</div>" +
        '<div style="margin-top:10px">' + ti(p.name, { size: 17, weight: "800" }) + "</div>" +
        "<div>" + imgText(yen(p.price), { size: 24, weight: "900", color: "#B23A2A" }) +
        ti("　（税込・送料別）", { size: 9, color: "#A4988C", weight: "400" }) + "</div>" +
        '<div class="urgent">残り1点！（ずっと）　<span id="watch">' + watchers + "</span> 人が見ています</div>" +
        '<div class="card" style="margin-top:12px">' +
        '<div class="grind"><div>' + ti("挽き方をお選びください", { size: 12 }) + "</div>" +
        '<input type="range" id="grind" min="0" max="4" step="1" value="2">' +
        '<div class="ticks">' + GRINDS.map((g) => ti(g, { size: 8, color: "#8A7A6C", weight: "400" })).join("") + "</div>" +
        '<div id="grindNow" class="note"></div></div>' +
        '<label style="margin-top:14px">' + ti("数量", { size: 12 }) + "</label>" +
        '<select id="qty">' + Array.from({ length: 100 }, (_, i) => "<option" + (i + 1 === 3 ? " selected" : "") + ">" + (i + 1) + "</option>").join("") + "</select>" +
        '<label class="opt-row"><input type="checkbox" id="oG" checked><span>' + ti("ギフト包装を付ける ＋¥330", { size: 12, weight: "400" }) + "</span></label>" +
        '<label class="opt-row"><input type="checkbox" id="oS" checked><span>' + ti("定期便をやめない（毎月お届け）", { size: 12, weight: "400" }) + "</span></label>" +
        '<button class="buy-big" type="button" id="subBuy">定期便で申し込む</button>' +
        '<button class="buy-small" type="button" id="addCart">1回だけ購入する（かごに入れる）</button>' +
        '<p class="note" style="margin-top:8px">※定期便の解約はお電話のみ承ります。</p></div>' +
        '<div class="card"><b style="font-size:13px">お客様の声</b>' +
        '<div class="review"><span class="stars">★★★★★</span> 香りがよいです。（当店スタッフ）</div>' +
        '<div class="review"><span class="stars">★★★★★</span> 毎朝飲んでいます。（当店スタッフの家族）</div>' +
        '<div class="review"><span class="stars">★☆☆☆☆</span> この投稿は店主の判断により非表示になりました。</div></div>';

      const w = setInterval(() => { watchers += 1 + (watchers % 2); $("watch").textContent = watchers; }, 2600);
      const showGrind = () => {
        const v = Number($("grind").value);
        $("grindNow").innerHTML = "ただいまの選択: " + ti(GRINDS[v], { size: 12, weight: "700" });
        if (v === 0) achieve("bean");
      };
      $("grind").oninput = showGrind;
      showGrind();
      const opts = () => ({ grind: Number($("grind").value), gift: $("oG").checked, sub: $("oS").checked });
      $("subBuy").onclick = () => { addToCart(p.id, Number($("qty").value), Object.assign(opts(), { sub: true })); go("#cart"); };
      $("addCart").onclick = () => {
        addToCart(p.id, Number($("qty").value), opts());
        ask("ご一緒にいかがですか？<br>" + ti("珈琲羊羹（5本） ¥1,200", { size: 12, weight: "500" }), [
          { label: "かごに入れる", cls: "yes", onClick: () => { addToCart("youkan", 1, {}); toast("かごに入れました"); go("#cart"); } },
          { label: "入れない", cls: "no", onClick: () => { toast("かごに入れました"); go("#cart"); } }
        ]);
      };
      return () => clearInterval(w);
    },

    cart(root) {
      // 初めて開いたときに、頼んでいない商品をこっそり足す
      if (S.cart.length && !S.tumblerAdded) { S.tumblerAdded = true; addToCart("tumbler", 1, {}); }
      const ev = listeners();
      const draw = () => {
        drawBadge();
        drawMission();
        if (!S.cart.length) {
          root.innerHTML = '<div class="card"><p>お買い物かごは空です。</p>' +
            '<button class="btn" type="button" data-go="#shop" style="margin-top:10px">オンラインストアへ</button></div>';
          return;
        }
        root.innerHTML =
          '<div class="sec-title">' + th("お買い物かご") + "</div>" +
          S.cart.map((l, i) => {
            const p = P(l.id);
            const addon = (key, label) => l[key] ? '<div class="addon"><span>' + ti(ADDONS[key].name + (ADDONS[key].price ? " ¥" + ADDONS[key].price : ""), { size: 11, weight: "500" }) +
              '</span><button type="button" data-rm="' + key + '" data-i="' + i + '">' + label + "</button></div>" : "";
            return '<div class="card"><div class="line"><div class="pic">' + photo(p.img, 112, 112) + "</div><div>" +
              "<div>" + ti(p.name, { size: 12, weight: "700" }) + "</div>" +
              (l.id === "tumbler" && S.tumblerAdded ? '<div class="note">よく一緒にご購入されています（自動で追加しました）</div>' : "") +
              (p.cat === "豆" ? '<div class="note">挽き方: ' + GRINDS[l.grind] + "</div>" : "") +
              "<div>" + tp(p.price) + "</div>" +
              '<div style="margin-top:4px;font-size:12px">数量 <select data-qty="' + i + '" style="width:auto;display:inline-block">' +
              Array.from({ length: 100 }, (_, k) => "<option" + (k + 1 === l.qty ? " selected" : "") + ">" + (k + 1) + "</option>").join("") + "</select> " +
              '<button class="tiny-link" type="button" data-del="' + i + '">削除</button></div></div></div>' +
              addon("gift", "包装をやめる") + addon("sub", "定期便を解除する（おすすめしません）") + "</div>";
          }).join("") +
          '<div class="card"><div class="sum"><span>' + ti("小計", { size: 13 }) + "</span>" + tp(subtotal()) + "</div>" +
          '<p class="note">送料・手数料はお支払い画面で加算されます。</p>' +
          '<button class="btn" type="button" id="toReg" style="margin-top:12px">レジに進む</button>' +
          (S.member ? "" : '<p class="note" style="margin-top:8px">ご注文には <b>会員登録（無料）</b> が必要です。</p>') + "</div>";
        $("toReg").onclick = () => {
          const beans = S.cart.some((l) => P(l.id).cat === "豆");
          if (beans && !S.ground) { askGrind(() => go(S.member ? "#ship" : "#signup")); return; }
          go(S.member ? "#ship" : "#signup");
        };
      };
      ev.on(root, "change", (e) => {
        const s = e.target.closest("[data-qty]");
        if (s) { S.cart[Number(s.dataset.qty)].qty = Number(s.value); draw(); }
      });
      ev.on(root, "click", (e) => {
        const del = e.target.closest("[data-del]");
        if (del) {
          const l = S.cart[Number(del.dataset.del)];
          if (l && l.id === "tumbler") achieve("tumbler");
          S.cart.splice(Number(del.dataset.del), 1);
          draw();
          return;
        }
        const rm = e.target.closest("[data-rm]");
        if (!rm) return;
        const l = S.cart[Number(rm.dataset.i)], key = rm.dataset.rm;
        const off = () => { l[key] = false; if (key === "sub") achieve("unsub"); draw(); };
        if (key === "sub") {
          ask("定期便を解除すると、次回以降のお届けが止まります。本当に解除しますか？", [
            { label: "定期便を続ける", cls: "yes", onClick: () => toast("定期便を継続します") },
            { label: "解除する", cls: "no", onClick: off }
          ]);
        } else off();
      });
      draw();
      return () => ev.off();
    },

    // かごの中に豆があると、レジに進む前に自分で挽かされる
    signup(root) {
      root.innerHTML =
        '<div class="sec-title">' + th("会員登録") + "</div>" +
        '<div class="card"><div class="rows">' +
        "<div><label>" + ti("メールアドレス ※", { size: 12 }) + '</label><input type="text" id="f1" autocomplete="off"></div>' +
        "<div><label>" + ti("お名前", { size: 12 }) + '</label><input type="text" id="f2" autocomplete="off"></div>' +
        "<div><label>" + ti("お電話番号 ※", { size: 12 }) + '</label><input type="text" id="f3" autocomplete="off"></div>' +
        "</div>" +
        '<p class="note" style="margin-top:8px">' + ti("※ の項目は必須です（画像のため読み上げには対応しておりません）", { size: 9, color: "#A4988C", weight: "400" }) + "</p>" +
        '<label class="opt-row"><input type="checkbox" id="c1"><span>' + ti("利用規約に同意する", { size: 12, weight: "400" }) + "</span></label>" +
        '<label class="opt-row"><input type="checkbox" id="c2"><span>' + ti("メールマガジンを受け取らないことを希望しない", { size: 12, weight: "400" }) + "</span></label>" +
        '<div style="margin-top:14px">' + ti("確認コードを画像から書き写してください", { size: 12 }) + "</div>" +
        '<div class="code" id="codeBox" style="margin-top:6px"></div>' +
        '<input type="text" id="cap" inputmode="numeric" autocomplete="off" style="margin-top:8px" placeholder="半角数字5桁">' +
        '<button class="btn" type="button" id="reg" style="margin-top:14px">登録してレジに進む</button>' +
        '<div class="err" id="regErr" hidden>入力内容をご確認ください。</div>' +
        '<button class="tiny-link" type="button" id="guest" style="margin-top:10px">会員登録せずに購入する</button></div>' +
        '<div class="card"><p class="note">お名前は必須ではありませんが、未入力の場合はご注文を承れません。' +
        "詳しくは利用規約（準備中）をご覧ください。</p></div>";
      // 確認コードは画像。読みにくくしてあるので、目で読んで書き写すしかない
      let code = "";
      const newCode = () => {
        code = String(Math.floor(10000 + Math.random() * 89999));
        $("codeBox").innerHTML = imgText(code.split("").join(" "), { size: 22, weight: "900", color: "#6B5B4C" });
        if (params.has("showcode")) console.log("確認コード:", code);   // 動作確認用
      };
      newCode();
      $("guest").onclick = () => { achieve("guest"); toast("ゲスト購入は現在ご利用いただけません"); };
      $("reg").onclick = () => {
        // どこが足りないかは教えない
        const filled = $("f1").value.trim() && $("f2").value.trim() && $("f3").value.trim() && $("c1").checked;
        const codeOk = $("cap").value.replace(/[^0-9]/g, "") === code;
        $("regErr").hidden = !!(filled && codeOk);
        if (!filled) return;
        if (!codeOk) { newCode(); $("cap").value = ""; return; }   // 間違えるとコードも作り直される
        achieve("captcha");
        S.member = true;
        toast("会員登録が完了しました");
        go("#ship");
      };
    },

    ship(root) {
      const days = Array.from({ length: 20 }, (_, i) => new Date(Date.now() + (i + 3) * 86400000));
      const times = ["指定なし（終日）"].concat(Array.from({ length: 95 }, (_, i) => {
        const m = i * 15, a = String(Math.floor(m / 60)).padStart(2, "0") + ":" + String(m % 60).padStart(2, "0");
        const n = m + 15, b = String(Math.floor(n / 60)).padStart(2, "0") + ":" + String(n % 60).padStart(2, "0");
        return a + " － " + b;
      }));
      root.innerHTML =
        '<div class="sec-title">' + th("お届け日時") + "</div>" +
        '<div class="card"><label>' + ti("お届け日をお選びください", { size: 12 }) + "</label>" +
        '<div class="days">' + days.map((d, i) =>
          '<button class="day" type="button" data-day="' + i + '">' +
          ti((d.getMonth() + 1) + "/" + d.getDate(), { size: 10, weight: "700" }) + "</button>").join("") + "</div>" +
        '<p class="note" style="margin-top:8px">水曜日は定休日ですが、選べます。</p>' +
        '<label style="margin-top:14px">' + ti("時間帯（15分単位）", { size: 12 }) + "</label>" +
        '<select id="time">' + times.map((t) => "<option>" + t + "</option>").join("") + "</select>" +
        '<div style="margin-top:14px">' + ti("送料 ¥660（全国一律・ここで加算されます）", { size: 11, weight: "700" }) + "</div>" +
        '<button class="btn" type="button" id="next" style="margin-top:12px">お支払いへ</button>' +
        '<div class="err" id="shErr" hidden>入力内容をご確認ください。</div></div>';
      const sel = () => root.querySelectorAll(".day").forEach((b, i) => b.classList.toggle("on", S.day === i));
      root.querySelectorAll(".day").forEach((b) => { b.onclick = () => { S.day = Number(b.dataset.day); sel(); drawMission(); }; });
      sel();
      $("next").onclick = () => {
        if (S.day === null) { $("shErr").hidden = false; return; }
        S.time = $("time").value;
        go("#pay");
      };
    },

    pay(root) {
      let stopPress = null;
      const PAYS = [
        ["later", "あと払い（手数料 ¥330）"],
        ["card", "クレジットカード"],
        ["cod", "代金引換（手数料 ¥440・現金のみ）"]
      ];
      const draw = () => {
        root.innerHTML =
          '<div class="sec-title">' + th("お支払い") + "</div>" +
          '<div class="card"><label>' + ti("お支払い方法", { size: 12 }) + "</label>" +
          '<div class="pays">' + PAYS.map(([v, n]) =>
            '<label class="pay"><input type="radio" name="pay" value="' + v + '"' + (S.pay === v ? " checked" : "") + ">" +
            ti(n, { size: 12, weight: "500" }) + "</label>").join("") + "</div>" +
          '<p class="note" style="margin-top:8px">既定では「あと払い」が選ばれています。</p></div>' +
          '<div class="card"><div class="sum"><span>' + ti("小計", { size: 12, weight: "500" }) + "</span>" + ti(yen(subtotal()), { size: 13, weight: "700" }) + "</div>" +
          '<div class="sum"><span>' + ti("送料", { size: 12, weight: "500" }) + "</span>" + ti(yen(SHIP), { size: 13, weight: "700" }) + "</div>" +
          (S.pay === "later" ? '<div class="sum"><span>' + ti("あと払い手数料", { size: 12, weight: "500" }) + "</span>" + ti(yen(LATER_FEE), { size: 13, weight: "700" }) + "</div>" : "") +
          (S.pay === "cod" ? '<div class="sum"><span>' + ti("代引手数料", { size: 12, weight: "500" }) + "</span>" + ti(yen(440), { size: 13, weight: "700" }) + "</div>" : "") +
          '<div class="sum" style="border-top:1px solid var(--line);margin-top:6px;padding-top:8px"><span>' + ti("合計", { size: 14 }) + "</span>" +
          imgText(yen(grandTotal() + (S.pay === "cod" ? 440 : 0)), { size: 20, weight: "900", color: "#B23A2A" }) + "</div>" +
          '<p class="note">合計は画像です。控えが必要な場合は画面を撮影してください。</p>' +
          '<button class="press" type="button" id="fix" style="margin-top:12px;background:var(--bad)">' +
          '<i id="fixFill"></i><span>長押しでハンコを押す（注文の確定）</span></button>' +
          '<div class="meter" style="margin-top:6px"><i id="fixBar"></i></div>' +
          '<button class="tiny-link" type="button" data-go="#cart" style="margin-top:8px">かごに戻る</button></div>';
        root.querySelectorAll('input[name="pay"]').forEach((r) => { r.onchange = () => { S.pay = r.value; draw(); }; });
        if (stopPress) stopPress();
        stopPress = longPress($("fix"), 1800, (pr) => {
          const w = Math.round(pr * 100) + "%";
          $("fixFill").style.width = w;
          $("fixBar").style.width = w;
        }, () => {
          if (stopPress) { stopPress(); stopPress = null; }
          achieve("hanko");
          const total = grandTotal() + (S.pay === "cod" ? 440 : 0);
          S.endT = performance.now();
          S.order = {
            no: "WG-" + String(Math.floor(Date.now() / 1000) % 100000).padStart(5, "0"),
            lines: S.cart.map((l) => Object.assign({}, l)),
            total,
            sec: (S.endT - S.t0) / 1000
          };
          achieve("ordered");
          if (isPerfect(S.order)) achieve("perfect");
          stopShout();
          go("#done");
        });
      };
      draw();
      return () => { if (stopPress) stopPress(); };
    },

    done(root) {
      const o = S.order;
      if (!o) { root.innerHTML = '<div class="card"><p>ご注文が見つかりません。</p></div>'; return; }
      const perfect = isPerfect(o);
      stopShout();
      let sent = false;
      root.innerHTML =
        '<div class="card"><h2>' + (perfect ? "ミッション達成" : "注文は完了しました") + "</h2>" +
        "<div>" + ti("ご注文番号 " + o.no, { size: 14, weight: "700" }) + "</div>" +
        '<p class="note" style="margin-top:6px">注文番号は画像です。お問い合わせの際は手で書き写してお伝えください。</p>' +
        '<div class="sum" style="margin-top:10px"><span>お支払い総額</span><b>' + yen(o.total) + "</b></div>" +
        '<div class="sum"><span>所要時間</span><b>' + mmss(o.sec) + "</b></div>" +
        '<div class="sum"><span>実績</span><b>🏆 ' + got.size + " / " + ACH.length + "</b></div>" +
        "<p" + (perfect ? "" : ' class="err"') + ' style="margin-top:10px">' +
        (perfect ? "朝霧ブレンド 200g を1袋だけ買えました。おめでとうございます。" :
          "余計なものが混ざっています: " + o.lines.map((l) => P(l.id).name + "×" + l.qty + (l.sub ? "（定期便）" : "") + (l.gift ? "（包装）" : "")).join(" / ")) +
        "</p></div>" +
        '<div class="card"><label>ニックネーム（12文字まで）</label>' +
        '<input type="text" id="nick" maxlength="12" value="' + esc(localStorage.getItem(NAME_KEY) || "") + '">' +
        '<button class="btn" type="button" id="send" style="margin-top:10px">ランキングに登録</button>' +
        '<div id="sendOut" class="note" style="margin-top:8px"></div>' +
        '<div id="rankBox" class="note" style="margin-top:10px"></div></div>' +
        '<div class="card"><b style="font-size:13px">実績</b>' + achListHtml() + "</div>" +
        '<button class="btn" type="button" id="again" style="margin-top:12px">もう一度あそぶ</button>';
      $("send").onclick = () => {
        if (sent) return;
        sent = true;
        const name = ($("nick").value || "名無し").slice(0, 12);
        try { localStorage.setItem(NAME_KEY, name); } catch (e) { /* 保存できない環境は無視 */ }
        const rec = { ts: Date.now(), name, sec: Math.round(o.sec), total: o.total, achievements: got.size, perfect };
        $("sendOut").textContent = "送信中…";
        RANK.send(rec).then((r) => {
          $("sendOut").textContent = r.shared && !r.ok ? "共有ランキングに送れませんでした（この端末には記録しました）" : "登録しました。";
          fillRanking($("rankBox"), rec);
        });
      };
      fillRanking($("rankBox"), null);
      $("again").onclick = () => {
        S.t0 = 0; S.endT = 0; S.member = false; S.cart = []; S.tumblerAdded = false;
        S.day = null; S.time = ""; S.pay = "later"; S.order = null; S.cookieDone = false; S.ground = false;
        SHOUT.done = 0;
        drawBadge();
        go("#start");
      };
    }
  };

  /* ============ 画面遷移 ============ */
  const CAFE_PAGES = { top: 1, menu: 1, info: 1 };   // 予約バナーを出すページ
  let cleanupView = null;
  function go(hash) { if (location.hash === hash) render(); else location.hash = hash; }
  function render() {
    if (cleanupView) { cleanupView(); cleanupView = null; }
    closeDialog();
    document.querySelectorAll(".layer").forEach((l) => l.remove());
    const h = location.hash.slice(1) || (S.t0 ? "top" : "start");
    const [name, rest] = h.split(/[/?](.*)/s);
    const view = VIEWS[name] ? name : (S.t0 ? "top" : "start");
    $("siteHead").hidden = view === "start";
    drawReserveBar(!!CAFE_PAGES[view]);
    if (view !== "top") $("cookie").hidden = true;
    drawMission();
    const root = $("view");
    root.innerHTML = "";
    window.scrollTo(0, 0);
    cleanupView = VIEWS[view](root, rest || "") || null;
  }

  // data-go / data-toast / data-phone はどの画面でも効くようにまとめて拾う
  document.addEventListener("click", (e) => {
    const g = e.target.closest("[data-go]");
    if (g) { go(g.dataset.go); return; }
    const ph = e.target.closest("[data-phone]");
    if (ph) { achieve("phone"); toast("電話番号は画像です。お手数ですが手で入力してください"); return; }
    const t = e.target.closest("[data-toast]");
    if (t) toast(t.dataset.toast);
  });

  // 画像の文字を選ぼうとした人へ
  const imgHit = (e) => { if (e.target.matches("img.t")) { achieve("imgtext"); toast("この文字は画像です。選択もコピーもできません"); } };
  document.addEventListener("dblclick", imgHit);
  document.addEventListener("contextmenu", (e) => { if (e.target.matches("img.t")) { e.preventDefault(); imgHit(e); } });

  $("logo").innerHTML = th("珈琲 和ごころ", { size: 18, color: "#F6EFE3" });
  $("logo").onclick = () => go("#top");
  $("menuBtn").onclick = () => showDrawer(1);
  $("cartBtn").onclick = () => go("#cart");
  $("searchBtn").onclick = showSearch;
  $("bgmBtn").onclick = () => toast("店内 BGM は配信しておりません");
  $("trophy").onclick = showAchievements;
  $("missionBtn").onclick = showMission;

  setInterval(() => {
    const sec = S.t0 ? ((S.endT || performance.now()) - S.t0) / 1000 : 0;
    $("clock").textContent = "⏱ " + mmss(sec);
  }, 500);

  drawTrophy();
  drawBadge();
  window.addEventListener("hashchange", render);
  render();
  if (params.has("shout")) { S.t0 = S.t0 || performance.now(); scheduleShout(500); }   // 動作確認用
})();
