---
title: "I Found LanguageTool's Hidden AI Rephrase Plumbing and Used It for Free"
description: "LanguageTool's open-source server ships an undocumented gRPC extension point that its own paid Rephrase feature runs on. Here's how I used it to add free, self-hosted AI rewrites to my LanguageTool server — plus two bugs that only showed up in real use."
date: "2026-08-04"
---

I run a self-hosted [LanguageTool](https://languagetool.org/) server — a genuinely good, free, private alternative to Grammarly for grammar and spelling checking. It catches typos, subject-verb agreement errors, the usual. What it doesn't do, in its open-source form, is the thing people actually love Grammarly for: taking an awkward, wordy sentence and handing back a better one.

That's an LLM-shaped problem, not a grammar-rules-shaped one. LanguageTool's commercial "Premium" tier has it. The open-source self-hosted build doesn't. I wanted it anyway, without paying for their SaaS and without bolting on some separate rewrite tool I'd have to remember to open. This is how I got there — including two bugs that took real debugging to catch, not just reading the docs harder.

> **Key Takeaways**
> - LanguageTool's open-source jar ships a fully-compiled-in gRPC extension point (`GRPCRule`/`RemoteRuleConfig`) that its own commercial Rephrase feature runs on — no fork, no recompile, works for every language out of the box.
> - Tagging the sidecar's matches with LanguageTool's own `picky` level tag made AI rewrites show up automatically in my existing browser extension, with zero configuration — most LanguageTool clients send `level=picky` by default.
> - Free-tier reasoning models can burn their entire token budget "thinking" and return an empty answer — one model I benchmarked took 65 seconds per sentence and was unusable.
> - A sequential-per-sentence bug silently broke real usage even though every `curl` test passed: three sentences at ~4 seconds each summed past LanguageTool's own timeout. Fixed by making the LLM calls concurrent.
> - The whole thing is open source and backend-agnostic — swap in Claude, GPT, or a local model with a one-line change.

## The constraint that mattered: one tool, not two

My first instinct was the obvious one: stand up a small service that calls an LLM and wraps it in a browser extension or bookmarklet. That works, but it's a *second thing* — a separate UI, a separate mental model, something I'd have to remember exists and reach for. I already have a LanguageTool client I use every day. I wanted the AI suggestion to just show up there, mixed in with the normal grammar and spelling matches, not living somewhere else.

That constraint turned out to be the interesting part of this project.

## The discovery: LanguageTool already has this plumbing

Before building anything, I went looking at LanguageTool's actual source rather than its docs, on the theory that their own commercial Rephrase feature had to be implemented as *something* inside the same codebase. It is.

`languagetool-core` ships a class called `GRPCRule` (extending `RemoteRule`), wired in by default for every language via `Language.java`'s `getRelevantRemoteRules()` — no fork, no recompile, works on the stock jar. Point a config file (`remoteRulesFile`) at a gRPC server implementing LanguageTool's own `MLServer.Match` interface, and its responses come back as ordinary rule matches in the normal `/v2/check` JSON — structurally indistinguishable from a built-in spelling fix.

The tell that this is exactly what their paid tier uses internally: the `.proto` file's `ProcessingOptions.Level` enum lists `picky, academic, clarity, professional, creative, customer, jobapp, objective, elegant` — LanguageTool Premium's actual named rewrite styles.

So the plan became: write a gRPC server that speaks this protocol, have it call an LLM, and let LanguageTool do the rest.

## Architecture

```
Your text
   │
   ▼
LanguageTool /v2/check  ──────────────►  ai-rephrase-grpc (my sidecar)
   │  (grammar/spelling rules,                  │
   │   as always)                               ▼
   │                                       an LLM
   │                                             │
   ◄─────────────── one JSON response ───────────┘
```

The sidecar is a small Go service. For every sentence LanguageTool sends it, it asks an LLM to rewrite it, and returns the rewrite as a `suggestedReplacement` spanning the whole sentence — same shape LanguageTool uses for a one-word spelling suggestion, just longer.

I picked [OpenCode Zen](https://opencode.ai/zen/)'s free tier as the LLM backend, mostly out of curiosity about how far "free" actually goes. More on that below — it's not a simple story.

## Making it disappear into the tool I already use

The naive way to gate this — require a client to pass `enabledRules=AI_REPHRASE` on each request — technically satisfies "it's the same tool," but in practice nothing would show up unless I manually added a parameter, which is just the bolted-on-tool problem wearing a costume.

The fix was tagging the sidecar's matches with LanguageTool's own `Tag.picky`. LanguageTool's rule-activation filter excludes `picky`-tagged rules entirely at `level=DEFAULT` — not just hiding the result, the remote call never happens — and includes them at `level=PICKY`. It turns out most LanguageTool clients, including the official browser extension, send `level=picky` by default, without the user ever touching a setting.

Net effect: once deployed, AI rewrites just started appearing in my actual browser extension. Nothing to install, nothing to configure, nothing to remember to open.

The honest tradeoff: this also activates for *any* client hitting the endpoint in picky mode, not just mine — there's no way to scope "picky mode" to one user at this layer. I accepted it because the LLM backend is free; if you're paying per token, you'd want a rate limit or a budget cap here.

## Two bugs that only showed up in real use

Both of these passed every test I threw at them via `curl` and only broke once I actually used the thing normally, in the extension.

**Reasoning models can burn their whole budget without answering.** Some free-tier models — including the one I ended up using — emit an internal chain-of-thought before the final answer. One free model I benchmarked took **65 seconds** and roughly 950 tokens of reasoning to rewrite a single sentence, which is obviously unusable. The model I picked instead is much faster, but even it occasionally exhausts a tight `max_tokens` budget mid-reasoning and returns an empty final answer with `finish_reason: "length"` — no error, just silence. Fixed by giving it enough headroom to actually finish thinking.

**Sequential per-sentence calls silently broke multi-sentence text.** My first implementation looped over every sentence in a request one at a time. A single test sentence always looked fine. But LanguageTool sends a whole paragraph's sentences in one request, and three sentences at roughly 4 seconds each summed to about 12 seconds — comfortably past LanguageTool's own timeout for the whole remote-rule call. The result: the extension would silently show no AI suggestions, with no visible error anywhere in the UI, even though the sidecar's own logs showed it working. The fix was running every sentence in a request concurrently instead of sequentially, so total latency tracks the *slowest* sentence, not the sum. This is the kind of bug that doesn't show up in "does the API work" testing and only appears once you use the real client with real, multi-sentence text.

## Try it

The whole thing is open source: [github.com/MariosTheof/languagetool-ai-rephrase](https://github.com/MariosTheof/languagetool-ai-rephrase) (MIT). It's backend-agnostic — I used a free model, but it's a plain HTTP call under the hood, so pointing it at Claude, GPT, or a local Ollama model is a one-line change.

If you're already self-hosting LanguageTool, this is maybe an afternoon of work to add. If you're not, and you've been paying for Grammarly just for the rewrite feature, it might be worth reconsidering what you actually need a subscription for.
