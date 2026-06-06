// X-API-Key authentication for service-to-service calls
// Spec: "Используется X-API-Key для сервис-сервисного взаимодействия.
//        Проще в ротации, не требует инфраструктуры токенов."

const VALID_API_KEYS = process.env.API_KEYS?.split(',') || ['finpro-api-key-2026-dev']

export function validateApiKey(request: Request): boolean {
  const apiKey = request.headers.get('X-API-Key')
  if (!apiKey) return false
  return VALID_API_KEYS.includes(apiKey)
}

export function apiKeyOrSession(authResult: { authenticated: boolean; isApiKey: boolean }): boolean {
  return authResult.authenticated
}
