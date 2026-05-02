# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Personal portfolio and blog for Marios Athanasiadis. Built with Astro 5 (Nano theme base), Tailwind CSS, TypeScript, MDX, and Vue. Deployed via Vercel (`@astrojs/vercel` adapter). Docker build also available (nginx-based static serving).

## Commands

- `npm run dev` — start dev server (localhost)
- `npm run dev:network` — dev server exposed on network
- `npm run build` — type-check (`astro check`) then build to `dist/`
- `npm run preview` — preview production build locally

No test framework configured. No linter configured.

## Architecture

**Content collections** (Astro Content Collections v2 in `src/content/config.ts`):
- `blog` — posts with title, description, date, optional draft flag. Each post is a numbered directory with `index.md`/`index.mdx`.
- `work` — work history entries with company, role, dateStart, dateEnd (date or string like "Present").
- `projects` — project entries with title, description, date, optional draft/demoURL/repoURL.

**Path aliases** defined in both `astro.config.mjs` and `tsconfig.json`: `@/` → `src/`, `@components/`, `@layouts/`, `@lib/`, `@consts`.

**Key files**:
- `src/consts.ts` — site metadata, social links, homepage item counts. Edit here to change site name, email, section limits.
- `src/lib/utils.ts` — `cn()` (tailwind-merge + clsx), `formatDate()`, `readingTime()`, `dateRange()`.
- `src/layouts/PageLayout.astro` — single layout wrapping all pages.
- `src/pages/` — file-based routing: index, blog/[slug], projects/[slug], work/[slug], art, rss.xml, robots.txt.

**Styling**: Tailwind CSS 3 with `@tailwindcss/typography` plugin. Styles in `src/styles/`.

**Vue integration**: `@astrojs/vue` is configured for interactive components (Astro islands).

## Adding Content

New blog post: create `src/content/blog/NN-slug/index.md` with frontmatter: `title`, `description`, `date`, optional `draft: true`.

New project: create `src/content/projects/slug/index.md` with frontmatter: `title`, `description`, `date`, optional `draft`, `demoURL`, `repoURL`.

New work entry: create `src/content/work/company-name.md` with frontmatter: `company`, `role`, `dateStart`, `dateEnd` (date or "Present").
