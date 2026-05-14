---
title: "How I Expose Self-Hosted Services Without Opening a Single Port"
description: "Cloudflare Tunnel and Access run my Grafana, Umami, and internal dashboards with zero inbound ports — and per-path bypass lets the public bits stay public."
date: "2026-05-10"
---

Three services on my home cluster — Grafana for monitoring, Umami for analytics, and a couple of internal dashboards — are reachable from anywhere on the public internet. The K3s nodes don't have anything listening on port 80 or 443 for any of them. That isn't a paradox. It's how Cloudflare Tunnel works, and once you understand the model you stop poking holes in your firewall for self-hosted apps.

This post is the pattern I've landed on after running the cluster from [my last post](/blog/09-zero-dollar-kubernetes-cluster) for a few months: outbound-only Cloudflare Tunnel for the data plane, Cloudflare Access for SSO at the edge, and a small per-path trick that lets one hostname mix public endpoints with admin-only screens. The whole thing is free up to 50 users.

> **Key Takeaways**
> - In 2026, exposed services on the public internet are scanned and probed within seconds — Sophos honeypots saw RDP login attempts in under a minute and the first cloud-server attack at 52 seconds (Sophos, 2019/2021).
> - Cloudflare Tunnel runs `cloudflared` inside the cluster as an outbound persistent connection, so origin services don't need any inbound ports open.
> - Cloudflare Access sits at the edge as an SSO bouncer — requests are blocked or sent to your IdP *before* they ever reach your origin.
> - The free Zero Trust tier covers up to 50 users (Cloudflare, 2026), which is enough for almost every homelab.

