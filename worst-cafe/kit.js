/* カフェ「珈琲 和ごころ」の共通小道具。site.js からは window.KIT 経由で使う。
   いちばん大事な道具は imgText。文字を画像にして返す。
   画像にすると、選択・コピー・検索・翻訳・読み上げができなくなり、拡大するとぼやける。
   このサイトの「最悪さ」の中心はこれなので、地の文は読める作りにしておく。 */
(() => {
  "use strict";

  const $ = (id) => document.getElementById(id);
  const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
  const esc = (s) => String(s).replace(/[<>&"]/g, (c) => ({ "<": "&lt;", ">": "&gt;", "&": "&amp;", '"': "&quot;" }[c]));
  const yen = (v) => "¥" + Number(v).toLocaleString("ja-JP");
  const mmss = (sec) => String(Math.floor(sec / 60)).padStart(2, "0") + ":" + String(Math.floor(sec % 60)).padStart(2, "0");

  /* ============ 文字を画像にする ============ */

  /* 等倍（devicePixelRatio を無視）で描くので、スマホの高精細画面や拡大ではぼやける。
     jpeg を指定すると低い画質の JPEG になり、文字のまわりに圧縮のにじみが出る。
     up を 1 より大きくすると、実寸より大きく表示してさらに荒くする。
     alt は空のまま返すので、読み上げソフトにも検索にも引っかからない。
     Web フォントの読み込みが終わる前に描かれた画像は、本文と書体がずれる。 */
  const cache = new Map();
  const canvas = document.createElement("canvas");
  const ctx = canvas.getContext("2d");

  function render(lines, o) {
    const font = o.weight + " " + o.size + "px " + o.family;
    ctx.font = font;
    if (o.ls) ctx.letterSpacing = o.ls;   // 対応していない環境では無視される
    const w = Math.ceil(Math.max.apply(null, lines.map((t) => ctx.measureText(t).width))) + o.pad * 2 + (o.ls ? o.size : 0);
    const lh = Math.round(o.size * o.lh);
    const h = lh * lines.length + o.pad * 2;
    canvas.width = w;
    canvas.height = h;
    const c = canvas.getContext("2d");
    // JPEG は透明を扱えないので、下地の色を必ず塗る
    const bg = o.bg || (o.jpeg ? "#FAF7F2" : "");
    if (bg) { c.fillStyle = bg; c.fillRect(0, 0, w, h); }
    c.font = font;
    if (o.ls) c.letterSpacing = o.ls;
    c.fillStyle = o.color;
    c.textBaseline = "middle";
    c.textAlign = o.align;
    const x = o.align === "center" ? w / 2 : o.align === "right" ? w - o.pad : o.pad;
    lines.forEach((t, i) => c.fillText(t, x, o.pad + lh * i + lh / 2));
    const url = o.jpeg ? canvas.toDataURL("image/jpeg", o.jpeg) : canvas.toDataURL("image/png");
    return { url, w, h };
  }

  /** 文字を画像の <img> にして HTML 文字列で返す */
  function imgText(text, opt) {
    const o = Object.assign({
      size: 15, weight: "700", color: "#2B1B12", bg: "",
      family: '"Noto Sans JP", system-ui, sans-serif',
      lh: 1.5, pad: 2, align: "left", cls: "", jpeg: 0, up: 1, ls: ""
    }, opt || {});
    const lines = String(text).split("\n");
    const key = JSON.stringify([lines, o]);
    let m = cache.get(key);
    if (!m) { m = render(lines, o); cache.set(key, m); }
    // 実寸より up 倍に伸ばして表示する。伸ばすほど荒くなる
    const w = Math.round(m.w * o.up), h = Math.round(m.h * o.up);
    return '<img class="t ' + o.cls + '" src="' + m.url + '" width="' + w + '" height="' + h + '" alt="" draggable="false">';
  }

  /* ============ 通知とダイアログ ============ */
  let toastTimer = 0;
  function toast(msg, ms) {
    const box = $("toast");
    box.textContent = msg;
    box.classList.add("on");
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => box.classList.remove("on"), ms || 2200);
  }

  const closeDialog = () => $("dialog").classList.remove("on");

  /** ボタン付きの確認ダイアログ。buttons は [{ label, cls, onClick }] */
  function ask(html, buttons) {
    const box = $("dialogBox");
    box.innerHTML = '<div class="dtext">' + html + '</div><div class="drow"></div>';
    const row = box.querySelector(".drow");
    buttons.forEach((b) => {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "dbtn " + (b.cls || "");
      btn.innerHTML = b.label;
      btn.onclick = () => { closeDialog(); if (b.onClick) b.onClick(); };
      row.appendChild(btn);
    });
    $("dialog").classList.add("on");
  }

  /** 画面の上に重ねる層。外側を押すと onOutside が呼ばれる */
  function layer(html, onOutside) {
    const root = document.createElement("div");
    root.className = "layer";
    root.innerHTML = html;
    root.addEventListener("click", (e) => { if (e.target === root && onOutside) onOutside(); });
    document.body.appendChild(root);
    return { root, close: () => root.remove() };
  }

  /** 画面を離れるときにまとめて外せるイベント登録 */
  function listeners() {
    const list = [];
    return {
      on(target, type, fn, opt) { target.addEventListener(type, fn, opt); list.push([target, type, fn, opt]); },
      off() { list.forEach(([t, ty, f, o]) => t.removeEventListener(ty, f, o)); list.length = 0; }
    };
  }

  /* ============ 挿絵 ============
     同梱の img/*.jpg（わざと小さく粗く焼いた画像。もとの絵は img/*.svg）を使う。
     config.js の window.WAGOKORO_PHOTO_BASE にフリー写真の配信元
     （例: https://picsum.photos/seed）を書くと、そちらを先に読み、
     読めなかったときだけ同梱の画像に戻す。 */
  function photo(name, w, h, cls) {
    const local = "img/" + name + ".jpg";
    const base = String(window.WAGOKORO_PHOTO_BASE || "").replace(/\/$/, "");
    const src = base ? base + "/wagokoro-" + name + "/" + w + "/" + h : local;
    return '<img class="ph ' + (cls || "") + '" src="' + src + '" width="' + w + '" height="' + h +
      '" alt="" data-local="' + local + '" draggable="false">';
  }
  // 外部の写真が読めなかったら、同梱の画像にそっと差し替える
  document.addEventListener("error", (e) => {
    const img = e.target;
    if (img && img.tagName === "IMG" && img.dataset.local && img.src.indexOf(img.dataset.local) < 0) {
      img.src = img.dataset.local;
    }
  }, true);

  /* ============ 毎フレームの繰り返し ============ */
  function loop(fn, maxDt) {
    let id = 0, last = performance.now(), stopped = false;
    const step = (now) => {
      if (stopped) return;
      const dt = Math.min((now - last) / 1000, maxDt || 0.05);
      last = now;
      fn(dt);
      id = requestAnimationFrame(step);
    };
    id = requestAnimationFrame(step);
    return () => { stopped = true; cancelAnimationFrame(id); };
  }

  /* ============ マイク（声の大きさ） ============
     「お声掛け確認」や「息で冷ます」で使う。断られても詰まないよう、呼び出し側で必ず代わりの手を用意する。 */
  const MIC = {
    ready: false, denied: false, analyser: null, buf: null,
    async ask() {
      if (this.ready) return true;
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) { this.denied = true; return false; }
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        const Ctx = window.AudioContext || window.webkitAudioContext;
        const ctx = new Ctx();
        if (ctx.state === "suspended") await ctx.resume();
        const an = ctx.createAnalyser();
        an.fftSize = 1024;
        ctx.createMediaStreamSource(stream).connect(an);
        this.analyser = an;
        this.buf = new Float32Array(an.fftSize);
        this.ready = true;
        return true;
      } catch (e) { this.denied = true; return false; }
    },
    /** いまの声の大きさ。0（無音）〜1（かなり大きい） */
    level() {
      if (!this.ready) return 0;
      this.analyser.getFloatTimeDomainData(this.buf);
      let sum = 0;
      for (let i = 0; i < this.buf.length; i++) sum += this.buf[i] * this.buf[i];
      return clamp(Math.sqrt(sum / this.buf.length) * 6, 0, 1);
    }
  };

  /** 長押しの見張り。ms 押し続けたら done を呼ぶ。指を離すと戻る */
  function longPress(btn, ms, onProgress, onDone) {
    let held = false, p = 0, fired = false;
    const stop = loop((dt) => {
      p = clamp(p + (held ? dt : -dt * 1.6) / (ms / 1000), 0, 1);
      onProgress(p);
      if (p >= 1 && !fired) { fired = true; onDone(); }
    });
    const down = (e) => { e.preventDefault(); held = true; };
    const up = () => { held = false; };
    btn.addEventListener("pointerdown", down);
    window.addEventListener("pointerup", up);
    window.addEventListener("pointercancel", up);
    return () => { stop(); btn.removeEventListener("pointerdown", down); window.removeEventListener("pointerup", up); window.removeEventListener("pointercancel", up); };
  }

  window.KIT = { $, clamp, esc, yen, mmss, imgText, photo, toast, ask, closeDialog, layer, listeners, loop, longPress, MIC };
})();
