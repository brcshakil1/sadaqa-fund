# Sadaqah Fund

A MERN website (MongoDB, Express, React, Node) to manage a monthly Sadaqah fund.

## How it works

- **Admins** (at least two) create member accounts: name, photo, address, profession, login ID and password. Admins can create more admins.
- **Members and admins** log in with their ID and password. Admins also donate monthly like everyone else.
- **Send Sadaqah**: after sending money to an admin, the member fills a form (amount, month, which admin, Monthly or Extra, note). The admin gets a notification and clicks **Confirm**. Only then is the amount added to the fund.
- **Donate**: anyone fills a form (amount, month, recipient name, address, reason). An admin approves it and the amount is deducted from the fund. An admin cannot approve their own request; the other admin must.
- **Dashboard**: fund balance, total collected, total donated, this month's amounts, and every member's amounts (monthly, extra, all time).
- **History**: everyone's confirmed Sadaqah and donations. Filter by period (all time, one year, or From month - To month) and by member, then download a PDF or Excel (CSV) report.

Rules built in:
- A payment can only be confirmed by the admin it was sent to.
- You cannot send a payment to yourself, so the other admin always confirms yours.
- A donation cannot exceed the current fund balance.
- The system always keeps at least one active admin.

## Project layout

```
server/   Express API + MongoDB (Mongoose), JWT login
client/   React (Vite) website
```

## Run on your computer

You need Node 18+ and a MongoDB database (a free MongoDB Atlas cluster, or local MongoDB).

```bash
# 1. API
cd server
cp .env.example .env        # then edit .env (MONGO_URI, JWT_SECRET, first admin)
npm install
npm run dev                 # http://localhost:5000

# 2. Website (new terminal)
cd client
npm install
npm run dev                 # http://localhost:5173
```

On first start the API creates the first admin from `SEED_ADMIN_ID` / `SEED_ADMIN_PASSWORD` in `.env`.
Log in, change the password on the **Profile** page, then open **Members** and add the second admin and the 10 members.

## Deploy for free

Free plans change, so check each site's current limits. This combination has been the usual free setup.

### 1. Database: MongoDB Atlas

1. Create a free account at mongodb.com/atlas and create a free **M0** cluster.
2. **Database Access** → add a database user (username + password).
3. **Network Access** → add IP `0.0.0.0/0` (needed because the free host has changing IPs).
4. **Connect → Drivers** → copy the connection string. Put your password in it and add the database name, e.g.
   `mongodb+srv://USER:PASS@cluster0.xxxxx.mongodb.net/sadaqah-fund?retryWrites=true&w=majority`

### 2. API: Render

1. Push this project to a GitHub repository.
2. On render.com: **New → Web Service** → connect the repo.
3. Settings: **Root Directory** `server`, **Build Command** `npm install`, **Start Command** `npm start`, plan **Free**.
4. Environment variables:
   - `MONGO_URI` = your Atlas string
   - `JWT_SECRET` = a long random string
   - `CLIENT_URL` = your Vercel URL (add it after step 3; no trailing slash)
   - `SEED_ADMIN_ID`, `SEED_ADMIN_NAME`, `SEED_ADMIN_PASSWORD` = your first admin
5. Deploy. Check `https://YOUR-API.onrender.com/api/health` shows `{"ok":true}`.

Note: free Render services go to sleep when idle, so the first request after a while can take about a minute. You can ping `/api/health` every 10 minutes with a free monitor such as UptimeRobot to keep it awake.

### 3. Website: Vercel

1. On vercel.com: **Add New → Project** → import the same repo.
2. **Root Directory** `client`. Framework preset: Vite.
3. Environment variable: `VITE_API_URL` = `https://YOUR-API.onrender.com/api`
4. Deploy, then copy the Vercel URL into `CLIENT_URL` on Render and redeploy the API.

`client/vercel.json` already makes page refreshes work.

## Good to know

- **Profile pictures** are resized in the browser to 200x200 and stored inside MongoDB, so no separate file storage is needed.
- **Bangla in PDFs**: Bangla names, addresses and reasons are drawn with the browser's Bangla font (Noto Sans Bengali from Google Fonts, or the system font) and placed into the PDF as pictures, so they look correct but cannot be selected or copied. English text stays normal PDF text. Excel (CSV) downloads keep all text.
- **Currency** is shown as ৳ on the website and "Tk" in PDFs.
- **Disabling** an account (instead of deleting) keeps its past records intact.
- **Backups**: Atlas free tier has no automatic backups. Export the data now and then (Atlas → Collections → Export, or `mongodump`).

## API summary

| Method | Path | Who |
|---|---|---|
| POST | `/api/auth/login` | all |
| GET/PUT | `/api/auth/me`, `/api/auth/password` | logged in |
| GET | `/api/users` | logged in |
| PUT | `/api/users/me` | logged in |
| POST / PUT | `/api/users`, `/api/users/:id` | admin |
| POST/GET | `/api/payments`, `/api/payments/mine` | logged in |
| GET / PATCH | `/api/payments/pending`, `/api/payments/:id/review` | admin |
| POST/GET | `/api/donations`, `/api/donations/mine` | logged in |
| GET / PATCH | `/api/donations/pending`, `/api/donations/:id/review` | admin |
| GET | `/api/stats/summary`, `/members`, `/report` | logged in |
| GET/PATCH | `/api/notifications` ... | logged in |
