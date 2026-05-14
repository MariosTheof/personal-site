---
title: "Buildero"
description: "Permit-monitoring SaaS for Greek construction engineers. Ingests permits from the Διαύγεια government portal, classifies them, and surfaces relevant leads."
date: "2026-05-01"
demoURL: "https://buildero.gr"
---

A subscription SaaS that turns the Greek government's public permit portal (Διαύγεια) into actionable construction leads for civil engineers, architects, and contractors.

## What It Does

- **Ingests** new permits published on Διαύγεια in near real-time
- **Classifies** each permit and matches it to the user's area of interest
- **Surfaces** matched permits as **Leads** that users can star, list, and follow up on
- **Tracks** engineers referenced across permits

## Stack

- **Frontend** — Vue 3, Vue Router, Vue Chartjs, Tailwind CSS 4
- **Backend** — FastAPI (Python), SQLite for the permit store
- **Billing** — Stripe Checkout + Customer Portal (14-day free trial, then monthly)
- **Infra** — Docker Compose, hosted on the istos.dev cluster

## Highlights

- Domain-driven design throughout — language and relationships codified in a `CONTEXT.md` shared with all contributors
- 14-day trial gates the full app; no credit card to start
- Lists are first-class — Leads can be starred, organized into named Lists, and bulk-managed
