/**
 * DAMS CALICUT — EXAM PORTAL BACKEND
 * ------------------------------------------------------------
 * Deploy this as a Web App (Extensions > Apps Script > paste this file,
 * then Deploy > New deployment > type: Web app).
 *   - Execute as: Me
 *   - Who has access: Anyone
 * Copy the resulting /exec URL into API_URL in both exam.html and admin.html.
 *
 * REQUIRED ONE-TIME SETUP (run once from the Apps Script editor):
 *   Run the function `setup` once (select it in the toolbar dropdown, click Run).
 *   It creates the sheet tabs with headers, an Images folder in your Drive,
 *   and asks you to set an admin password in Script Properties.
 * ------------------------------------------------------------
 */

const SHEET_ID = SpreadsheetApp.getActiveSpreadsheet().getId();
const QUESTIONS_SHEET = 'Questions';
const SUBMISSIONS_SHEET = 'Submissions';
const TESTS_SHEET = 'Tests';

const Q_HEADERS = ['ID', 'TestTag', 'Subject', 'QuestionText', 'ImageURL',
  'OptionA', 'OptionB', 'OptionC', 'OptionD', 'CorrectOption', 'Explanation', 'Active'];
const SUB_HEADERS = ['Timestamp', 'TestTag', 'Name', 'Phone', 'EmailOrBatch',
  'Score', 'TotalQuestions', 'AnswersJSON', 'TimeTakenSeconds'];
const TEST_HEADERS = ['TestTag', 'Title', 'DurationMinutes', 'Active'];

/* ---------------- ONE-TIME SETUP ---------------- */
function setup() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  ensureSheet_(ss, QUESTIONS_SHEET, Q_HEADERS);
  ensureSheet_(ss, SUBMISSIONS_SHEET, SUB_HEADERS);
  ensureSheet_(ss, TESTS_SHEET, TEST_HEADERS);

  // Create (or find) a Drive folder to hold uploaded question images.
  const folderName = 'DAMS Exam Portal - Question Images';
  const existing = DriveApp.getFoldersByName(folderName);
  let folder;
  if (existing.hasNext()) {
    folder = existing.next();
  } else {
    folder = DriveApp.createFolder(folderName);
  }
  PropertiesService.getScriptProperties().setProperty('IMAGES_FOLDER_ID', folder.getId());

  // Set a default admin password if none is set yet. CHANGE THIS AFTER SETUP:
  // Script Properties > ADMIN_PASSWORD (Project Settings in the Apps Script editor).
  const props = PropertiesService.getScriptProperties();
  if (!props.getProperty('ADMIN_PASSWORD')) {
    props.setProperty('ADMIN_PASSWORD', 'changeme123');
  }

  Logger.log('Setup complete. Images folder ID: ' + folder.getId());
  Logger.log('Default admin password is "changeme123" — change it in Project Settings > Script Properties > ADMIN_PASSWORD.');
}

function ensureSheet_(ss, name, headers) {
  let sheet = ss.getSheetByName(name);
  if (!sheet) {
    sheet = ss.insertSheet(name);
  }
  if (sheet.getLastRow() === 0) {
    sheet.appendRow(headers);
    sheet.setFrozenRows(1);
  }
}

/* ---------------- ENTRY POINTS ---------------- */
function doGet(e) {
  const action = e.parameter.action;
  try {
    if (action === 'getActiveTest') return jsonOut_(getActiveTest_());
    if (action === 'getQuestions') return jsonOut_(getQuestionsForStudent_(e.parameter.testTag));
    if (action === 'checkAttempt') return jsonOut_(checkAttempt_(e.parameter.testTag, e.parameter.phone));

    // Admin-only GET actions (require password param)
    if (action === 'adminListQuestions') {
      requireAdmin_(e.parameter.password);
      return jsonOut_(listAllQuestions_());
    }
    if (action === 'adminListTests') {
      requireAdmin_(e.parameter.password);
      return jsonOut_(listAllTests_());
    }
    return jsonOut_({ error: 'Unknown action' });
  } catch (err) {
    return jsonOut_({ error: String(err) });
  }
}

function doPost(e) {
  const body = JSON.parse(e.postData.contents);
  const action = body.action;
  try {
    if (action === 'submitExam') return jsonOut_(submitExam_(body));
    if (action === 'adminAddQuestion') {
      requireAdmin_(body.password);
      return jsonOut_(addQuestion_(body));
    }
    if (action === 'adminUpdateQuestion') {
      requireAdmin_(body.password);
      return jsonOut_(updateQuestion_(body));
    }
    if (action === 'adminDeleteQuestion') {
      requireAdmin_(body.password);
      return jsonOut_(deleteQuestion_(body));
    }
    if (action === 'adminUploadImage') {
      requireAdmin_(body.password);
      return jsonOut_(uploadImage_(body));
    }
    if (action === 'adminSetActiveTest') {
      requireAdmin_(body.password);
      return jsonOut_(setActiveTest_(body));
    }
    if (action === 'adminAddTest') {
      requireAdmin_(body.password);
      return jsonOut_(addTest_(body));
    }
    return jsonOut_({ error: 'Unknown action' });
  } catch (err) {
    return jsonOut_({ error: String(err) });
  }
}

function jsonOut_(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}

function requireAdmin_(password) {
  const real = PropertiesService.getScriptProperties().getProperty('ADMIN_PASSWORD');
  if (!password || password !== real) {
    throw new Error('Unauthorized: incorrect admin password.');
  }
}

/* ---------------- TESTS ---------------- */
function getActiveTest_() {
  const rows = sheetRows_(TESTS_SHEET);
  const active = rows.find(r => String(r.Active).toUpperCase() === 'TRUE');
  if (!active) return { found: false };
  return {
    found: true,
    testTag: active.TestTag,
    title: active.Title,
    durationMinutes: Number(active.DurationMinutes) || 30
  };
}

