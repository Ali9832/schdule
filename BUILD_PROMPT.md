# NOVA — English Product & Build Prompt

Act as a senior full-stack product engineer, UX designer, and delivery lead. Build a polished local-first personal life-planning web application called **NOVA** for a user with only beginner-level programming knowledge.

## Product goal

Create a calm, beautiful command center for managing the user's life: capture vague thoughts, turn them into actionable tasks, organize tasks into projects, prioritize the next step, plan time, and review progress. The user should be able to talk to an AI planning companion in Persian and ask it to classify ideas, create tasks, set priorities, modify existing items, create projects, and propose realistic plans.

## Required architecture

- **Front end:** React single-page application powered by Vite. Use a responsive, RTL-first Persian interface with fast interactions and accessible controls.
- **Back end:** Fastify on Node.js. Expose validated JSON REST endpoints for bootstrap data, tasks, projects, health checks, and the AI assistant.
- **Database:** PostgreSQL for structured data, roles-ready extensibility, activity logs, and ACID-safe task/project transactions. The app must also run without PostgreSQL by using a clearly documented in-memory fallback for first-time local setup.
- **AI:** Keep the OpenAI API key server-side in `.env`. Use structured model output for safe planner operations. If the key is missing or the remote request fails, use a deterministic local assistant fallback so the UI remains usable.

## UX and visual direction

Design a premium but approachable productivity workspace:

- Persian RTL layout, elegant typography, generous whitespace, and mobile responsiveness.
- Dark navy sidebar with a focused purple accent, soft pastel metric cards, rounded panels, subtle borders, and restrained shadows.
- Dashboard with greeting, daily focus list, weekly focus rhythm chart, active projects, recent activity, and an AI coaching call-to-action.
- Clear empty states, loading states, toast feedback, modal forms, hover states, and keyboard-friendly controls.
- Avoid visual clutter. Prioritize the user's next action.

## Core features

1. Dashboard / overview:
   - Today's date and a warm personalized greeting.
   - Open-task, focus-hours, active-project, and rhythm-score metrics.
   - Today's focus tasks with completion toggles and quick edit.
   - Weekly focus visualization.
   - Active project progress and recent activity.
2. Task management:
   - Create, edit, delete, search, filter, and inspect task details.
   - Statuses: todo, in_progress, done.
   - Priorities: high, medium, low.
   - Due date, estimated minutes, description, and optional project relation.
3. Project management:
   - Create and edit projects.
   - Name, success definition, due date, color, icon, status, progress, and task count.
4. Focus calendar:
   - Show a rolling seven-day planning view.
   - Display tasks by due date and allow status toggling.
5. AI planning companion:
   - Persian chat panel with suggestions and typing state.
   - Understand natural language requests such as “امروز را برایم اولویت‌بندی کن”, “این ایده را به پروژه تبدیل کن”, and “برای فردا یک تسک ثبت کن”.
   - Return a concise Persian response and explicit actions.
   - Execute only safe, explicit create/update operations and refresh the UI after successful operations.
   - Never expose the API key to the browser.
6. Local developer experience:
   - One-command development startup from PyCharm.
   - `.env.example`, optional Docker Compose PostgreSQL, README instructions, build script, and health endpoint.
   - Perform validation/build checks and fix runtime issues before handoff.

## Delivery requirements

Generate the complete project files, install dependencies, run the app locally, verify the production build, test the API endpoints, and correct any bugs discovered. Do not stop for subjective design questions during the first pass: choose sensible defaults, ship a coherent working version, and document where the user can customize preferences later.

## Definition of done

- `npm install` completes.
- `npm run dev` starts the Fastify API and Vite client.
- `http://127.0.0.1:5173` renders the RTL NOVA dashboard.
- `GET /api/health` and `GET /api/bootstrap` return valid JSON.
- CRUD actions work for tasks and projects.
- The assistant works with the local fallback and optionally with the OpenAI API.
- `npm run build` succeeds.
- A beginner can follow the README without needing to write application code.
