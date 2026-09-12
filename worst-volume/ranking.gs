/* ヤスイネ.com の共有ランキング用 Google Apps Script。
   スプレッドシートに紐づけて「ウェブアプリ」としてデプロイする（手順は RANKING.md）。
   - GET  ?action=list        記録を JSON で返す（?callback= を付けると JSONP）
   - POST 本文が JSON        1行追記する */

const SHEET_NAME = "ranking";

function sheet_() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sh = ss.getSheetByName(SHEET_NAME);
  if (!sh) {
    sh = ss.insertSheet(SHEET_NAME);
    sh.appendRow(["ts", "name", "sec", "total", "achievements", "perfect"]);
  }
  return sh;
}

function rows_() {
  const values = sheet_().getDataRange().getValues();
  return values.slice(1).map(function (r) {
    return { ts: Number(r[0]), name: String(r[1]), sec: Number(r[2]), total: Number(r[3]), achievements: Number(r[4]), perfect: r[5] === true || r[5] === "TRUE" };
  });
}

function reply_(data, callback) {
  const json = JSON.stringify(data);
  if (callback) {
    return ContentService.createTextOutput(callback + "(" + json + ")")
      .setMimeType(ContentService.MimeType.JAVASCRIPT);
  }
  return ContentService.createTextOutput(json).setMimeType(ContentService.MimeType.JSON);
}

function doGet(e) {
  const cb = e && e.parameter ? e.parameter.callback : null;
  return reply_(rows_(), cb);
}

function doPost(e) {
  try {
    const rec = JSON.parse(e.postData.contents);
    const name = String(rec.name || "名無し").slice(0, 12);
    const sec = Math.max(0, Math.round(Number(rec.sec) || 0));
    const total = Math.max(0, Math.round(Number(rec.total) || 0));
    const ach = Math.max(0, Math.round(Number(rec.achievements) || 0));
    sheet_().appendRow([Number(rec.ts) || Date.now(), name, sec, total, ach, rec.perfect === true]);
    return reply_({ ok: true }, null);
  } catch (err) {
    return reply_({ ok: false, error: String(err) }, null);
  }
}
