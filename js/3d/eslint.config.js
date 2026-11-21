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
  // Architecture: the Lair and the workshops talk through core/host/workshop-host.js.
  {
    files: ['workshops/**/src/**/*.js'],
    rules: {
      'no-restricted-syntax': ['error', {
        selector: "MemberExpression[object.name='window'][property.name=/^__/]",
        message: 'Workshops get what the Lair offers from core/host/workshop-host.js, not from window globals.',
      }, {
        selector: "MemberExpression[object.name='window'][property.name='parent']",
        message: 'Workshops are mounted in the room, not in an iframe: use core/host/workshop-host.js.',
      }],
      'no-restricted-imports': ['error', { patterns: [{
        group: ['**/scenes/**'],
        message: 'A workshop must not depend on the Lair or another scene; the Lair offers it what it needs through the host.',
      }] }],
    },
  },
  {
    // bridge.html: the published Atelier's storage page, which the published Lair
    // site opens in a cross-origin iframe. Talking to window.parent is its job.
    files: ['workshops/atelier/src/lair-bridge.js'],
    rules: { 'no-restricted-syntax': 'off' },
  },
  {
    files: ['scenes/lair/src/**/*.js'],
    rules: {
      'no-restricted-syntax': ['error', {
        // Two documented exceptions: the workbench iframe finds the shared renderer
        // through __keynlockRendererHost, and tests read __keynlockDebug.
        selector: "MemberExpression[object.name='window'][property.name=/^__/]:not([property.name=/^__keynlock(RendererHost|Debug)$/])",
        message: 'Offer workshops what they need through core/host/workshop-host.js, not window globals.',
      }],
    },
  },
  // Lair folders: room/ and rendering/ stand alone; workshops/ knows only the
  // host contract; navigation/ and ui/ sit on top. main.js wires them together.
  ...[
    ['room', ['workshops', 'navigation', 'ui', 'rendering']],
    ['rendering', ['room', 'workshops', 'navigation', 'ui']],
    ['workshops', ['room', 'navigation', 'ui', 'rendering']],
  ].map(([folder, forbidden]) => ({
    files: [`scenes/lair/src/${folder}/**/*.js`],
    rules: {
      'no-restricted-imports': ['error', { patterns: [{
        group: forbidden.map(name => `../${name}/*`),
        message: `scenes/lair/src/${folder}/ must not depend on ${forbidden.join(', ')}; see the Lair README.`,
      }] }],
    },
  })),
  {
    files: ['core/**/*.js'],
    rules: {
      'no-restricted-imports': ['error', { patterns: [{
        group: ['**/scenes/**', '**/workshops/**'],
        message: 'core/ is shared by every scene and must not depend on one.',
      }] }],
    },
  },
  {
    // Node scripts, tests and build configs.
    files: ['**/scripts/**', '**/tests/**', '**/test/**', '**/*.config.js', '**/*.mjs'],
    languageOptions: { globals: { ...globals.node, ...globals.browser } },
  },
];
