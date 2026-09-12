/* 共通の小道具・値を合わせる入力欄・会員登録の手続き。
   サイト本体（site.js）からは window.BAD 経由で使う。 */
(() => {
  "use strict";

  const $ = (id) => document.getElementById(id);
  const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
  const el = (html) => { const d = document.createElement("div"); d.innerHTML = html.trim(); return d.firstElementChild; };

  const params = new URLSearchParams(location.search);
  const CTRL = params.get("ctrl");

  let toastTimer = 0;
  function toast(msg, ms = 2200) {
    const t = $("toast");
    t.textContent = msg;
    t.classList.add("on");
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => t.classList.remove("on"), ms);
  }

  /** 確認ダイアログ。buttons は左から順に { label, cls, onClick } */
  function ask(text, buttons) {
    const dlg = $("dialog"), box = $("dialogBox");
    box.innerHTML = "<p>" + text + '</p><div class="dbtns"></div>';
    const row = box.querySelector(".dbtns");
    buttons.forEach((b) => {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = b.cls || "no";
      btn.textContent = b.label;
      btn.onclick = () => { dlg.classList.remove("on"); if (b.onClick) b.onClick(); };
      row.appendChild(btn);
    });
    dlg.classList.add("on");
  }
  const closeDialog = () => $("dialog").classList.remove("on");

  /** イベント登録をまとめ、後始末で一括解除する */
  function listeners() {
    const list = [];
    return {
      on(t, type, fn, opt) { t.addEventListener(type, fn, opt); list.push([t, type, fn, opt]); },
      off() { list.forEach(([t, type, fn, opt]) => t.removeEventListener(type, fn, opt)); }
    };
  }
  /** requestAnimationFrame のループ。dt（秒）を渡し、止める関数を返す */
  function loop(fn, maxDt = .05) {
    let last = performance.now(), raf = 0, stopped = false;
    // fn の中から止めることがあるので、止まった後は次のフレームを予約しない
    const frame = (now) => {
      if (stopped) return;
      fn(Math.min(maxDt, (now - last) / 1000));
      last = now;
      if (!stopped) raf = requestAnimationFrame(frame);
    };
    raf = requestAnimationFrame(frame);
    return () => { stopped = true; cancelAnimationFrame(raf); };
  }

  /** 実績の解除。本体は site.js が差し替える */
  const achieve = (id) => BAD.achieve(id);

  /* ============ 値を合わせる入力欄 ============
     入力欄は 0〜100 の位置を onChange で返すだけ。判定は呼び出し側が行う。 */

  const TASKS = {
    volume: { min: 0, max: 100, tol: 3, format: (v) => String(Math.round(v)) },
    money:  { min: 0, max: 9999, tol: 150, format: (v) => "¥" + Math.round(v).toLocaleString("ja-JP") },
    date:   { min: 1, max: 31, tol: 0, format: (v) => "10月" + Math.round(v) + "日" }
  };
  const fromPct = (t, p) => clamp(t.min + p / 100 * (t.max - t.min), t.min, t.max);
  const toPct = (t, v) => (v - t.min) / (t.max - t.min) * 100;

  function addScale(root, task) {
    const s = el('<div class="scale"></div>');
    [0, 25, 50, 75, 100].forEach((p) => {
      const x = document.createElement("span");
      x.textContent = task.format(fromPct(task, p));
      x.style.left = p + "%";
      s.appendChild(x);
    });
    root.appendChild(s);
  }

  const CONTROLLERS = {
    "physics-slider": {
      name: "物理スライダー", task: "volume",
      /* つまみが中央に引かれるバネと弱い減衰。離すと揺れ続けて狙った値で止まらない */
      mount(root, { task, onChange }) {
        root.innerHTML = '<div class="hint">つまみを離すと揺れます</div><div class="track"></div><div class="knob" id="knob"></div>';
        addScale(root, task);
        const knob = $("knob"), ev = listeners();
        let x = 50, v = 0, drag = false, lastX = 50, lastT = performance.now();
        const K = 7, D = .4;
        const pos = (e) => { const r = root.getBoundingClientRect(); return clamp((e.clientX - r.left) / r.width * 100, 0, 100); };
        ev.on(root, "pointerdown", (e) => { e.preventDefault(); drag = true; v = 0; lastX = x = pos(e); lastT = performance.now(); });
        ev.on(window, "pointermove", (e) => {
          if (!drag) return;
          const now = performance.now(), nx = pos(e);
          v = (nx - lastX) / Math.max(.008, (now - lastT) / 1000);
          x = nx; lastX = nx; lastT = now;
        });
        const up = () => { drag = false; };
        ev.on(window, "pointerup", up); ev.on(window, "pointercancel", up);
        const stop = loop((dt) => {
          if (!drag) {
            v += (-K * (x - 50) - D * v) * dt;
            x += v * dt;
            if (x < 0) { x = 0; v = -v * .7; }
            if (x > 100) { x = 100; v = -v * .7; }
          }
          knob.style.left = x + "%";
          onChange(x);
        }, .032);
        return () => { stop(); ev.off(); };
      }
    },

    pump: {
      name: "空気入れ", task: "volume",
      /* 押すと上がるが常に抜けていく。押し続けないと保てない */
      mount(root, { onChange }) {
        root.innerHTML = '<div class="hint">押すと入りますが、ずっと抜けています</div>' +
          '<button class="round" id="pump" type="button">押す</button><div class="leak">Leaking…</div>';
        const pump = $("pump"), ev = listeners();
        let x = 0;
        ev.on(pump, "pointerdown", (e) => { e.preventDefault(); x = clamp(x + 9, 0, 100); pump.classList.add("down"); });
        const up = () => pump.classList.remove("down");
        ev.on(window, "pointerup", up); ev.on(window, "pointercancel", up);
        const stop = loop((dt) => { x = clamp(x - 14 * dt, 0, 100); onChange(x); });
        return () => { stop(); ev.off(); };
      }
    },

    pi: {
      name: "円周率スクロール", task: "volume",
      /* 円周率の小数を横に流し、枠に入った2桁が値になる */
      mount(root, { onChange }) {
        const digits = piDigits(), W = 26;
        root.innerHTML = '<div class="hint">枠に入った2桁が値です</div>' +
          '<div class="pi-strip" id="strip"><div class="pi-digits" id="digits"></div></div><div class="pi-window"></div>';
        const strip = $("strip"), box = $("digits");
        box.style.padding = "0 " + (root.clientWidth / 2 - W) + "px";
        box.innerHTML = digits.split("").map((d) => "<span>" + d + "</span>").join("");
        const ev = listeners();
        const read = () => {
          const i = clamp(Math.round(strip.scrollLeft / W), 0, digits.length - 2);
          onChange(Number(digits[i]) * 10 + Number(digits[i + 1]));
        };
        read();
        ev.on(strip, "scroll", read, { passive: true });
        return () => ev.off();
      }
    },

    curling: {
      name: "カーリング", task: "volume",
      /* 石を上に払って止まった位置が値。氷の状態は毎回同じ（乱数なし） */
      mount(root, { onChange }) {
        root.innerHTML = '<div class="sheet"></div><div class="hint">石を上に払ってください</div><div class="stone" id="stone"></div>';
        const stone = $("stone"), ev = listeners();
        const H = root.clientHeight, START = H - 40, END = 30;
        let y = START, vy = 0, sliding = false, held = false, hist = [];
        const place = () => { stone.style.left = "50%"; stone.style.top = y + "px"; };
        const report = () => onChange(clamp((START - y) / (START - END) * 100, 0, 100));
        place(); report();
        ev.on(root, "pointerdown", (e) => {
          e.preventDefault();
          if (sliding) return;
          y = START;
          held = true; hist = [{ y: e.clientY, t: performance.now() }];
        });
        ev.on(window, "pointermove", (e) => {
          if (!held) return;
          hist.push({ y: e.clientY, t: performance.now() });
          if (hist.length > 8) hist.shift();
          y = START - clamp(hist[0].y - e.clientY, 0, 60);
          place();
        });
        const release = () => {
          if (!held) return;
          held = false;
          const a = hist[0], b = hist[hist.length - 1];
          vy = Math.max(0, (a.y - b.y) / (Math.max(16, b.t - a.t) / 1000));
          sliding = vy > 30;
        };
        ev.on(window, "pointerup", release); ev.on(window, "pointercancel", release);
        const stop = loop((dt) => {
          if (sliding) {
            y -= vy * dt; vy -= 900 * dt;
            if (y < END) { y = END; sliding = false; }
            else if (vy <= 0) { sliding = false; vy = 0; }
            place();
          }
          report();
        });
        return () => { stop(); ev.off(); };
      }
    },

    keypad: {
      name: "シャッフル・テンキー", task: "money",
      /* 押すたびにキーの並びが入れ替わる */
      mount(root, { task, onChange }) {
        root.innerHTML = '<div class="pad-disp" id="disp">¥0</div><div class="pad-grid" id="grid"></div>';
        const disp = $("disp"), grid = $("grid"), ev = listeners();
        const KEYS = ["0", "1", "2", "3", "4", "5", "6", "7", "8", "9", "00", "C"];
        let typed = "";
        const shuffle = () => {
          const k = KEYS.slice();
          for (let i = k.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [k[i], k[j]] = [k[j], k[i]]; }
          grid.innerHTML = k.map((x) => '<button type="button" class="key' + (x === "C" ? " fn" : "") + '" data-k="' + x + '">' + (x === "C" ? "クリア" : x) + "</button>").join("");
        };
        const report = () => {
          const v = clamp(Number(typed || "0"), task.min, task.max);
          disp.textContent = task.format(v);
          onChange(toPct(task, v));
        };
        shuffle(); report();
        ev.on(grid, "pointerdown", (e) => {
          const b = e.target.closest(".key");
          if (!b) return;
          e.preventDefault();
          typed = b.dataset.k === "C" ? "" : (typed + b.dataset.k).replace(/^0+(?=\d)/, "").slice(0, 4);
          report(); shuffle();
        });
        return () => ev.off();
      }
    },

    tearoff: {
      name: "日めくり", task: "date",
      /* 上に払ってめくる。速いほど何枚もめくれ、めくった紙は戻らない */
      mount(root, { task, onChange }) {
        root.innerHTML = '<div class="hint">上に払ってめくります（戻せません）</div><div class="cal" id="cal"></div>';
        const cal = $("cal"), ev = listeners();
        let day = 1, downY = 0, downT = 0, down = false;
        const page = (d) => el('<div class="cal-page"><div class="cal-m">10月</div><div class="cal-day">' + d + "</div></div>");
        let cur = page(day);
        cal.appendChild(cur);
        onChange(toPct(task, day));
        ev.on(root, "pointerdown", (e) => { e.preventDefault(); down = true; downY = e.clientY; downT = performance.now(); });
        const release = (e) => {
          if (!down) return;
          down = false;
          const dy = downY - e.clientY;
          if (dy < 30 || day >= task.max) return;
          const n = clamp(Math.round(dy / Math.max(16, performance.now() - downT) * 2.5), 1, 8);
          day = Math.min(task.max, day + n);
          const torn = cur;
          torn.classList.add("torn");
          setTimeout(() => torn.remove(), 420);
          cur = page(day);
          cal.insertBefore(cur, torn);
          onChange(toPct(task, day));
        };
        ev.on(window, "pointerup", release);
        ev.on(window, "pointercancel", () => { down = false; });
        return () => ev.off();
      }
    },

    shout: {
      name: "叫ぶ", task: "volume", needs: "mic",
      /* 声の大きさが値。確定の瞬間まで声量を保つ必要がある */
      mount(root, { onChange }) {
        root.innerHTML = '<div class="hint">声の大きさが値になります</div><div class="meter"><i id="lv"></i></div>';
        const fill = $("lv"), buf = new Float32Array(SENSORS.analyser.fftSize);
        let x = 0;
        const stop = loop((dt) => {
          SENSORS.analyser.getFloatTimeDomainData(buf);
          let sum = 0;
          for (let i = 0; i < buf.length; i++) sum += buf[i] * buf[i];
          const db = 20 * Math.log10(Math.sqrt(sum / buf.length) + 1e-9);
          x += (clamp((db + 55) / 45 * 100, 0, 100) - x) * Math.min(1, dt * 6);
          fill.style.height = x + "%";
          onChange(x);
        });
        return stop;
      }
    },

    level: {
      name: "水準器", task: "volume", needs: "tilt",
      /* 端末を左右に傾けて気泡の位置を合わせる */
      mount(root, { onChange }) {
        root.innerHTML = '<div class="hint">端末を左右に傾けてください</div><div class="vial"><div class="bubble" id="bub"></div></div>';
        const bub = $("bub");
        let x = 50;
        const stop = loop((dt) => {
          x += (clamp((SENSORS.gamma + 40) / 80 * 100, 0, 100) - x) * Math.min(1, dt * 5);
          bub.style.left = x + "%";
          onChange(x);
        });
        return stop;
      }
    }
  };

  /** 円周率の小数（Machin の公式を BigInt で計算。一度だけ計算して使い回す） */
  let piCache = null;
  function piDigits(n = 600) {
    if (piCache) return piCache;
    const scale = 10n ** BigInt(n + 10);
    const arctanInv = (x) => {
      const X = BigInt(x), X2 = X * X;
      let term = scale / X, sum = term, k = 1n, sign = -1n;
      while (term !== 0n) { term /= X2; sum += sign * (term / (2n * k + 1n)); sign = -sign; k++; }
      return sum;
    };
    piCache = (16n * arctanInv(5) - 4n * arctanInv(239)).toString().slice(1, n + 1);
    return piCache;
  }

  /* ============ センサー（叫ぶ・水準器を使うときだけ許可を求める） ============ */
  const SENSORS = { mic: false, tilt: false, analyser: null, gamma: 0 };

  async function askMic() {
    if (SENSORS.mic) return "ok";
    if (!window.isSecureContext) return "https で開いていないため、ブラウザがマイクを許可しません";
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) return "このブラウザはマイク入力に対応していません";
    try {
      // 声の大きさをそのまま測りたいので、ノイズ抑制・自動ゲインは切る
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: false, noiseSuppression: false, autoGainControl: false }
      });
      const Ctx = window.AudioContext || window.webkitAudioContext;
      const ac = new Ctx();
      if (ac.state === "suspended") await ac.resume();
      SENSORS.analyser = ac.createAnalyser();
      SENSORS.analyser.fftSize = 1024;
      ac.createMediaStreamSource(stream).connect(SENSORS.analyser);
      SENSORS.mic = true;
      return "ok";
    } catch (e) { return e.name + ": " + e.message; }
  }
  async function askTilt() {
    if (SENSORS.tilt) return "ok";
    if (!window.DeviceOrientationEvent) return "このブラウザは傾きセンサーに対応していません";
    if (!window.isSecureContext) return "https で開いていないため、ブラウザが傾きセンサーを許可しません";
    try {
      if (typeof DeviceOrientationEvent.requestPermission === "function") {
        const res = await DeviceOrientationEvent.requestPermission();
        if (res !== "granted") return "許可されませんでした（" + res + "）";
      }
    } catch (e) { return e.name + ": " + e.message; }
    const ok = await new Promise((resolve) => {
      const on = (e) => { if (e.gamma !== null) { window.removeEventListener("deviceorientation", on); resolve(true); } };
      window.addEventListener("deviceorientation", on);
      setTimeout(() => { window.removeEventListener("deviceorientation", on); resolve(false); }, 1500);
    });
    if (!ok) return "傾きセンサーから値が届きません（センサーの無い端末など）";
    window.addEventListener("deviceorientation", (e) => { if (e.gamma !== null) SENSORS.gamma = e.gamma; });
    SENSORS.tilt = true;
    return "ok";
  }

  /** 値を合わせる入力欄を root に置く。センサーが要るものは許可ボタンを先に出す。後始末の関数を返す */
  function mountControl(root, ctrlId, onValue) {
    const ctrl = CONTROLLERS[ctrlId], task = TASKS[ctrl.task], ev = listeners();
    let cleanupCtrl = () => {};
    const start = () => {
      cleanupCtrl = ctrl.mount(root, {
        task,
        onChange: (p) => onValue(fromPct(task, clamp(Number(p) || 0, 0, 100)))
      });
    };
    if (ctrl.needs) {
      root.innerHTML = '<div style="padding:16px"><button class="btn" data-grant type="button">' +
        (ctrl.needs === "mic" ? "マイクの使用を許可する" : "傾きセンサーの使用を許可する") +
        '</button><div class="note" data-smsg style="margin-top:10px"></div></div>';
      ev.on(root.querySelector("[data-grant]"), "click", async () => {
        const msg = root.querySelector("[data-smsg]");
        msg.textContent = "確認中…";
        const res = ctrl.needs === "mic" ? await askMic() : await askTilt();
        if (res === "ok") { root.innerHTML = ""; start(); }
        else msg.textContent = "使えません — " + res;
      });
    } else {
      start();
    }
    return () => { cleanupCtrl(); ev.off(); };
  }

  /* ============ ステップ ============
     各ステップは条件を満たしたら done() を呼ぶだけ。進捗・遷移は runSignup が持つ。 */

  /** 値を合わせる設定ステップを作る。?ctrl= を付けると入力欄を差し替えられる */
  function settingStep(id, title, label, defaultCtrl, target) {
    return {
      id, title, label: label.replace("音量", ""),
      mount(root, { done }) {
        const ctrlId = (CTRL && CONTROLLERS[CTRL]) ? CTRL : defaultCtrl;
        const ctrl = CONTROLLERS[ctrlId];
        const task = TASKS[ctrl.task];
        // 差し替えた入力欄の種類に合わせて、目標と項目名を決める
        const goal = ctrl.task === "volume" ? target : ctrl.task === "money" ? 3280 : 14;
        const name = ctrl.task === "volume" ? label : ctrl.task === "money" ? "月額料金" : "利用開始日";

        root.innerHTML =
          '<div class="card">' +
          "<p>" + name + "を <b>" + task.format(goal) + "</b> に設定してください。</p>" +
          '<div class="readout">' +
          '<div><span>目標</span> <b class="t">' + task.format(goal) + "</b></div>" +
          '<div><span>現在</span> <b id="cur">-</b></div></div>' +
          '<div class="ctrl-area" id="ctrlArea"></div>' +
          '<button class="btn" id="go" type="button" style="margin-top:12px">この値で設定する</button>' +
          '<div id="msg"></div>' +
          '<div class="note" style="margin-top:8px">入力方法: ' + ctrl.name + "（許容差 ±" + task.tol + "）</div>" +
          "</div>";

        let value = task.min;
        const cleanupCtrl = mountControl($("ctrlArea"), ctrlId, (v) => { value = v; $("cur").textContent = task.format(v); });
        const ev = listeners();
        ev.on($("go"), "click", () => {
          if (Math.abs(value - goal) <= task.tol) done();
          else $("msg").innerHTML = '<div class="err">' + (value > goal ? "値が大きすぎます" : "値が小さすぎます") + "</div>";
        });
        return () => { cleanupCtrl(); ev.off(); };
      }
    };
  }

  /* ---- CAPTCHA 用の絵と文字 ---- */

  // 4×4 にまたがる1枚絵の信号機（座標は 0〜400 の正方形）。当たり判定もこの矩形から計算する
  const LIGHT_PARTS = [
    { x: 128, y: 34, w: 104, h: 150 },   // 本体
    { x: 196, y: 184, w: 8, h: 160 },    // 柱（200 をまたぐので右の列にも数ピクセルだけ写る）
    { x: 204, y: 70, w: 104, h: 6 }      // 横に伸びる腕（右上の列に少しだけ入る）
  ];
  const LIGHT_SVG =
    '<svg viewBox="0 0 400 400" xmlns="http://www.w3.org/2000/svg">' +
    '<rect width="400" height="400" fill="#BFD9EE"/>' +
    '<rect x="0" y="250" width="120" height="150" fill="#9AA5B1"/><rect x="290" y="210" width="110" height="190" fill="#8B96A3"/>' +
    '<rect x="0" y="360" width="400" height="40" fill="#6B7280"/>' +
    '<rect x="204" y="70" width="104" height="6" fill="#374151"/><rect x="300" y="60" width="10" height="26" fill="#374151"/>' +
    '<rect x="196" y="184" width="8" height="160" fill="#374151"/>' +
    '<rect x="128" y="34" width="104" height="150" rx="14" fill="#1F2937"/>' +
    '<circle cx="180" cy="72" r="20" fill="#EF4444"/><circle cx="180" cy="118" r="20" fill="#4B5563"/><circle cx="180" cy="160" r="16" fill="#4B5563"/>' +
    "</svg>";
  function lightTargets(n) {
    const size = 400 / n, hit = new Set();
    for (let r = 0; r < n; r++) for (let c = 0; c < n; c++) {
      const x0 = c * size, y0 = r * size;
      if (LIGHT_PARTS.some((p) => p.x < x0 + size && p.x + p.w > x0 && p.y < y0 + size && p.y + p.h > y0)) hit.add(r * n + c);
    }
    return hit;
  }

  // 歪んだ文字。紛らわしい文字を混ぜ、大文字小文字も区別する。「別の画像」ほど読みにくい
  const CAP_WORDS = ["rn0Ol7", "Il1vVw", "CcO0q9g"];
  function drawWord(canvas, word, level) {
    const ctx = canvas.getContext("2d"), W = canvas.width, H = canvas.height;
    let s = 0;
    for (const ch of word) s = (s * 31 + ch.charCodeAt(0)) >>> 0;
    const rnd = () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; };   // 同じ文字列なら毎回同じ絵
    ctx.fillStyle = "#F1EDE4";
    ctx.fillRect(0, 0, W, H);
    for (let i = 0; i < 40 + level * 40; i++) {   // 背景のノイズ
      ctx.fillStyle = "rgba(60,60,60," + (0.1 + rnd() * 0.25) + ")";
      ctx.fillRect(rnd() * W, rnd() * H, 2, 2);
    }
    const step = (W - 40) / word.length;
    [...word].forEach((ch, i) => {
      ctx.save();
      ctx.translate(24 + i * step + rnd() * 6, H / 2 + (rnd() - .5) * 18);
      ctx.rotate((rnd() - .5) * (0.7 + level * 0.25));
      ctx.transform(1, 0, (rnd() - .5) * 0.8, 1, 0, 0);
      ctx.font = "bold " + Math.round(34 + rnd() * 12) + "px Georgia, 'Times New Roman', serif";
      ctx.fillStyle = "#2B2B2B";
      ctx.textBaseline = "middle";
      ctx.fillText(ch, 0, 0);
      ctx.restore();
    });
    for (let k = 0; k < 1 + level; k++) {   // 打ち消し線
      ctx.strokeStyle = "#2B2B2B";
      ctx.lineWidth = 2 + k;
      ctx.beginPath();
      ctx.moveTo(4, H * (0.3 + rnd() * 0.4));
      ctx.bezierCurveTo(W * .3, rnd() * H, W * .7, rnd() * H, W - 4, H * (0.3 + rnd() * 0.4));
      ctx.stroke();
    }
  }

  const STEPS = [
    {
      id: "entry", label: "入口",
      title: "アカウント登録をはじめる",
      /* 「はい」は薄い色で漂い、近づくと逃げる。「いいえ」は大きく押しやすい */
      mount(root, { done }) {
        root.innerHTML =
          '<div class="card">' +
          '<p class="note">会員登録は無料です（所要時間: 約3分）。</p>' +
          "<p>アカウント登録を始めますか？</p>" +
          '<p class="note">※「はい」を押すと登録に進みます。</p>' +
          '<div class="entry-area" id="area">' +
          '<button id="yesBtn" type="button">はい</button>' +
          '<button class="entry-no" id="noBtn" type="button">いいえ</button>' +
          "</div></div>";
        const area = $("area"), yes = $("yesBtn"), ev = listeners();
        let x = 12, y = 12, vx = 46, vy = 31, flees = 0, noCount = 0;
        const FLEE_MOUSE = 3, FLEE_TOUCH = 2;
        const place = () => { yes.style.transform = "translate(" + x + "px," + y + "px)"; };
        const bounds = () => ({ w: area.clientWidth - yes.offsetWidth, h: area.clientHeight - yes.offsetHeight });
        // 反対側へ跳ぶ（壁から少し離す）
        const flee = () => {
          const b = bounds();
          x = clamp(b.w - x, 8, b.w - 8);
          y = clamp(b.h - y, 8, b.h - 8);
          vx = -vx; vy = -vy;
          flees++;
          place();
        };
        const stop = loop((dt) => {
          const b = bounds();
          x += vx * dt; y += vy * dt;
          if (x < 0) { x = 0; vx = Math.abs(vx); }
          if (x > b.w) { x = b.w; vx = -Math.abs(vx); }
          if (y < 0) { y = 0; vy = Math.abs(vy); }
          if (y > b.h) { y = b.h; vy = -Math.abs(vy); }
          place();
        });
        ev.on(window, "pointermove", (e) => {
          if (e.pointerType !== "mouse" || flees >= FLEE_MOUSE) return;
          const r = yes.getBoundingClientRect();
          const dx = e.clientX - (r.left + r.width / 2), dy = e.clientY - (r.top + r.height / 2);
          if (Math.hypot(dx, dy) < 60) flee();
        });
        ev.on(yes, "pointerdown", (e) => {
          if (e.pointerType !== "mouse" && flees < FLEE_TOUCH) { e.preventDefault(); flee(); return; }
          done();
        });
        ev.on($("noBtn"), "click", () => {
          noCount++;
          toast("登録を中止するには、まずアカウントを登録してください");
          if (noCount >= 5) achieve("no5");
        });
        return () => { stop(); ev.off(); };
      }
    },

    {
      id: "cookie", label: "Cookie",
      title: "Cookie の利用に同意してください",
      /* 二重否定のチェックと、押そうとすると逃げる同意ボタン */
      mount(root, { done }) {
        root.innerHTML =
          '<div class="card">' +
          '<p class="note">当サイトは利便性向上のため Cookie を使用します。</p>' +
          '<label class="check-row" style="margin-top:12px"><input type="checkbox" id="cbA">' +
          "<span>マーケティング目的でのデータ利用を希望しないわけではありません（必須）</span></label>" +
          '<label class="check-row" style="margin-top:10px"><input type="checkbox" id="cbB">' +
          "<span>上記に同意しないという意思表示を行わないことに同意します（必須）</span></label>" +
          '<div class="cookie-actions">' +
          '<button id="agreeBtn" type="button">送信しないことはない</button>' +
          '<button class="reject" id="rejectBtn" type="button">送信しません</button>' +
          "</div></div>";
        const ev = listeners();
        const btn = $("agreeBtn"), area = btn.parentElement;
        let flee = 0;
        // 決まった順に逃げる（乱数なし）。3回逃げたら押せるようになる
        const SPOTS = [[1, 0], [0, 1], [.5, .45]];
        const moveAway = () => {
          const [fx, fy] = SPOTS[flee % SPOTS.length];
          flee++;
          btn.style.left = fx * (area.clientWidth - btn.offsetWidth) + "px";
          btn.style.top = fy * (area.clientHeight - btn.offsetHeight) + "px";
        };
        ev.on(btn, "pointerdown", (e) => {
          if (flee < 3) { e.preventDefault(); moveAway(); toast("ボタンの位置が変更されました"); return; }
          if (!$("cbA").checked || !$("cbB").checked) { toast("必須項目にご同意ください"); return; }
          done();
        });
        ev.on($("rejectBtn"), "click", () => { toast("設定を保存できませんでした。もう一度お試しください"); achieve("reject"); });
        return () => ev.off();
      }
    },

    {
      id: "email", label: "メール",
      title: "メールアドレスを登録してください",
      /* 確認欄はコピペ禁止・文字が右から左に並び、判定も逆から読む */
      mount(root, { done }) {
        root.innerHTML =
          '<div class="card rows">' +
          "<div><label>メールアドレス</label>" +
          '<input type="text" id="m1" inputmode="email" autocomplete="off" placeholder="you@example.com"></div>' +
          "<div><label>メールアドレス（確認用）</label>" +
          '<input type="text" id="m2" class="rtl" inputmode="email" autocomplete="off">' +
          '<div class="note" style="margin-top:6px">確認用の欄は貼り付けできません。</div></div>' +
          '<button class="btn" id="go" type="button">次へ</button>' +
          '<div id="msg"></div></div>';
        const ev = listeners();
        ev.on($("m2"), "paste", (e) => { e.preventDefault(); toast("貼り付けはご利用いただけません"); });
        ev.on($("m2"), "drop", (e) => { e.preventDefault(); toast("貼り付けはご利用いただけません"); });
        ev.on($("go"), "click", () => {
          const a = $("m1").value.trim(), b = $("m2").value.trim();
          if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(a)) { $("msg").innerHTML = '<div class="err">メールアドレスの形式が正しくありません</div>'; return; }
          // 画面上は右から左に並ぶので、見た目どおりに一致させるには逆から打つ必要がある
          if (a !== [...b].reverse().join("")) { $("msg").innerHTML = '<div class="err">2つの入力が一致しません</div>'; return; }
          done();
        });
        return () => ev.off();
      }
    },

    {
      id: "password", label: "パスワード",
      title: "パスワードを作成してください",
      /* 入力中から赤くなり、満たしていない条件だけを突きつける。満たすたびに次の条件が現れる */
      mount(root, { done }) {
        root.innerHTML =
          '<div class="card">' +
          "<label>パスワード</label>" +
          '<input type="text" id="pw" autocomplete="off" autocapitalize="off" spellcheck="false">' +
          '<div class="rules" id="rules"></div>' +
          '<button class="btn" id="go" type="button" style="margin-top:14px">この内容で登録する</button>' +
          "</div>";
        const chars = (v) => [...v];
        const RULES = [
          { text: "8文字以上にしてください", ok: (v) => chars(v).length >= 8 },
          { text: "数字を1つ以上含めてください", ok: (v) => /\d/.test(v) },
          { text: "大文字を1つ以上含めてください", ok: (v) => /[A-Z]/.test(v) },
          { text: "記号（!#$% など）を1つ以上含めてください", ok: (v) => /[!-/:-@[-`{-~]/.test(v) },
          { text: "「ui」または「ux」を含めてください", ok: (v) => /u[ix]/i.test(v) },
          { text: "ひらがなを1文字以上含めてください", ok: (v) => /[ぁ-ゟ]/.test(v) },
          { text: "数字をすべて足すと 20 になるようにしてください", ok: (v) => (v.match(/\d/g) || []).reduce((s, d) => s + Number(d), 0) === 20 },
          { text: "同じ文字を2回続けて使わないでください", ok: (v) => !chars(v).some((c, i, a) => i > 0 && a[i - 1] === c) },
          { text: "12文字以上にしてください", ok: (v) => chars(v).length >= 12 },
          { text: "絵文字を1つ以上含めてください", ok: (v) => /\p{Extended_Pictographic}/u.test(v) },
          { text: "最初の文字と最後の文字を同じにしてください", ok: (v) => { const a = chars(v); return a.length > 1 && a[0] === a[a.length - 1]; } },
          { text: "20文字以下にしてください", ok: (v) => chars(v).length <= 20 }
        ];
        const ev = listeners(), pw = $("pw");
        let shown = 1;
        const draw = () => {
          const v = pw.value;
          const before = shown;
          // 表示中の条件がすべて満たされたら、次の条件を1つ増やす
          while (shown < RULES.length && RULES.slice(0, shown).every((r) => r.ok(v))) shown++;
          const unmet = RULES.slice(0, shown).filter((r) => !r.ok(v));
          $("rules").innerHTML = v ? unmet.map((r) => '<div class="rule"><span>✕</span><span>' + r.text + "</span></div>").join("") : "";
          pw.classList.toggle("bad", v !== "" && unmet.length > 0);
          pw.classList.toggle("good", unmet.length === 0 && shown === RULES.length);
          if (shown > before) { pw.classList.remove("shake"); void pw.offsetWidth; pw.classList.add("shake"); }
        };
        ev.on(pw, "input", draw);
        ev.on(pw, "animationend", () => pw.classList.remove("shake"));
        ev.on($("go"), "click", () => {
          const v = pw.value;
          if (shown === RULES.length && RULES.every((r) => r.ok(v))) done();
          else { draw(); toast("条件を満たしていない項目があります"); }
        });
        return () => ev.off();
      }
    },

    {
      id: "birthday", label: "生年月日",
      title: "生年月日を選択してください",
      /* 年・月・日をすべてラジオボタンで並べる（合計 170 個） */
      mount(root, { done }) {
        const radios = (name, from, to, unit, wide) => {
          const items = [];
          for (let v = from; v <= to; v++) items.push('<label><input type="radio" name="' + name + '" value="' + v + '"><span>' + v + unit + "</span></label>");
          return '<div class="card"><label>' + unit + '</label><div class="radio-box' + (wide ? " wide" : "") + '">' + items.join("") + "</div></div>";
        };
        root.innerHTML = radios("y", 1900, 2026, "年") + radios("m", 1, 12, "月", true) + radios("d", 1, 31, "日", true) +
          '<div class="card"><div class="picked" id="picked">____年 __月 __日</div>' +
          '<button class="btn" id="go" type="button" style="margin-top:10px">次へ</button></div>';
        const ev = listeners();
        const val = (n) => { const c = root.querySelector('input[name="' + n + '"]:checked'); return c ? c.value : null; };
        ev.on(root, "change", () => {
          $("picked").textContent = (val("y") || "____") + "年 " + (val("m") || "__") + "月 " + (val("d") || "__") + "日";
        });
        ev.on($("go"), "click", () => {
          if (val("y") && val("m") && val("d")) done();
          else toast("年・月・日をすべて選択してください");
        });
        return () => ev.off();
      }
    },

    // 音量の入力欄は、アプリ通知まわりの設定として出す
    settingStep("vol-ring",  "着信音量を設定してください", "着信音量", "pump", 40),
    settingStep("vol-alarm", "アラーム音量を設定してください", "アラーム音量", "pi", 65),

    {
      id: "captcha", label: "CAPTCHA",
      title: "あなたがロボットでないことを証明してください",
      /* 1回目は必ず失敗。2回目は1枚絵にまたがる信号機（端が少し写ったタイルも正解）。最後に歪んだ文字 */
      mount(root, { done }) {
        const ev = listeners();
        let round = 0, stopDrift = () => {}, wordIdx = 0;

        const head = (title, sub) => '<div class="cap-head">' + title + (sub ? "<small>" + sub + "</small>" : "") + "</div>";
        const selected = (grid) => new Set([...grid.querySelectorAll(".tile.sel")].map((t) => Number(t.dataset.i)));
        const same = (a, b) => a.size === b.size && [...a].every((x) => b.has(x));
        const toggleTiles = (grid) => { grid.onclick = (e) => { const t = e.target.closest(".tile"); if (t) t.classList.toggle("sel"); }; };

        // 1回目: 絵文字の 3×3。絵柄はゆっくり動き、どう選んでも失敗する
        const buildEmoji = () => {
          const n = 3;
          root.innerHTML = head("信号機をすべて選択してください") +
            '<div class="cap-grid" id="grid" style="grid-template-columns:repeat(' + n + ',1fr)"></div>' +
            '<button class="btn" id="verify" type="button" style="margin-top:12px">確認</button><div id="msg"></div>';
          const grid = $("grid");
          grid.innerHTML = Array.from({ length: n * n }, (_, i) =>
            '<div class="tile" data-i="' + i + '"><span class="mark">' + (i % 3 === 0 ? "🚦" : ["🌲", "🚗", "🏠", "🐟", "☂️"][i % 5]) + "</span></div>").join("");
          let t = 0;
          const marks = [...grid.querySelectorAll(".mark")];
          stopDrift = loop((dt) => {
            t += dt;
            marks.forEach((m, i) => {
              m.style.transform = "translate(" + (Math.sin(t * 1.1 + i) * 8).toFixed(1) + "px," + (Math.cos(t * .9 + i) * 8).toFixed(1) + "px)";
            });
          });
          toggleTiles(grid);
          $("verify").onclick = () => {
            $("msg").innerHTML = '<div class="err">認証に失敗しました。もう一度お試しください</div>';
            round = 1;
            setTimeout(build, 900);
          };
        };

        // 2回目: 4×4 にまたがる大きな信号機。柱や腕が少しでも写っているタイルも選ばないと通らない
        const buildPhoto = (hint) => {
          const n = 4, target = lightTargets(n);
          root.innerHTML = head("信号機が写っているタイルをすべて選択してください", hint) +
            '<div class="cap-grid" id="grid" style="grid-template-columns:repeat(' + n + ',1fr)"></div>' +
            '<button class="btn" id="verify" type="button" style="margin-top:12px">確認</button><div id="msg"></div>';
          const grid = $("grid");
          grid.innerHTML = Array.from({ length: n * n }, (_, i) => {
            const r = Math.floor(i / n), c = i % n;
            return '<div class="tile" data-i="' + i + '"><div class="piece" style="left:' + (-c * 100) + "%;top:" + (-r * 100) + '%">' + LIGHT_SVG + "</div></div>";
          }).join("");
          toggleTiles(grid);
          $("verify").onclick = () => {
            if (same(selected(grid), target)) { round = 2; build(); return; }
            $("msg").innerHTML = '<div class="err">選択が正しくありません</div>';
            setTimeout(() => buildPhoto("信号機の一部（柱など）が写っているタイルも含めてください"), 900);
          };
        };

        // 3回目: 歪んだ文字の入力（大文字と小文字を区別）
        const buildText = () => {
          root.innerHTML = head("画像の文字を入力してください", "大文字と小文字を区別します") +
            '<div class="card" style="border-radius:0 0 8px 8px;border-top:0">' +
            '<canvas class="cap-text" id="capCanvas" width="300" height="96"></canvas>' +
            '<div class="cap-tools"><button type="button" id="another">別の画像</button><button type="button" id="audio">🔊 音声で聞く</button></div>' +
            '<input type="text" id="capIn" autocomplete="off" autocapitalize="off" spellcheck="false">' +
            '<button class="btn" id="verify" type="button" style="margin-top:12px">確認</button><div id="msg"></div></div>';
          const redraw = () => drawWord($("capCanvas"), CAP_WORDS[wordIdx % CAP_WORDS.length], Math.min(2, wordIdx));
          redraw();
          $("another").onclick = () => { wordIdx++; $("capIn").value = ""; redraw(); };
          $("audio").onclick = () => toast("音声は現在ご利用いただけません");
          $("verify").onclick = () => {
            if ($("capIn").value === CAP_WORDS[wordIdx % CAP_WORDS.length]) { achieve("captcha"); done(); return; }
            // 間違えるとより読みにくい文字に替わる
            $("msg").innerHTML = '<div class="err">文字が正しくありません</div>';
            wordIdx++; $("capIn").value = ""; redraw();
          };
        };

        const build = () => {
          stopDrift(); stopDrift = () => {};
          [buildEmoji, buildPhoto, buildText][round]();
        };
        build();
        return () => { stopDrift(); ev.off(); };
      }
    },

    {
      id: "terms", label: "規約",
      title: "利用規約に同意してください",
      /* 最後まで読まないと同意できない。途中で3回だけスクロールが戻る */
      mount(root, { done }) {
        const para = "第◯条 当社は、本サービスの提供にあたり、利用者に対して事前の通知なく内容を変更することがあります。" +
          "利用者は、本サービスの利用にあたり、自己の責任において必要な準備を行うものとします。";
        let body = "";
        for (let i = 1; i <= 24; i++) body += "<p>" + para.replace("◯", i) + "</p>";
        root.innerHTML =
          '<div class="card">' +
          '<div class="terms" id="terms">' + body + '<p style="font-weight:700">以上</p></div>' +
          '<label class="check-row" style="margin-top:12px"><input type="checkbox" id="agree" disabled>' +
          "<span>利用規約を最後まで読み、内容に同意します</span></label>" +
          '<button class="btn" id="go" type="button" style="margin-top:12px" disabled>同意して次へ</button>' +
          '<div class="note" style="margin-top:8px" id="tnote">最後までスクロールすると同意できます。</div>' +
          "</div>";
        const box = $("terms"), ev = listeners();
        let backs = 0, reached = false;
        ev.on(box, "scroll", () => {
          const max = box.scrollHeight - box.clientHeight;
          if (!reached && backs < 3 && box.scrollTop > (backs + 1) * max / 4) {
            backs++;
            box.scrollTop = Math.max(0, box.scrollTop - 160);
            $("tnote").textContent = "読み込みのため位置を調整しました。";
            if (backs === 3) achieve("terms");
            return;
          }
          if (!reached && box.scrollTop >= max - 8) {
            reached = true;
            $("agree").disabled = false;
            $("tnote").textContent = "同意できます。";
          }
        }, { passive: true });
        ev.on($("agree"), "change", () => { $("go").disabled = !$("agree").checked; });
        ev.on($("go"), "click", done);
        return () => ev.off();
      }
    },

    {
      id: "submit", label: "送信",
      title: "登録内容を送信してください",
      /* 確認ダイアログが3回続き、最後の1つだけ「いいえ」が正解 */
      mount(root, { done }) {
        root.innerHTML =
          '<div class="card"><p>入力内容の確認が完了しました。送信してください。</p>' +
          '<button class="btn" id="send" type="button">送信する</button></div>';
        const ev = listeners();
        const yn = (text, onYes, onNo) => ask(text, [{ label: "いいえ", cls: "no", onClick: onNo }, { label: "はい", cls: "yes", onClick: onYes }]);
        const cancel = () => toast("送信を中止しました。もう一度お試しください");
        ev.on($("send"), "click", () => {
          yn("本当に送信しますか？",
            () => yn("入力内容に誤りがないことを確認しましたか？",
              () => yn("送信をキャンセルしますか？", cancel, done),
              cancel),
            cancel);
        });
        return () => { closeDialog(); ev.off(); };
      }
    }
  ];

  /* ============ 登録手続きの進行 ============ */

  /** root の中で登録手続きを流す。終わったら onDone。途中で抜けるときは戻り値の関数を呼ぶ */
  function runSignup(root, { only, onDone }) {
    const list = only ? STEPS.filter((s) => s.id === only) : STEPS;
    root.innerHTML =
      '<div class="su-bar"><div class="su-fill" id="suFill"></div></div>' +
      '<div class="su-chips" id="suChips"></div>' +
      '<div class="su-head"><div class="step-no" id="stepNo"></div><h1 id="stepTitle"></h1></div>' +
      '<div id="stage"></div>';
    if (!list.length) { $("stepTitle").textContent = "指定されたステップが見つかりません（?only=" + only + "）"; return () => {}; }

    let i = 0, cleanup = null;
    // 進捗バーは正直ではない。進んだり戻ったりし、完了まで 99% を超えない
    const drawProgress = () => {
      const base = (i / list.length) * 100;
      $("suFill").style.width = clamp(i % 2 === 0 ? base - 6 : base + 9, 3, 99) + "%";
    };
    // ステップの一覧を出して、今どこにいて、あと何個かをはっきりさせる
    const drawChips = () => {
      $("suChips").innerHTML = list.map((s, k) =>
        '<span class="chip' + (k < i ? " done" : k === i ? " now" : "") + '">' + (k < i ? "✓" : k + 1) + " " + (s.label || s.id) + "</span>").join("");
      const now = $("suChips").querySelector(".chip.now");
      if (now) now.scrollIntoView({ block: "nearest", inline: "center" });
    };
    const start = () => {
      const step = list[i];
      drawChips();
      $("stepNo").textContent = "会員登録 ステップ " + (i + 1) + " / " + list.length + "（あと " + (list.length - i - 1) + " 個）";
      $("stepTitle").textContent = step.title;
      drawProgress();
      $("stage").innerHTML = "";
      window.scrollTo(0, 0);
      let finished = false;
      cleanup = step.mount($("stage"), { done: () => { if (!finished) { finished = true; next(); } } });
    };
    const next = () => {
      if (cleanup) { cleanup(); cleanup = null; }
      i++;
      if (i >= list.length) onDone();
      else start();
    };
    start();
    return () => { if (cleanup) { cleanup(); cleanup = null; } };
  }

  window.BAD = {
    $, clamp, el, toast, ask, closeDialog, listeners, loop,
    TASKS, CONTROLLERS, mountControl, runSignup, askMic, SENSORS,
    STEP_IDS: STEPS.map((s) => s.id),
    achieve: () => {}
  };
})();
