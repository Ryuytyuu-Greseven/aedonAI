# AedonAI Agent Builder Server

NestJS backend for the AedonAI Agent Builder frontend (`../builder_config`). Implements the contracts documented in that repo's `backend-openspec/` folder: auth, agents, templates, monitoring, reporting.

## Stack

- NestJS 11, MongoDB via `@nestjs/mongoose`
- JWT auth (`@nestjs/passport` + `passport-jwt`), bcrypt password hashing
- `exceljs` for real `.xlsx` report generation

## Setup

```bash
npm install
cp .env.example .env   # fill in MONGODB_URI (Atlas cluster) and JWT_SECRET
npm run start:dev
```

On first boot, if no user exists yet, a seed account is created from `ADMIN_EMAIL`/`ADMIN_PASSWORD` in `.env` (defaults match the old frontend mock: `test@test.com` / `admin123`). Change these before deploying anywhere real — see `src/auth/auth.service.ts`.

## Scope

This is an independent CRUD/config API for the builder UI — no telephony provider, LLM vendor, or call-execution runtime is wired in yet (those were explicitly undecided in `backend-openspec/`). See `openspec/` in this repo for capability specs and in-flight changes.

Not yet implemented (no backend contract existed for these at scaffold time — see `openspec/` for tracked work): knowledge base, phone numbers, MCP servers, version history, realtime events (call/chat streaming), call log detail, action items.
