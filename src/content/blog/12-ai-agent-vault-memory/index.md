---
title: "How I Gave My AI Coding Assistant a Permanent Memory"
description: "I structured a PARA-style Obsidian vault so Claude Code never re-asks what my project does — CLAUDE.md rules, per-project index files, a compile-pass workflow, and agentmemory MCP hooks. 84% of devs use AI tools. Only 29% trust them."
date: "2026-05-26"
---

Every Claude Code session used to start the same way. I'd open a terminal, type something like "add a retry handler to the lingopop backend," and get back: "I don't have information about lingopop in this session. Could you describe the project?" Fifteen minutes of re-explaining architecture later, we'd finally do the actual work.

That's fixed now. The session I ran this morning opened with the CI pipeline spec, the k3s namespace, the HeatWave DSN catch, and the exact deploy command — all without me saying a word about any of it. The fix isn't a new model or a longer context window. It's a structured vault that lives on disk and a set of rules that tell the agent exactly where to look.

Here's the whole setup.

> **Key Takeaways**
> - 84% of developers use or plan to use AI tools, but only 29% trust AI accuracy — down from 40% the year before ([Stack Overflow Developer Survey](https://survey.stackoverflow.co/2025/ai), n=49,000+). The trust gap is mostly a context problem, not a model problem.
> - A PARA-structured vault with per-project `index.md` files gives every agent session a read target before the first prompt.
> - A "compile pass" — triggered explicitly, never autonomous — keeps the vault fresh by routing daily captures to the right project pages.
> - The agentmemory MCP server closes the write loop: decisions made during a session get persisted back without manual note-taking.

## Why do AI coding tools keep forgetting your project?

According to the Stack Overflow Developer Survey (n=49,000+), 84% of developers now use or plan to use AI coding tools, and 51% use them daily. Yet trust in AI accuracy fell from 40% to just 29% — the lowest on record ([Stack Overflow](https://survey.stackoverflow.co/2025/ai)). That's a trust collapse happening right alongside an adoption boom.

<figure style="margin: 2.5rem 0;">
<svg viewBox="0 0 600 280" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="Dual-line chart showing AI tool adoption rising from 70% in 2023 to 84% in 2025 while developer trust fell from 55% in 2023 to 29% in 2025, based on Stack Overflow 2025 Developer Survey">
  <rect width="600" height="280" fill="#0f172a" rx="10"/>
  <!-- Grid lines -->
  <line x1="80" y1="30" x2="80" y2="210" stroke="#334155" stroke-width="1"/>
  <line x1="80" y1="210" x2="560" y2="210" stroke="#334155" stroke-width="1"/>
  <line x1="80" y1="170" x2="560" y2="170" stroke="#1e293b" stroke-width="1" stroke-dasharray="4,4"/>
  <line x1="80" y1="130" x2="560" y2="130" stroke="#1e293b" stroke-width="1" stroke-dasharray="4,4"/>
  <line x1="80" y1="90" x2="560" y2="90" stroke="#1e293b" stroke-width="1" stroke-dasharray="4,4"/>
  <line x1="80" y1="50" x2="560" y2="50" stroke="#1e293b" stroke-width="1" stroke-dasharray="4,4"/>
  <!-- Y-axis labels -->
  <text x="70" y="214" fill="#94a3b8" font-size="11" font-family="system-ui,sans-serif" text-anchor="end">0%</text>
  <text x="70" y="174" fill="#94a3b8" font-size="11" font-family="system-ui,sans-serif" text-anchor="end">20%</text>
  <text x="70" y="134" fill="#94a3b8" font-size="11" font-family="system-ui,sans-serif" text-anchor="end">40%</text>
  <text x="70" y="94" fill="#94a3b8" font-size="11" font-family="system-ui,sans-serif" text-anchor="end">60%</text>
  <text x="70" y="54" fill="#94a3b8" font-size="11" font-family="system-ui,sans-serif" text-anchor="end">80%</text>
  <!-- X-axis labels -->
  <text x="160" y="228" fill="#94a3b8" font-size="11" font-family="system-ui,sans-serif" text-anchor="middle">2023</text>
  <text x="320" y="228" fill="#94a3b8" font-size="11" font-family="system-ui,sans-serif" text-anchor="middle">2024</text>
  <text x="480" y="228" fill="#94a3b8" font-size="11" font-family="system-ui,sans-serif" text-anchor="middle">2025</text>
  <!-- Adoption line (blue): 70% → 77% → 84% -->
  <!-- y = 210 - (value/100 * 180) -->
  <!-- 70% = 84, 77% = 71.4, 84% = 58.8 -->
  <polyline points="160,84 320,71 480,58" fill="none" stroke="#4f8ef7" stroke-width="2.5" stroke-linejoin="round"/>
  <circle cx="160" cy="84" r="5" fill="#4f8ef7"/>
  <circle cx="320" cy="71" r="5" fill="#4f8ef7"/>
  <circle cx="480" cy="58" r="5" fill="#4f8ef7"/>
  <text x="492" y="54" fill="#4f8ef7" font-size="11" font-family="system-ui,sans-serif">84%</text>
  <!-- Trust line (red): 55% → 40% → 29% -->
  <!-- 55% = 111, 40% = 138, 29% = 157.8 -->
  <polyline points="160,111 320,138 480,158" fill="none" stroke="#f74f4f" stroke-width="2.5" stroke-linejoin="round"/>
  <circle cx="160" cy="111" r="5" fill="#f74f4f"/>
  <circle cx="320" cy="138" r="5" fill="#f74f4f"/>
  <circle cx="480" cy="158" r="5" fill="#f74f4f"/>
  <text x="492" y="162" fill="#f74f4f" font-size="11" font-family="system-ui,sans-serif">29%</text>
  <!-- Legend -->
  <rect x="160" y="245" width="12" height="3" fill="#4f8ef7" rx="1"/>
  <text x="178" y="251" fill="#cbd5e1" font-size="11" font-family="system-ui,sans-serif">Adoption</text>
  <rect x="280" y="245" width="12" height="3" fill="#f74f4f" rx="1"/>
  <text x="298" y="251" fill="#cbd5e1" font-size="11" font-family="system-ui,sans-serif">Trust in accuracy</text>
  <!-- Title -->
  <text x="320" y="18" fill="#e2e8f0" font-size="12" font-family="system-ui,sans-serif" text-anchor="middle" font-weight="600">AI Tool Adoption vs. Developer Trust, 2023-2025</text>
  <text x="320" y="270" fill="#64748b" font-size="10" font-family="system-ui,sans-serif" text-anchor="middle">Source: Stack Overflow 2025 Developer Survey (n=49,000+)</text>
</svg>
</figure>

Most commentary blames the models. I don't think that's right. The real problem is context loss between sessions. Every new conversation starts blank. The agent has no memory of your stack, your deploy targets, your architectural decisions from last week, or the TLS snag HeatWave throws at you. So it hallucinates, guesses wrong, or asks you to explain things you've already explained a dozen times.

![Developer planning and organizing project context on a whiteboard with structured diagrams](https://images.unsplash.com/photo-1531403009284-440f080d1e12?w=1200&h=630&fit=crop&q=80)

A METR study (arXiv:2507.09089) found experienced developers were 19% *slower* with AI tools than without them. Not because the tools are bad. Because experienced devs have complex, multi-file projects with history and context that the agent can't see. The re-explanation overhead eats the time savings.

<!-- [UNIQUE INSIGHT] -->

The trust collapse and the productivity regression are both pointing at the same root cause: the quality of context the agent receives, not the quality of the model. Fix the context layer and you fix both problems. That's what the vault does.

> **Citation capsule:** According to the Stack Overflow Developer Survey (n=49,000+), 84% of developers use or plan to use AI tools and 51% use them daily, yet trust in AI accuracy has fallen from 40% to just 29% — the lowest recorded. The METR study (arXiv:2507.09089) found experienced developers are 19% slower with AI tools, suggesting context overhead, not model quality, is the primary drag on productivity.

[INTERNAL-LINK: my $0 OCI k3s cluster → post 09 "How I Run This Site on a $0 Kubernetes Cluster"]

## What goes where: the PARA vault structure

I run five projects across three VPS instances and a k3s cluster. Without a system, project context lives everywhere: scattered across git commit messages, a half-remembered Notion page, a terminal history that scrolls off. The Asana Anatomy of Work Index (via Speakwise, 2026) found that 60% of knowledge worker time goes to "work about work" — searching, re-explaining, re-locating context that already exists.

<figure style="margin: 2.5rem 0;">
<svg viewBox="0 0 600 220" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="Horizontal bar chart showing estimated daily developer time lost without structured context: re-explaining project architecture to AI costs 30 minutes, regaining focus after AI corrections costs 46 minutes, and searching for context across notes costs 60 minutes">
  <rect width="600" height="220" fill="#0f172a" rx="10"/>
  <!-- Title -->
  <text x="300" y="22" fill="#e2e8f0" font-size="12" font-family="system-ui,sans-serif" text-anchor="middle" font-weight="600">Estimated Developer Time Lost Without Structured Context (per day)</text>
  <!-- Bars -->
  <!-- Max value 60 min, bar area x: 230 to 560 = 330px -->
  <!-- "Re-explaining project architecture to AI": 30 min = 165px -->
  <text x="225" y="70" fill="#94a3b8" font-size="11" font-family="system-ui,sans-serif" text-anchor="end">Re-explaining architecture to AI</text>
  <defs>
    <linearGradient id="barGrad" x1="0" y1="0" x2="1" y2="0">
      <stop offset="0%" stop-color="#4f8ef7"/>
      <stop offset="100%" stop-color="#818cf8"/>
    </linearGradient>
  </defs>
  <rect x="230" y="55" width="165" height="22" fill="url(#barGrad)" rx="3"/>
  <text x="402" y="70" fill="#e2e8f0" font-size="11" font-family="system-ui,sans-serif">30 min</text>
  <!-- "Regaining focus after AI corrections": 46 min = 253px -->
  <text x="225" y="120" fill="#94a3b8" font-size="11" font-family="system-ui,sans-serif" text-anchor="end">Regaining focus after AI corrections</text>
  <rect x="230" y="105" width="253" height="22" fill="url(#barGrad)" rx="3"/>
  <text x="490" y="120" fill="#e2e8f0" font-size="11" font-family="system-ui,sans-serif">46 min</text>
  <!-- "Searching for context across notes/docs": 60 min = 330px -->
  <text x="225" y="170" fill="#94a3b8" font-size="11" font-family="system-ui,sans-serif" text-anchor="end">Searching for context across notes</text>
  <rect x="230" y="155" width="330" height="22" fill="url(#barGrad)" rx="3"/>
  <text x="567" y="170" fill="#e2e8f0" font-size="11" font-family="system-ui,sans-serif">60 min</text>
  <!-- Source -->
  <text x="300" y="210" fill="#64748b" font-size="10" font-family="system-ui,sans-serif" text-anchor="middle">Source: UCI/Gloria Mark + Asana Anatomy of Work Index, 2026 | 46 min based on 2 × 23 min focus-recovery cycles</text>
</svg>
</figure>

The 46-minute figure in that chart isn't invented. Research from Gloria Mark at the University of California Irvine found it takes an average of 23 minutes 15 seconds to regain full focus after an interruption (widely cited, 2026). When an AI confidently gives you wrong output and you have to context-switch to debug it, that's a real interruption with a real recovery cost.

My vault lives at `~/vault/` and follows a PARA structure. The folders that matter most to AI sessions are:

<!-- [ORIGINAL DATA] -->

```
~/vault/
  CLAUDE.md                    # global agent rules, folder map
  Projects/
    lingopop/index.md          # deploy commands, stack, known issues, TODOs
    pcprice.watch/index.md
    diavgeia-monitor/index.md
    car-statistics-greece/index.md
  Areas/
    infra/
      k3s-cluster.md           # cluster runbook
      cloudflare-tunnel.md     # tunnel + Access config
      oci/overview.md          # OCI account, VCN, HeatWave
  Inbox/                       # raw daily captures — drained by compile pass
  Inbox/_processed/            # archived items after compilation
  Templates/
    project-index.md           # template for new project index files
```

Each `Projects/<name>/index.md` is structured for AI consumption, not human reading. That's a distinction most people miss. Human notes are prose. AI-consumption notes are structured tables with explicit labels: "How to deploy," "Where it runs," "Gotchas," "Active TODOs." When an agent reads a properly structured index file, it can answer operational questions without guessing.

[INTERNAL-LINK: self-hosted Umami → post 11 "Why I Moved My Analytics Off Vercel and Onto a Free MySQL Box"]

## The CLAUDE.md layer: standing orders for every agent

Over 60,000 open-source projects have adopted `AGENTS.md` or `CLAUDE.md` files as of 2026, according to DeployHQ's AI Coding Config Files Guide ([DeployHQ](https://www.deployhq.com/blog/ai-coding-config-files-guide), 2026). The pattern is simple: a file at the repo root that gives the AI agent its standing orders. What it should do, what it shouldn't, where to look.

My global `~/vault/CLAUDE.md` goes a step further. It's not just a per-repo instruction file — it's the operating manual for every agent session I run, regardless of which project I'm in. The key sections:

<!-- [PERSONAL EXPERIENCE] -->

**North star.** One line: "Zero re-teaching tax." If I have to explain a project to the agent, the vault has failed. That sentence keeps me honest when I'm tempted to skip updating a project index after a deploy.

**Folder map.** Tells the agent which folder handles what. Without this, an agent reading `~/vault/` cold has no idea that `Inbox/` is raw captures and `Areas/infra/` is runbooks. With it, the first thing the agent does in a new session is read `Projects/<this-project>/index.md` and `Areas/infra/` — it knows where to go.

**Commit format.** Single-line subject, no AI attribution, no Co-Authored-By trailers. This is the one that saves me the most editing time. Left to its defaults, every commit message from an AI agent is a three-paragraph essay.

**Pointer-secrets convention.** Never write a secret into the vault. Write a pointer: `OCI API key → 1Password entry "OCI-API-prod"`. This means the vault can live in a private git repo without becoming a secret store. The agent knows not to look for actual credentials in vault files.

**Compile pass trigger.** The rule "never compile autonomously — only on explicit user instruction" is load-bearing. Without it, an agent might decide to reorganize your vault mid-session, which is not what you want in the middle of a debugging run.

> **Citation capsule:** More than 60,000 open-source projects have adopted AI coding configuration files like `AGENTS.md` or `CLAUDE.md` as of 2026, according to DeployHQ ([DeployHQ](https://www.deployhq.com/blog/ai-coding-config-files-guide), 2026). These files function as standing orders for agent sessions: they specify folder maps, commit formats, secrets conventions, and behavioral constraints that persist across every session without re-prompting.

What's the difference between a `CLAUDE.md` and a system prompt you paste each time? The `CLAUDE.md` lives in the filesystem. The agent reads it as data, not instructions injected into the conversation. That means it can be version-controlled, diff'd, and updated like any other file. It's a living document, not a static incantation.

## The compile pass: how the vault stays fresh

A vault that doesn't get updated is just a stale wiki. Most note-taking systems fail here: you capture something in `Inbox/`, you never drain it, and six months later you have 200 unprocessed captures and a vault that's worse than useless because it has outdated information mixed with current information.

![Structured notes and organized documentation on a tablet representing vault workflow](https://images.unsplash.com/photo-1753715613392-c708c671b3dd?w=1200&h=630&fit=crop&q=80)

The compile pass is what keeps mine current. When I say "compile inbox," the agent:

1. Reads every file under `Inbox/` (skipping `_processed/`).
2. For each item, decides which existing PARA page it updates — or whether it creates a new one.
3. **Integrates, doesn't append.** Operational facts — deploy commands, hosts, URLs, tricky bits — get routed to the relevant `Projects/<name>/index.md` and written into the right section, not pasted at the bottom.
4. Flags contradictions with `> [!warning]` blocks. If a new capture says "HeatWave IP is 10.0.3.200" and the existing vault says "10.0.3.117," the agent surfaces that rather than silently overwriting.
5. Moves the raw item to `Inbox/_processed/<YYYY-MM-DD>/` and commits.

<!-- [PERSONAL EXPERIENCE] -->

I ran a compile pass last week after three days of captures had piled up. The result was changes to four project index files, two new runbook steps in `Areas/infra/k3s-cluster.md`, and one contradiction flag on a HeatWave connection string I'd updated in one place but not the other. The commit message was `compile: 11 inbox items → 6 files updated, 0 new`.

That contradiction flag is the part I'd miss most if I didn't have it. The vault's whole value is that it's accurate. A flag on an inconsistency tells me exactly where to verify, which is far better than silently trusting stale data.

The "never autonomous" rule matters here. The compile pass has real write access to your project notes. You want to be in the loop when it runs. Triggering it explicitly gives you the chance to review the summary before anything gets committed.

[INTERNAL-LINK: Cloudflare Tunnel → post 10 "How I Expose Self-Hosted Services Without Opening a Single Port"]

## The agentmemory MCP: closing the write loop

The Model Context Protocol has gone from a curiosity to infrastructure fast. By March 2026, MCP had reached 97 million monthly SDK downloads, up from roughly 22 million a year earlier. The server registry grew from 1,200 to 9,400+ servers over the same period ([Digital Applied / Anthropic](https://www.digitalapplied.com/blog/mcp-adoption-statistics-2026-model-context-protocol), 2026). That kind of adoption curve usually means the abstraction is genuinely useful.

<figure style="margin: 2.5rem 0;">
<svg viewBox="0 0 600 260" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="Bar chart showing MCP monthly SDK downloads growth: 2 million in November 2024, 22 million in April 2025, 45 million in July 2025, and 97 million in March 2026, based on Digital Applied and Anthropic data">
  <rect width="600" height="260" fill="#0f172a" rx="10"/>
  <!-- Title -->
  <text x="300" y="22" fill="#e2e8f0" font-size="12" font-family="system-ui,sans-serif" text-anchor="middle" font-weight="600">MCP Monthly SDK Downloads Growth</text>
  <!-- Grid lines -->
  <line x1="60" y1="40" x2="560" y2="40" stroke="#1e293b" stroke-width="1" stroke-dasharray="4,4"/>
  <line x1="60" y1="80" x2="560" y2="80" stroke="#1e293b" stroke-width="1" stroke-dasharray="4,4"/>
  <line x1="60" y1="120" x2="560" y2="120" stroke="#1e293b" stroke-width="1" stroke-dasharray="4,4"/>
  <line x1="60" y1="160" x2="560" y2="160" stroke="#1e293b" stroke-width="1" stroke-dasharray="4,4"/>
  <line x1="60" y1="200" x2="560" y2="200" stroke="#334155" stroke-width="1"/>
  <!-- Y-axis labels -->
  <text x="55" y="204" fill="#94a3b8" font-size="10" font-family="system-ui,sans-serif" text-anchor="end">0</text>
  <text x="55" y="164" fill="#94a3b8" font-size="10" font-family="system-ui,sans-serif" text-anchor="end">25M</text>
  <text x="55" y="124" fill="#94a3b8" font-size="10" font-family="system-ui,sans-serif" text-anchor="end">50M</text>
  <text x="55" y="84" fill="#94a3b8" font-size="10" font-family="system-ui,sans-serif" text-anchor="end">75M</text>
  <text x="55" y="44" fill="#94a3b8" font-size="10" font-family="system-ui,sans-serif" text-anchor="end">100M</text>
  <!-- Bars: max 97M = 160px height, bar area from y=200 up -->
  <!-- Nov 2024: 2M = 200 - (2/100 * 160) = 196.8 -->
  <rect x="100" y="196" width="60" height="4" fill="#818cf8" rx="3"/>
  <text x="130" y="215" fill="#94a3b8" font-size="10" font-family="system-ui,sans-serif" text-anchor="middle">Nov 2024</text>
  <text x="130" y="188" fill="#818cf8" font-size="10" font-family="system-ui,sans-serif" text-anchor="middle">2M</text>
  <!-- Apr 2025: 22M = 200 - (22/100 * 160) = 164.8 -->
  <rect x="220" y="165" width="60" height="35" fill="#818cf8" rx="3"/>
  <text x="250" y="215" fill="#94a3b8" font-size="10" font-family="system-ui,sans-serif" text-anchor="middle">Apr 2025</text>
  <text x="250" y="158" fill="#818cf8" font-size="10" font-family="system-ui,sans-serif" text-anchor="middle">22M</text>
  <!-- Jul 2025: 45M = 200 - (45/100 * 160) = 128 -->
  <rect x="340" y="128" width="60" height="72" fill="#818cf8" rx="3"/>
  <text x="370" y="215" fill="#94a3b8" font-size="10" font-family="system-ui,sans-serif" text-anchor="middle">Jul 2025</text>
  <text x="370" y="121" fill="#818cf8" font-size="10" font-family="system-ui,sans-serif" text-anchor="middle">45M</text>
  <!-- Mar 2026: 97M = 200 - (97/100 * 160) = 44.8 -->
  <rect x="460" y="45" width="60" height="155" fill="#818cf8" rx="3"/>
  <text x="490" y="215" fill="#94a3b8" font-size="10" font-family="system-ui,sans-serif" text-anchor="middle">Mar 2026</text>
  <text x="490" y="38" fill="#818cf8" font-size="10" font-family="system-ui,sans-serif" text-anchor="middle">97M</text>
  <!-- Source -->
  <text x="300" y="248" fill="#64748b" font-size="10" font-family="system-ui,sans-serif" text-anchor="middle">Source: Digital Applied / Anthropic, April 2026</text>
</svg>
</figure>

The agentmemory MCP server closes a gap the vault alone doesn't cover: write-back from live sessions. The vault holds what I've explicitly captured. But every session produces decisions, discoveries, and things that bit me that I never get around to capturing. The agentmemory hooks intercept those and persist them automatically.

Setup is two commands:

```bash
npm install -g @agentmemory/agentmemory@0.9.21
agentmemory connect claude-code
```

That adds 12 hooks to Claude Code and starts an MCP server on `:3111`. The hooks capture decisions and context updates from live sessions and route them back to the MCP server, which the vault can then read in a subsequent session.

<!-- [UNIQUE INSIGHT] -->

Here's the nuance most write-ups miss: agentmemory and the compile pass operate on different time horizons. The compile pass handles deliberate, structured updates — things I've thought about, written down, and want integrated cleanly. agentmemory handles ephemeral session state: a command that worked, a decision made mid-debug, a file path I found by trial and error. They complement each other rather than competing.

One catch: the hooks fail silently if the MCP server isn't running. There's no error; the hooks just don't fire. I keep the server in a tmux pane to avoid losing session state. If you restart your machine and forget to restart the server, your next session won't be persisting anything. Worth adding it to whatever autostart mechanism you use.

> **Citation capsule:** The Model Context Protocol reached 97 million monthly SDK downloads by March 2026, growing from roughly 2 million in November 2024. The server registry expanded from 1,200 to over 9,400 entries in just over a year ([Digital Applied / Anthropic](https://www.digitalapplied.com/blog/mcp-adoption-statistics-2026-model-context-protocol), 2026). This adoption trajectory positions MCP as the standard persistence layer for stateful AI agent workflows.

## The acid test: does it actually work?

Fresh terminal. No preamble, no "here's what I'm working on." Just: "What's the deploy command for lingopop?"

Before the vault: "I don't have information about lingopop in this session. Could you describe the project and its deployment setup?"

After: The agent reads `~/vault/Projects/lingopop/index.md` from the CLAUDE.md pointer, finds the CI/CD section, and responds with the actual answer. CI triggers on push to `main` touching `backend/**`. GitHub Actions builds an arm64 image via `docker buildx`, pushes to `ghcr.io/mariostheof/lingopop:{sha}`, then runs `kubectl set image deployment/lingopop-backend` in the `lingopop` namespace and waits for rollout status. The pull secret requirement is flagged. The HeatWave TLS catch is flagged.

<!-- [PERSONAL EXPERIENCE] -->

The first session where the agent opened by citing the deploy command without being asked was genuinely disorienting. I'd been so conditioned to the re-explanation ritual that I'd almost forgotten what productive-from-minute-one felt like. It felt less like using a tool and more like working with someone who'd been paying attention.

![Neural network visualization representing AI memory and persistent knowledge across sessions](https://images.unsplash.com/photo-1617791160536-598cf32026fb?w=1200&h=630&fit=crop&q=80)

The honest gaps: anything decided in a recent session that hasn't been compiled yet. A new environment variable I set yesterday won't be in the vault until I either capture it or run a compile pass. Secrets are excluded by design — the vault has pointers, not values, so the agent can tell you where the secret lives but not what it is.

That's the right trade-off. A vault that tried to hold everything would eventually hold secrets, outdated values, and contradictions with no flags. This one holds structured facts with explicit provenance, and it tells you when something doesn't add up.

Is it more setup than just pasting a summary into each session? Yes, by a fair margin. Whether that overhead pays off depends entirely on how many projects you run and how often you context-switch between them. For a solo dev with five active projects across multiple servers, the math resolves quickly in favor of the vault.

## Frequently asked questions

**Does this work with AI tools other than Claude Code?**

The vault structure works with any agent that can read files. The `CLAUDE.md` naming is Claude-specific, but most major AI coding tools support an equivalent — Cursor has `.cursorrules`, GitHub Copilot reads `AGENTS.md`. Over 60,000 open-source projects have adopted one of these files ([DeployHQ](https://www.deployhq.com/blog/ai-coding-config-files-guide), 2026). The compile pass workflow is agent-agnostic; any tool that can edit markdown files can perform it.

**How do you avoid the vault becoming stale?**

The compile pass handles this for new captures, but the deeper answer is structure. Notes written for AI consumption — with explicit section headers and structured facts rather than prose — age gracefully because they're easy to update in-place. If your project runbook is a paragraph of prose, updating one command means rewriting sentences. If it's a table of `Command: X` entries, updating a command is a one-cell edit.

**What about secrets? Can you store API keys in the vault?**

No. The pointer-secrets convention in `CLAUDE.md` is explicit: never write a secret into the vault; write a reference instead. `OCI API key → 1Password entry "OCI-API-prod"` tells the agent where to find the secret without the vault holding it. This matters because the vault will eventually be in a git repo, and secrets in git repos have a way of ending up somewhere they shouldn't.

**Can the agentmemory MCP replace the manual compile pass?**

Not completely. agentmemory captures session state automatically, which is good for ephemeral decisions and command discoveries. The compile pass handles deliberate integration: routing a capture to the right project page, flagging contradictions, maintaining backlinks. They're complementary. The MCP closes the write loop for things you wouldn't remember to capture; the compile pass handles things you've thought about carefully enough to write down.

## Wrapping up

The vault didn't solve an AI problem. It solved an information architecture problem, and the AI benefit was a side effect of actually organizing project context well.

The Stack Overflow trust numbers are a signal worth taking seriously. Only 29% of developers trust AI accuracy ([Stack Overflow](https://survey.stackoverflow.co/2025/ai)). But mistrust built on context rot is different from mistrust built on model limitations. One of those you can fix with a markdown file and a compile trigger.

The setup I've described: a PARA vault at `~/vault/`, per-project `index.md` files structured for AI consumption, a `CLAUDE.md` with standing orders, an explicit compile pass for integration, and the agentmemory MCP for session write-back. Nothing in that stack requires a subscription or a hosted service. It runs on the same [free OCI cluster](/blog/09-zero-dollar-kubernetes-cluster) as everything else, costs nothing, and has eliminated the re-explanation ritual entirely.

If you try this, start with one project. Write the `index.md` file the way you'd brief a new collaborator who needed to get to production in an hour. That framing changes how you write it, and it's the right framing.
