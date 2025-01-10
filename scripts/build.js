import esbuild from "esbuild";
import { readFileSync } from "fs";

const tsConfig = JSON.parse( readFileSync( new URL('../package.json', import.meta.url ) ) );

console.log( tsConfig );

esbuild
  .build({
      entryPoints: ['src/main.ts'],
      bundle: true,
      platform: 'node',
      outdir: 'build',
      format: 'esm',
      outExtension: { '.js': '.mjs' },
      tsconfigRaw: tsConfig
  })
  .catch(() => process.exit(1))
