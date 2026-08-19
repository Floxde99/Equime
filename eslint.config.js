import js from '@eslint/js';
import prettier from 'eslint-config-prettier';
import importPlugin from 'eslint-plugin-import';
import react from 'eslint-plugin-react';
import reactHooks from 'eslint-plugin-react-hooks';
import globals from 'globals';

export default [
  {
    ignores: [
      '**/node_modules/**',
      '**/dist/**',
      '**/build/**',
      '**/coverage/**',
      'apps/api/generated/**',
    ],
  },

  js.configs.recommended,

  // Règles communes à tout le monorepo (ESM, Node 22)
  {
    files: ['**/*.{js,jsx}'],
    plugins: { import: importPlugin },
    languageOptions: {
      ecmaVersion: 'latest',
      sourceType: 'module',
    },
    rules: {
      'no-unused-vars': ['error', { argsIgnorePattern: '^_', varsIgnorePattern: '^_' }],
      'no-console': ['warn', { allow: ['error'] }],
      eqeqeq: ['error', 'smart'],
      'import/order': [
        'warn',
        {
          groups: ['builtin', 'external', 'internal', 'parent', 'sibling', 'index'],
          'newlines-between': 'always',
          alphabetize: { order: 'asc', caseInsensitive: true },
        },
      ],
      'import/no-duplicates': 'error',
    },
  },

  // Backend + package partagé + fichiers de config racine : environnement Node
  {
    files: [
      'apps/api/**/*.js',
      'packages/**/*.js',
      '*.js',
      'playwright/**/*.mjs',
      'scripts/**/*.mjs',
    ],
    languageOptions: {
      globals: { ...globals.node },
    },
  },

  // Scripts d'outillage exécutés en CI : leur sortie console est le livrable
  {
    files: ['scripts/**/*.mjs'],
    rules: {
      'no-console': 'off',
    },
  },

  // Frontend : environnement navigateur + React
  {
    files: ['apps/web/**/*.{js,jsx}'],
    plugins: { react, 'react-hooks': reactHooks },
    languageOptions: {
      globals: { ...globals.browser },
      parserOptions: {
        ecmaFeatures: { jsx: true },
      },
    },
    settings: {
      react: { version: 'detect' },
    },
    rules: {
      ...react.configs.flat.recommended.rules,
      'react/react-in-jsx-scope': 'off',
      'react/prop-types': 'off',
      'react-hooks/rules-of-hooks': 'error',
      'react-hooks/exhaustive-deps': 'warn',
    },
  },

  // Fichiers de config web exécutés par Node (vite.config, etc.)
  {
    files: ['apps/web/*.js'],
    languageOptions: {
      globals: { ...globals.node },
    },
  },

  // Désactive les règles en conflit avec Prettier — toujours en dernier
  prettier,
];
