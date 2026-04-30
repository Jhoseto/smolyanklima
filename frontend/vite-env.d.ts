/// <reference types="vite/client" />

interface ImportMetaEnv {
  // Keep custom env typings empty intentionally:
  // AI is server-side and does not use VITE_* variables.
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
