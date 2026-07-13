module.exports = {
  root: true,
  env: { browser: true, es2021: true, node: true },
  extends: [
    'eslint:recommended',
    'plugin:react/recommended',
    'plugin:react-hooks/recommended',
  ],
  ignorePatterns: ['dist', 'node_modules', 'ar-data-sync', '.vercel'],
  parserOptions: {
    ecmaVersion: 'latest',
    sourceType: 'module',
    ecmaFeatures: { jsx: true },
  },
  settings: { react: { version: 'detect' } },
  plugins: ['react-refresh'],
  rules: {
    'react/prop-types': 'off',
    'react/react-in-jsx-scope': 'off',
    // react-three-fiber usa JSX para elementos Three.js (mesh, position, args, ...)
    // que não são propriedades DOM — esta regra não os reconhece e gera falsos positivos.
    'react/no-unknown-property': 'off',
    'react-refresh/only-export-components': ['warn', { allowConstantExport: true }],
    'no-unused-vars': ['warn', { argsIgnorePattern: '^_' }],
  },
  overrides: [
    {
      // Padrão idiomático React: contexto exporta Provider + hook de acesso
      // (useParlamento) e componentes utilitários pequenos exportam constantes
      // auxiliares — o HMR fica um pouco menos granular, mas é intencional.
      files: ['src/context/**/*.jsx', 'src/components/UI/InfoTooltip.jsx'],
      rules: { 'react-refresh/only-export-components': 'off' },
    },
  ],
};
