# Your Laundry

A college laundry website made with **HTML, CSS, JavaScript and Firebase**.
Made for Bennett University (laundry codes start with `BU`).

## How it works

1. **Student** signs up with their college email (e.g. S25CSEU1161@bennett.edu.in).
2. They add their clothes (max **10 big + 5 small**) and get a **code**, e.g. `BU-48213`.
3. At the **laundry desk**, staff type the code, count the clothes, fix them if needed, and click **Confirm**.
   The return date is set to **3 days** later (the desk can change it if needed). Dates are DD/MM/YYYY.
4. Status: Submitted → Received at desk → Washing → Ready to collect → Collected.
   The student sees the status change live.
5. If clothes are **lost or damaged**, the student sends a complaint (with a photo) and the desk replies.

## Features

| Students | Desk staff |
|----------|-----------|
| Sign up / login with college email | Find laundry by code |
| Laundry list with + / − buttons and limits | Count, fix and confirm clothes |
| Laundry code | Move laundry to the next status |
| Live status tracker | Search by code, name, ID or email |
| Return date with days left | Tabs: Not Collected / All, and change the return date |
| Help: lost / damaged complaints with photo | Reply to complaints |
| Laundry history | Numbers at a glance |
| Dark mode | Dark mode |

## Files

| File | What it does |
|------|--------------|
| `index.html` + `login.js` | Login and Sign up |
| `student.html` + `student.js` | Student page |
| `admin.html` + `admin.js` | Desk staff page |
| `common.js` | Settings + shared code (Firebase connection, helpers, clothes picker, dark mode) |
| `firebase-config.js` | Firebase project settings |
| `style.css` | Design (light + dark, responsive) |
| `firestore-rules.txt` | Database rule: only logged-in users can use it |
| `firebase.json`, `.firebaserc` | Settings for putting the site online |

## Database (Firestore)

| Collection | What is stored |
|------------|----------------|
| `users` | Each student's name, college ID and email |
| `orders` | Each laundry list: code, student, clothes, status, dates |
| `complaints` | Lost / damaged complaints and the desk's reply |

## Setup

1. Put your Firebase settings in `firebase-config.js`.
2. Firebase Console → Authentication → Sign-in method → **Email/Password** → Enable.
3. **Desk staff:** Authentication → Users → **Add user** → `admin@yourlaundry.app` + a password.
   On the website, staff log in by typing just **`admin`**. (More staff: e.g. `ravi@yourlaundry.app` → log in as `ravi`.)
4. Firestore → **Rules** → paste `firestore-rules.txt` → **Publish**.
5. Run: right-click `index.html` → **Open with Live Server**.

## Put it online (Firebase Hosting)

```
npm install -g firebase-tools
firebase login
firebase deploy --only hosting
```

Site: **https://your-laundry-75285.web.app**

## Settings (top of `common.js`)

Code prefix (`BU`), college email domain, clothes list, the 10 / 5 limits and the 3 days.
