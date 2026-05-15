// ID 생성 - 브라우저/Node.js 모두 호환
export const generateId = (): string => {
    if (typeof crypto !== 'undefined' && crypto.randomUUID) {
        return crypto.randomUUID()
    }
    // fallback
    return Math.random().toString(36).slice(2) + Date.now().toString(36)
}

// 현재 시각 ISO 문자열
export const now = (): string => new Date().toISOString()

// path 파라미터 추출
// ex) /users/{id}/posts/{postId} → ['id', 'postId']
export const extractPathParams = (path: string): string[] => {
    const matches = path.match(/\{([^}]+)\}/g)
    if (!matches) return []
    return matches.map(m => m.replace(/[{}]/g, ''))
}

// path 정규화
// ex) /users/:id → /users/{id} (Express 스타일 → OpenAPI 스타일)
export const normalizePath = (path: string): string => {
    return path.replace(/\/+/g, '/').replace(/^([^/])/, '/$1')
}

// 태그 정규화
export const normalizeTag = (tag: string): string => {
    return tag.trim()
}