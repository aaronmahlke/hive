# Nuxt Conventions

## Project Structure
- Use Nuxt 4 with `future: { compatibilityVersion: 4 }` 
- App code lives in `app/` directory
- Server code lives in `server/`
- Use `<script setup lang="ts">` in all components
- Composition API only, no Options API

## Components
- Use reka-ui primitives for accessible UI components
- Style with Tailwind CSS v4 utility classes only
- Use semantic design tokens: `text-primary`, `bg-surface-1`, `border-edge`
- Never use raw colors or hardcoded values
- Prefix project components with the project prefix (e.g., `o-` for hive)
- Use lucide-vue-next for icons

## State Management
- Use composables for shared state
- Use `useFetch` and `$fetch` for server communication
- Use `ref` and `computed` for local state

## Server Routes
- File-based routing: `server/api/[resource]/index.get.ts`
- Use `defineEventHandler`, `readBody`, `getRouterParam`, `getQuery`
- Validate inputs with zod
- Return typed responses
- Use relative imports within server directory

## TypeScript
- Strict types, no `any`
- Define interfaces for all props
- Use discriminated unions for status/type fields
