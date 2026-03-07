import * as esbuild from 'esbuild';
import { copyFileSync, mkdirSync, existsSync } from 'fs';

const isWatch = process.argv.includes('--watch');

const buildOptions = {
  entryPoints: ['src/main.ts'],
  bundle: true,
  outfile: 'dist/main.js',
  format: 'iife',
  target: 'es2022',
  sourcemap: true,
  minify: !isWatch,
  loader: {
    '.png': 'dataurl',
    '.wav': 'dataurl',
    '.ogg': 'dataurl',
  },
  // Write to disk so serve can pick up index.html
  write: true,
};

mkdirSync('dist', { recursive: true });

// Always copy HTML to dist
copyFileSync('src/index.html', 'dist/index.html');

// Copy SWA config if present
if (existsSync('staticwebapp.config.json')) {
  copyFileSync('staticwebapp.config.json', 'dist/staticwebapp.config.json');
}

if (isWatch) {
  const ctx = await esbuild.context({
    ...buildOptions,
    minify: false,
    plugins: [{
      name: 'copy-html',
      setup(build) {
        build.onEnd(() => {
          copyFileSync('src/index.html', 'dist/index.html');
        });
      },
    }],
  });
  await ctx.watch();
  const { host, port } = await ctx.serve({ servedir: 'dist', port: 3000 });
  console.log(`Dev server: http://${host}:${port}`);
} else {
  await esbuild.build(buildOptions);
  console.log('Build complete → dist/');
}