![Dark server rack with blue indicator lights stretching down a server room corridor](https://cdn.pixabay.com/photo/2017/03/21/02/00/server-2160321_1280.jpg)

## Why is port-forwarding a bad default in 2026?

In 2026, opening a port to the public internet is roughly equivalent to ringing a dinner bell for scanners. Sophos's RDP honeypot recorded login attempts in under one minute from the moment the port came up, and over 2 million failed logins from 999 unique IPs in 15 days ([Sophos News, *Remote Desktop Protocol: Exposed RDP (is dangerous)*](https://www.sophos.com/en-us/blog/remote-desktop-protocol-exposed-rdp-is-dangerous), 2021). A separate Sophos cloud-honeypot study saw the first attack at 52 seconds ([Sophos, *Exposed: Cyberattacks on Cloud Honeypots*](https://www.sophos.com/en-us/press/press-releases/2019/04/cybercriminals-attack-cloud-server-honeypot-within-52-seconds), 2019). Censys's 2025 State of the Internet Report puts the median network lifespan of an open web directory at one day before someone notices ([Censys SOTIR 2025](https://censys.com/blog/2025-state-of-the-internet-report-open-directories-time-to-live), 2025). The "obscure URL" defense expired a long time ago.

<figure style="margin: 2.5rem 0; text-align: center;">
<svg viewBox="0 0 600 220" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="Time before an exposed service is first probed: cloud honeypot at 52 seconds, RDP under one minute, open web directory noticed within one day median">
  <style>
    .t { fill: currentColor; font: 600 14px system-ui, sans-serif; }
    .l { fill: currentColor; font: 13px system-ui, sans-serif; }
    .v { fill: currentColor; font: 12px system-ui, sans-serif; opacity: 0.7; }
    .b1 { fill: #ef4444; }
    .b2 { fill: #f97316; }
    .b3 { fill: #eab308; }
  </style>
  <text x="20" y="24" class="t">Time before an exposed service is first probed</text>
  <text x="20" y="60" class="l">Cloud honeypot</text>
  <rect class="b1" x="240" y="46" width="80" height="20" rx="2"/>
  <text x="328" y="61" class="v">52 seconds (Sophos, 2019)</text>
  <text x="20" y="100" class="l">RDP login attempts</text>
  <rect class="b2" x="240" y="86" width="90" height="20" rx="2"/>
  <text x="338" y="101" class="v">under 1 minute (Sophos, 2021)</text>
  <text x="20" y="140" class="l">Open web directory noticed</text>
  <rect class="b3" x="240" y="126" width="320" height="20" rx="2"/>
  <text x="240" y="165" class="v">~1 day median (Censys SOTIR, 2025)</text>
</svg>
<figcaption style="font-size: 0.85rem; opacity: 0.7;">Sources: Sophos honeypot studies (2019, 2021); Censys 2025 State of the Internet Report.</figcaption>
</figure>

<!-- [PERSONAL EXPERIENCE] -->
I used to run a Wireguard VPN to my homelab and pretend that was good enough. It mostly was — until I wanted to share a Grafana dashboard with someone, or check it from my phone on a flaky connection. VPNs work for individuals and break for everything else. They're also the exact attack surface that's getting hammered: 22% of breaches in the 2025 Verizon DBIR started with stolen credentials, and 88% of basic web-app attacks involved them ([Verizon, *2025 DBIR*](https://www.verizon.com/business/resources/T16f/reports/2025-dbir-data-breach-investigations-report.pdf), 2025).

Gartner forecast that 70% of new remote-access deployments in 2025 would use ZTNA rather than VPN, up from less than 10% in 2021 ([Gartner research, *Market Guide for Zero Trust Network Access*](https://www.gartner.com/en/documents/6780434), 2022 forecast). That direction is correct for self-hosters too. The shape of the answer is: don't expose the origin at all, and put auth at the edge.

## How does Cloudflare Tunnel actually work?

Cloudflare Tunnel inverts the connection. Instead of you opening a port for the internet to reach in, you run a small daemon called `cloudflared` *inside* the cluster that opens a long-lived outbound TLS connection to Cloudflare's edge. When a browser hits `grafana.istos.dev`, Cloudflare looks up the tunnel ingress rule, ships the request down the existing outbound socket, and `cloudflared` proxies it to the in-cluster `Service` over plain HTTP.

Here's the request flow end-to-end:

```
Browser ──HTTPS──▶ Cloudflare edge ──TLS tunnel──▶ cloudflared (in pod)
                                                           │
                                                           ▼
                                                 ClusterIP Service
                                                           │
                                                           ▼
                                                        Pod(s)
```

The K3s public IPs never see this traffic. You can audit `iptables` on the nodes and there is no rule routing 443 to Grafana — there can't be, because no inbound 443 is needed. The data plane is the outbound TLS connection that `cloudflared` already maintains.

In Terraform it's a `cloudflare_zero_trust_tunnel_cloudflared_config` resource with one rule per hostname:

```hcl
ingress_rule {
  hostname = "grafana.istos.dev"
  service  = "http://vmstack-grafana.monitoring.svc.cluster.local:80"
}
ingress_rule {
  hostname = "umami.istos.dev"
  service  = "http://umami.umami.svc.cluster.local:80"
}
ingress_rule {
  service = "http_status:404"  # catch-all — don't leak hostnames
}
```

The catch-all matters. Without it, an unmatched hostname falls through to whatever Cloudflare decides, which is usually something you don't want. `http_status:404` makes unknown traffic return a clean 404 from the edge.

Why do this instead of opening another `Ingress` on the public IP? Three reasons. The origin services aren't exposed to the internet at all, so a misconfigured `NetworkPolicy` or a CVE in Grafana doesn't translate into a remote-exploitable issue. TLS terminates at Cloudflare's edge, so the cluster never has to renew certs for these hostnames. And because everything goes through the edge first, Cloudflare Access can sit in front.

## What does Cloudflare Access add on top?

Cloudflare Access is the auth layer. It's a bouncer that sits at the edge *in front of* the tunnel. Each protected hostname has a list of policies — `allow`, `bypass`, `block` — and when a request shows up, Cloudflare checks for a valid session cookie. Missing or expired? Redirect to your IdP (Google, GitHub, Microsoft, OTP), set a cookie, then forward the now-authenticated request down the tunnel.

The key thing this gets you is that **the request never reaches your origin** until Access has decided it should. Grafana doesn't see anonymous probes. Umami's admin UI doesn't see credential-stuffing attempts. The Verizon DBIR's 88% web-app-stolen-creds figure becomes a non-issue if the web app never gets the request in the first place.

<figure style="margin: 2.5rem 0; text-align: center;">
<svg viewBox="0 0 480 300" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="Verizon 2025 DBIR breach causes: 22 percent stolen credentials, 16 percent phishing, 60 percent involving the human element overall">
  <style>
    .t { fill: currentColor; font: 600 14px system-ui, sans-serif; }
    .l { fill: currentColor; font: 12px system-ui, sans-serif; }
    .v { fill: currentColor; font: 600 13px system-ui, sans-serif; }
  </style>
  <text x="20" y="24" class="t">Verizon 2025 DBIR — how breaches start</text>
  <!-- Donut: stolen creds 22%, phishing 16%, exploit vuln ~20%, other 42% -->
  <!-- Center cx=180 cy=160 r=80 inner=45 -->
  <g transform="translate(180,160)">
    <!-- Stolen credentials 22% (red) — angle 79.2° -->
    <path d="M 0,-80 A 80,80 0 0,1 78.7,-14.3 L 44.3,-8.0 A 45,45 0 0,0 0,-45 Z" fill="#ef4444"/>
    <!-- Phishing 16% (orange) — start 79.2°, sweep 57.6° -->
    <path d="M 78.7,-14.3 A 80,80 0 0,1 70.5,38.0 L 39.6,21.4 A 45,45 0 0,0 44.3,-8.0 Z" fill="#f97316"/>
    <!-- Exploit vulnerability 20% (yellow) — start 136.8°, sweep 72° -->
    <path d="M 70.5,38.0 A 80,80 0 0,1 -25.0,76.0 L -14.0,42.7 A 45,45 0 0,0 39.6,21.4 Z" fill="#eab308"/>
    <!-- Other 42% (gray) — remaining -->
    <path d="M -25.0,76.0 A 80,80 0 1,1 0,-80 L 0,-45 A 45,45 0 1,0 -14.0,42.7 Z" fill="#94a3b8"/>
  </g>
  <!-- Legend -->
  <g transform="translate(310,80)">
    <rect x="0" y="0" width="12" height="12" fill="#ef4444"/>
    <text x="20" y="10" class="l">Stolen credentials — 22%</text>
    <rect x="0" y="24" width="12" height="12" fill="#f97316"/>
    <text x="20" y="34" class="l">Phishing — 16%</text>
    <rect x="0" y="48" width="12" height="12" fill="#eab308"/>
    <text x="20" y="58" class="l">Exploited vulnerability — ~20%</text>
    <rect x="0" y="72" width="12" height="12" fill="#94a3b8"/>
    <text x="20" y="82" class="l">Other vectors — ~42%</text>
    <text x="0" y="120" class="v">60%</text>
    <text x="0" y="138" class="l">involve the human element</text>
  </g>
</svg>
<figcaption style="font-size: 0.85rem; opacity: 0.7;">Source: Verizon 2025 Data Breach Investigations Report. "Other vectors" includes misconfigurations, errors, physical, etc.</figcaption>
</figure>

The free Zero Trust plan covers up to 50 users, supports IdP integrations including AzureAD, Google, and GitHub, and includes 24-hour log retention ([Cloudflare, *A Boring Announcement: Free Tunnels for Everyone*](https://blog.cloudflare.com/teams-plans/), 2020 — still in force per the 2026 plan page). For a homelab or a small team that's effectively unlimited.

You can do all of this without a third-party IdP — Cloudflare ships an email-OTP flow that sends a 6-digit code to allowlisted addresses. I use Google for myself and a `var.access_allowed_emails` allowlist for the half-dozen people who occasionally need in.

![Glowing fingerprint scanner overlay representing biometric authentication](https://cdn.pixabay.com/photo/2022/03/29/15/46/biometrics-7119387_1280.jpg)

## How does per-path bypass tie it together?

The trick that makes this practical for real workloads: **multiple Access apps on the same hostname, distinguished by path**, with more-specific paths taking precedence.

Umami is the canonical example. The admin UI needs SSO, but two endpoints have to stay public:

- `umami.istos.dev/script.js` — the tracker bundle that browsers download from blog readers
- `umami.istos.dev/api/send` — the endpoint that ingests pageview events

If the whole hostname required SSO, no anonymous visitor could fetch the tracker, and analytics would silently break. If nothing required SSO, the admin UI would be public.

Three Access apps on the same hostname solves it:

```hcl
# Public — script bundle
resource "cloudflare_zero_trust_access_application" "umami_script" {
  domain   = "umami.istos.dev/script.js"
  policies = [cloudflare_zero_trust_access_policy.bypass_all.id]
}

# Public — event ingest
resource "cloudflare_zero_trust_access_application" "umami_send" {
  domain   = "umami.istos.dev/api/send"
  policies = [cloudflare_zero_trust_access_policy.bypass_all.id]
}

# SSO — everything else (admin UI)
resource "cloudflare_zero_trust_access_application" "umami_admin" {
  domain   = "umami.istos.dev"
  policies = [cloudflare_zero_trust_access_policy.email_allowlist.id]
}
```

More-specific paths win, so `/script.js` and `/api/send` go straight through with `bypass`, while every other path on the hostname triggers SSO. This is the "public endpoints + private admin" shape of every analytics, status-page, or webhook-receiver tool I've ever self-hosted, and almost none of the tutorials I've read mention it.

<!-- [UNIQUE INSIGHT] -->
The general pattern is: list the *exact* public endpoints, mark them `bypass`, then drop a catch-all SSO app at the root. Don't try to do it in reverse with allowlist regexes — Cloudflare's path matching prefers the more specific app, which makes the bypass list the natural place to encode "public surface area."

## What bites

Four things that cost me time:

**Silent 404s when the tunnel ingress is wrong.** If your `service` URL points to a `Service` that doesn't exist in the namespace `cloudflared` thinks it's in, you get a Cloudflare 404 with no useful detail. Check `kubectl logs deploy/cloudflared -n cloudflare` — the daemon logs the resolution failure, but the browser sees nothing helpful. I lost 20 minutes once because I'd typo'd `umami.umami` as `umami.default`.

**Proxied DNS is required.** A Cloudflare Tunnel CNAME has to be `proxied=true` (orange-cloud). I had a wildcard A record at the apex with `proxied=false` for the personal site, and accidentally inherited that flag onto a tunnel CNAME — requests bypassed the tunnel entirely and hit dead air. Always set `proxied=true` on tunnel CNAMEs explicitly.

**Cookie scope on cross-domain assets.** Access cookies are set per-host. If your app loads assets from a *different* protected host (rare, but happens with separate static-asset domains), the user gets a redirect loop because the asset host has no cookie. Either bypass the asset host, or share a parent domain so the cookie applies.

**Token rotation.** Tunnel tokens are long-lived but rotatable. Rotate them through Terraform — don't edit the dashboard secret out from under the deployment, because you'll have a window where `cloudflared` keeps the old connection up while the new pods can't authenticate.

## Should you put everything behind it?

No. The site you're reading is at `marios.istos.dev` and is *not* behind a tunnel. There's no auth on a personal blog and no value in routing every request through Cloudflare's edge for it — the DNS A records point straight at the K3s nodes, and Traefik handles 443 directly with a Let's Encrypt wildcard cert. Adding a tunnel here would add 20-50 ms of latency for no security gain.

Where it earns its keep: anything with auth, anything where the origin doesn't need to be reachable by the open internet, anything you'd otherwise put on a VPN. Grafana, internal admin UIs, webhook receivers (with `bypass` on the receiver path), home automation dashboards, status pages with a private edit URL.

The honest tradeoff is that Cloudflare sees all your traffic for the protected hostnames. They terminate the TLS, so it isn't end-to-end encrypted past their edge. For most self-hosters this is fine — Cloudflare's threat model around customer data is stronger than yours. For genuinely sensitive workloads (anything HIPAA, anything where you don't want a US company in the data path), it isn't, and you should run a real ZTNA stack you control.

## Frequently Asked Questions

### Is Cloudflare Tunnel the same as Argo Tunnel?

Yes — Argo Tunnel was renamed to Cloudflare Tunnel in 2021, and `cloudflared` ships free of charge for all users ([Cloudflare, *Free Tunnels for Everyone*](https://blog.cloudflare.com/tunnel-for-everyone/), 2020). Older docs still call it Argo. The product is unchanged.

### What does this cost past the free tier?

The Zero Trust free plan is good for 50 users with email/IdP-based Access policies and 24-hour log retention. Past that, the paid Zero Trust tiers start at around $7 per user per month for the Standard plan (Cloudflare, 2026 — see Teams plans link in the Sources section). Tunnel itself remains free at any user count.

### What happens if Cloudflare goes down?

Your protected hostnames go down. There is no automatic failover, because the data plane is the tunnel. For my homelab this is fine — Cloudflare's uptime is better than my home internet's. Cloudflare's 2025 numbers were 47.1 million DDoS attacks blocked across 330 cities in 125+ countries, with 81 million HTTP requests per second average ([Cloudflare Radar 2025 Year in Review](https://blog.cloudflare.com/radar-2025-year-in-review/), 2025) — they're operationally fine. If your business depends on a service, run a second public ingress as a fallback.

### Can I use this without giving Cloudflare my domain?

Cloudflare Tunnel requires the hostname to be on a zone you've delegated to Cloudflare DNS, because the tunnel CNAME has to be authored there. You can keep your registrar elsewhere — only the nameservers move. If you're not willing to do that, look at alternatives like Tailscale Funnel or self-hosted reverse-tunnel options like `frp` or `chisel`.

## Wrap

The pattern I keep coming back to for self-hosted services is:

1. **Outbound-only data plane** via `cloudflared` — no inbound ports on the cluster.
2. **Auth at the edge** via Access — the origin never sees unauthenticated traffic.
3. **Per-path bypass** for the small set of endpoints that genuinely need to be public.

The Terraform that wires this together is in the same `lab/oci` repo as the [zero-dollar K3s cluster post](/blog/09-zero-dollar-kubernetes-cluster) — `tunnel.tf` plus `umami.tf` for the per-path apps. It's about 80 lines for the whole tunnel-plus-three-Access-apps setup, and it has held up cleanly through several months of the cluster being live on the public internet with zero open ports for those hostnames.

## Sources

- Sophos News, *Remote Desktop Protocol: Exposed RDP (is dangerous)*, 2021. Retrieved 2026-05-10. <https://www.sophos.com/en-us/blog/remote-desktop-protocol-exposed-rdp-is-dangerous>
- Sophos, *Exposed: Cyberattacks on Cloud Honeypots*, 2019. Retrieved 2026-05-10. <https://www.sophos.com/en-us/press/press-releases/2019/04/cybercriminals-attack-cloud-server-honeypot-within-52-seconds>
- Censys, *2025 State of the Internet Report — Open Directories*, 2025. Retrieved 2026-05-10. <https://censys.com/blog/2025-state-of-the-internet-report-open-directories-time-to-live>
- Verizon, *2025 Data Breach Investigations Report*, 2025. Retrieved 2026-05-10. <https://www.verizon.com/business/resources/T16f/reports/2025-dbir-data-breach-investigations-report.pdf>
- Gartner, *Market Guide for Zero Trust Network Access*, 2022 forecast for 2025. Retrieved 2026-05-10. <https://www.gartner.com/en/documents/6780434>
- Cloudflare, *A Boring Announcement: Free Tunnels for Everyone* (Teams plans), 2020 (still in force per the 2026 plan page). Retrieved 2026-05-10. <https://blog.cloudflare.com/teams-plans/>
- Cloudflare, *Free Tunnels for Everyone* (cloudflared GA), 2020. Retrieved 2026-05-10. <https://blog.cloudflare.com/tunnel-for-everyone/>
- Cloudflare, *Radar 2025 Year in Review*, 2025. Retrieved 2026-05-10. <https://blog.cloudflare.com/radar-2025-year-in-review/>
