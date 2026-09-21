/* 挿絵のもと（*.svg）を、粗い JPEG（*.jpg）に焼き直す。
   小さく描いて低い画質で保存するので、サイトで横幅いっぱいに伸ばすとガビガビになる。
   使い方: node img/build.mjs   （Playwright と Chromium が必要）
   Playwright が別の場所にある場合は PW を書き換える。 */
const PW = process.env.PW_PATH || "/opt/node22/lib/node_modules/playwright/index.js";
const { chromium } = (await import(PW)).default;
const path = await import("node:path");
const url = await import("node:url");

const here = path.dirname(url.fileURLToPath(import.meta.url));
const JOBS = [
  // [もとの svg, 幅, 高さ, 縮小率, 画質]
  ["shop", 640, 360, 0.3, 30],
  ["drip", 640, 360, 0.3, 30],
  ["interior", 640, 360, 0.3, 30],
  ["roaster", 640, 360, 0.3, 30],
  ["map", 640, 360, 0.3, 32],
  ["bag-asagiri", 320, 240, 0.3, 34],
  ["bag-yuuhi", 320, 240, 0.3, 34],
  ["bag-sumibi", 320, 240, 0.3, 34],
  ["box", 320, 240, 0.3, 34],
  ["tumbler", 320, 240, 0.3, 34],
  ["cup", 320, 240, 0.3, 34],
  ["filter", 320, 240, 0.3, 34],
  ["youkan", 320, 240, 0.3, 34],
  ["cookie", 320, 240, 0.3, 34],
  ["fukubukuro", 320, 240, 0.3, 34],
  ["paper", 480, 660, 0.36, 40]
];

const b = await chromium.launch();
for (const [name, w, h, scale, quality] of JOBS) {
  const p = await b.newPage({ viewport: { width: w, height: h }, deviceScaleFactor: scale });
  await p.goto("file://" + path.join(here, name + ".svg"));
  await p.waitForTimeout(150);
  await p.screenshot({ path: path.join(here, name + ".jpg"), type: "jpeg", quality, clip: { x: 0, y: 0, width: w, height: h } });
  await p.close();
  console.log(name + ".jpg", Math.round(w * scale) + "x" + Math.round(h * scale));
}
await b.close();
