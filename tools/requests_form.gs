/**
 * TeNSorE Lab website: requests from lab members (Google Apps Script).
 *
 * Creates a Google Form where lab members submit news, events, awards, papers, talks and photos.
 * They must sign in with Google, so every request carries a verified email address. Requests are
 * listed on the website's admin page (admin.html), where the admin publishes or rejects them.
 *
 * ONE-TIME SETUP (about 5 minutes, from the Google account that should own the form):
 *   1. Open https://script.google.com → New project. Delete the sample code and paste this whole file.
 *      Name the project "TeNSorE website requests".
 *   2. Choose the function `setup` in the toolbar and press Run. Allow the permissions it asks for.
 *      The execution log prints the FORM LINK (share it with students) and the response sheet.
 *   3. Deploy → New deployment → type "Web app". Execute as: Me. Who has access: Anyone.
 *      Press Deploy and copy the "Web app URL" (ends in /exec).
 *   4. On the website's admin page → "Requests from lab members", paste the form link and the
 *      web app URL, and save. Then (optional) fill in the weekly admin duty rota there.
 *
 * SECURITY: the web app only answers callers that present a GitHub token with write access to the
 * website repository (the admin page has one after the admin password is entered). Students never
 * see other people's requests; the form itself only collects.
 *
 * After editing this script, publish the change with Deploy → Manage deployments → Edit → Version: New.
 */

var REPO = "vinayarya29/tensorelab";
var ADMIN_URL = "https://www.vinayarya.in/tensorelab/admin.html#requests";
var NOTIFY_SUBMITTER = true;  // email the student when their request is published or declined
// Alerts about new requests go ONLY to the lab admin on duty that week (rota edited on the admin page,
// stored privately in this script's properties). With an empty rota nobody is emailed.

var Q = {                     // form question titles -> keys used by the admin page
  "Your name": "name",
  "What is it?": "type",
  "When": "when",
  "Heading": "title",
  "Details": "text",
  "Link (optional)": "link",
  "Photo (optional)": "photo"
};
var TYPES = ["News / achievement", "Award", "New paper", "Talk or conference", "Workshop or event", "Photo for the website", "Other"];

// ------------------------------------------------------------------ setup (run once)
function setup() {
  var props = PropertiesService.getScriptProperties();
  if (props.getProperty("FORM_ID")) {
    var f = FormApp.openById(props.getProperty("FORM_ID"));
    Logger.log("Already set up.\nFORM LINK (share with lab members): " + f.getPublishedUrl() +
               "\nEdit the form: " + f.getEditUrl() + "\nResponse sheet: " + SpreadsheetApp.openById(props.getProperty("SHEET_ID")).getUrl());
    return;
  }
  var form = FormApp.create("TeNSorE Lab: submit to the website");
  form.setDescription("For members of the TeNSorE Lab, IIT Kharagpur. Send news, awards, papers, talks, events or photos " +
                      "for the lab website. Sign in with your own Google account (preferably your institute email). " +
                      "Every request is checked before it is published.");
  try { form.setEmailCollectionType(FormApp.EmailCollectionType.VERIFIED); } catch (e) { form.setCollectEmail(true); }
  form.setLimitOneResponsePerUser(false);
  form.setAllowResponseEdits(false);
  form.setConfirmationMessage("Thank you! Your request has been sent to the website admin. You will get an email when it is published.");

  form.addTextItem().setTitle("Your name").setRequired(true);
  form.addMultipleChoiceItem().setTitle("What is it?").setChoiceValues(TYPES).setRequired(true);
  form.addTextItem().setTitle("When").setHelpText("Month and year (e.g. Nov 2026) or the dates of the event.").setRequired(true);
  form.addTextItem().setTitle("Heading").setHelpText("One short line, e.g. “Riya wins the best poster award at ICTP 2026”.").setRequired(true);
  form.addParagraphTextItem().setTitle("Details").setHelpText("A few sentences: who, what, where. Write names in full.").setRequired(true);
  form.addTextItem().setTitle("Link (optional)").setHelpText("Paper DOI, event page, LinkedIn post, news article…");
  form.addTextItem().setTitle("Photo (optional)").setHelpText("Google Drive link to the photo, shared as “Anyone with the link can view”.");

  var ss = SpreadsheetApp.create("TeNSorE website requests");
  form.setDestination(FormApp.DestinationType.SPREADSHEET, ss.getId());
  var st = ss.insertSheet("Status");
  st.appendRow(["Response ID", "Status", "Handled at", "Note"]);
  st.setFrozenRows(1);
  try { if (form.setPublished) form.setPublished(true); } catch (e) {}

  props.setProperties({ FORM_ID: form.getId(), SHEET_ID: ss.getId() });
  ScriptApp.newTrigger("onRequest").forForm(form).onFormSubmit().create();
  ensureWeeklyTrigger();
  Logger.log("Done.\nFORM LINK (share with lab members): " + form.getPublishedUrl() +
             "\nEdit the form: " + form.getEditUrl() + "\nResponse sheet: " + ss.getUrl() +
             "\nNext: Deploy → New deployment → Web app (Execute as: Me, Who has access: Anyone), then paste both links in the admin page.");
}

