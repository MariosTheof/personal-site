---
title: "Why I Moved My Analytics Off Vercel and Onto a Free MySQL Box"
description: "Vercel Analytics charges per event overage. Why I moved to self-hosted Umami on a free Oracle HeatWave instance — and three things that bit me along the way."
date: "May 10 2026"
---

Vercel Analytics is fine until your site grows. The free tier caps events; the Pro tier charges $0.00003 per overage event ([Vercel](https://vercel.com/docs/analytics/limits-and-pricing), 2026), and once you've crossed that line you're paying for a dashboard you can't query. I had something else sitting on my Oracle account for months: a free MySQL HeatWave instance, attached to the same VCN as my K3s cluster, doing nothing. So I moved analytics there.

The stack is Umami v2 (mysql build) running on K3s, talking to HeatWave on a private subnet, exposed through a Cloudflare Tunnel with per-path Access policies. The bill is zero. What follows is why each piece of this stack is what it is — and what it cost in things other than money.

> **Key Takeaways**
> - Vercel Analytics charges $0.00003 per event overage on Pro and pauses collection on Hobby ([Vercel](https://vercel.com/docs/analytics/limits-and-pricing), 2026).
> - Umami is cookieless and GDPR-compliant by architecture, with 36.4k GitHub stars and active maintenance ([umami-software/umami](https://github.com/umami-software/umami), 2026).
> - Umami v3 dropped MySQL entirely; the last MySQL-compatible image is `mysql-v2.19.0`. Don't bump it without replatforming the database.
> - Cloudflare Access with three per-path policies on one hostname is the cleanest way to serve a public tracker and a private admin from the same Service.

## Why I left Vercel Analytics

Three reasons, in order of how much they bothered me.

First, the pricing curve. Vercel's analytics is event-based: events accumulate across every project on your team, and once you cross the included quota on Pro you're paying $0.00003 per event. On Hobby, collection pauses at the cap and you lose data until the cycle resets. Both endings are worse than "see all your data."

Second, the lock-in. Vercel Analytics is a feature attached to Vercel deployments. Anything you don't deploy to Vercel — a static SPA hosted somewhere else, a Kubernetes-served Astro site, a side project on Cloudflare Pages — is invisible to it. I wanted one dashboard that didn't care where the page was served from.

Third, the data was in a black box. There's no SQL, no event export, nothing to query against directly. For a portfolio site that doesn't matter much. For anything where you might want to ask a question the dashboard doesn't already answer, it matters a lot.

## Why HeatWave instead of a fresh Postgres pod

The Oracle Always Free tier includes one MySQL HeatWave instance, free forever, on a private subnet. Mine had been provisioned months earlier as part of the [zero-dollar Kubernetes cluster](/blog/09-zero-dollar-kubernetes-cluster) build and was sitting at zero queries per second. That's the entire reason this is MySQL: the database I already had idle was a MySQL.

Spinning up a Postgres StatefulSet on the cluster would have been the more conventional choice, but it would have eaten cluster RAM I don't have to spare on a 4-OCPU/24-GB Always Free setup. HeatWave runs on Oracle's compute, not mine. It comes with backups, a managed control plane, and I don't think about it.

The catch is that HeatWave only listens on the private subnet `10.0.3.0/24`. Anything in the VCN can reach it; the public internet can't. That's good for security, mildly annoying for laptop access (SSH tunnel through a K3s node gets you there), and irrelevant to the analytics use case where the only client is the Umami pod next to it.

## Why Umami over the alternatives

GA4 was eliminated immediately. The cookie banner alone disqualifies it: in Germany and France, fewer than 25% of users accept analytics cookies ([CookieYes](https://www.cookieyes.com/blog/cookie-consent-trends/), 2026), and 67% of Consent Mode v2 implementations have technical errors that break the data anyway. Privacy-friendly defaults aren't a feature for me — they're the floor.

Plausible was the obvious alternative. The cloud version is paid; the self-hosted version pulls in ClickHouse as a dependency, and ClickHouse on a 6-GB ARM node is a bad time. I tried it briefly. It came out.

PostHog has more features than I will ever use on a portfolio site.

Umami is what was left, and what was left turned out to fit. It's a Node app with a MySQL or Postgres backend, cookieless, no PII collection, GDPR-compliant by architecture ([umami-software/umami](https://github.com/umami-software/umami), 2026). The MySQL build matched the database I had idle. The container fit the cluster. The front-end is one HTML page. Nothing about it is fancy, and that's the point.

## The stack, end to end

```
Browser
  ↓
[hostname]/script.js   (DNS CNAME, proxied by Cloudflare)
  ↓
Cloudflare edge   (TLS termination, Access policy check)
  ↓
Cloudflare Tunnel   (outbound-only connection from inside the cluster)
  ↓
cloudflared pod   (cloudflare namespace)
  ↓
umami Service   (ClusterIP, in-cluster only)
  ↓
Umami v2 mysql container   (Deployment, pinned to k3s-worker)
  ↓
HeatWave private IP:3306   (private subnet, TLS required)
```

There is no inbound port on the K3s nodes for any of this. The only thing exposed publicly is the tracker, served through Cloudflare's edge. The cluster doesn't need a LoadBalancer, doesn't need a public IP for analytics, and the database is on a network the internet can't address.

## Three things that bit me

**Umami v3 dropped MySQL.** Umami's mainline moved Postgres-only, and the last container image with MySQL support is `ghcr.io/umami-software/umami:mysql-v2.19.0`. It's also the last image with a working ARM64 build under the mysql tag. If you `:latest` your way into a deploy, you will be staring at a Postgres connection-string error against a database that doesn't exist. Pin the tag. Document the pin.

**HeatWave's TLS is self-signed.** Prisma's MySQL client refuses to connect to a server with a self-signed certificate by default, and the error you get back is a generic "Can't reach database server" with no useful trace. The fix is appending `?sslaccept=accept_invalid_certs` to the Prisma DSN. The cert is fine — it's Oracle's — Prisma just won't trust the chain without being told to. The flag is documented but not anywhere obvious.

**Cloudflare Access ate the tracker.** I configured Access on the analytics hostname with an SSO email allowlist for the admin UI, deployed, then watched the site silently stop reporting. The browser was hitting `/script.js`, getting redirected to the Cloudflare login page, and quietly logging a JS error instead of analytics events. The fix is per-path Access apps on the same hostname: `/script.js` and `/api/send` get `bypass` policies (public), and `/` gets the SSO allowlist. More-specific paths win in Access, so the pattern works cleanly. I now use it for any "public endpoints, private admin" service.

## What it actually cost

Self-hosting means owning the version pin, schema migrations between Umami releases, and any drift in the Cloudflare Access config. When Access drift happens the tracker silently serves the SSO login page in place of JS, stats stop arriving, and nothing alerts unless something is watching.

HeatWave is managed; everything from the connection string up is mine.

What I traded was SaaS pricing risk for ops surface. Not free, paid in different currency. This is net positive only because the cluster and the database existed already for other reasons. Spinning a K3s cluster up from scratch solely to dodge a $20/month analytics bill is not rational.

The piece I'd defend on its own is data sovereignty. Raw SQL access to events matters when a dashboard can't answer the question being asked.

## FAQ

### Why not just keep using Vercel Analytics?

Vercel Analytics is fine for sites that live entirely on Vercel and stay under the included event quota. It stops being fine when you have hosts elsewhere, cross the cap, or need raw event access. Cost wasn't the deciding factor; lock-in was.

### Why MySQL and not Postgres?

Because Oracle Always Free includes a free MySQL HeatWave instance and mine was idle. If I were starting from scratch with no idle database, Postgres on the cluster would be the more conventional choice — but I'd pay for it in cluster RAM.

### What happens when Umami v2 stops getting security patches?

The realistic exit is migrating to a fresh Postgres StatefulSet running v3, accepting the cluster RAM hit, and re-importing event history. The schema is stable enough that the migration is mostly mechanical. I'd revisit this only when v2 stops getting security backports.

## Closing

The stack works because none of the pieces were added for it. The cluster was already running. The database was already provisioned and idle. Cloudflare was already DNS for the domain. Each piece pulled weight that was already on the table; analytics just gave me a reason to actually use the database.

If you have a similar pile of free-tier infrastructure sitting around, this is one of the more useful things to throw at it. If you don't, GA4 is fine.
