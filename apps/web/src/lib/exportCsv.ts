import { useAuthStore } from "@/stores/auth"

export async function downloadReportCsv(params: {
  shiftId?: string
  startDate?: string
  endDate?: string
  types?: string[]
}) {
  const query = new URLSearchParams()
  if (params.shiftId) query.set("shiftId", params.shiftId)
  if (params.startDate) query.set("startDate", params.startDate)
  if (params.endDate) query.set("endDate", params.endDate)
  if (params.types && params.types.length > 0) {
    query.set("types", params.types.join(","))
  }

  const token = useAuthStore.getState().token
  const res = await fetch(`/api/reports/export/csv?${query.toString()}`, {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  })

  if (!res.ok) {
    const errorData = await res.json().catch(() => ({ message: "Error al exportar reporte" }))
    throw new Error(errorData.message || "Error al exportar reporte")
  }

  const blob = await res.blob()
  const contentDisposition = res.headers.get("Content-Disposition")
  let filename = "openkiosco_reporte.csv"
  if (contentDisposition) {
    const match = contentDisposition.match(/filename="?([^";]+)"?/)
    if (match?.[1]) filename = match[1]
  }

  const url = window.URL.createObjectURL(blob)
  const a = document.createElement("a")
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  window.URL.revokeObjectURL(url)
}
