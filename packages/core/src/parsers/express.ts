import type { Endpoint, HttpMethod, Parameter } from '../types'
import { generateId, extractPathParams, normalizeTag } from '../utils'

// Express 라우터 파일 + 기본 경로 → 엔드포인트 목록 변환
// basePath: index.ts/app.ts 에서 추출한 app.use('/api/auth', ...) 경로
export const parseExpress = (source: string, basePath: string = ''): Endpoint[] => {
    const endpoints: Endpoint[] = []
    const lines = source.split('\n')
    const tag = normalizeTag(getTagFromBase(basePath))

    for (let i = 0; i < lines.length; i++) {
        const line = lines[i]
        const match = line.match(
            /router\.(get|post|put|patch|delete|head|options)\s*\(\s*['"`]([^'"`]+)['"`]/i
        )
        if (!match) continue

        const method = match[1].toUpperCase() as HttpMethod
        // Express :id → OpenAPI {id}
        const subPath = match[2].replace(/:([a-zA-Z_][a-zA-Z0-9_]*)/g, '{$1}')
        const fullPath = joinPaths(basePath, subPath)
        const summary = extractComment(lines, i)
        const pathParams = extractPathParams(fullPath)

        const parameters: Parameter[] = pathParams.map(name => ({
            name,
            in: 'path',
            required: true,
            type: 'string',
            description: '',
        }))

        endpoints.push({
            id: generateId(),
            method,
            path: fullPath,
            summary,
            description: '',
            tags: tag ? [tag] : [],
            parameters,
            requestBody: ['POST', 'PUT', 'PATCH'].includes(method)
                ? { required: true, description: '', example: '' }
                : undefined,
            responses: [{ statusCode: '200', description: 'OK' }],
        })
    }

    return endpoints
}

// app.use('/api/auth', authRoutes) 형태에서 라우트 파일 → base path 매핑 추출
// ex) { 'auth-routes': '/api/auth', 'expense-routes': '/api/expenses' }
export const parseExpressBasePaths = (appSource: string): Record<string, string> => {
    const map: Record<string, string> = {}

    // app.use('/api/auth', authRoutes) 또는 app.use('/api/auth', someVar)
    const pattern = /app\.use\s*\(\s*['"`]([^'"`]+)['"`]\s*,\s*([a-zA-Z_][a-zA-Z0-9_]*)/g

    let match
    while ((match = pattern.exec(appSource)) !== null) {
        const basePath = match[1]
        const varName = match[2]  // authRoutes, expenseRoutes 등

        // import { ... } from './routes/auth-routes' 에서 파일명 추출
        const importRegex = new RegExp(
            `import\\s+${varName}\\s+from\\s+['"\`][^'"\`]*\\/([^/'"\`]+)['"\`]`
        )
        const importMatch = appSource.match(importRegex)
        if (importMatch) {
            // 파일명 (확장자 제외)
            map[importMatch[1]] = basePath
        }
    }

    return map
}

// 경로 합치기: /api/auth + /:id → /api/auth/{id}
const joinPaths = (base: string, sub: string): string => {
    if (!sub || sub === '/') return base || '/'
    const joined = '/' + [base, sub].join('/').replace(/\/+/g, '/')
    return joined.replace(/\/$/, '') || '/'
}

// base path에서 태그 추출
// ex) /api/auth → Auth, /api/expenses → Expenses
const getTagFromBase = (basePath: string): string => {
    if (!basePath) return ''
    const parts = basePath.split('/').filter(Boolean)
    return parts[parts.length - 1] ?? ''
}

// 해당 줄 위의 주석 추출 (// 단행 주석)
const extractComment = (lines: string[], idx: number): string => {
    for (let i = idx - 1; i >= Math.max(0, idx - 3); i--) {
        const line = lines[i].trim()
        if (!line) continue
        if (line.startsWith('//')) {
            return line.replace(/^\/\/\s*/, '')
        }
        // 주석이 아닌 코드라면 중단
        if (!line.startsWith('*') && !line.startsWith('/*')) break
    }
    return ''
}
