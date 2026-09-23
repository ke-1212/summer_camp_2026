/**
 * バッティング60 セットアップスクリプト
 * 予告ボード用・シミュレーター記録用のGoogleフォームとシートを作り、
 * 各HTMLの CONFIG にそのまま貼れる設定を「実行ログ」に出力します。
 *
 * 使い方: script.google.com で新しいプロジェクト → これを貼り付け → setup を実行
 */
function setup() {
  const yokoku = createYokoku_();
  const log = createSimLog_();

  const out = [
    '===== batting60_yokoku.html の CONFIG =====',
    '  FORM_ACTION: "' + yokoku.action + '",',
    '  ENTRY: {',
    '    name:   "' + yokoku.entry['名前'] + '",',
    '    number: "' + yokoku.entry['数字'] + '",',
    '    date:   "' + yokoku.entry['日付'] + '",',
    '  },',
    '  CSV_URL: "' + yokoku.csv + '",',
    '',
    '===== batting60.html（シミュレーター）の CONFIG =====',
    '  LOG_FORM: "' + log.action + '",',
    '  ENTRY: {',
    '    name:    "' + log.entry['名前'] + '",',
    '    number:  "' + log.entry['数字'] + '",',
    '    number2: "' + log.entry['2つ目の数字'] + '",',
    '    item:    "' + log.entry['アイテム'] + '",',
    '    chips:   "' + log.entry['手持ちチップ'] + '",',
    '  },',
    '',
    '予告シート（全員に公開）: ' + yokoku.sheetUrl,
    '記録シート（主催者のみ）: ' + log.sheetUrl,
  ].join('\n');
  Logger.log(out);
}

/** 予告ボード：回答シートはリンクを知っている全員が閲覧可（ボード表示のため） */
function createYokoku_() {
  const form = FormApp.create('バッティング60 数字予告');
  form.setDescription('数字予告ボード用のフォームです。名前と数字は全員に公開されます。');
  const titles = ['名前', '数字', '日付'];
  const items = titles.map(t => form.addTextItem().setTitle(t));
  finishForm_(form);

  const ss = SpreadsheetApp.create('バッティング60 数字予告（回答）');
  form.setDestination(FormApp.DestinationType.SPREADSHEET, ss.getId());
  SpreadsheetApp.flush();
  const sheet = findResponseSheet_(ss, form);
  removeDefaultSheet_(ss, sheet);

  DriveApp.getFileById(ss.getId()).setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);

  return {
    action: formResponseUrl_(form),
    entry: entryIds_(form, titles, items),
    csv: 'https://docs.google.com/spreadsheets/d/' + ss.getId() + '/gviz/tq?tqx=out:csv&headers=1&gid=' + sheet.getSheetId(),
    sheetUrl: ss.getUrl(),
  };
}

/** シミュレーター記録：シートは非公開（主催者のみ） */
function createSimLog_() {
  const form = FormApp.create('バッティング60 シミュレーター記録');
  form.setDescription('得点シミュレーターの入力記録用です。入力内容は主催者に共有されます。');
  const titles = ['名前', '数字', '2つ目の数字', 'アイテム', '手持ちチップ'];
  const items = titles.map(t => form.addTextItem().setTitle(t));
  finishForm_(form);

  const ss = SpreadsheetApp.create('バッティング60 シミュレーター記録（回答）');
  form.setDestination(FormApp.DestinationType.SPREADSHEET, ss.getId());
  SpreadsheetApp.flush();
  const sheet = findResponseSheet_(ss, form);
  removeDefaultSheet_(ss, sheet);

  return {
    action: formResponseUrl_(form),
    entry: entryIds_(form, titles, items),
    sheetUrl: ss.getUrl(),
  };
}

/* ---------- 共通 ---------- */
function finishForm_(form) {
  form.setCollectEmail(false);
  form.setAllowResponseEdits(false);
  form.setLimitOneResponsePerUser(false);
  try { form.setRequireLogin(false); } catch (e) {}   // 個人アカウントでは不要
  try { if (form.setPublished) form.setPublished(true); } catch (e) {}
  form.setAcceptingResponses(true);
}

function formResponseUrl_(form) {
  return form.getPublishedUrl().replace(/\/viewform.*$/, '/formResponse');
}

/** 事前入力URLを作って entry.XXXX を取り出す */
function entryIds_(form, titles, items) {
  let resp = form.createResponse();
  items.forEach((it, i) => { resp = resp.withItemResponse(it.createResponse('__' + i + '__')); });
  const url = resp.toPrefilledUrl();
  const map = {};
  titles.forEach((t, i) => {
    const m = url.match(new RegExp('(entry\\.\\d+)=__' + i + '__'));
    map[t] = m ? m[1] : '(取得失敗)';
  });
  return map;
}

function findResponseSheet_(ss, form) {
  const id = form.getId();
  for (let i = 0; i < 10; i++) {
    const s = ss.getSheets().find(sh => (sh.getFormUrl() || '').indexOf(id) !== -1);
    if (s) return s;
    Utilities.sleep(1000);
    SpreadsheetApp.flush();
  }
  return ss.getSheets()[0];
}

function removeDefaultSheet_(ss, keep) {
  ss.getSheets().forEach(sh => {
    if (sh.getSheetId() !== keep.getSheetId() && !sh.getFormUrl() && sh.getLastRow() === 0) {
      try { ss.deleteSheet(sh); } catch (e) {}
    }
  });
}
