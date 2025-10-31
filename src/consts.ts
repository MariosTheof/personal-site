import type { Site, Metadata, Socials } from "./types";

export const SITE: Site = {
  NAME: "Marios Athanasiadis",
  EMAIL: "athmarios@gmail.com",
  NUM_POSTS_ON_HOMEPAGE: 3,
  NUM_WORKS_ON_HOMEPAGE: 3,
  NUM_PROJECTS_ON_HOMEPAGE: 3,
};

export const HOME: Metadata = {
  TITLE: "Home",
  DESCRIPTION: "Senior Site Reliability Engineer and DevOps specialist with expertise in cloud infrastructure, automation, and system reliability.",
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
    NAME: "github",
    HREF: "https://github.com/MariosTheof"
  },
  { 
    NAME: "linkedin",
    HREF: "https://linkedin.com/in/mariostheof",
  }
];
