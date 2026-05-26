import { defineConfig } from "astro/config";
import mdx from "@astrojs/mdx";
import sitemap from "@astrojs/sitemap";
import tailwind from "@astrojs/tailwind";
import vue from "@astrojs/vue";

function rehypeLazyImages() {
  return function(tree) {
    function walk(node) {
      if (node.type === "element" && node.tagName === "img") {
        node.properties = node.properties || {};
        if (!node.properties.loading) node.properties.loading = "lazy";
      }
      (node.children || []).forEach(walk);
    }
    walk(tree);
  };
}

export default defineConfig({
  site: "https://marios.istos.dev",
  integrations: [mdx(), sitemap(), tailwind(), vue()],
  markdown: {
    rehypePlugins: [rehypeLazyImages],
  },
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
