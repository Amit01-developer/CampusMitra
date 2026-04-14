# CampusMitra 🤝

An AI-powered platform for college students to **rent, borrow, and share campus essentials** — reducing expenses, minimizing waste, and building a trusted campus community.

> "Share Smart. Save More. Grow Together."

---

## Features

- Browse & search items by category (Electronics, Textbooks, Tools, Clothing)
- List your own items for rent or borrow
- JWT-based authentication (Email/Password + Google Sign-In)
- Owner Dashboard — manage your listed items & incoming rental requests
- Borrower Dashboard — track items you've borrowed
- AI-powered trust scoring & smart matching
- Firebase Firestore as database

---

## Tech Stack

| Layer    | Technology                        |
|----------|-----------------------------------|
| Frontend | HTML, CSS, Vanilla JavaScript     |
| Backend  | Python, Flask, Flask-JWT-Extended |
| Database | Firebase Firestore                |
| Auth     | Firebase Auth + JWT               |

---

## Project Structure

```
CampusMitra/
├── index.html               # Landing page
├── owner-dashboard.html     # Lender dashboard
├── borrower-dashboard.html  # Borrower dashboard
├── style.css
├── dashboard.css
├── script.js
├── dashboard.js
└── backend/
    ├── app.py               # Flask API routes
    ├── auth.py              # JWT auth middleware
    ├── db.py                # Firestore connection
    ├── seed.py              # Seed data script
    └── requirements.txt
```

---

## Getting Started

### 1. Clone the repo

```bash
git clone https://github.com/your-username/campusmitra.git
cd campusmitra
```

### 2. Setup Firebase

- Go to [Firebase Console](https://console.firebase.google.com/) and create a project
- Enable **Firestore** and **Authentication** (Email/Password + Google)
- Download your `serviceAccountKey.json` from Project Settings → Service Accounts
- Place it inside the `backend/` folder

> ⚠️ Never commit `serviceAccountKey.json` to GitHub

### 3. Install dependencies

```bash
cd backend
pip install -r requirements.txt
```

### 4. Run the backend

```bash
python app.py
```

Server starts at `http://localhost:5000`

The Flask server also serves the frontend — open `http://localhost:5000` in your browser.

---

## API Endpoints

| Method | Endpoint                        | Description              |
|--------|---------------------------------|--------------------------|
| POST   | `/api/auth/signup`              | Register new user        |
| POST   | `/api/auth/login`               | Login with email/password|
| POST   | `/api/auth/google`              | Login with Google        |
| GET    | `/api/auth/me`                  | Get current user         |
| GET    | `/api/items`                    | List all items           |
| POST   | `/api/items`                    | Create new item          |
| PUT    | `/api/items/<id>`               | Update item              |
| DELETE | `/api/items/<id>`               | Delete item              |
| GET    | `/api/categories`               | List all categories      |
| GET    | `/api/search?q=query`           | Search items             |
| POST   | `/api/rentals`                  | Create rental request    |
| GET    | `/api/rentals`                  | Get my rentals           |
| PUT    | `/api/rentals/<id>/status`      | Update rental status     |

---

## Environment Variables

You can set these instead of hardcoding:

| Variable               | Description                        | Default                      |
|------------------------|------------------------------------|------------------------------|
| `JWT_SECRET`           | Secret key for JWT tokens          | `campus-mitra-secret-2026`   |
| `FIREBASE_CREDENTIALS` | Path to serviceAccountKey.json     | `serviceAccountKey.json`     |

---

## .gitignore

Make sure these are ignored:

```
backend/serviceAccountKey.json
backend/__pycache__/
*.pyc
.env
```

---

## Made with ❤️ for students, by students
