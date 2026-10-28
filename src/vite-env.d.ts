/// <reference types="vite/client" />

// .env.local의 화면용 설정 (공개용 열쇠만. 관리용 열쇠는 VITE_를 붙이지 않아 화면에 들어오지 않는다)
interface ImportMetaEnv {
  readonly VITE_SUPABASE_URL?: string
  readonly VITE_SUPABASE_ANON_KEY?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
