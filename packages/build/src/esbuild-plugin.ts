import type { Plugin } from "esbuild";
import fs from "fs/promises";

export function druidExtensionPlugin(): Plugin {
  return {
    name: "druid-extension",
    setup(build) {
      build.onLoad({ filter: /\.[jt]sx?$/ }, async (args) => {
        let code = await fs.readFile(args.path, "utf8");
        if (!code.includes("druid:ui/")) return;

        const transformNamed = (_: string, vars: string, name: string) => {
          const mapped = vars
            .split(",")
            .map((v) => {
              const [left, right] = v.split(/\s+as\s+/).map((s) => s.trim());
              return right ? `${left}: ${right}` : left;
            })
            .join(", ");
          return `const { ${mapped} } = window["druid-extension"]["${name}"];`;
        };

        code = code
          // named imports
          .replace(
            /import\s*{\s*([^}]+)\s*}\s*from\s*["'](druid:ui\/[^"']+)["'];?/g,
            transformNamed
          )
          // namespace imports
          .replace(
            /import\s+\*\s+as\s+([\w$]+)\s+from\s*["'](druid:ui\/[^"']+)["'];?/g,
            (_, id: string, name: string) =>
              `const ${id} = window["druid-extension"]["${name}"];`
          )
          // default imports
          .replace(
            /import\s+([\w$]+)\s+from\s*["'](druid:ui\/[^"']+)["'];?/g,
            (_, id: string, name: string) =>
              `const ${id} = window["druid-extension"]["${name}"];`
          );

        // choose loader based on file extension
        let loader: "ts" | "tsx" | "js" | "jsx" = "js";
        if (args.path.endsWith(".ts")) loader = "ts";
        else if (args.path.endsWith(".tsx")) loader = "tsx";
        else if (args.path.endsWith(".jsx")) loader = "jsx";

        return { contents: code, loader };
      });
    },
  };
}
