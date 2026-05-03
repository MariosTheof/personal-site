import { defineConfig } from "astro/config";
import mdx from "@astrojs/mdx";
import sitemap from "@astrojs/sitemap";
import tailwind from "@astrojs/tailwind";
import vue from "@astrojs/vue";

export default defineConfig({
  site: "https://marios.istos.dev",
  integrations: [mdx(), sitemap(), tailwind(), vue()],
  vite: {
    resolve: {
      alias: {
        "@": "/src",
        "@components": "/src/components",
        "@layouts": "/src/layouts", 
        "@lib": "/src/lib",
        "@consts": "/src/consts.ts"
      }
    }
  }
});
