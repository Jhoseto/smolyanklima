/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** Base URL на Next админ (без накрайна /). Пример: https://smolyanklima.com */
  readonly VITE_ADMIN_ORIGIN?: string;
  /** GA4 Measurement ID. Пример: G-E7G28G8K38 */
  readonly VITE_GA_MEASUREMENT_ID?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
