/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** Set for static hosting (GitHub Pages): feedback opens this URL instead of posting to the server. */
  readonly VITE_FEEDBACK_URL?: string;
}
