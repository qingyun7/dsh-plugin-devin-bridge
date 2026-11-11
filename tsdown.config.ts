const host = {
  entry: { index: 'src/index.ts' },
  outDir: 'lib',
  format: ['esm'],
  platform: 'node',
  target: 'node22',
  dts: true,
  sourcemap: true,
  clean: true,
  deps: { neverBundle: [/^@deepseek-ai\//] },
  outExtensions: () => ({ js: '.js', dts: '.d.ts' }),
} as const

const client = {
  entry: { client: 'src/client/index.tsx' },
  outDir: 'lib',
  format: ['cjs'],
  platform: 'browser',
  target: 'es2022',
  dts: false,
  sourcemap: true,
  clean: false,
  deps: { neverBundle: ['react', 'react/jsx-runtime'] },
  outExtensions: () => ({ js: '.js' }),
  outputOptions: {
    banner: 'window.__ModuleLoader__.load({ id: "dsh-plugin-devin-bridge", factory: (require) => {',
    intro: 'var module = { exports: {} }; var exports = module.exports;',
    footer: 'return module.exports; } });',
  },
} as const

export default [host, client]
