import { useQuery } from '@tanstack/react-query'

interface HealthResponse {
  status: string
}

async function fetchHealth(): Promise<HealthResponse> {
  const response = await fetch('/health')
  if (!response.ok) {
    throw new Error(`Health check failed with status ${response.status}`)
  }
  return response.json()
}

export function HealthStatus() {
  const { data, isPending, isError } = useQuery({
    queryKey: ['health'],
    queryFn: fetchHealth,
  })

  if (isPending) {
    return <p>Verificando conexão com o backend…</p>
  }

  if (isError) {
    return <p>Backend indisponível</p>
  }

  return <p>Status do backend: {data.status}</p>
}
