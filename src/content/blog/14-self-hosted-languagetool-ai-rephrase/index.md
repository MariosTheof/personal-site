---
title: "How to Self-Host Grammarly (Including the AI Rewrite Feature)"
description: "A practical guide to replacing Grammarly with a fully self-hosted, free setup: a LanguageTool server for grammar and spelling, plus an open-source gRPC sidecar that adds Grammarly's AI rephrasing feature on top."
date: "2026-08-04"
---

Grammarly does two things people actually pay for: it catches grammar and spelling mistakes, and it rewrites awkward sentences into better ones. You can get both, fully self-hosted, for free, without sending your writing to anyone's servers. Here's exactly how.

> **Key Takeaways**
> - Part 1 alone — a self-hosted [LanguageTool](https://languagetool.org/) server plus its official browser extension — replaces Grammarly's grammar/spelling checking entirely, for free, privately.
> - Part 2 adds the feature Grammarly is actually known for: full-sentence AI rewrites, via an open-source gRPC sidecar I built and am sharing here.
> - The AI rewrite feature activates automatically in your existing LanguageTool extension — no separate tool, no extra UI, nothing to remember to open.
> - The whole setup runs on a spare machine or a small VM for effectively $0/month.

## What you're building

Two pieces, layered:

1. **A self-hosted LanguageTool server** — the grammar/spelling engine, talking to the official LanguageTool browser extension (or any editor plugin that supports a custom server). This alone covers most of what people use Grammarly for, day to day.
2. **An AI rephrase sidecar** ([source here, MIT licensed](https://github.com/MariosTheof/languagetool-ai-rephrase)) — a small gRPC service that plugs into LanguageTool and adds the one feature the open-source build doesn't have: rewriting a clunky sentence into a better one.

You can stop after part 1 and already have a complete Grammarly replacement for grammar/spelling. Part 2 is what closes the gap with Grammarly's paid tier.

## Part 1: A self-hosted grammar and spelling checker

Run LanguageTool's server. The [`erikvl87/languagetool`](https://hub.docker.com/r/erikvl87/languagetool) Docker image is the easiest path — it listens on port 8010 and is public/CORS-open by default:

```bash
docker run -d -p 8010:8010 erikvl87/languagetool
```

Then install the [official LanguageTool browser extension](https://languagetool.org/) (Chrome, Firefox, Edge, Opera all supported) and point it at your server:

1. Extension settings → **Advanced Settings** → **LanguageTool Server** → **Other server**
2. Enter `http://your-server:8010/v2` — the `/v2` suffix matters; without it you'll get a cryptic 400 error, because the extension posts to a legacy endpoint that isn't `/v2/check`.

That's it. You now have private, self-hosted grammar and spelling checking wired into your browser, with zero recurring cost. If English ngram-informed suggestions matter to you (better "their/there/they're"-style confusion detection), LanguageTool's setup docs cover downloading the optional ngram dataset — not required for basic checking.

## Part 2: Adding the AI rewrite feature

This is the part LanguageTool's open-source build is missing, and it turns out LanguageTool itself ships the plumbing to add it — an undocumented gRPC extension point (`GRPCRule`) that its own commercial Premium tier uses internally for its rewrite-style features. I built a small server that speaks that protocol and calls an LLM, and open-sourced it:

**[github.com/MariosTheof/languagetool-ai-rephrase](https://github.com/MariosTheof/languagetool-ai-rephrase)** (MIT)

```bash
git clone https://github.com/MariosTheof/languagetool-ai-rephrase
cd languagetool-ai-rephrase
docker build -t languagetool-ai-rephrase .
```

Run it alongside your LanguageTool server, point LanguageTool's `remoteRulesFile` config at the included example config, set an API key for whichever LLM you want to use, and you're done — the repo's README has the full step-by-step.

The detail worth calling out: **you don't need to change anything in the browser extension.** The sidecar tags its suggestions with LanguageTool's own `picky` rewrite-level tag, and most LanguageTool clients — including the official extension — already request picky-level checking by default. So once the sidecar is running, AI rewrite suggestions just start appearing next to your normal grammar and spelling matches. No new UI, no plugin, no bookmarklet.

Verify it's working:

```bash
curl 'http://localhost:8010/v2/check' \
  --data-urlencode 'text=Due to the fact that we were unable to obtain the necessary permissions, the project was ultimately not able to proceed as originally planned.' \
  --data-urlencode 'language=en-US' \
  --data-urlencode 'level=picky'
```

Look for a match with `"id": "AI_REPHRASE"` in the response.

## Choosing a model

The repo ships configured for a free-tier model by default, and works out of the box with it — good for trying this out at zero cost. If you want faster, more reliable rewrites, pointing it at a real hosted model (Claude Haiku, GPT-4o-mini) is a one-line config change and costs well under $10/month at personal-use volume, since each request is one sentence in, one sentence out. The README has a latency comparison across several free models if you want to stay in free-tier territory — some are much slower than others.

## What this costs you

A small VM or a spare machine to run LanguageTool and the sidecar on, and either nothing (free-tier LLM) or a few dollars a month (a real model). No subscription, no account, no data leaving your own infrastructure.

Repo's here if you want to try it or contribute: [github.com/MariosTheof/languagetool-ai-rephrase](https://github.com/MariosTheof/languagetool-ai-rephrase).
