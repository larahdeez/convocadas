# CLAUDE.md — Convocadas

## What it is
Convocadas is a web app for amateur futsal teams. The coach creates training sessions and matches,
players say whether they are coming, and the coach sees at a glance who is coming, who is not
and who hasn't answered yet. It replaces the "who's coming on Saturday?" message in the team WhatsApp group.

## Stack
- Node.js 22+ **with no external dependencies**: server with `node:http`, database with `node:sqlite`, tests with `node:test`.
- Frontend: plain HTML + CSS + JavaScript, no frameworks, served from `public/`.
- Why: no `npm install` needed, and it runs the same way on any machine and in Docker.

## Structure
- `src/db.js`: SQLite schema (`players`, `events`, `attendance`)
- `src/http.js`: HTTP helpers (JSON, errors, static files)
- `src/app.js`: `createApp(db, { now })`, which loads every route in `src/routes/`
- `src/routes/*.js`: one file per user story
- `src/server.js`: entry point (reads `PORT` and `DATABASE_PATH`)
- `public/`: web interface
- `tests/`: tests with `node:test` (in-memory database and fixed clock)

## Working rules
- **Git flow:** `main` is production and `develop` is integration. Every feature goes in a `feature/<name>` branch created from `develop` and is merged with `--no-ff` after review.
- **Commits:** Conventional Commits (`feat`, `fix`, `docs`, `refactor`, `test`, `chore`).
- **Continuous testing:** every change comes with its tests; the full `npm test` suite must pass before merging. Never change a test just to make it pass.
- **Development environment:** DevContainer (`.devcontainer/devcontainer.json`).
- **Deployment:** Docker (`Dockerfile` + `docker-compose.yml`), deployed on Render from `main`.
- **Secrets:** never in the code. Environment variables, `.env` in `.gitignore` and a versioned `.env.example`.
- **Scope:** implement only what each user story's acceptance criteria ask for. No extras.
- **Language:** everything in English: code, UI, error messages, tests and documentation.

## User stories
- MVP (v0.1.0): US-01 create event · US-02 confirm attendance · US-03 view the squad
- v0.2.0: US-05 attendance statistics
- Backlog: US-04 notifications · US-06 AI squad suggestion

## Commands
- `npm start`: start the server
- `npm run dev`: start with auto-reload (`node --watch`)
- `npm test`: run all tests
- `docker compose up --build`: run in Docker
