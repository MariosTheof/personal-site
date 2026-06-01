---
title: "CoffeeVersus"
description: "Independent coffee gear comparison site — 258 static pages matching grinders, brewers, espresso machines, and kettles head-to-head."
date: "2026-05-28"
demoURL: "https://coffeeversus.com"
---

A static comparison site for coffee equipment built to capture affiliate search traffic in a niche with low competition and high buyer intent.

## Key Features

- **258 comparison pages** generated from 49 products via Astro's `getStaticPaths()` — quadratic growth within category
- **Amazon Associates integration** — affiliate click tracking via GA4 custom events on every "Check price" CTA
- **JSON-LD schema** — BreadcrumbList + ItemList on all pages for rich snippet eligibility
- **Category pages** with editorial intro copy for each gear type (grinders, brewers, espresso machines, kettles, pod machines)

## Technical Implementation

- **Frontend**: Astro SSG (`output: static`) — zero JS by default, fast TTFB
- **Hosting**: k3s cluster behind Cloudflare Tunnel; Cloudflare handles SSL and www → apex redirect
- **Deploy**: GitHub Actions → GHCR → k3s rolling update on push to master
- **Analytics**: GA4 with affiliate click event tracking
- **SEO**: Sitemap auto-generated via `@astrojs/sitemap`, copied to `sitemap.xml` via post-build hook

A lean, low-maintenance side project designed to grow passively as more products are added.
