# WhyOps App - Agent Guidelines

This document provides instructions and guidelines for AI agents working on the WhyOps application.

## IMPORTANT: Always Update This File First

When the user provides important information that should be remembered for future cases:
1. **Priority #1**: Add or update this CLAUDE.md file first
2. Document the new information in the appropriate section
3. Only then proceed with any implementation work

This ensures the entire team (and future sessions) benefit from the knowledge.

## 1. Build, Lint, and Test Commands

*   **IMPORTANT**: When learning new information about the project (architectural decisions, API patterns, user preferences), add it to this file FIRST before continuing with other work.
*   **Development Server**: `npm run dev` (Starts Next.js dev server on port 3000)
*   **Build**: `npm run build` (Creates an optimized production build)
*   **Start Production**: `npm run start` (Starts the production server)
*   **Lint**: `npm run lint` (Runs ESLint)
*   **Type Check**: Run `tsc --noEmit` to check for type errors without building.
*   **Tests**: Currently, there are no tests configured. If asked to add tests, prefer **Vitest** + **React Testing Library**.

## 2. Code Style & Conventions

### General
*   **Framework**: Next.js 15+ (App Router), React 19, TypeScript.
*   **Styling**: Tailwind CSS, shadcn/ui.
*   **Path Alias**: Use `@/` to import from `src/` (e.g., `import { Button } from "@/components/ui/button"`).
*   **Strictness**: `strict: true` is enabled in `tsconfig.json`. Ensure all types are strictly defined; avoid `any`.
*   **State Management**: Use **Zustand** for all client-side state management. Create stores in `src/stores/`.

### Naming
*   **Components**: PascalCase (e.g., `StepContainer.tsx`, `UserProfile.tsx`).
*   **Functions/Variables**: camelCase (e.g., `handleSubmit`, `isLoading`).
*   **Constants**: UPPER_SNAKE_CASE (e.g., `MAX_RETRIES`).
*   **Files**:
    *   Components: PascalCase (e.g., `StepContainer.tsx`).
    *   Utilities: camelCase (e.g., `formatDate.ts`).
    *   Page/Layout: `page.tsx`, `layout.tsx` (Next.js conventions).

### Component Structure
*   **Composition**: Keep components small and focused. Separate logic (hooks, utils) from view (JSX).
*   **Reusability**:
    *   Check `src/components/ui` (shadcn/ui) before creating new UI elements.
    *   If a pattern is used twice, extract it into a reusable component.
*   **Hardcoded Values**: Move hardcoded text, data, or configuration to `src/constants` or a dedicated constant file. Do not inline large text blocks or magic numbers.

### Styling
*   **Tokens**: ALWAYS use CSS variables/tokens defined in `globals.css` (e.g., `bg-primary`, `text-muted-foreground`) instead of arbitrary Tailwind colors (e.g., `bg-blue-500`).
*   **Tailwind**: Use utility classes. Use `cn()` utility for conditional class merging.

### Error Handling
*   Use `try/catch` blocks for async operations.
*   Display user-friendly error messages using the toast component or inline error states.

## 3. Onboarding Implementation Checkpoints

### Config Endpoint
The backend config endpoint (`GET /api/config`) returns three base URLs:
- `authBaseUrl` - for authentication-related API calls
- `proxyBaseUrl` - for LLM proxy calls
- `analyseBaseUrl` - for events API (includes `/api` suffix)
- `apiBaseUrl` - legacy alias for `proxyBaseUrl`

### Code Snippets
**Via Proxy tab:**
- Agent Init: `proxyBaseUrl/v1/agents/init`
- LLM Calls: `proxyBaseUrl/v1/chat/completions`

**Manual Events tab:**
- Agent Init: `analyseBaseUrl/entities/init`
- Events: `analyseBaseUrl/events`

### Model Name Format
- Always use `providerSlug/model` format (e.g., `openai/gpt-4o-mini`, `anthropic/claude-3-haiku-20240307`)
- Provider slug is stored in the provider record and comes from the provider store

### API Key Authentication
- **IMPORTANT**: userId, projectId, and environmentId are automatically extracted from the API key
- Do NOT require these as manual parameters in tracking API calls
- The auth middleware extracts these from the API key

## 4. Backend Architecture

### File Organization (Hono.js services)
```
src/
├── controllers/   # Request handlers
├── services/      # Business logic
├── middleware/   # Auth, logging, etc.
├── routes/       # Route definitions
├── utils/        # Helper functions
└── index.ts      # App entry point
```

### Backend Path: /Users/dishants/projects/whyops/be

### Key Services
- **whyops-auth**: Authentication, config endpoint
- **whyops-proxy**: LLM proxy (OpenAI, Anthropic compatible)
- **whyops-analyse**: Event tracking, entities

## 5. Copilot & AI Rules (Inherited)

*   **Existing Utilities**: Always check for existing components/utils before creating new ones.
*   **Shadcn/UI**: If a component exists in shadcn/ui, install/use it rather than building from scratch.
*   **Color Tokens**: NEVER use hardcoded hex values. Use semantic tokens (`primary`, `secondary`, `destructive`, etc.).
*   **No Tailwind Tokens**: Avoid arbitrary Tailwind color classes (e.g., `bg-blue-500`, `text-gray-700`). Always use design tokens from `globals.css`.
*   **Copy-Paste**: Do not copy-paste code. Refactor into reusable components/functions.
*   **Constants**: Externalize hardcoded strings/values to constant files.
*   **Single Responsibility**: Ensure files do one thing. Separate utils, controllers, and views.
*   **Context**: If unsure about implementation, search the codebase for similar patterns (`grep` or `glob`).
*   **Documentation**: Document complex logic, but avoid explaining "what" the code does (the code should be self-explanatory). Focus on "why".


## 6. Quality Assurance

*   **Type Checking**: After completing work, always run `tsc --noEmit` to check for TypeScript errors.
*   **Fix Issues**: Review the Problems tab in your editor and fix all errors before considering the task complete.
*   **Linting**: Run `npm run lint` to ensure code style compliance.

## 7. File Structure

### Frontend (Next.js)
*   `src/app`: App Router pages and layouts.
*   `src/components/ui`: Generic UI components (shadcn/ui).
*   `src/components/onboarding`: Onboarding-specific components.
*   `src/lib`: Utility functions (`utils.ts`).
*   `src/stores`: Zustand state management stores.
*   `src/constants`: Static data and configuration.

### Backend (Hono.js)
*   `src/controllers`: Request handlers.
*   `src/services`: Business logic.
*   `src/middleware`: Auth, logging, validation.
*   `src/routes`: Route definitions.
*   `src/utils`: Helper functions.