// ------------------------------------------------------------------ weekly admin duty
// DUTY = { rota: [{name, email}], start: "YYYY-MM-DD" (a Monday: week 1 of the rota), instant: bool, digest: bool }
function getDuty() {
  var d;
  try { d = JSON.parse(PropertiesService.getScriptProperties().getProperty("DUTY") || "{}"); } catch (e) { d = {}; }
  return { rota: d.rota || [], start: d.start || "", instant: d.instant !== false, digest: d.digest !== false };
}
function mondayOf(date) { var d = new Date(date.getFullYear(), date.getMonth(), date.getDate()); d.setDate(d.getDate() - ((d.getDay() + 6) % 7)); return d; }
function dutyIndex(duty, when) {
  var n = duty.rota.length; if (!n) return -1;
  var start = duty.start ? mondayOf(new Date(duty.start + "T00:00:00")) : mondayOf(new Date());
  var weeks = Math.floor((mondayOf(when || new Date()) - start) / (7 * 864e5));
  return ((weeks % n) + n) % n;
}
function onDuty() { var d = getDuty(), i = dutyIndex(d); return i < 0 ? null : d.rota[i]; }

function setDuty(d) {
  var rota = (d.rota || []).filter(function (p) { return p && /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(p.email || ""); })
    .slice(0, 30).map(function (p) { return { name: String(p.name || "").slice(0, 80), email: String(p.email).trim().slice(0, 120) }; });
  var start = /^\d{4}-\d{2}-\d{2}$/.test(d.start || "") ? d.start : Utilities.formatDate(mondayOf(new Date()), Session.getScriptTimeZone(), "yyyy-MM-dd");
  var duty = { rota: rota, start: start, instant: d.instant !== false, digest: d.digest !== false };
  PropertiesService.getScriptProperties().setProperty("DUTY", JSON.stringify(duty));
  ensureWeeklyTrigger();
  return dutyInfo();
}
function dutyInfo() {
  var d = getDuty(), i = dutyIndex(d), next = dutyIndex(d, new Date(Date.now() + 7 * 864e5));
  return { duty: d, current: i, next: next };
}
function ensureWeeklyTrigger() {
  var has = ScriptApp.getProjectTriggers().some(function (t) { return t.getHandlerFunction() === "weeklyDigest"; });
  if (!has) ScriptApp.newTrigger("weeklyDigest").timeBased().onWeekDay(ScriptApp.WeekDay.MONDAY).atHour(9).create();
}

// new request -> email the admin on duty this week (if any, and if instant alerts are on)
function onRequest(e) {
  var d = getDuty(), who = onDuty();
  if (!who || !d.instant) return;
  var r = toRequest(e.response);
  MailApp.sendEmail({
    to: who.email,
    subject: "TeNSorE website request: " + r.title,
    body: "Hello " + (who.name || "") + ",\n\nYou are the TeNSorE website admin on duty this week. A new request came in:\n\n" +
          r.name + " <" + r.email + ">, " + r.type + "\n" + r.when + " — " + r.title + "\n\n" + r.text +
          (r.link ? "\n\nLink: " + r.link : "") + (r.photo ? "\nPhoto: " + r.photo : "") +
          "\n\nReview it on the admin page: " + ADMIN_URL
  });
}

// Monday 9:00: hand-over email to the admin on duty this week, with the pending requests (if any)
function weeklyDigest() {
  var d = getDuty(), who = onDuty();
  if (!who || !d.digest) return;
  var pending = listRequests().filter(function (r) { return r.status === "pending"; });
  MailApp.sendEmail({
    to: who.email,
    subject: "TeNSorE website duty this week" + (pending.length ? ": " + pending.length + " pending request" + (pending.length > 1 ? "s" : "") : ""),
    body: "Hello " + (who.name || "") + ",\n\nYou are the TeNSorE website admin on duty this week (Monday to Sunday).\n\n" +
          (pending.length ? "Pending requests:\n" + pending.map(function (r) { return "  • " + r.title + " (" + r.name + ", " + r.when + ")"; }).join("\n")
                          : "There are no pending requests right now.") +
          "\n\nAdmin page: " + ADMIN_URL + "\n\nYou will get an email for each new request this week."
  });
}

