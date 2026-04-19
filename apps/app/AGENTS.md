# WhyOps App - Agent Guidelines

This document provides instructions and guidelines for AI agents working on the WhyOps application.

## 1. Build, Lint, and Test Commands

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

## 3. Copilot & AI Rules (Inherited)

*   **Existing Utilities**: Always check for existing components/utils before creating new ones.
*   **Shadcn/UI**: If a component exists in shadcn/ui, install/use it rather than building from scratch.
*   **Color Tokens**: NEVER use hardcoded hex values. Use semantic tokens (`primary`, `secondary`, `destructive`, etc.).
*   **No Tailwind Tokens**: Avoid arbitrary Tailwind color classes (e.g., `bg-blue-500`, `text-gray-700`). Always use design tokens from `globals.css`.
*   **Copy-Paste**: Do not copy-paste code. Refactor into reusable components/functions.
*   **Constants**: Externalize hardcoded strings/values to constant files.
*   **Single Responsibility**: Ensure files do one thing. Separate utils, controllers, and views.
*   **Context**: If unsure about implementation, search the codebase for similar patterns (`grep` or `glob`).
*   **Documentation**: Document complex logic, but avoid explaining "what" the code does (the code should be self-explanatory). Focus on "why".


## 4. Quality Assurance

*   **Type Checking**: After completing work, always run `tsc --noEmit` to check for TypeScript errors.
*   **Fix Issues**: Review the Problems tab in your editor and fix all errors before considering the task complete.
*   **Linting**: Run `npm run lint` to ensure code style compliance.

## 5. File Structure
*   `src/app`: App Router pages and layouts.
*   `src/components/ui`: Generic UI components (shadcn/ui).
*   `src/components/onboarding`: Onboarding-specific components.
*   `src/lib`: Utility functions (`utils.ts`).
*   `src/constants`: Static data and configuration.
