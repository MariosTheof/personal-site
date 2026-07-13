import type { Site, Metadata, Socials, Skills } from "./types";

export const SITE: Site = {
  NAME: "Marios Athanasiadis",
  EMAIL: "athmarios@gmail.com",
  NUM_POSTS_ON_HOMEPAGE: 3,
  NUM_WORKS_ON_HOMEPAGE: 3,
  NUM_PROJECTS_ON_HOMEPAGE: 3,
};

export const HOME: Metadata = {
  TITLE: "Home",
  DESCRIPTION: "Senior SRE, infrastructure builder, and occasional writer. Currently at Kaizen Gaming.",
};

export const BLOG: Metadata = {
  TITLE: "Blog",
  DESCRIPTION: "A collection of articles on topics I am passionate about.",
};

export const WORK: Metadata = {
  TITLE: "Work",
  DESCRIPTION: "Where I have worked and what I have done.",
};

export const PROJECTS: Metadata = {
  TITLE: "Projects",
  DESCRIPTION: "A collection of my projects, with links to repositories and demos.",
};

export const SOCIALS: Socials = [
  {
    NAME: "github @MariosTheof",
    HREF: "https://github.com/MariosTheof",
  },
  {
    NAME: "linkedin",
    HREF: "https://linkedin.com/in/mariostheof",
  },
  {
    NAME: "rss",
    HREF: "/rss.xml",
  },
];

export const SKILLS: Skills = [
  { group: "Cloud", items: ["Azure", "AWS", "OCI", "GCP", "Vercel"] },
  { group: "IaC", items: ["Terraform", "Ansible", "cloud-init"] },
  { group: "Containers", items: ["Docker", "Kubernetes", "OpenShift", "k3s", "Helm", "ArgoCD"] },
  { group: "CI/CD", items: ["GitLab CI", "GitHub Actions", "Jenkins"] },
  { group: "Observability", items: ["Prometheus", "Grafana", "Loki", "VictoriaMetrics", "Graylog"] },
  { group: "Data", items: ["PostgreSQL", "MySQL", "SQLite", "Redis Cluster", "Clickhouse", "Databricks", "Kafka", "RabbitMQ"] },
  { group: "Networking & Edge", items: ["Cloudflare", "Fastly", "Traefik", "nginx", "Vault", "Signal Sciences"] },
  { group: "Languages", items: ["Python", "Go", "Bash", "TypeScript", "PHP / Laravel", "SQL", "HCL"] },
];
