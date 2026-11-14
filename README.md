# Convocadas ⚽

> A web app that lets a futsal team know who's coming to every training session and match, without chasing anyone on WhatsApp.

🌐 **Live:** https://convocadas.onrender.com

Final project for the course *Building Digital Products with Generative AI* (2026). *Convocadas* is Spanish for "called-up players", the list of players selected for a match.

---

## 1. What it is

**Problem:** in an amateur team, the coach or captain has to ask every player, one by one, whether they're coming to each training session and match. Answers get lost in the team's WhatsApp group and the squad is picked blindly.

**Who it's for:** coaches, captains and players of an amateur futsal team (around 10-15 people).

**Minimum moment of value:** the coach opens Saturday's match and instantly sees who's coming, who isn't and who hasn't answered yet.

> **In one sentence:** Convocadas replaces the "who's coming on Saturday?" message in the group chat with a list that updates itself.

---

## 2. Features

### MVP

| ID | User story | Status |
|---|---|---|
| US-01 | As a **coach**, I want to **create an event (training or match) with a date, time and location**, so that **the team knows when and where to be**. | ✅ |
| US-02 | As a **player**, I want to **say whether I'm coming to an event**, so that **the coach can plan ahead**. | ✅ |
| US-03 | As a **coach**, I want to **see who's coming, who isn't and who hasn't answered for each event**, so that **I can pick the squad without asking everyone one by one**. | ✅ |

### Version 0.2.0

| ID | User story | Status |
|---|---|---|
| US-05 | As a **coach**, I want to **see attendance statistics per player**, so that **I know how committed the team is**. | ✅ |

