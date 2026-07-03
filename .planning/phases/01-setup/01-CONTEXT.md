# Phase 01: Project Setup and Core Architecture
**Domain**: Set up the project structure with a functional baseline that includes a basic dashboard showing mock data.

## Decisions

### Frontend Dashboard Implementation
- **Layout style**: Use a responsive grid of cards to display dashboard sections (calories, macronutrients, weight trend, etc.) for consistency with modern dashboard patterns and ease of extension.
- **Data fetching**: Use React Query (already specified in tech stack) for fetching mock data from the backend `/api/dashboard` endpoint, leveraging its caching and background update capabilities.
- **State management**: Use React Query for server state and React Context for minimal global UI state (e.g., theme). Avoid Redux for simplicity in this baseline phase.
- **Styling**: Implement Tailwind CSS (per tech stack) with a custom color scheme following the design principles (dark mode first, glassmorphism where tasteful). Use `next-themes` or a custom hook for dark mode toggling.
- **Charting**: Use Recharts (per tech stack) for visualizing macro trends and weight progress, ensuring smooth animations and responsive containers.
- **File structure**: Organize frontend using Next.js conventions: `/components` for reusable UI, `/pages` for routes, `/lib` for utilities and API clients, `/styles` for global CSS.

## Canonical refs
- .planning/ROADMAP.md
- .planning/PROJECT.md
- .planning/phases/01-setup/01-01-PLAN.md
- .planning/phases/01-setup/01-02-PLAN.md