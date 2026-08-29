# ProjectPulse — Integrated Project Monitoring Platform

**Plan. Track. Collaborate. Deliver.**

A full-stack, real-time, multi-user project monitoring platform: Node.js + Express + MongoDB + Socket.IO on the backend, vanilla HTML/CSS/JS on the frontend. Multiple people can log in from different devices, work on the same project, and see each other's changes update live — no page refresh required.

---

## 1. What's included

- **Auth**: JWT sessions, bcrypt password hashing, 4 roles (Admin, Project Manager, Team Member, Viewer)
- **Projects**: create/edit/delete/archive, budget tracking, priority, status, auto-calculated progress & health score
- **Tasks**: full Kanban board (Backlog → To Do → In Progress → Review → Completed / Blocked), drag-and-drop, priority, assignment, progress %
- **Milestones** with a visual timeline
- **Issue tracking** and a **risk register** (auto-scored: probability × impact)
- **Documents**: file upload per project
- **Comments** on projects/tasks/issues/milestones
- **Real-time team chat** per project (Socket.IO)
- **Real-time notifications** (task assigned, status changes, new comments, etc.)
- **Activity log** — automatic audit trail of everything that happens on a project
- **Dashboard analytics** with Chart.js (task status, project health, team performance)
- **Dark mode**, responsive layout, toasts, empty/loading states
- **Demo data seed script** with 4 demo accounts and 3 sample projects

## 2. Project structure

```
projectpulse/
  client/           HTML/CSS/JS frontend (static, no build step)
  server/
    config/         MongoDB connection
    models/         Mongoose schemas
    routes/         REST API endpoints
    middleware/      JWT auth guard
    sockets/        Socket.IO event handlers
    utils/          Shared logic (health scoring, activity/notification helpers)
    server.js       App entry point
    seed.js         Demo data generator
  package.json
```

---

## 3. Run it locally

**You'll need:** Node.js 18+ and a MongoDB connection string (a free [MongoDB Atlas](https://www.mongodb.com/cloud/atlas/register) cluster works great and takes about 3 minutes to set up).

```bash
# 1. Install dependencies
npm install

# 2. Configure environment
cp server/.env.example server/.env
# then edit server/.env and paste in your MONGO_URI and a JWT_SECRET

# 3. (Optional but recommended) Populate demo data
npm run seed

# 4. Start the app
npm run dev        # auto-restarts on changes (nodemon)
# or: npm start     # plain node

# 5. Open it
http://localhost:5000
```

### Demo accounts (created by `npm run seed`)
| Role | Email | Password |
|---|---|---|
| Admin | admin@projectpulse.com | Admin123 |
| Project Manager | manager@projectpulse.com | Manager123 |
| Team Member | member@projectpulse.com | Member123 |
| Viewer / Faculty | viewer@projectpulse.com | Viewer123 |

Anyone can also click **"Load Demo Data"** on the dashboard to generate a fresh sample project on their own account at any time.

### Proving it's really multi-user
1. Log in as the Manager in one browser.
2. Log in as the Member in another browser (or phone) — use the same project.
3. Assign a task to the Member from the Manager's screen.
4. Watch it appear instantly on the Member's screen with no refresh, and vice versa when they change its status.

---

## 4. Publishing it so anyone can access it

This app has two pieces that both need to be online: the **Node/Express/Socket.IO server** and a **MongoDB database**. Free tiers exist for both. Recommended path (~10–15 minutes):

### Step A — Database: MongoDB Atlas (free)
1. Create a free cluster at [mongodb.com/cloud/atlas](https://www.mongodb.com/cloud/atlas/register).
2. Under **Network Access**, add `0.0.0.0/0` (allow access from anywhere) so your host can reach it.
3. Under **Database Access**, create a database user with a password.
4. Copy the connection string (Connect → Drivers), e.g.
   `mongodb+srv://<user>:<password>@cluster0.xxxxx.mongodb.net/projectpulse`

### Step B — Hosting: Render (free tier, supports Socket.IO's persistent connections)
> Railway, Fly.io, or a VPS work too — anything that runs a long-lived Node process. Vercel/Netlify are *not* a good fit because their serverless functions don't support Socket.IO's long-lived WebSocket connections.

1. Push this project to a GitHub repository.
2. Go to [render.com](https://render.com) → **New → Web Service** → connect your repo.
3. Configure:
   - **Build command:** `npm install`
   - **Start command:** `npm start`
4. Add environment variables in the Render dashboard:
   - `MONGO_URI` = your Atlas connection string from Step A
   - `JWT_SECRET` = any long random string
   - `PORT` = `10000` (Render sets this automatically, but the app reads `process.env.PORT` either way)
5. Deploy. Render gives you a public URL like `https://projectpulse.onrender.com` — that's now live for anyone.
6. SSH/shell into the Render service (or run it once locally pointed at the same `MONGO_URI`) and run `npm run seed` to load demo accounts, or just register a new account through the UI.

Free-tier note: Render's free web services spin down after inactivity and take ~30–60 seconds to wake up on the next request — fine for a hackathon demo, worth knowing about beforehand.

---

## 5. Environment variables

Set these in `server/.env` locally, or in your host's dashboard when deployed:

```
PORT=5000
MONGO_URI=your_mongodb_connection_string
JWT_SECRET=change_this_to_a_long_random_secret
```

Never commit `server/.env` — it's already excluded via `.gitignore`.

## 6. Notes on scope

This build covers the core, functioning slice of the full spec (auth/roles, projects, tasks/Kanban, milestones, issues, risks, documents, comments, real-time chat & notifications, activity log, analytics, dark mode, demo data). A few of the more peripheral items in the original spec (e.g. a dedicated global search bar across every entity type, granular per-field sorting UI, weighted-task progress calculation) aren't wired up yet — the data model and API already support extending into them if you want to keep building.