**Main acceptance criteria**
- US-01: type, date, time and location are required; past dates and impossible dates (e.g. 30 February) are rejected; the list only shows upcoming events, sorted by date and time.
- US-02: each player picks her name (or adds herself to the roster) and clicks "Coming" / "Not coming"; she can change her mind; past events can't be answered.
- US-03: clicking an event shows three columns (Coming / Not coming / No answer yet) with their counts; it refreshes automatically every 4 seconds.
- US-05: a table shows, for each player, how many events she's coming to, not coming to and hasn't answered, plus her attendance rate (events she's coming to ÷ all events, rounded). Players are sorted by attendance rate, the team average is shown, and the stats can be filtered by matches or training.

### Backlog

| ID | User story |
|---|---|
| US-04 | As a player, I want to get a notification when an event is created, so that I don't find out too late. |
| US-06 | As a coach, I want AI to suggest the squad based on attendance, so that I can decide faster. |

**Why this cut:** without US-01 to US-03 there is no value, because you can't know who's coming. Notifications, statistics or AI improve the product, but they aren't essential to solve the problem. Once the MVP was working, attendance statistics (US-05) were the first backlog item added, in version 0.2.0.

---

## 3. How to run it

### Stack
Node.js 22+ **with no external dependencies**: server with `node:http`, SQLite database with `node:sqlite` and tests with `node:test`. Plain HTML, CSS and JavaScript frontend with no frameworks. No `npm install` needed.

### Option A: with Docker (recommended)
Requirements: [Docker](https://www.docker.com/) with Docker Compose.

```bash
docker compose up --build
```
Open http://localhost:3000. Data is stored in a Docker volume (`convocadas-data`).

To stop it and delete the data:
```bash
docker compose down -v
```

### Option B: with Node.js
Requirement: **Node.js 22.13 or later** (`node -v`), because it uses the built-in `node:sqlite` module.

```bash
cp .env.example .env      # on Windows: copy .env.example .env
npm start                 # or npm run dev for auto-reload
```
Open http://localhost:3000.

> On Windows PowerShell, if `npm` is blocked by the script execution policy, use `npm.cmd start` and `npm.cmd test`.

### Option C: DevContainer
Open the folder in VS Code → *Reopen in Container* → `npm run dev`.

### Environment variables

| Variable | What it's for | Default |
|---|---|---|
| `PORT` | Server port | `3000` |
| `DATABASE_PATH` | Path to the SQLite file | `./data/convocadas.db` |

`.env` is **never** committed (it's in `.gitignore`); only `.env.example` is versioned. The project uses no API keys or secrets.

### Tests
```bash
npm test
```
44 tests (server health, US-01, US-02, US-03 and US-05). Each test starts the server with an in-memory database and a fixed clock, so results don't depend on the day they run.

### Demo walkthrough
1. Open the app in two browser tabs.
2. **Tab 1 (coach):** leave "Who are you?" as "I'm the coach" and create Saturday's match.
3. **Tab 2 (player):** add your name and click "✔ Coming" on the match.
4. Go back to tab 1: within a few seconds the player shows up under "Coming", without reloading.
5. Scroll down to **Attendance stats** to see each player's attendance rate, and filter it by matches or training.

### API

| Method | Route | Story |
|---|---|---|
| GET | `/api/health` | — |
| GET / POST | `/api/events` | US-01 |
| GET / POST | `/api/players` | US-02 |
| GET | `/api/players/:id/attendance` | US-02 |
| PUT | `/api/events/:id/attendance` | US-02 |
| GET | `/api/events/:id/squad` | US-03 |
| GET | `/api/stats?type=match\|training` | US-05 |

### Deployment
Deployed on **Render** as a Docker web service, from the `main` branch on GitHub:

**https://convocadas.onrender.com**

- Render builds the image from the repository's `Dockerfile` and sets the port through the `PORT` variable, which the app already reads. Nothing else needs configuring.
- Every `push` to `main` triggers a new deployment automatically.
- Free plan: the service goes to sleep after 15 minutes without traffic (the first visit takes about 30-50 s to wake it up), and the disk isn't persistent, so data is wiped when it restarts.

---

## 4. How it was built with AI

**Agent used:** Claude, with access to the project folder. I defined the product, the user stories and the acceptance criteria, and I reviewed and tested every delivery; the agent wrote the code, the tests and the configuration.

### The workflow
1. **Define the idea:** I started from a problem I deal with every week as a futsal player. With the agent I pinned down the problem, the user and the minimum moment of value, and separated the MVP (US-01 to US-03) from the backlog.
2. **Context for the agent:** first came `CLAUDE.md`, with the description, the stack and the rules (Git flow, Conventional Commits, DevContainer, Docker, no secrets in the code and nothing outside the acceptance criteria).
3. **Skeleton:** `src/`, `tests/` and `docs/` structure, DevContainer, Dockerfile, `docker-compose.yml`, `.env.example` and a first passing test.
4. **One loop per user story:** `feature/<name>` branch from `develop` → implementation → tests (normal cases, edge cases and errors) → full suite green → merge into `develop` with `--no-ff`.
   - `feature/create-event` (US-01)
   - `feature/attendance` (US-02)
   - `feature/squad-view` (US-03)
5. **Release and deployment:** merge `develop` into `main` as `v0.1.0` and deploy on Render from `main`.
6. **Version 0.2.0:** the first backlog story, `feature/attendance-stats` (US-05), following the same loop, released as `v0.2.0`.

You can see the history with `git log --oneline --graph --all`.

### Example of a spec given to the agent
Each story was handed to the agent in this format (US-01):
```
Implement only US-01 on the feature/create-event branch, created from develop.
As a coach, I want to create an event (training or match) with a date, time and location,
so that the team knows when and where to be.
Acceptance criteria:
- Type, date, time and location are required.
- Past dates and impossible dates are rejected.
- The list only shows upcoming events, sorted by date and time.
Follow the rules in CLAUDE.md, write the tests (normal cases, edge cases and errors)
and don't add anything that isn't in the criteria.
```

### What went well
- Going from the idea to an MVP with a clearly separated backlog was very fast.
- User stories with concrete acceptance criteria gave every branch a clear scope that was easy to review.
- The tests immediately caught a bug in the `npm test` script (Node couldn't find the `tests/` folder and had to be given the `tests/*.test.js` pattern).

### What was hard
- **The agent's environment couldn't download npm packages** (the registry was blocked). Instead of losing time, we decided to use only Node's built-in modules (`node:http`, `node:sqlite`, `node:test`). The result is a dependency-free project that is actually easier to run.
- **PowerShell blocked `npm`** because of Windows' script execution policy. I solved it by using `npm.cmd test` and `npm.cmd start`, without changing the system's security settings.
- **SQLite and Vercel don't fit together:** Vercel runs serverless functions and doesn't keep the database file. That's why I deployed on **Render**, another platform covered in the course, which runs the Docker container as is.

### Decisions (and why)
- **No external dependencies:** because npm was blocked and because it means no `npm install` and no version issues.
- **SQLite instead of PostgreSQL:** more than enough for a 15-person team, and no separate database server needed.
- **No login in the MVP:** each player identifies herself by picking her name from a list. Good enough for a team that knows each other, but not secure (see limitations).
- **Injectable clock (`now`) on the server:** the tests use a fixed date so that "past dates are rejected" can always be checked the same way.
- **Auto-refresh every 4 s** instead of WebSockets: simpler and good enough for the demo.

---

## 5. Status and next steps

### How far I got
| Story | Status | Notes |
|---|---|---|
| US-01 | ✅ | With field validation, past dates and impossible dates |
| US-02 | ✅ | Includes the player roster and changing your answer |
| US-03 | ✅ | With counts and auto-refresh |
| US-05 | ✅ | Per-player rate, team average and match/training filter (v0.2.0) |

### What works
- The three MVP stories and the attendance statistics, end to end, locally, in Docker and in production.
- 44 automated tests, all green.
- Runs with `npm start` without installing anything, and with Docker (`docker compose up --build`), tested on Windows with Docker Desktop.
- Deployed and available at https://convocadas.onrender.com.

### Known limitations
- **No authentication:** anyone with the link can answer for another player or create events.
- **A single team:** there's no separation between different teams.
- **Events and players can't be edited or deleted** (not part of the MVP criteria).
- **Production data isn't permanent:** on Render's free plan it's wiped when the service restarts or is redeployed.
- **Attendance rates count every event:** a player who joins the roster late starts with a lower rate, because events before she joined count as "no answer".

### Natural next step
1. **Persistent data in production:** add a persistent disk on Render or move to PostgreSQL.
2. **Simple login** (magic link by email) so each player can only answer for herself.
3. **US-04, notifications:** a notification when an event is created.

---

## Project structure

```
.
├── .devcontainer/devcontainer.json
├── src/
│   ├── server.js          # entry point
│   ├── app.js             # HTTP server and router
│   ├── http.js            # helpers (JSON, errors, static files)
│   ├── db.js              # SQLite schema
│   └── routes/
│       ├── events.js      # US-01
│       ├── players.js     # US-02 (roster)
│       ├── attendance.js  # US-02
│       ├── squad.js       # US-03
│       └── stats.js       # US-05
├── public/                # web interface (index.html, app.js, styles.css)
├── tests/                 # node:test
├── docs/
├── Dockerfile
├── docker-compose.yml
├── .env.example
├── CLAUDE.md
└── README.md
```
