---
title: "istos.dev — Personal Cluster"
description: "The 2-node Kubernetes cluster running this site and a handful of side projects, provisioned with Terraform on Oracle Cloud's Always Free tier for $0/month."
date: "2026-05-04"
demoURL: "https://istos.dev"
---

A real Kubernetes cluster hosting this site, Buildero, and other side projects. Built on Oracle Cloud's Always Free tier — 4 ARM cores, 24 GB RAM, free MySQL, automatic TLS, all for $0 a month.

## Stack

- **Compute** — 2 × VM.Standard.A1.Flex ARM nodes (1 server + 1 worker)
- **Kubernetes** — k3s, single binary, ~512 MB control-plane footprint
- **IaC** — Terraform provisions VCN, subnets, instances, MySQL, DNS in one apply
- **Ingress** — Traefik as a DaemonSet with `hostNetwork: true` (no LoadBalancer needed)
- **TLS** — cert-manager + Let's Encrypt DNS-01 via Cloudflare
- **DNS / Edge** — Cloudflare (apex + wildcard A records)
- **Database** — MySQL HeatWave Free on a private subnet
- **Registry** — ttl.sh for ephemeral image hosting

## Hosts

This site, [Buildero](https://buildero.gr), and other side projects.

The full writeup with Terraform snippets and the Oracle Linux firewalld quirks lives in the [$0 Kubernetes Cluster post](/blog/09-zero-dollar-kubernetes-cluster).
