import { fixupPluginRules } from '@eslint/compat';
import { FlatCompat } from '@eslint/eslintrc';
import javascript from '@eslint/js';
import pluginQuery from '@tanstack/eslint-plugin-query';
import eslintConfigPrettier from 'eslint-config-prettier';
import eslintPluginPrettier from 'eslint-plugin-prettier';
import react from 'eslint-plugin-react';
import reactHooks from 'eslint-plugin-react-hooks';
import reactRefresh from 'eslint-plugin-react-refresh';
import globals from 'globals';
import typescript from 'typescript-eslint';

const compat = new FlatCompat({
  baseDirectory: import.meta.dirname,
});

export default [
  { files: ['src/**/*.{js,mjs,cjs,ts,jsx,tsx}'] },
  { ignores: ['src/components/ui/'] },
  { languageOptions: { globals: globals.browser } },
  javascript.configs.recommended,
  ...typescript.configs.recommended,
  react.configs.flat.recommended,
  react.configs.flat['jsx-runtime'],
  ...pluginQuery.configs['flat/recommended'],
  ...compat.extends('airbnb'),
  ...compat.extends('@kesills/airbnb-typescript'),
  eslintConfigPrettier,
  {
    settings: {
      react: {
        pragma: 'React',
        version: 'detect',
      },
    },
    plugins: {
      'react-hooks': fixupPluginRules(reactHooks),
      'react-refresh': reactRefresh,
      prettier: eslintPluginPrettier,
    },
    rules: {
      ...reactHooks.configs.recommended.rules,
      'react/require-default-props': 'off', // handled by TypeScript
      'react/jsx-props-no-spreading': 'off', // handled by TypeScript
      'react-refresh/only-export-components': 'warn',
      'import/extensions': 'off',
      'react/react-in-jsx-scope': 'off',
      ...eslintConfigPrettier.rules,
      'prettier/prettier': 'error',
      '@stylistic/comma-dangle': 'off',
      'linebreak-style': ['error', 'unix'],
    },
    languageOptions: {
      parserOptions: {
        projectService: true,
        tsconfigRootDir: import.meta.dirname,
      },
    },
  },
];
