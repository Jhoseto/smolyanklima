/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_GEMINI_API_KEY: string
  readonly VITE_ENABLE_AI_ASSISTANT: string
  readonly VITE_AI_MAX_DAILY_REQUESTS: string
  readonly VITE_AI_MAX_TOKENS: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
