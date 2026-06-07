// ZakupPro API Client — real integration
// Spec: "Получение списка по API. Маппинг UUID FinPro ↔ номер проекта ZakupPro (ПМXXXXXX)."

const ZAKUPPRO_API_URL = process.env.ZAKUPPRO_API_URL || 'https://zakuppro.ru/api/v1'
const ZAKUPPRO_API_KEY = process.env.ZAKUPPRO_API_KEY || ''

export interface ZakupProProject {
  id: string | number
  number: string          // ПМ000010
  name: string
  status: string          // lead | active | completed | cancelled
  contract_amount: number
  start_date: string | null
  end_date: string | null
  client_name?: string
  manager_name?: string
}

export interface ZakupProApiResponse {
  success: boolean
  data: ZakupProProject[]
  total?: number
  page?: number
  per_page?: number
  error?: string
}

export interface ZakupProSyncResult {
  fetched: number
  synced: number
  created: number
  updated: number
  skipped: number
  errors: Array<{ externalId: string; error: string }>
}

/**
 * Fetch all projects from ZakupPro API
 */
export async function fetchZakupProProjects(): Promise<ZakupProProject[]> {
  if (!ZAKUPPRO_API_KEY) {
    console.warn('[ZakupPro] API key not configured, using empty response')
    return []
  }

  const allProjects: ZakupProProject[] = []
  let page = 1
  const perPage = 50
  let hasMore = true

  while (hasMore) {
    try {
      const url = new URL(`${ZAKUPPRO_API_URL}/projects`)
      url.searchParams.set('page', String(page))
      url.searchParams.set('per_page', String(perPage))

      console.log(`[ZakupPro] Fetching page ${page} from ${url.toString()}`)

      const response = await fetch(url.toString(), {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${ZAKUPPRO_API_KEY}`,
          'X-API-Key': ZAKUPPRO_API_KEY,
          'Accept': 'application/json',
          'Content-Type': 'application/json',
        },
        signal: AbortSignal.timeout(30000), // 30s timeout
      })

      if (!response.ok) {
        const errorText = await response.text().catch(() => 'Unknown error')
        console.error(`[ZakupPro] API error ${response.status}: ${errorText}`)
        
        // If first page fails, throw; otherwise return what we have
        if (page === 1) {
          throw new Error(`ZakupPro API вернул ошибку ${response.status}: ${errorText}`)
        }
        break
      }

      const data: ZakupProApiResponse = await response.json()

      if (!data.success && data.error) {
        throw new Error(`ZakupPro API error: ${data.error}`)
      }

      const projects = data.data || []
      allProjects.push(...projects)

      // Check if there are more pages
      const total = data.total || 0
      if (projects.length < perPage || allProjects.length >= total) {
        hasMore = false
      } else {
        page++
      }
    } catch (error) {
      if (error instanceof TypeError && error.message.includes('fetch')) {
        console.error('[ZakupPro] Network error — API unavailable')
        throw new Error('Не удалось подключиться к ZakupPro API. Проверьте URL и доступность сервиса.')
      }
      throw error
    }
  }

  console.log(`[ZakupPro] Fetched ${allProjects.length} projects total`)
  return allProjects
}

/**
 * Fetch a single project by its external ID
 */
export async function fetchZakupProProject(externalId: string): Promise<ZakupProProject | null> {
  if (!ZAKUPPRO_API_KEY) return null

  try {
    const url = `${ZAKUPPRO_API_URL}/projects/${encodeURIComponent(externalId)}`

    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${ZAKUPPRO_API_KEY}`,
        'X-API-Key': ZAKUPPRO_API_KEY,
        'Accept': 'application/json',
      },
      signal: AbortSignal.timeout(15000),
    })

    if (response.status === 404) return null
    if (!response.ok) {
      throw new Error(`ZakupPro API error: ${response.status}`)
    }

    const data = await response.json()
    return data.data || data || null
  } catch (error) {
    console.error(`[ZakupPro] Error fetching project ${externalId}:`, error)
    return null
  }
}

/**
 * Map ZakupPro status to FinPro status
 */
export function mapZakupProStatus(zpStatus: string): string {
  const statusMap: Record<string, string> = {
    'новый': 'lead',
    'lead': 'lead',
    'в работе': 'active',
    'active': 'active',
    'в процессе': 'active',
    'завершен': 'completed',
    'completed': 'completed',
    'выполнен': 'completed',
    'отменен': 'cancelled',
    'cancelled': 'cancelled',
  }
  return statusMap[zpStatus.toLowerCase()] || 'lead'
}

/**
 * Validate ZakupPro API connectivity
 */
export async function validateZakupProConnection(): Promise<{
  connected: boolean
  message: string
  projectCount?: number
}> {
  if (!ZAKUPPRO_API_KEY) {
    return {
      connected: false,
      message: 'API-ключ ZakupPro не настроен',
    }
  }

  try {
    const url = `${ZAKUPPRO_API_URL}/projects?per_page=1`

    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${ZAKUPPRO_API_KEY}`,
        'X-API-Key': ZAKUPPRO_API_KEY,
        'Accept': 'application/json',
      },
      signal: AbortSignal.timeout(10000),
    })

    if (!response.ok) {
      return {
        connected: false,
        message: `API вернул статус ${response.status}`,
      }
    }

    const data: ZakupProApiResponse = await response.json()

    return {
      connected: true,
      message: 'Подключение успешно',
      projectCount: data.total,
    }
  } catch (error) {
    return {
      connected: false,
      message: error instanceof Error ? error.message : 'Ошибка подключения',
    }
  }
}
