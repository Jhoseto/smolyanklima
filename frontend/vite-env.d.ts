/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** Base URL на Next админ (без накрайна /). Пример: https://api.smolyanklima.bg */
  readonly VITE_ADMIN_ORIGIN?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
