# CRIS Document Portal

A polished, IRHRMS-inspired internal document management portal built as an intern project for the **Centre for Railway Information Systems (CRIS)**, Ministry of Railways, Government of India.

## Live Demo

**https://shivanshx333.github.io/cris-document-portal/**

Demo credentials shown on the sign-in page:

| User ID  | Password    | Role   |
|----------|-------------|--------|
| `admin`  | `cris123`   | Admin  |
| `viewer` | `viewer123` | Viewer |

> The hosted version runs entirely in the browser — files are stored in **IndexedDB**, session in **localStorage**. No backend, no installation, no signup. Open the link on any modern browser (Chrome, Edge, Firefox, Safari).

## Features

- **Sign-in screen** with mock authentication, captcha verification, and demo-credentials box
- **Sidebar navigation** with bilingual English/Hindi labels and saffron active accent
- **Top bar** with notification bell, user pill, and profile dropdown
- **Indian tricolor accent strip** below the top bar
- **Dashboard** with welcome banner, 4 stat tiles, Chart.js donut (file type distribution) and bar chart (uploads over last 7 days), recent files list, recent activity feed
- **Documents page** with drag-and-drop multi-file upload, file type icon badges, client-side search (press `/` to focus), sortable columns, in-modal preview for images / PDFs / text, download, delete with confirmation
- **Activity log** — full audit trail with role and action badges, recording every upload, download, delete, sign-in, and sign-out
- **Toast notifications** that slide in from the top-right and auto-dismiss
- **Responsive layout** with mobile sidebar toggle
- **16 MB file limit**, allowed-extension list, duplicate-filename auto-suffix
- **Hindi script** via Noto Sans Devanagari, English via Inter

## Project structure

```
├── docs/                          ← Static version (deployed to GitHub Pages)
│   ├── index.html                 ← Sign-in page
│   ├── dashboard.html             ← Dashboard with charts
│   ├── documents.html             ← File management
│   ├── activity.html              ← Audit log
│   ├── css/app.css                ← Shared stylesheet
│   ├── js/app.js                  ← All client-side logic
│   └── .nojekyll                  ← Skip Jekyll on GH Pages
│
├── file-manager/                  ← Flask version (deployable on Render)
│   ├── app.py
│   ├── templates/
│   │   ├── base.html
│   │   ├── login.html
│   │   ├── dashboard.html
│   │   ├── documents.html
│   │   └── activity.html
│   └── uploads/
│
├── render.yaml                    ← Render deployment blueprint
├── requirements.txt               ← Python deps (flask, gunicorn)
└── README.md
```

## Two versions, same UI

| | **Static (GitHub Pages)** | **Flask (Render)** |
|---|---|---|
| Hosting | GitHub Pages | Render free tier |
| Storage | IndexedDB (browser) | Server filesystem |
| Auth | Mock (client-side) | Mock (server session) |
| Cold start | None | ~30s after 15 min idle |
| Multi-user | Each user sees own files | Shared (within one host) |
| URL | `shivanshx333.github.io/cris-document-portal/` | `cris-document-portal.onrender.com` |

## Running the Flask version locally

```bash
cd file-manager
pip install -r ../requirements.txt
python app.py
```

Open `http://127.0.0.1:5001`.

## Running the static version locally

```bash
cd docs
python -m http.server 8000
```

Open `http://127.0.0.1:8000`.

## Tech stack

- **Static version:** Vanilla HTML / CSS / JavaScript, IndexedDB, localStorage, [Chart.js](https://www.chartjs.org/) (CDN)
- **Flask version:** Python 3.11, Flask 3.1, Werkzeug, Jinja2, gunicorn
- **Typography:** Inter + Noto Sans Devanagari (Google Fonts)

## Credits

Designed and built by an intern at the **Centre for Railway Information Systems (CRIS)**, Chanakyapuri, New Delhi. UI inspired by Indian Railways internal portals (IRHRMS, IPAS) — restrained navy / steel / saffron palette with subtle tricolor cues.
