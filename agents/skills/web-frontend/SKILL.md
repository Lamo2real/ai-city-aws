---
name: web-frontend
description: "Build web frontends with React and TypeScript: accessible, fast, tested."
---
# Web frontend

- Current versions: check React, Vite/Next.js and library docs with **Context7** first.
- TypeScript `strict`, ESLint and Prettier clean.
- Accessibility (WCAG 2.2 AA): semantic HTML, labels on every control, keyboard reachable, visible focus, contrast ≥ 4.5:1, `prefers-reduced-motion` respected. Check with axe.
- Responsive from 360 px wide up; no horizontal scroll; touch targets ≥ 44 px.
- Performance: code-split routes, lazy images with sizes, no layout shift, Lighthouse performance ≥ 90 on mobile.
- Tests: unit tests for logic (Vitest), one Playwright journey per user flow, including the error states.
- Designs from **Figma** when the connector is on: match spacing and type tokens, don't eyeball.
