import { useUiStore } from "../stores/ui"

export class ApiError extends Error {
  status: number
  details?: unknown

  constructor(status: number, message: string, details?: unknown) {
    super(message)
    this.status = status
    this.details = details
  }
}

let getToken: () => string | null = () => null
let onUnauthorized: () => void = () => {}

export function configureApi(opts: {
  getToken: () => string | null
  onUnauthorized: () => void
}) {
  getToken = opts.getToken
  onUnauthorized = opts.onUnauthorized
}

const BASE = (import.meta.env.VITE_API_URL as string | undefined) ?? ""

async function request<T>(method: string, path: string, body?: unknown): Promise<T> {
  const headers: Record<string, string> = {}
  if (body !== undefined) headers["Content-Type"] = "application/json"
  const token = getToken()
  if (token) headers.Authorization = `Bearer ${token}`

  let res: Response
  try {
    res = await fetch(BASE + "/api" + path, {
      method,
      headers,
      body: body !== undefined ? JSON.stringify(body) : undefined,
    })
  } catch {
    useUiStore.getState().setOnline(false)
    throw new ApiError(0, "Sin conexión con el servidor")
  }

  useUiStore.getState().setOnline(true)
  useUiStore.getState().touchSync()

  if (res.status === 401 && !path.startsWith("/auth/login") && !path.startsWith("/auth/users")) {
    onUnauthorized()
    throw new ApiError(401, "Sesión expirada")
  }

  const data = res.status === 204 ? null : await res.json().catch(() => null)
  if (!res.ok) {
    const err = data as { message?: string; details?: unknown } | null
    throw new ApiError(res.status, err?.message ?? "Error inesperado", err?.details)
  }
  return data as T
}

export const api = {
  get: <T,>(p: string) => request<T>("GET", p),
  post: <T,>(p: string, b?: unknown) => request<T>("POST", p, b),
  put: <T,>(p: string, b?: unknown) => request<T>("PUT", p, b),
  patch: <T,>(p: string, b?: unknown) => request<T>("PATCH", p, b),
  del: <T,>(p: string, b?: unknown) => request<T>("DELETE", p, b),
  delete: <T,>(p: string, b?: unknown) => request<T>("DELETE", p, b),
}
