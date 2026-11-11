# DAMS Calicut Exam Portal — Setup Guide

You're setting up 3 pieces: a Google Sheet (database), an Apps Script (backend), and two web pages (`exam.html` for students, `admin.html` for your team). Takes about 10 minutes.

## 1. Create the Google Sheet
1. Go to sheets.google.com → **Blank spreadsheet**. Name it "DAMS Exam Portal".
2. You don't need to create tabs or headers manually — the script does this for you in Step 3.

## 2. Attach the Apps Script
1. In the Sheet, go to **Extensions → Apps Script**.
2. Delete any starter code in `Code.gs`, then paste in the entire contents of the `Code.gs` file I gave you.
3. Click the **Save** icon (disk icon).

## 3. Run setup once
1. In the Apps Script toolbar, find the function dropdown (next to "Debug") and select **setup**.
2. Click **Run**. The first time, Google will ask you to authorize the script — click through **Review permissions → (your account) → Advanced → Go to [project] (unsafe) → Allow**. (This "unsafe" warning is normal for your own scripts — it just means Google hasn't reviewed it, not that it's actually unsafe.)
3. Go back to your Sheet — you'll now see 3 tabs: **Questions**, **Submissions**, **Tests**.
4. Back in Apps Script, go to **Project Settings (gear icon) → Script Properties**. You'll see `ADMIN_PASSWORD` set to `changeme123` — click it and **change this to your own password**. This is the password your team will use to log into `admin.html`.

## 4. Deploy as a Web App
1. In Apps Script, click **Deploy → New deployment**.
2. Click the gear icon next to "Select type" → choose **Web app**.
3. Set:
   - **Execute as:** Me
   - **Who has access:** Anyone
4. Click **Deploy**, authorize again if asked, then **copy the Web App URL** (ends in `/exec`). This is your `API_URL`.

> Whenever you edit `Code.gs` later, you must **Deploy → Manage deployments → Edit (pencil) → New version → Deploy** for changes to take effect — saving alone isn't enough.

## 5. Connect the two web pages
1. Open `exam.html` in a text editor, find this line near the top of the `<script>`:
   ```
   const API_URL = "PASTE_YOUR_APPS_SCRIPT_WEB_APP_URL_HERE";
   ```
   Replace the text in quotes with the URL you copied in Step 4.
2. Do the same in `admin.html`.
3. Upload both files to wherever you host your other sites (e.g. the same GitHub Pages repo as the IUK/Moldova sites, or a folder on damscalicut.com). They're fully self-contained — no build step needed.

## 6. Add your first test and questions
1. Open `admin.html` in a browser, log in with the password you set in Step 3.
2. Under **Create New Test**, add e.g. Test Tag `Week1`, Title "DAMS Weekly Test - Week 1", Duration `30`.
3. Click **Make Active** next to it — this is the test students will see.
4. Use the **Add a Question** form to add questions one at a time (image upload is optional — it uploads straight to your Drive automatically).

## 7. Each new week
1. In `admin.html`, create a new test (e.g. `Week2`), add that week's questions tagged with `Week2`.
2. Click **Make Active** on `Week2` — students now see the new test automatically. (`Week1`'s questions and results stay in the Sheet for your records.)

## Where results go
Every submission appears as a new row in the **Submissions** tab of your Sheet automatically — name, phone, batch, score, and time taken. Students never see their score on-screen; only your team, by opening the Sheet.

## One-attempt enforcement
A student can't submit the same test twice with the same phone number — this is checked both in their browser and (more importantly) on the server, so it can't be bypassed by refreshing or clearing browser data.

## If something doesn't work
- **"Incorrect password" in admin.html** → double check `ADMIN_PASSWORD` in Script Properties matches exactly what you're typing.
- **Exam page stuck on "Loading test..."** → check `API_URL` is pasted correctly in `exam.html`, and that you've made a test "Active" in `admin.html`.
- **Images not showing** → re-check the deployment is set to "Execute as: Me" and "Anyone" — private Drive sharing will block the image.
