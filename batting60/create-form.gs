/* バッティング60 の記録用 Google フォームを自動で作る Apps Script。
   使い方:
     1. https://script.google.com/ で「新しいプロジェクト」を開き、このファイルの中身を全部貼り付ける
     2. 関数「createLogForm」を選んで「実行」→ 権限を許可する
     3. 「実行ログ」に出た CONFIG をそのまま batting60/index.html の CONFIG と差し替える
   フォームと、回答が溜まるスプレッドシート（「バッティング60 記録（回答）」）がマイドライブに作られる。 */

const QUESTIONS = [
  ["name",    "名前"],
  ["number",  "数字"],
  ["number2", "2つ目の数字"],
  ["item",    "アイテム"],
  ["chips",   "手持ちチップ"],
];

function createLogForm() {
  const form = FormApp.create("バッティング60 記録")
    .setDescription("得点シミュレーターから自動で送られる記録です。直接回答しないでください。")
    .setCollectEmail(false)
    .setLimitOneResponsePerUser(false)
    .setAllowResponseEdits(false)
    .setShowLinkToRespondAgain(false);
  try { form.setRequireLogin(false); } catch (e) { /* 個人アカウントでは設定不要 */ }

  const ss = SpreadsheetApp.create("バッティング60 記録（回答）");
  form.setDestination(FormApp.DestinationType.SPREADSHEET, ss.getId());

  // entry.○○ の番号は、事前入力 URL から読み取る
  const entry = {};
  QUESTIONS.forEach(function (q) {
    const item = form.addTextItem().setTitle(q[1]);
    const url = form.createResponse().withItemResponse(item.createResponse("1")).toPrefilledUrl();
    entry[q[0]] = url.match(/entry\.\d+/)[0];
  });

  const action = form.getPublishedUrl().replace(/\/viewform.*$/, "/formResponse");
  const lines = QUESTIONS.map(function (q) {
    return '    ' + (q[0] + ':').padEnd(9) + JSON.stringify(entry[q[0]]) + ',  // ' + q[1];
  });
  Logger.log([
    "フォーム（編集）: " + form.getEditUrl(),
    "回答スプレッドシート: " + ss.getUrl(),
    "",
    "▼ batting60/index.html の CONFIG をこれに差し替える",
    "const CONFIG = {",
    '  LOG_FORM: "' + action + '",',
    "  ENTRY: {",
  ].concat(lines, ["  },", '  ORGANIZER: "あやちゃ",', "};"]).join("\n"));
}
