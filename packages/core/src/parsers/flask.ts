import type { Endpoint, HttpMethod, Parameter } from '../types'
import { generateId, normalizeTag } from '../utils'

// Flask 파일 내용을 엔드포인트 목록으로 변환
export const parseFlask = (source: string): Endpoint[] => {
    const endpoints: Endpoint[] = []
    const routerName = parseRouterName(source)
    const defaultTag = parseBlueprintTag(source)
    const blocks = splitRouteBlocks(source, routerName)

    for (const block of blocks) {
        const parsed = parseBlock(block, defaultTag)
        if (parsed.length > 0) endpoints.push(...parsed)
    }

    return endpoints
}

// 라우터 변수명 추출
// ex) bp = Blueprint('main', __name__) → bp
// ex) app = Flask(__name__) → app
const parseRouterName = (source: string): string => {
    const bpMatch = source.match(/(\w+)\s*=\s*Blueprint\s*\(/)
    if (bpMatch) return bpMatch[1]

    const appMatch = source.match(/(\w+)\s*=\s*Flask\s*\(/)
    if (appMatch) return appMatch[1]

    return 'app'
}

// Blueprint 이름에서 태그 추출
// ex) Blueprint('main', __name__) → Main
// ex) Blueprint('auth', __name__) → Auth
const parseBlueprintTag = (source: string): string => {
    const match = source.match(/Blueprint\s*\(\s*['"]([^'"]+)['"]/)
    return match ? normalizeTag(match[1]) : ''
}

// 라우트 블록 단위로 분리
// @bp.route ~ 다음 @bp.route 전까지
const splitRouteBlocks = (source: string, routerName: string): string[] => {
    const pattern = new RegExp(`@${routerName}\\.route\\s*\\(`, 'g')
    const indices: number[] = []

    let match
    while ((match = pattern.exec(source)) !== null) {
        indices.push(match.index)
    }

    return indices.map((start, i) => {
        const end = indices[i + 1] ?? source.length
        return source.slice(start, end)
    })
}

// 라우트 블록 → 엔드포인트 변환 (methods 여러 개면 여러 엔드포인트 생성)
const parseBlock = (block: string, defaultTag: string): Endpoint[] => {
    const mapping = parseMappingInfo(block)
    if (!mapping) return []

    const summary = parseSummary(block)
    const description = parseDescription(block)
    const tags = [defaultTag].filter(Boolean)
    const queryParams = parseQueryParams(block, mapping.path)
    const hasBody = detectRequestBody(block)

    return mapping.methods.map(method => {
        const pathParams = parsePathParams(mapping.path)

        return {
            id: generateId(),
            method,
            path: mapping.path,
            summary,
            description,
            tags,
            parameters: [...pathParams, ...queryParams],
            requestBody: hasBody && ['POST', 'PUT', 'PATCH'].includes(method)
                ? { required: true, description: '', example: '' }
                : undefined,
            responses: parseResponses(block),
        }
    })
}

// @bp.route('/path', methods=['GET', 'POST']) 파싱
const parseMappingInfo = (block: string): { path: string; methods: HttpMethod[] } | null => {
    // 경로 추출
    const pathMatch = block.match(/@\w+\.route\s*\(\s*['"]([^'"]+)['"]/)
    if (!pathMatch) return null

    // Flask URL 파라미터 변환: <int:id> → {id}, <id> → {id}
    const path = pathMatch[1].replace(/<(?:\w+:)?(\w+)>/g, '{$1}')

    // methods 배열 추출 (없으면 기본 GET)
    const methodsMatch = block.match(/methods\s*=\s*\[([^\]]+)\]/)
    const methods: HttpMethod[] = methodsMatch
        ? methodsMatch[1]
            .split(',')
            .map(m => m.replace(/['"'\s]/g, '').toUpperCase() as HttpMethod)
            .filter(m => ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'HEAD', 'OPTIONS'].includes(m))
        : ['GET']

    return { path, methods }
}

// Path 파라미터 추출: {id}, {name} 등
const parsePathParams = (path: string): Parameter[] => {
    const matches = path.match(/\{([^}]+)\}/g) ?? []
    return matches.map(m => ({
        name: m.replace(/[{}]/g, ''),
        in: 'path' as const,
        required: true,
        type: 'string' as const,
        description: '',
    }))
}

// request.args.get('key') 호출에서 query 파라미터 추출
const parseQueryParams = (block: string, path: string): Parameter[] => {
    const params: Parameter[] = []
    const pathParamNames = (path.match(/\{([^}]+)\}/g) ?? []).map(m => m.replace(/[{}]/g, ''))

    const pattern = /request\.args\.get\s*\(\s*['"]([^'"]+)['"]\s*(?:,\s*([^)]+))?\)/g
    let match
    while ((match = pattern.exec(block)) !== null) {
        const name = match[1]
        // path 파라미터와 중복이면 skip
        if (pathParamNames.includes(name)) continue

        // 기본값이 있으면 optional
        const hasDefault = match[2] !== undefined
        params.push({
            name,
            in: 'query',
            required: !hasDefault,
            type: 'string',
            description: '',
        })
    }

    return params
}

// request.get_json() 또는 request.json 사용 시 requestBody 존재로 판단
const detectRequestBody = (block: string): boolean => {
    return /request\.(get_json|json|form|data)/.test(block)
}

// docstring 첫 줄을 summary로
// ex) """회사명 또는 종목코드로 기업 기본 정보 조회""" → 회사명 또는 종목코드로 기업 기본 정보 조회
const parseSummary = (block: string): string => {
    // 인라인 docstring: """한 줄"""
    const inlineMatch = block.match(/"""\s*([^"\n]+)\s*"""/)
    if (inlineMatch) return inlineMatch[1].trim()

    // 멀티라인 docstring: 첫 비어있지 않은 줄
    const multiMatch = block.match(/"""\s*\n\s*([^"\n]+)/)
    if (multiMatch) return multiMatch[1].trim()

    // 함수 위 # 주석
    const commentMatch = block.match(/# (.+)\n\s*def\s/)
    if (commentMatch) return commentMatch[1].trim()

    return ''
}

// docstring 전체에서 description 추출 (첫 줄 이후)
const parseDescription = (block: string): string => {
    const match = block.match(/"""([\s\S]*?)"""/)
    if (!match) return ''
    const lines = match[1].trim().split('\n')
    if (lines.length <= 1) return ''
    return lines.slice(1).join('\n').trim()
}

// return 의 상태 코드 추출
// ex) ), 400 → 400   ex) ), 404 → 404
const parseResponses = (block: string): Endpoint['responses'] => {
    const responses: Endpoint['responses'] = []
    const seen = new Set<string>()

    // return ...), 200 스타일
    const pattern = /\),\s*(\d{3})/g
    let match
    while ((match = pattern.exec(block)) !== null) {
        const code = match[1]
        if (!seen.has(code)) {
            seen.add(code)
            responses.push({
                statusCode: code,
                description: httpStatusText(code),
            })
        }
    }

    if (responses.length === 0) {
        responses.push({ statusCode: '200', description: 'OK' })
    }

    return responses
}

// HTTP 상태 코드 → 설명
const httpStatusText = (code: string): string => {
    const map: Record<string, string> = {
        '200': 'OK',
        '201': 'Created',
        '204': 'No Content',
        '400': 'Bad Request',
        '401': 'Unauthorized',
        '403': 'Forbidden',
        '404': 'Not Found',
        '409': 'Conflict',
        '422': 'Unprocessable Entity',
        '500': 'Internal Server Error',
    }
    return map[code] ?? 'OK'
}

