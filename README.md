# summer_camp_2026 (夏合宿 2026 ネタ置き場)

夏合宿 2026 で使うミニゲームと、その下調べの置き場。
第一弾は、わざと使いにくくした音量調整 UI を連続で解くブラウザゲーム「ワースト・ボリューム選手権」。

## ディレクトリ構成

```text
summer_camp_2026/
├── README.md
├── docs/
│   └── weird-ui-research.md    変なUI・bad UI battles の調査記録（ネタ出しの元資料）
└── worst-volume/
    └── index.html              ワースト・ボリューム選手権（trial 版・1ファイル完結）
```

## 遊び方

`worst-volume/index.html` をブラウザで直接開けば動く。ビルド・依存ライブラリなし。

スマホで確認する場合は、同じネットワークからアクセスできるようにローカルサーバを立てる。

```bash
cd worst-volume
python3 -m http.server 8000  # http://<PC の IP>:8000/ をスマホで開く
```

- スマホ縦持ち前提（PC でも動く）
- 効果音あり。最初に「はじめる」をタップした時点で音が有効になる

## ワースト・ボリューム選手権

お題は毎回「音量を指定の値に合わせろ」で固定。変わるのはコントローラのほう。
1本 8 秒、時間切れの瞬間の値が目標の許容誤差内なら成功。ライフ 4、5 ステージごとに許容誤差が狭まる。

| コントローラ | 不便さの分類 | 挙動 |
|---|---|---|
| ボリューム・ランチャー | 再現性がない | 長押しで砲身の角度と初速が上がり、離すと発射。着弾した位置が音量 |
| 物理スライダー | 精度が出ない | つまみが中央に引かれるバネ付き。離すと揺れ続けて止まらない |
| 空気入れ | 操作量が多い | 押すと上がるが毎秒 14 ずつ抜ける。押し続けないと保てない |

不便さの分類は `docs/weird-ui-research.md` §6 の4分類（操作量が多い／精度が出ない／再現性がない／社会的コストが高い）による。
「社会的コストが高い」枠（叫ぶ音量調整など）は未実装。

### コントローラの追加方法

`worst-volume/index.html` の `CONTROLLERS` 配列に1要素足すだけで出題に加わる。

```js
{
  id: "my-controller",        // 一意な ID
  name: "表示名",
  pain: "effort",             // effort / precision / randomness / social
  mount(root, { onChange }) {
    // root に操作面を描画し、音量 (0〜100) が変わるたびに onChange(値) を呼ぶ
    // 判定・タイマー・ライフは親側が持つので、ここでは気にしない
    return () => { /* 後始末（イベント解除・requestAnimationFrame の停止） */ };
  }
}
```

- 目標値は 30〜90（ランチャーの最短飛距離が約 29 のため）
- 実際の端末音量は変えない。値はゲーム内の数値として扱う

## 出典

- ボリューム・ランチャーの原典: [ZeyuKeithFu/WorstVolumeControl](https://github.com/ZeyuKeithFu/WorstVolumeControl) の `VolumeLauncher.vue`（ソースを取得して確認済み）
- それ以外（UX Collective の記事、r/badUIbattles、User Inyerface など）は `docs/weird-ui-research.md` §8 に一覧がある。
  ただし同 §9 のとおり検索スニペット経由の情報で、**一次確認は未実施**。引用する際は再確認が必要
