# Research for Phase 1: Project Setup and Core Architecture

## Domain
Nutrition and body composition tracking application inspired by MacroFactor and MacroPhase.

## Standard Stack
- **Frontend**: React with TypeScript, Tailwind CSS for styling, Recharts for charts, React Query for state management.
- **Backend**: Node.js with Express, SQLite for development (consider PostgreSQL for production), or Supabase for a BaaS approach.
- **Dev Tools**: ESLint, Prettier, TypeScript, Jest for testing, Git for version control.
- **Deployment**: Vercel for frontend, Render or Railway for backend (or Vercel for both if using serverless).

## Patterns
- Modular architecture: Separate concerns into features (dashboard, food logging, weight tracking, etc.).
- Reusable UI components with a design system.
- State management: Use React Query for server state and Context or Redux for client state.
- API layer: Separate API service layer from components.
- Error handling and loading states.
- Accessibility: Follow WCAG guidelines, use semantic HTML, ARIA labels.
- Performance: Code splitting, lazy loading, optimize images, use React.memo where appropriate.
- Testing: Unit tests for utilities and components, integration tests for critical flows.

## Pitfalls to Avoid
- Over-engineering early on; focus on MVP.
- Ignoring performance on mobile devices.
- Not planning for offline capabilities.
- Neglecting accessibility from the start.
- Inconsistent state management leading to bugs.
- Not handling edge cases in data validation and user input.
- Hardcoding API keys or configuration; use environment variables.
- Not setting up logging and monitoring early.

## Phase 1 Goals
- Set up the project structure with frontend and backend.
- Implement a basic dashboard that shows mock data for:
    - Today's calories
    - Macronutrients (protein, carbs, fat)
    - Remaining targets
    - Expenditure estimate (hardcoded)
    - Weight trend (placeholder)
    - Weekly adherence (placeholder)
    - Goal progress (placeholder)
- Ensure the app runs locally and can be started with a single command.
- Implement a responsive layout that works on mobile and desktop.
- Set up TypeScript, ESLint, Prettier, and basic testing setup.