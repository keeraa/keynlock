import js from '@eslint/js';
import globals from 'globals';

// One set of rules for the 3D code. `npm run lint` in js/3d checks the parts
// that are maintained together: the Lair, the workshop packages, core/ and the
// Key Archive. Other scenes can opt in by being added to the lint script.
export default [
  {
    ignores: [
      '**/node_modules/**', '**/dist/**', '**/vendor/**', '**/*.min.js',
      '**/test-results/**',
      // The Lair's copy of the workbench; the workbench itself is developed in scenes/workbench.
      'scenes/lair/public/stations/workbench/**',
      // The Key Archive has no build step: its dist/ is the source (minus vendor).
      '!scenes/key-archive/dist/',
      '!scenes/key-archive/dist/**',
      'scenes/key-archive/dist/vendor/**',
    ],
  },
  js.configs.recommended,
  {
    languageOptions: {
      ecmaVersion: 'latest',
      sourceType: 'module',
      globals: { ...globals.browser },
    },
    rules: {
      // Unused arguments document callback shapes; unused variables are bugs or leftovers.
      'no-unused-vars': ['error', { args: 'none', caughtErrors: 'none', ignoreRestSiblings: true }],
      'no-empty': ['error', { allowEmptyCatch: true }],
    },
  },
  {
    // Node scripts, tests and build configs.
    files: ['**/scripts/**', '**/tests/**', '**/test/**', '**/*.config.js', '**/*.mjs'],
    languageOptions: { globals: { ...globals.node, ...globals.browser } },
  },
];
