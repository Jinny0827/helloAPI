import { Endpoint, HttpMethod, Parameter } from '../types'
import { generateId, normalizePath, extractPathParams } from '../utils'

// curl 문자열을 엔드포인트로 변환
export const parseCurl = (curl: string): Endpoint => {
    const cleaned = cleanCurl(curl)

    const method = parseMethod(cleaned)
    const url = parseUrl(cleaned)
    const { path, baseUrl } = parsePath(url)
    const headers = parseHeaders(cleaned)
    const queryParams = parseQueryParams(url)
    const body = parseBody(cleaned)

    const pathParams = extractPathParams(path).map<Parameter>(name => ({
        name,
        in: 'path',
        required: true,
        type: 'string',
        description: '',
    }))

    return {
        id: generateId(),
        method,
        path,
        summary: '',
        description: '',
        tags: [],
        parameters: [...pathParams, ...queryParams, ...headers],
        requestBody: body ? { required: true, description: '', example: body } : undefined,
        responses: [],
    }
}

// 멀티라인 curl 정리 (백슬래시 줄바꿈 제거)
const cleanCurl = (curl: string): string => {
    return curl
        .replace(/\\\n/g, ' ')
        .replace(/\s+/g, ' ')
        .trim()
}

// HTTP 메서드 추출
// ex) curl -X POST ... → POST
// 없으면 body 있으면 POST, 없으면 GET
const parseMethod = (curl: string): HttpMethod => {
    const match = curl.match(/-X\s+([A-Z]+)/i)
    if (match) return match[1].toUpperCase() as HttpMethod
    if (curl.includes('-d ') || curl.includes('--data')) return 'POST'
    return 'GET'
}

// URL 추출
const parseUrl = (curl: string): string => {
    // 따옴표 있는 URL
    const quoted = curl.match(/curl\s+['"]([^'"]+)['"]/i)
    if (quoted) return quoted[1]

    // 따옴표 없는 URL
    const plain = curl.match(/curl\s+(https?:\/\/[^\s]+)/i)
    if (plain) return plain[1]

    throw new Error('URL을 찾을 수 없습니다. curl 형식을 확인해주세요.')
}

// URL → path / baseUrl 분리
// ex) https://api.example.com/users/123?name=john
//   → path: /users/{id}, baseUrl: https://api.example.com
const parsePath = (url: string): { path: string, baseUrl: string } => {
    try {
        const parsed = new URL(url)
        const baseUrl = parsed.origin
        // 숫자로만 이루어진 세그먼트는 path 파라미터로 치환
        // ex) /users/123 → /users/{id}
        const path = normalizePath(
            parsed.pathname.replace(/\/(\d+)/g, '/{id}')
        )
        return { path, baseUrl }
    } catch {
        throw new Error('올바르지 않은 URL 형식입니다.')
    }
}

// 헤더 추출
// ex) -H "Authorization: Bearer token" → { name: Authorization, in: header }
const parseHeaders = (curl: string): Parameter[] => {
    const matches = curl.matchAll(/-H\s+['"]([^'"]+)['"]/gi)
    const headers: Parameter[] = []

    for (const match of matches) {
        const [name, ...valueParts] = match[1].split(':')
        const trimmedName = name.trim()

        // Content-Type은 파라미터가 아니라 body 형식 정보라 제외
        if (trimmedName.toLowerCase() === 'content-type') continue

        headers.push({
            name: trimmedName,
            in: 'header',
            required: false,
            type: 'string',
            example: valueParts.join(':').trim(),
            description: '',
        })
    }

    return headers
}

// 쿼리 파라미터 추출
// ex) /users?name=john&page=1 → [{ name: 'name' }, { name: 'page' }]
const parseQueryParams = (url: string): Parameter[] => {
    try {
        const parsed = new URL(url)
        const params: Parameter[] = []

        parsed.searchParams.forEach((value, name) => {
            params.push({
                name,
                in: 'query',
                required: false,
                type: 'string',
                example: value,
                description: '',
            })
        })

        return params
    } catch {
        return []
    }
}

// body 추출
// ex) -d '{"name":"john"}' → '{"name":"john"}'
const parseBody = (curl: string): string => {
    const match = curl.match(/(?:-d|--data|--data-raw)\s+['"]([^'"]+)['"]/i)
    if (!match) return ''

    try {
        // JSON이면 pretty print
        return JSON.stringify(JSON.parse(match[1]), null, 2)
    } catch {
        return match[1]
    }
}