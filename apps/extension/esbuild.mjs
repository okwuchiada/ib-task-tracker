import * as esbuild from 'esbuild';

const watch = process.argv.includes('--watch');

/** The extension and the git hook scripts are each bundled into one file with @task-tracker/shared inlined. */
const options = {
  entryPoints: {
    extension: 'src/extension.ts',
    'hooks/commit-msg': 'src/hooks/commit-msg.ts',
    'hooks/pre-push': 'src/hooks/pre-push.ts',
  },
  outdir: 'dist',
  bundle: true,
  platform: 'node',
  format: 'cjs',
  target: 'node18',
  external: ['vscode'],
  sourcemap: watch,
  minify: !watch,
  logLevel: 'info',
};

if (watch) {
  const ctx = await esbuild.context(options);
  await ctx.watch();
} else {
  await esbuild.build(options);
}
