/**
 * Deno type declarations for VS Code
 * Silences linting errors for Deno runtime
 */

declare namespace Deno {
  export const env: {
    get(key: string): string | undefined;
  };
}

declare const performance: {
  now(): number;
};

