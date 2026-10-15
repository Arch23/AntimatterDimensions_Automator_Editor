import { defineConfig, loadEnv } from "vite";

export default defineConfig(({ mode }) => {
  const configuredBase = loadEnv(mode, ".", "VITE_").VITE_BASE_PATH || "/";
  const normalizedBase = `/${configuredBase.replace(/^\/+|\/+$/g, "")}/`;

  return {
    base: configuredBase === "/" ? "/" : normalizedBase,
    optimizeDeps: {
      // This linked workspace entry is CommonJS; prebundle it so the browser
      // receives an ESM module with its named exports during development.
      include: ["@adme/automator-language", "@adme/automator-language/highlighting"],
      // Rebuild the linked package's prebundle on startup after language changes.
      force: true
    },
    build: {
      outDir: "dist",
      emptyOutDir: true
    }
  };
});