// ------------------------------------------------------------------ web app used by admin.html
function doPost(e) {
  var body;
  try { body = JSON.parse(e.postData.contents); } catch (x) { return out({ error: "bad request" }); }
  if (!authorised(body.token)) return out({ error: "not authorised" });
  if (body.action === "list") return out({ requests: listRequests() });
  if (body.action === "set") return out(setStatus(String(body.id || ""), String(body.status || ""), String(body.note || "")));
  if (body.action === "getDuty") return out(dutyInfo());
  if (body.action === "setDuty") return out(setDuty(body.duty || {}));
  return out({ error: "unknown action" });
}
function doGet() { return out({ ok: true, service: "TeNSorE website requests" }); }

function out(obj) { return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON); }

// Only someone holding a GitHub token that can write to the website repository may read or change requests.
function authorised(token) {
  if (!token || typeof token !== "string" || token.length > 400) return false;
  var key = "gh_" + Utilities.base64EncodeWebSafe(Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, token));
  var cache = CacheService.getScriptCache();
  if (cache.get(key)) return true;
  var res = UrlFetchApp.fetch("https://api.github.com/repos/" + REPO, {
    headers: { Authorization: "Bearer " + token, Accept: "application/vnd.github+json" }, muteHttpExceptions: true
  });
  if (res.getResponseCode() !== 200) return false;
  var j = JSON.parse(res.getContentText());
  if (!(j.permissions && j.permissions.push)) return false;
  cache.put(key, "1", 600);
  return true;
}

function toRequest(resp) {
  var r = { id: resp.getId(), at: resp.getTimestamp().toISOString(), email: resp.getRespondentEmail() || "" };
  for (var k in Q) r[Q[k]] = "";
  resp.getItemResponses().forEach(function (ir) {
    var key = Q[ir.getItem().getTitle()];
    if (key) r[key] = String(ir.getResponse() || "").trim();
  });
  return r;
}

function statusSheet() { return SpreadsheetApp.openById(PropertiesService.getScriptProperties().getProperty("SHEET_ID")).getSheetByName("Status"); }

function statusMap() {
  var m = {}, rows = statusSheet().getDataRange().getValues();
  for (var i = 1; i < rows.length; i++) m[rows[i][0]] = { status: rows[i][1], handled: rows[i][2] ? new Date(rows[i][2]).toISOString() : "", note: rows[i][3], row: i + 1 };
  return m;
}

function listRequests() {
  var form = FormApp.openById(PropertiesService.getScriptProperties().getProperty("FORM_ID"));
  var st = statusMap();
  return form.getResponses().slice(-300).reverse().map(function (resp) {
    var r = toRequest(resp), s = st[r.id] || {};
    r.status = s.status || "pending"; r.handled = s.handled || ""; r.note = s.note || "";
    return r;
  });
}

function setStatus(id, status, note) {
  if (["published", "declined", "pending"].indexOf(status) < 0) return { error: "bad status" };
  var form = FormApp.openById(PropertiesService.getScriptProperties().getProperty("FORM_ID"));
  var resp;
  try { resp = form.getResponse(id); } catch (x) { return { error: "request not found" }; }
  var sh = statusSheet(), s = statusMap()[id], now = new Date();
  if (s) sh.getRange(s.row, 2, 1, 3).setValues([[status, now, note]]);
  else sh.appendRow([id, status, now, note]);
  var r = toRequest(resp);
  if (NOTIFY_SUBMITTER && r.email && status !== "pending" && (!s || s.status !== status)) {
    MailApp.sendEmail({
      to: r.email,
      subject: (status === "published" ? "Published on the TeNSorE website: " : "About your website request: ") + r.title,
      body: "Hello " + (r.name || "") + ",\n\n" +
            (status === "published"
              ? "Your request “" + r.title + "” is now on the TeNSorE Lab website (it appears within a few minutes): https://www.vinayarya.in/tensorelab/news.html"
              : "Your request “" + r.title + "” was not added to the website this time.") +
            (note ? "\n\nNote from the admin: " + note : "") + "\n\nTeNSorE Lab, IIT Kharagpur"
    });
  }
  return { ok: true };
}
