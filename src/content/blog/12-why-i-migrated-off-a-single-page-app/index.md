---
title: "Why I Migrated My Biggest Project Off a Single-Page App"
description: "A Vue SPA felt fast for pcprice.watch. For 2 years it fired ads and analytics on one page per visit. Migrating to Astro cut the build from 26 min to 9 sec."
date: "2026-07-08"
---

[pcprice.watch](https://pcprice.watch) has been my main project for about two years. It started because I was sick of guessing what a used graphics card actually sells for. You go on eBay and get a wall of asking prices that nobody actually pays, and I wanted the real number, the sold one, across a few countries at once. So I built a tool for exactly that. Punch in a card, get its going rate.

Then it stopped being a tool. People started browsing it instead of looking up one thing, so I added buying guides, then a deals page, then kept piling on models until there were close to a hundred of them across seven markets. Somewhere in there it quietly turned into a site. I never noticed the day it crossed over, which turned out to be the whole problem.

I built the front end as a Vue single-page app because that's what I reach for and it's quick to get running. For a tool, that's fine. For what it became, it was the wrong call, and it cost me for most of those two years before I worked out why. This isn't a "SPAs are bad" post, because they're not. It's about how a lazy early decision can sit in production for years without ever throwing an error and still bleed you the entire time.

> **Key Takeaways**
> - A SPA loads the page once, then swaps content with JavaScript. Your ad and analytics scripts fire once and go quiet for every click after that ([DebugBear](https://www.debugbear.com/docs/single-page-application-seo), 2026).
> - For two years my ads and pageviews got counted on the landing page only. I read that as low traffic. It wasn't low traffic.
> - Crawlers got near-empty HTML for my most important pages, because the content only appeared after JavaScript ran.
> - The thing that finally gave it away was a hack to force full page reloads. Writing it was the moment I realized I'd built a multi-page site the hard way.

## Why I reached for a SPA

A SPA was the least-effort path, which is exactly why it bit me. Vue Router, Pinia, a dev server that hot-reloads, and you've got a working app in an afternoon where every internal link feels instant because nothing reloads. For something app-shaped, a dashboard you log into, that's the right tool and I'd do it again.

<!-- [UNIQUE INSIGHT] -->
The trouble is pcprice stopped being app-shaped the second it became somewhere people go to read. A tool has one screen and one job. A content site is a few thousand mostly-static pages that people find through Google and that need to load fast, get crawled, and show an ad. Those are basically opposite problems. I picked the framework for the tool I started with and just never went back and re-picked it for the site I ended up with. So I had a price-per-page site wearing an application framework, and I didn't clock how wrong that was for way too long.

## What a SPA does to your ads and analytics

The mechanism is simple, which is what makes it so easy to miss. In a SPA the browser loads real HTML exactly once. After that, clicking a link doesn't fetch a new page. JavaScript rewrites the DOM and swaps the URL with the History API. No full page load means the scripts sitting in your `<head>` don't run again. Google Tag Manager fires one pageview when someone lands and then goes silent for every page they visit after that ([DebugBear](https://www.debugbear.com/docs/single-page-application-seo), 2026).

<!-- [PERSONAL EXPERIENCE] -->
Now put an ad script and an analytics script in that `<head>` and picture what happens. Both run on the page that loads. Every click after that, nothing. Somebody landing on my site and looking at five GPUs generated one ad impression and one pageview, not five. For two years I stared at flat ad revenue and sad little analytics numbers and decided I had a traffic problem. I didn't. I had a plumbing problem. The visitors were there the whole time, my scripts just weren't looking. That's the part that still bugs me, because it wasn't a bug I could catch in a stack trace. It was an absence, and you don't go hunting for an absence.

## The SEO tax I didn't see

Same architecture, second bill. SPAs often only render content after the browser runs the JavaScript, so a crawler can land on a mostly-empty HTML file with no real content, title, or links ([DebugBear](https://www.debugbear.com/docs/single-page-application-seo), 2026). My search pages, the ones that are supposed to rank for "RTX 4070 price" and every model like it, were client-only. The median price, the sold count, all of it, none was in the HTML. It got painted in after JS ran, assuming the crawler bothered.

So the pages that are the entire point of the project were shipping an empty shell to the exact audience that decides whether anyone new ever finds the thing. I'd spent all my time building for the people already on the site and starving the pipe that brings the next ones in.

## The one hack that gave it away

I found all of this the way you always find this stuff, by trying to fix the wrong layer. I noticed the ad script wasn't re-running on navigation, so I bolted on a route guard that forced a full page reload on every internal link. Basically `window.location.assign` on each nav so the scripts would fire fresh.

<!-- [UNIQUE INSIGHT] -->
And it worked. Ads re-rendered, analytics counted. It was also the exact second the whole thing clicked for me. I had a single-page app and I'd just written code to make it reload the entire page on every click. That's not a SPA anymore. That's a multi-page site, rebuilt badly, on top of a framework whose one selling point I'd just switched off. When your temporary fix deletes the only reason you picked the framework, the framework was the mistake. I killed that hack a day later, by killing the SPA.

## Why Astro

I rebuilt the front end on Astro. Static HTML by default, with the interactive bits (the search box, the deals feed, the builder) as hydrated islands. Astro ships zero JavaScript to the browser unless you specifically ask for it, and only hydrates the components that need it ([Astro Docs](https://docs.astro.build/en/concepts/islands/), 2026). Every page is real HTML on disk. Every navigation is a real page load, for free, which means the ad and analytics scripts run on every page, because now every page is actually a page. The hack didn't get ported over. It just stopped being a thing that needs to exist.

<!-- [ORIGINAL DATA] -->
And the numbers moved in ways I could finally see. The production build dropped from 26 minutes on the old setup to about 9 seconds. It puts out 12,061 static pages, each one with its price data and its heading baked into the HTML at build time, which is exactly the stuff crawlers weren't getting before. The search pages that used to ship an empty shell now ship the answer.

## What it cost

The money is real but I can't put a number on it, and I'm not going to invent one. I can't get back two years of impressions that were never counted. The costs I can name are worse anyway.

It cost me trust in my own dashboards, which is the one that stings. When your metrics quietly under-report for years you end up making calls against fiction, building features for traffic you're convinced you don't have. It cost me a full framework migration I could've skipped by spending one honest hour up front asking whether I was building a document or an app. And it cost me the slow drip of a 26-minute build, which is exactly how a fast iteration loop turns into a thing you avoid touching.

None of it ever showed up as an error, and that's the whole point. The decisions that wreck a side project aren't the loud ones. You fix those the same day. It's the quiet ones that keep working while they cost you, because nothing ever forces you to look. My SPA never once broke. It just did the wrong thing, cheaply, for two years, while I sat there blaming the traffic. If your quick temporary decision is still running two years later and has never once caused an incident, that isn't proof it was right. Might just be a bill you haven't opened yet.
