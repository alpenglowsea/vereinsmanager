import js from '@eslint/js';
import globals from 'globals';
import tseslint from 'typescript-eslint';
import reactHooks from 'eslint-plugin-react-hooks';
import prettierConfig from 'eslint-config-prettier';

/**
 * ESLint-Konfiguration für VereinsManager.
 *
 * Leitgedanke: ESLint sucht nach FEHLERN, nicht nach Formatierung.
 * Um Einrückung, Anführungszeichen und Zeilenumbrüche kümmert sich
 * Prettier — deshalb steht prettierConfig am Ende und schaltet alle
 * Stilregeln wieder ab, die sich sonst mit Prettier streiten würden.
 *
 * "error" bedeutet: mit hoher Wahrscheinlichkeit ein echter Bug.
 * "warn"  bedeutet: sollte man sich ansehen, blockiert aber nichts.
 */
export default tseslint.config(
  {
    // Nicht geprüft: generierter und fremder Code.
    ignores: [
      'dist/**',
      'build/**',
      'node_modules/**',
      'src-tauri/**',
      'public/**',
      'coverage/**',
    ],
  },

  js.configs.recommended,
  ...tseslint.configs.recommended,

  {
    files: ['**/*.{ts,tsx}'],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: 'module',
      globals: {
        ...globals.browser,
        ...globals.node,
      },
    },
    plugins: {
      'react-hooks': reactHooks,
    },
    rules: {
      // --- React-Hooks: hier stecken echte Bugs ---------------------
      // Hooks in Bedingungen oder Schleifen zerstören den internen
      // Zustand von React. Das ist nie beabsichtigt.
      'react-hooks/rules-of-hooks': 'error',
      // Fehlende Abhängigkeiten in useEffect führen zu veralteten
      // Daten auf dem Bildschirm. Vorerst nur Warnung, weil der
      // Bestand davon einige hat.
      'react-hooks/exhaustive-deps': 'warn',

      // --- Vorerst abgeschaltet ------------------------------------
      // Der geerbte Code nutzt "any" an vielen Stellen. Das anzugehen
      // ist ein eigenes Arbeitspaket; als Dauerrauschen wäre es nur
      // hinderlich.
      '@typescript-eslint/no-explicit-any': 'off',

      // Eine Typprüfung zu unterdrücken ist manchmal richtig — etwa bei
      // Browser-Schnittstellen, die im DOM-Standard fehlen. Ohne
      // Begründung ist es aber nie richtig, deshalb wird sie verlangt.
      '@typescript-eslint/ban-ts-comment': [
        'error',
        {
          'ts-ignore': 'allow-with-description',
          'ts-expect-error': 'allow-with-description',
          minimumDescriptionLength: 10,
        },
      ],

      // Bleibt ein Fehler. Ein Startwert, den ohnehin jeder Zweig
      // überschreibt, ist nicht nur überflüssig — er hebt eine Prüfung
      // auf: Vergisst später jemand einen Zweig, liefert die Variable
      // stillschweigend den Vorgabewert, statt dass TypeScript den
      // fehlenden Fall meldet. Eine Fehlermeldung beim Bauen ist einem
      // stillen Fehlverhalten im Betrieb immer vorzuziehen.
      'no-useless-assignment': 'error',

      // --- Auf Warnung heruntergestuft -----------------------------
      // Ungenutzte Variablen sind meist harmlos, manchmal aber ein
      // Hinweis auf vergessenen Code. Ein führender Unterstrich
      // markiert "absichtlich ungenutzt".
      '@typescript-eslint/no-unused-vars': [
        'warn',
        {
          argsIgnorePattern: '^_',
          varsIgnorePattern: '^_',
          caughtErrorsIgnorePattern: '^_',
          // "Alles ausser diesen Feldern" ist ein gängiges und gut lesbares
          // Muster:
          //
          //   const { is_split, splits, ...rest } = zeile;
          //
          // Die beiden genannten Namen sind hier gerade deshalb da, weil sie
          // NICHT weiterverwendet werden sollen — sie zu melden, dreht die
          // Absicht um. Genau für diesen Fall gibt es diese Einstellung.
          // Sie gilt nur für Namen, neben denen ein "...rest" steht;
          // gewöhnliche ungenutzte Variablen meldet die Regel weiterhin.
          ignoreRestSiblings: true,
        },
      ],

      // --- Echte Fehlerquellen -------------------------------------
      // Vergessenes await: eine Zusage, auf die niemand wartet.
      // Fehler darin verschwinden lautlos.
      'no-async-promise-executor': 'error',
      // Zuweisung statt Vergleich in einer Bedingung (= statt ===).
      'no-cond-assign': 'error',
      // Doppelte Schlüssel im Objekt: der zweite gewinnt stillschweigend.
      'no-dupe-keys': 'error',
      // Unerreichbarer Code nach return/throw.
      'no-unreachable': 'error',
      // Vergleich mit NaN funktioniert nie wie erwartet.
      'use-isnan': 'error',
      // == statt === (null ausgenommen, das ist gängige Praxis).
      eqeqeq: ['warn', 'always', { null: 'ignore' }],
      // Übriggebliebene Debug-Ausgaben. console.warn und console.error
      // sind erlaubt, die gehören zur Fehlerbehandlung.
      'no-console': ['warn', { allow: ['warn', 'error', 'info'] }],
    },
  },

  // Konfigurationsdateien laufen in Node, nicht im Browser.
  {
    files: ['*.config.{js,ts}', 'server.ts'],
    languageOptions: {
      globals: { ...globals.node },
    },
    rules: {
      'no-console': 'off',
    },
  },

  // MUSS als Letztes stehen: schaltet alle Stilregeln ab, die Prettier
  // bereits erledigt.
  prettierConfig
);
