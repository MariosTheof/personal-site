---
title: "Why I Migrated My Biggest Project Off a Single-Page App"
description: "A Vue SPA felt fast for pcprice.watch. For 2 years it fired ads and analytics on one page per visit. Migrating to Astro cut the build from 26 min to 9 sec."
date: "2026-07-08"
---

[pcprice.watch](https://pcprice.watch) has been my main project for about two years. It started as a narrow tool: punch in a graphics card, get its going price across eBay markets. Somewhere along the way it stopped being a tool. It turned into a site hardware enthusiasts actually browse, with buying guides, deal feeds, and close to a hundred models tracked across seven markets. I built the front end as a Vue 3 single-page app because that's what I knew and it was fast to stand up. For the tool I was building, that was the right call. For the site it became, it was quietly the wrong one, and I didn't find out until I tried to patch the symptom instead of the cause.

This is the post-mortem. Not "SPAs are bad," because they aren't. It's about what happens when the quick early call is the wrong shape for what the thing becomes, and how long you can run on the wrong shape without noticing.

> **Key Takeaways**
> - A SPA loads the page once, then swaps content on the client. Analytics and ad scripts fire once and go silent for every internal navigation after that ([DebugBear](https://www.debugbear.com/docs/single-page-application-seo), 2026).
> - For nearly two years, ads and pageviews on my site were counted on the entry page only, a rounding error I mistook for low traffic.
> - Crawlers received near-empty HTML for my most important pages, because the content only existed after JavaScript ran.
> - The fix that finally exposed the problem was a one-line hack to force full page reloads. Writing it was the moment I realized I'd built a multi-page site badly.

## Why a SPA felt like the obvious choice

The SPA was the path of least resistance, and that's exactly why it was dangerous. Vue Router, Pinia, a dev server that hot-reloads, and you get a working app in an afternoon, and every internal link feels instant because nothing reloads. For an app-shaped product with a logged-in dashboard, that model is correct.

<!-- [UNIQUE INSIGHT] -->
The problem is that pcprice.watch stopped being app-shaped the moment it became a destination. A tool has one screen and one job, and a SPA fits it perfectly. A content site is thousands of mostly-static pages, one per model, per market, per condition, that people find through search and that need to load, be crawled, and show an ad. I picked the framework for the tool I started with and never re-picked it for the site I actually had. A price-per-page site wearing an application framework.

## What a SPA actually does to ads and analytics

The mechanism is simple, which is what makes it easy to miss. In a SPA, the browser loads real HTML exactly once. After that, clicking an internal link doesn't fetch a new page. JavaScript rewrites the DOM and updates the URL with the History API. No full page load means the scripts in your `<head>` don't run again. Google Tag Manager fires one pageview when the visitor first lands, then goes silent for every page they visit after that ([DebugBear](https://www.debugbear.com/docs/single-page-application-seo), 2026).

<!-- [PERSONAL EXPERIENCE] -->
Now put an ad network's script and an analytics script in that `<head>` and think about what happens. Both run on the page that loads. Every click after that fires neither. Someone landing on my site and browsing five GPUs generated one ad impression and one pageview, not five. For two years I looked at flat ad revenue and low analytics numbers and concluded I had a traffic problem. I had a plumbing problem. The traffic was there; my scripts just weren't watching it. That's the part that still stings. The cost wasn't a bug I could see in a stack trace, it was an absence, and absences are invisible until you go looking.

## The SEO tax I didn't see

The same architecture quietly taxed my search rankings. SPAs often render content only after the browser executes JavaScript, so a crawler can receive a mostly-empty HTML file with no real content, title, or links ([DebugBear](https://www.debugbear.com/docs/single-page-application-seo), 2026). My search-result pages, the ones that should rank for "RTX 4070 price" and every model like it, were client-only. The median price, the sold count, the comparison: none of it existed in the HTML. It got painted in after JavaScript ran, if the crawler bothered to run it.

So my highest-intent pages, the whole reason the project exists, were shipping an empty shell to the one audience that decides whether anyone ever finds them. I'd been writing code for the users who were already on the site and starving the pipe that brings new ones.

## The one-line hack that gave it away

I found all this the way you usually find these things: by trying to fix the wrong layer. I noticed the ad script wasn't re-running on navigation, so I added a route guard that forced a full page reload on every internal link, essentially `window.location.assign` on each nav so the scripts would fire fresh.

<!-- [UNIQUE INSIGHT] -->
It worked. Ads re-rendered, analytics counted. And it was also the exact moment the whole thing clicked. I had taken a single-page app and written code to make it reload the entire page on every click. That's not a SPA anymore. That's a multi-page site, reimplemented badly, on top of a framework whose entire selling point I had just switched off. When your temporary fix is deleting the one advantage your framework has, the framework was the mistake. I deleted the hack a day later, by deleting the SPA.

## Why Astro, and what actually changed

I rebuilt the front end on Astro 5: static HTML by default, with the interactive bits (the search box, the deals feed, the PC builder) as hydrated "islands." Astro ships zero JavaScript to the browser unless you explicitly ask for it, hydrating only the components that need it ([Astro Docs](https://docs.astro.build/en/concepts/islands/), 2026). Every page is real HTML on disk. Every navigation is a real page load, natively, which means the ad script and the analytics script run on every page, because every page is a page. The hack wasn't ported. It was made irrelevant.

<!-- [ORIGINAL DATA] -->
The numbers moved in ways I could actually see. The production build went from 26 minutes under the old SSG setup to about 9 seconds. It emits 12,061 static pages, each with its price data, its heading, and its structured data baked into the HTML at build time, which is the exact content crawlers were missing before. The search pages that used to ship an empty shell now ship the answer.

## What it cost, in things other than money

The money cost is real but unknowable. I can't recover two years of impressions that were never counted, and I won't pretend to a number I don't have. The costs I can name are worse anyway.

It cost me trust in my own dashboards. When your metrics quietly under-report for years, you make decisions against fiction: I built features for traffic I thought I didn't have. It cost me rework, a full framework migration I could have skipped by spending one honest hour at the start asking "is this a document or an application?" And it cost me the slow tax of a 26-minute build, which is how long it takes for a fast iteration loop to become a thing you avoid.

None of it showed up as an error. That's the actual lesson. The expensive decisions in a side project aren't the ones that break loudly. You fix those the same day. They're the ones that keep working while quietly costing you, so nothing ever forces the reckoning. My SPA never once threw. It just ran the wrong shape, cheaply and silently, for two years. The reload hack was the first time the wrong shape made a noise, and I almost patched over it instead of listening.

If your quick temporary decision is still in production two years later and has never caused an incident, that's not evidence it was right. It might just be an absence you haven't gone looking for yet.