function listAllTests_() {
  return sheetRows_(TESTS_SHEET);
}

function addTest_(body) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName(TESTS_SHEET);
  sheet.appendRow([body.testTag, body.title, body.durationMinutes, false]);
  return { success: true };
}

function setActiveTest_(body) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName(TESTS_SHEET);
  const data = sheet.getDataRange().getValues();
  for (let i = 1; i < data.length; i++) {
    sheet.getRange(i + 1, 4).setValue(data[i][0] === body.testTag); // Active col = 4
  }
  return { success: true };
}

/* ---------------- QUESTIONS ---------------- */
function getQuestionsForStudent_(testTag) {
  const rows = sheetRows_(QUESTIONS_SHEET);
  return rows
    .filter(r => r.TestTag === testTag && String(r.Active).toUpperCase() !== 'FALSE')
    .map(r => ({
      id: r.ID,
      subject: r.Subject,
      question: r.QuestionText,
      imageUrl: r.ImageURL,
      options: { A: r.OptionA, B: r.OptionB, C: r.OptionC, D: r.OptionD }
      // NOTE: CorrectOption and Explanation are intentionally NOT sent to the student.
    }));
}

function listAllQuestions_() {
  return sheetRows_(QUESTIONS_SHEET);
}

function addQuestion_(body) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName(QUESTIONS_SHEET);
  const id = 'Q' + new Date().getTime();
  sheet.appendRow([
    id, body.testTag, body.subject, body.questionText, body.imageUrl || '',
    body.optionA, body.optionB, body.optionC, body.optionD,
    body.correctOption, body.explanation, true
  ]);
  return { success: true, id: id };
}

function updateQuestion_(body) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName(QUESTIONS_SHEET);
  const data = sheet.getDataRange().getValues();
  for (let i = 1; i < data.length; i++) {
    if (data[i][0] === body.id) {
      const row = i + 1;
      sheet.getRange(row, 2, 1, 11).setValues([[
        body.testTag, body.subject, body.questionText, body.imageUrl || '',
        body.optionA, body.optionB, body.optionC, body.optionD,
        body.correctOption, body.explanation, body.active !== false
      ]]);
      return { success: true };
    }
  }
  return { success: false, error: 'Question ID not found' };
}

function deleteQuestion_(body) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName(QUESTIONS_SHEET);
  const data = sheet.getDataRange().getValues();
  for (let i = 1; i < data.length; i++) {
    if (data[i][0] === body.id) {
      sheet.deleteRow(i + 1);
      return { success: true };
    }
  }
  return { success: false, error: 'Question ID not found' };
}

/* ---------------- IMAGE UPLOAD ---------------- */
function uploadImage_(body) {
  // body.imageBase64 is a data URL: "data:image/png;base64,...."
  const folderId = PropertiesService.getScriptProperties().getProperty('IMAGES_FOLDER_ID');
  const folder = DriveApp.getFolderById(folderId);

  const matches = body.imageBase64.match(/^data:(image\/[a-zA-Z0-9+.-]+);base64,(.*)$/);
  if (!matches) return { success: false, error: 'Invalid image data' };
  const contentType = matches[1];
  const base64Data = matches[2];
  const bytes = Utilities.base64Decode(base64Data);
  const blob = Utilities.newBlob(bytes, contentType, body.filename || ('image_' + Date.now()));

  const file = folder.createFile(blob);
  file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);

  // Direct-view URL format that works in <img src="">
  const url = 'https://lh3.googleusercontent.com/d/' + file.getId();
  // Fallback alternative if the above ever stops rendering for a file:
  // const url = 'https://drive.google.com/uc?export=view&id=' + file.getId();

  return { success: true, url: url, fileId: file.getId() };
}

/* ---------------- EXAM SUBMISSION ---------------- */
function checkAttempt_(testTag, phone) {
  const rows = sheetRows_(SUBMISSIONS_SHEET);
  const already = rows.some(r => r.TestTag === testTag && String(r.Phone).trim() === String(phone).trim());
  return { alreadyAttempted: already };
}

function submitExam_(body) {
  // Server-side re-check: block a second attempt even if the client was reloaded/tampered with.
  const check = checkAttempt_(body.testTag, body.phone);
  if (check.alreadyAttempted) {
    return { success: false, error: 'This phone number has already submitted this test.' };
  }

  // Score server-side using the real answer key — never trust a client-sent score.
  const questions = sheetRows_(QUESTIONS_SHEET).filter(r => r.TestTag === body.testTag);
  const qById = {};
  questions.forEach(q => qById[q.ID] = q);

  let score = 0;
  const answers = body.answers || {}; // { questionId: "A"|"B"|"C"|"D" }
  Object.keys(answers).forEach(qid => {
    const q = qById[qid];
    if (q && q.CorrectOption && answers[qid] === q.CorrectOption) score++;
  });

  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName(SUBMISSIONS_SHEET);
  sheet.appendRow([
    new Date(), body.testTag, body.name, body.phone, body.emailOrBatch || '',
    score, questions.length, JSON.stringify(answers), body.timeTakenSeconds || ''
  ]);

  // Student response deliberately omits the score — results go to the team only.
  return { success: true };
}

/* ---------------- HELPERS ---------------- */
function sheetRows_(sheetName) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName(sheetName);
  const data = sheet.getDataRange().getValues();
  if (data.length < 2) return [];
  const headers = data[0];
  return data.slice(1)
    .filter(row => row.some(cell => cell !== '')) // skip blank rows
    .map(row => {
      const obj = {};
      headers.forEach((h, i) => obj[h] = row[i]);
      return obj;
    });
}
