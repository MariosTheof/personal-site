---
title: "How I Run This Site on a $0 Kubernetes Cluster"
description: "The Terraform, k3s, and Traefik setup behind a 2-node Kubernetes cluster on Oracle Cloud's Always Free tier — 4 ARM cores, 24 GB RAM, $0/month."
date: "2026-05-04"
---

The site you're reading right now is served from a Kubernetes cluster I pay nothing for. Two ARM nodes, 4 OCPUs, 24 GB of RAM, a free MySQL database on a private subnet, automatic TLS, and an ingress controller — all on Oracle Cloud's Always Free tier. The bill at the end of the month is, genuinely, zero.

This isn't a "you can rent a $5 VPS" article. It's the actual setup: the Terraform that provisions it, the cloud-init that configures it, and the parts that fought me (looking at you, Oracle Linux firewalld). If you've been curious whether you can host real workloads on a free cluster without it being a toy, the answer is yes — but the path has sharp edges.

> **Key Takeaways**
> - Oracle Cloud's Always Free tier includes 4 ARM Ampere A1 cores and 24 GB of RAM permanently free ([Oracle](https://www.oracle.com/cloud/free/), 2026), enough for a real 2-node Kubernetes cluster.
> - k3s is the right distribution for this — single binary, ARM-friendly, runs the control plane in roughly 512 MB of RAM ([k3s.io](https://docs.k3s.io/), 2026).
> - The free tier doesn't give you a managed LoadBalancer, so I run Traefik as a `DaemonSet` with `hostNetwork: true` to bind ports 80/443 directly on the nodes.
> - Oracle Linux's default `firewalld` rules silently break Flannel pod networking until you trust the `cni0` and `flannel.1` interfaces.

## Why Oracle Cloud Always Free?

Most "free" cloud tiers expire after 12 months. Oracle's Always Free tier doesn't. As of 2026, it includes up to 4 ARM Ampere A1 cores and 24 GB of memory across one or more VMs, plus 200 GB of block storage and a free MySQL HeatWave instance ([Oracle](https://www.oracle.com/cloud/free/), 2026). That's the entire reason this works. Four ARM cores and 24 GB is not a toy — it's enough to run a non-trivial cluster with services, ingress, observability, and a handful of personal apps.

The catch is region availability and reclamation. ARM A1 capacity in busy regions can be thin, and idle Always Free instances may be reclaimed if you don't use them. I run mine in `eu-milan-1`, which has been consistently available for me. Reclamation is real — keep a CPU/memory load on the boxes (which a Kubernetes cluster naturally has) and you're fine.

<!-- [PERSONAL EXPERIENCE] -->

I split the budget into a control-plane node (1 OCPU, 6 GB) and a worker (2 OCPU, 12 GB). The remaining 1 OCPU and 6 GB are a buffer — useful for resizing or adding a tiny third node later.

## Why k3s and not "real" Kubernetes?

Because k3s *is* real Kubernetes — it's a fully conformant distribution that ships as a single ~70 MB binary and runs the control plane in roughly 512 MB of RAM ([k3s.io](https://docs.k3s.io/), 2026). On a 6 GB node where I want headroom for actual workloads, that footprint matters. Vanilla `kubeadm` would work, but the etcd + apiserver + controller-manager + scheduler stack eats more memory and gives me nothing I'd use on a personal cluster.

k3s also ships with sensible defaults that save time on a free-tier setup: SQLite as the datastore (no etcd to babysit on a single-server cluster), Traefik as the bundled ingress controller, Flannel as the CNI, and `local-path-provisioner` for storage. I keep all of those except I override Traefik's config to make it work without a LoadBalancer.

The install on each node is one curl. The server:

```bash
curl -sfL https://get.k3s.io | INSTALL_K3S_EXEC="server" \
  K3S_TOKEN="$TOKEN" sh -s - --tls-san "$PUBLIC_IP" --write-kubeconfig-mode 600
```

The worker:

```bash
curl -sfL https://get.k3s.io | K3S_URL="https://${SERVER_IP}:6443" \
  K3S_TOKEN="$TOKEN" sh -s -
```

The `--tls-san` flag matters: without it, the kubeconfig you fetch from the server is only valid for `127.0.0.1`. Adding the public IP to the cert's SANs lets you `kubectl` from your laptop.

## The architecture in one diagram

Here's the whole thing:

```
                         Cloudflare DNS
                               │
                               ▼
              ┌──────────────────────────────────┐
              │   OCI VCN  10.0.0.0/16           │
              │                                  │
              │   Public subnet 10.0.2.0/24      │
              │   ┌──────────────┐  ┌──────────┐ │
              │   │ k3s-server   │  │ k3s-     │ │
              │   │ 1 OCPU 6 GB  │──│ worker   │ │
              │   │ Traefik DS   │  │ 2 OCPU   │ │
              │   └──────┬───────┘  │ 12 GB    │ │
              │          │          │ Traefik  │ │
              │          │          │ DS       │ │
              │          │          └──────────┘ │
              │          │                       │
              │   Private subnet 10.0.3.0/24     │
              │   ┌──────▼───────┐               │
              │   │ MySQL Free   │               │
              │   │ 50 GB        │               │
              │   └──────────────┘               │
              └──────────────────────────────────┘
```

Two VMs in a public subnet, one MySQL HeatWave Free instance in a private subnet that's only reachable from inside the VCN. Cloudflare handles DNS and TLS challenge solving. The public subnet's security list opens 22, 80, 443, and 6443 from the internet, plus everything inside the VCN. That's it.

## The Terraform that provisions it

Everything is one `terraform apply`. The IaC has five files of substance:

- `network.tf` — VCN data source (I attach to an existing VCN), public/private subnets, route tables, security lists, internet/NAT/service gateways.
- `compute.tf` — two `VM.Standard.A1.Flex` instances on Oracle Linux 9 aarch64, ED25519 SSH key generated and written to disk, cloud-init injected via `templatefile()`.
- `mysql.tf` — `MySQL.Free` shape on the private subnet.
- `cloudflare.tf` — apex and wildcard A records pointed at both nodes.
- `cloud-init/k3s-server.yaml` and `k3s-worker.yaml` — firewalld rules and the k3s installer.

<!-- [ORIGINAL DATA] -->

The whole stack — VCN attachments, subnets, two ARM instances, MySQL, DNS records, SSH keys — provisions in about 6–8 minutes from a clean `terraform apply`. Most of that is OCI waiting for the MySQL instance to come online; the compute is up in under two.

The compute resource is short:

```hcl
resource "oci_core_instance" "k3s_server" {
  shape = "VM.Standard.A1.Flex"
  shape_config {
    ocpus         = 1
    memory_in_gbs = 6
  }
  source_details {
    source_type             = "image"
    source_id               = var.arm_image_ocid
    boot_volume_size_in_gbs = 50
  }
  metadata = {
    ssh_authorized_keys = tls_private_key.k3s.public_key_openssh
    user_data = base64encode(templatefile("${path.module}/cloud-init/k3s-server.yaml", {
      k3s_token = random_password.k3s_token.result
    }))
  }
  lifecycle {
    ignore_changes = [source_details[0].source_id, metadata]
  }
}
```

The `lifecycle.ignore_changes` block is doing real work here. OCI rolls new minor image OCIDs forward over time, and without that block every `terraform plan` wants to rebuild your nodes from scratch. The `metadata` ignore is the same idea applied to cloud-init — once the nodes are bootstrapped, I don't want a tiny edit to the user-data template to nuke and recreate them.

## Oracle Linux fought me

This is the part nobody warns you about. Oracle Linux 9 ships with `firewalld` enabled and a default zone that blocks almost everything pod-to-pod. You install k3s, it comes up, `kubectl get nodes` shows both nodes Ready, and then you discover that pods on node A cannot reach pods on node B. There are no errors. DNS just times out. Service IPs route to nowhere.

The fix isn't obvious from the symptoms. Flannel uses VXLAN over UDP 8472 for cross-node pod traffic, which firewalld blocks by default. It also creates two virtual interfaces — `cni0` (the bridge that connects local pods to the host) and `flannel.1` (the VXLAN tunnel) — that aren't trusted, so even when the UDP port is open, the bridge traffic is dropped.

The cloud-init that fixes this:

```yaml
runcmd:
  - firewall-cmd --permanent --add-port=6443/tcp     # K3s API
  - firewall-cmd --permanent --add-port=10250/tcp    # Kubelet
  - firewall-cmd --permanent --add-port=8472/udp     # VXLAN (Flannel)
  - firewall-cmd --permanent --add-port=51820/udp    # WireGuard (Flannel)
  - firewall-cmd --permanent --zone=trusted --add-interface=cni0
  - firewall-cmd --permanent --zone=trusted --add-interface=flannel.1
  - firewall-cmd --reload
```

The two `--zone=trusted --add-interface` lines are the ones that took me longest to find. Without them, you can have every right port open and pod networking still won't work cross-node. This is the single thing I'd put on the front page of any "k3s on Oracle Linux" guide.

The other Oracle Linux quirk: `iptables` is the legacy variant by default, but Flannel works fine with it. I added `iptables` to the package list explicitly in cloud-init to guarantee it's there before k3s installs.

## Ingress without a LoadBalancer

Oracle's Always Free tier doesn't include a managed Network Load Balancer. The first 10 Mbps load balancer is free elsewhere on OCI, but in Always Free, you don't get one. So when k3s installs Traefik with the default `Service: LoadBalancer`, it sits forever in `Pending` state because there's no provisioner to give it an external IP.

The clean fix is to run Traefik as a `DaemonSet` with `hostNetwork: true`. That makes Traefik bind to ports 80 and 443 directly on each node's host network — no Service object, no external IP needed. DNS points `*.istos.dev` at both node public IPs, and either node will answer.

K3s makes this override easy because it ships with a `HelmChartConfig` reconciler. You drop a YAML in the cluster and k3s reconciles its bundled Traefik chart to match:

```yaml
apiVersion: helm.cattle.io/v1
kind: HelmChartConfig
metadata:
  name: traefik
  namespace: kube-system
spec:
  valuesContent: |-
    hostNetwork: true
    deployment:
      kind: DaemonSet
    ports:
      web:
        port: 80
      websecure:
        port: 443
    service:
      type: ClusterIP
    securityContext:
      capabilities:
        add:
          - NET_BIND_SERVICE
        drop:
          - ALL
      runAsNonRoot: false
      runAsUser: 0
```

`hostNetwork: true` plus `service.type: ClusterIP` is the magic combination. The Service still exists for in-cluster routing, but external traffic comes in directly on the node ports.

There's a subtle consequence: because Traefik runs in the host network, the source IP of ingress traffic seen by your application pods is *not* a pod selector. Same-node traffic appears to come from `10.42.x.1` (the cni0 bridge), and cross-node traffic comes from the node's IP in `10.0.2.0/24`. So if you write a NetworkPolicy to allow Traefik, you have to whitelist those CIDRs:

```yaml
ingress:
  - from:
      - ipBlock:
          cidr: 10.42.0.0/16  # cni0 bridge (same-node)
      - ipBlock:
          cidr: 10.0.2.0/24   # nodes (cross-node)
```

I lost an evening to this once. A `podSelector: matchLabels: app: traefik` looks correct and does exactly nothing.

## Free TLS without an email tax

Cert-manager with the Let's Encrypt DNS-01 solver via Cloudflare. The Cloudflare API token is a Secret, the `ClusterIssuer` references it, and a single `Certificate` resource issues a wildcard cert for `*.istos.dev` and `istos.dev` in one go. DNS-01 means I never have to expose port 80 to ACME challenge servers — the verification happens entirely through Cloudflare's API.

```yaml
apiVersion: cert-manager.io/v1
kind: ClusterIssuer
metadata:
  name: letsencrypt-prod
spec:
  acme:
    server: https://acme-v02.api.letsencrypt.org/directory
    email: <my-email>
    solvers:
      - dns01:
          cloudflare:
            apiTokenSecretRef:
              name: cloudflare-api-token
              key: api-token
```

Cloudflare DNS itself is free, and Terraform manages the records — so the apex and wildcard A records pointing at the two node public IPs come up the same time the cluster does.

## The free container registry trick

I needed somewhere to push container images for the cluster to pull. Docker Hub's free tier has rate limits I didn't want to fight, GHCR is fine but adds auth setup. I use [ttl.sh](https://ttl.sh) — an anonymous, ephemeral container registry where images expire after a configurable TTL.

The deployment manifest references it directly:

```yaml
containers:
  - name: nginx
    image: ttl.sh/marios-personal-site:1h
    imagePullPolicy: Always
```

Push a new image, the tag expires in an hour, the cluster pulls fresh on the next rollout. For a personal site that I redeploy occasionally, this is friction-free and free. For anything I want long-lived, I'd use GHCR, but for "ship a static site to a free cluster" it's perfect.

## What it actually costs

Zero per month, with caveats. The cluster itself is genuinely $0 — compute, MySQL, networking, DNS, TLS, registry. The asterisks:

- **Domain.** `istos.dev` is ~$15/year. Not the cluster's fault, but you do need a domain to point at it.
- **Time.** First-time setup took me a couple of evenings — most of that lost to the firewalld issue and figuring out the hostNetwork-plus-NetworkPolicy interaction.
- **Reclamation risk.** Idle Always Free resources can be reclaimed. A live cluster with running pods doesn't qualify as idle, so this hasn't bitten me, but it's a real Oracle policy.

## What I'd do differently next time

The cluster has not been running for very long, so this is "things I already see I'd change," not battle-tested wisdom. With that caveat:

- **Three nodes, not two.** I have 1 unused OCPU and 6 GB of RAM in my Always Free budget. A third tiny node would let me drain and reboot the other two without dropping ingress. I'll add it.
- **External secrets.** Right now Cloudflare API token and DB credentials are plain Kubernetes Secrets. Sealed-secrets or external-secrets with a free backend would close that loop.
- **Backups.** MySQL HeatWave Free has automated backups, but I haven't tested a restore. That's the most important thing on the to-do list.
- **Skip the ingress detour.** Honestly, for a single static site, just running nginx in `hostNetwork` on both nodes would be simpler than Traefik + cert-manager + Cloudflare DNS-01. I went with the full ingress stack because I wanted the cluster to grow into more services, but for one app it's overkill.

## Frequently Asked Questions

### Can you really run production workloads on Oracle Cloud Always Free?

For personal projects and small services, yes. The Always Free tier is permanent and includes 4 ARM cores plus 24 GB of RAM ([Oracle](https://www.oracle.com/cloud/free/), 2026). The bigger constraints are no managed load balancer in always-free and the reclamation policy for idle resources — both manageable but not invisible.

### Why k3s instead of microk8s or kubeadm?

k3s is a single binary, runs in roughly 512 MB of RAM ([k3s.io](https://docs.k3s.io/), 2026), ships with sensible defaults (Flannel, Traefik, local-path-provisioner), and supports ARM64 cleanly. microk8s is also good but its snap-based install is heavier on a small node. kubeadm gives you more control but you pay for it in memory and operational overhead.

### Do I need Terraform for this?

No, but you'll regret not using it the first time you have to rebuild. The whole stack — VCN attachments, two compute instances, MySQL, DNS, SSH keys — is a few hundred lines of HCL. After that, `terraform destroy` and `terraform apply` give you a clean cluster in about eight minutes.

### What's the catch with the OCI free tier?

Three things: ARM A1 capacity can be tight in popular regions, idle resources may be reclaimed (a running cluster is not idle), and there's no managed Network Load Balancer in the always-free SKUs. The first you fix by region choice, the second by having actual workloads, the third by running ingress on `hostNetwork`.

### Can I host a database too?

Yes. MySQL HeatWave Free is part of the Always Free tier — 50 GB on a private subnet ([Oracle](https://www.oracle.com/cloud/free/), 2026). I have apps in the cluster connect to it directly by private IP. For PostgreSQL or anything else, you'd run it in-cluster on the local-path-provisioner, or use a separate free-tier service like Neon or Supabase.

## Wrap-up

A free Kubernetes cluster on Oracle Cloud isn't a hack or a toy — it's a real environment that runs real services, with the same kubectl, the same manifests, and the same patterns you'd use anywhere. The ceiling is lower (4 cores, 24 GB) but the floor is solid.

The pieces that surprised me most were the Oracle Linux firewalld dance and the hostNetwork + NetworkPolicy CIDR interaction. Both are documented somewhere on the internet, but neither is in the obvious place when you go looking. If this post saves one person an evening of Flannel debugging, it was worth writing.

If you want to try it: pick a region with ARM A1 capacity, write a tiny Terraform module for two `VM.Standard.A1.Flex` instances, install k3s with one curl on each, override Traefik to a `DaemonSet` with `hostNetwork: true`, and point a domain at your nodes through Cloudflare. That's the whole thing.

---

*Sources:*
*Oracle, "Oracle Cloud Free Tier", retrieved 2026-05-04, https://www.oracle.com/cloud/free/*
*k3s, "Architecture and Resource Profile", retrieved 2026-05-04, https://docs.k3s.io/*
