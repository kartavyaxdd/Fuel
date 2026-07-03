---
wave: 1
type: setup_architecture
depends_on: []
files_modified:
  - README.md
  - backend/package.json
  - backend/tsconfig.json
  - backend/src/server.ts
  - backend/src/routes/dashboard.ts
  - backend/src/index.ts
  - frontend/package.json
  - frontend/tsconfig.json
  - frontend/tailwind.config.ts
  - frontend/app/dashboard/page.tsx
  - frontend/app/layout.tsx
  - frontend/app/globals.css
  - root package.json
autonomous: true
must_haves:
  truths:
    - "Application starts with `npm run dev` from root"
    - "Dashboard loads at `http://localhost:3000` and shows mock nutrition data"
    - "Backend API serves `/api/dashboard` with JSON payload"
    - "Responsive layout works on mobile and desktop"
    - "Tests pass for backend route and frontend component"
  artifacts:
    - "backend/src/routes/dashboard.ts (25+ lines)"
    - "frontend/app/dashboard/page.tsx (60+ lines)"
    - "frontend/app/layout.tsx (30+ lines)"
  key_links:
    - "frontend dashboard fetches from http://localhost:4000/api/dashboard via useEffect"
---

# Phase 1: Project Setup and Core Architecture

## Goal
Set up the project structure with a functional baseline that includes a basic dashboard showing mock data. Establish the development environment, tooling, and core architecture.

---

<task id="t1">
<name>Initialize Repository Structure</name>
<files>
  - /backend
  - /frontend
  - /docs
  - .gitignore
  - README.md
</files>
<action>
Create `/backend`, `/frontend`, `/docs`. Initialize git repo. Add `.gitignore` for Node.js, Next.js, and IDE files.
</action>
<verify>
Run `ls backend frontend docs README.md .git` and confirm they exist.
</verify>
<done>Directory structure exists and git is initialized.</done>
</task>

<task id="t2">
<name>Backend Server Setup</name>
<files>
  - backend/package.json
  - backend/tsconfig.json
  - backend/src/server.ts
  - backend/src/routes/dashboard.ts
  - backend/src/index.ts
</files>
<action>
1. Init Node.js project with `npm init -y`
2. Install `express`, `cors`, `dotenv` and their types
3. Install dev deps: `typescript`, `ts-node`, `nodemon`, `@types/express`, `@types/cors`, `@types/node`
4. Write `tsconfig.json`
5. Write `src/index.ts` (entry point)
6. Write `src/server.ts` (Express app with CORS and JSON parser)
7. Write `src/routes/dashboard.ts` (GET /api/dashboard returning mock nutrition data)
8. Add `dev:server` script
</action>
<verify>
Run `npm run dev:server` and curl `http://localhost:4000/api/dashboard` — expect 200 with JSON.
</verify>
<done>Backend API returns mock data successfully.</done>
</task>

<task id="t3">
<name>Frontend Setup with Next.js and Tailwind</name>
<files>
  - frontend/package.json
  - frontend/tsconfig.json
  - frontend/tailwind.config.ts
  - frontend/postcss.config.js
  - frontend/app/globals.css
  - frontend/app/layout.tsx
  - frontend/app/dashboard/page.tsx
</files>
<action>
1. Run `npx create-next-app@latest frontend --typescript --tailwind --eslint --app --src-dir=false`
2. Configure dark mode in `tailwind.config.ts`
3. Set up `globals.css` with dark theme base variables
4. Create `app/layout.tsx` with dark background wrapper
5. Create `app/dashboard/page.tsx` fetching from `http://localhost:4000/api/dashboard` and displaying mock data with beautiful cards and progress indicators
</action>
<verify>
Run `npm run dev:app` and open `http://localhost:3000` — dashboard renders with data.
</verify>
<done>Frontend renders dashboard with API data.</done>
</task>

<task id="t4">
<name>Development Workflow & Root Orchestration</name>
<files>
  - package.json
</files>
<action>
Create root `package.json` with workspaces, add `concurrently` as dev dependency, create root `dev` script to run both frontend and backend simultaneously.
</action>
<verify>
Run `npm run dev` from root — both backend (4000) and frontend (3000) start.
</verify>
<done>Single command starts the full stack.</done>
</task>

<task id="t5">
<name>Code Quality & Testing</name>
<files>
  - backend/jest.config.js
  - backend/src/routes/__tests__/dashboard.test.ts
  - frontend/jest.config.js
  - frontend/app/dashboard/__tests__/page.test.tsx
</files>
<action>
1. Install and configure Jest for both backend and frontend
2. Install React Testing Library for frontend tests
3. Write a simple test for the backend `/api/dashboard` route
4. Write a simple snapshot/availability test for the dashboard page component
5. Ensure ESLint and Prettier configs exist in both
</action>
<verify>
Run `npm test` in both backend and frontend and see passing tests.
</verify>
<done>Tests pass and formatting tools are configured.</done>
</task>

<task id="t6">
<name>Documentation</name>
<files>
  - README.md
</files>
<action>
Write README.md with project overview, tech stack, and setup instructions (git clone, npm install, npm run dev).
</action>
<verify>
Verify README.md is present and has the required sections.
</verify>
<done>README.md is complete.</done>
</task>