/* 共有ランキングの保存先。
   Google Apps Script の Web アプリ URL（https://script.google.com/macros/s/～/exec）を入れる。
   空のままなら、ランキングはこの端末（localStorage）だけに保存される。
   設定手順は RANKING.md を参照。 */
window.WAGOKORO_RANKING_URL = "";

/* 挿絵の配信元。
   空のままなら、同梱の img/*.jpg を使う（そのまま遊べる）。
   フリー写真に差し替えたいときは、種（seed）と大きさを URL の末尾に足す形の配信元を入れる。
   例: window.WAGOKORO_PHOTO_BASE = "https://picsum.photos/seed";
       → https://picsum.photos/seed/wagokoro-shop/640/360 のように読み込む。
   読み込めなかった画像は、同梱の img/*.jpg に自動で戻る。 */
window.WAGOKORO_PHOTO_BASE = "";
