# `/blog` Commands — How to Use Them Here

Quick reference for the `claude-blog` skill suite, tuned for *this* site
(Astro + minimal frontmatter schema: `title`, `description`, `date`, `draft`).

## TL;DR Workflow

```
/blog outline   → review structure
/blog write     → generate draft (asks clarifying Qs first)
/blog analyze   → 0-100 score; fix what's flagged
/blog seo-check → final pass/fail checklist
remove `draft: true` → commit → push
```

For first-person posts (like the K8s one), the skill will pause and ask you
for real details rather than fabricating them. That's intentional — answer
honestly, not aspirationally.

## Commands by Frequency of Use

### Use these often

| Command | What it does |
|---|---|
| `/blog write <topic>` | New post from scratch. Will ask clarifying questions for personal/experience posts. |
| `/blog rewrite <file>` | Polish an existing post — fixes weak openings, adds stats, removes AI-sounding phrases. |
| `/blog analyze <file>` | Score 0-100 across content quality, SEO, E-E-A-T, technical, AI-citation. Run before publishing. |
| `/blog outline <topic>` | Just the outline. Lighter than `brief`; lets you steer structure before drafting. |
| `/blog seo-check <file>` | Quick pass/fail for title length, meta description, heading hierarchy, internal links. |

### Useful occasionally

| Command | What it does |
|---|---|
| `/blog brief <topic>` | Heavyweight pre-writing: competitive analysis, target keywords, recommended stats. |
| `/blog factcheck <file>` | Fetches every cited URL and verifies the stat actually appears. Worth running on stat-heavy posts. |
| `/blog repurpose <file>` | Generates Twitter/X threads, LinkedIn posts, Reddit posts, YouTube scripts from an article. |
| `/blog audit src/content/blog/` | Scores every published post in parallel. Run quarterly to find decay. |
| `/blog cannibalization src/content/blog/` | Finds posts competing for the same keyword. Relevant once 10+ posts exist. |
| `/blog calendar quarterly` | Editorial calendar with topic clusters and publishing schedule. |
| `/blog strategy <niche>` | Positioning + topic ideation. Run once to plan content direction. |
| `/blog update <file>` | Refreshes stats on an older post — re-fetches sources, updates dates. |
| `/blog geo <file>` | AI-citation-only audit (ChatGPT, Perplexity, AI Overviews). |

### Skip on this site (unless you change setup)

- `/blog image generate` — needs nanobanana MCP and a `coverImage` field in `config.ts`.
- `/blog audio generate` — needs `GOOGLE_AI_API_KEY`. Optional TTS narration.
- `/blog schema` — generates JSON-LD. Astro Nano doesn't render it by default; needs layout work first.
- `/blog translate`, `/blog multilingual`, `/blog localize`, `/blog locale-audit` — single-language site.
- `/blog taxonomy` — your schema has no `tags` field.
- `/blog persona` — useful if you commission ghostwriting at scale.
- `/blog notebooklm` — only if you use Google NotebookLM.

## Site-Specific Gotchas

**1. Schema is minimal.**
`src/content/config.ts` only defines `title`, `description`, `date`, `draft`.
The skill sometimes tries to add `coverImage`, `tags`, `author`,
`lastUpdated`. Either ignore those fields or extend `config.ts` first.

**2. Date format.**
Existing posts use `"Mar 17 2024"` style; `z.coerce.date()` also accepts
`"2026-05-04"`. Pick one and stay consistent.

**3. Draft hiding.**
`draft: true` filters posts out of: home page, `/blog`, RSS feed, individual
post routes. Confirmed in `src/pages/index.astro`, `blog/index.astro`,
`rss.xml.ts`, `blog/[...slug].astro`, `projects/[...slug].astro`.

**4. Personal-experience posts.**
The skill enforces zero-tolerance for fabricated stats. If a post is framed
as "How I did X", the writer agent will *ask you* for real details rather
than invent them. Have your repo / config / numbers ready before you run it.

**5. No charts on most posts here.**
The blog skill defaults to 2-4 SVG charts per post. For config-heavy
tutorials and personal narratives, charts feel forced — code blocks and
ASCII diagrams are the visual rhythm. The skill will respect this if you
say so or if no chart-worthy data exists.

## What "Best Use" Looks Like for a Personal Tech Blog

You're an SRE running a personal site, not a content marketing operation.
Use the skill for:

- **Structure and rhythm** — answer-first openings, paragraph length,
  heading hierarchy, FAQ sections. The skill is good at these and they're
  invisible busywork to do by hand.
- **Source discipline** — every stat gets a Tier 1-3 source with a URL and
  retrieval date. This is what separates a credible technical post from a
  blog-spam post.
- **AI-phrase detection** — catches "leverage", "delve", "navigate the
  landscape", etc. before they ship.
- **Self-audit** — `/blog analyze` after writing tells you objectively what
  needs work.

Don't use it for:

- **Faking experience.** If the post is "I did X", you have to actually do
  X. The skill is a writing tool, not a fabrication tool.
- **Generic listicles.** "10 best Kubernetes tools" content is a saturated,
  low-value space and will not rank against established sites. Stick to
  first-person, specific, technical posts where you have real signal.
- **Schema-heavy SEO.** This site doesn't have the layout machinery for
  JSON-LD, OpenGraph cards, etc. Trying to bolt it on through the blog
  skill alone is the wrong order — fix the layout first if you care.

## Suggested Cadence

- **One real post per month.** Quality over volume on a personal blog.
- **Quarterly `/blog audit src/content/blog/`** to spot stale posts.
- **Annually `/blog strategy "SRE / DevOps / Kubernetes / OCI"`** to refresh
  topic direction.

## Where to Read More

- Skill source: `.claude/skills/blog/SKILL.md` (the orchestrator)
- Sub-skills: `.claude/skills/blog-write/`, `blog-rewrite/`, etc.
- Quality scoring rubric: `.claude/skills/blog/references/quality-scoring.md`
- Content templates: `.claude/skills/blog/templates/`
