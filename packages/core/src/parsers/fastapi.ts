import type { Endpoint, HttpMethod, Parameter, ParameterType } from '../types'
import { generateId, normalizeTag } from '../utils'

// FastAPI 파일 내용을 엔드포인트 목록으로 변환
export const parseFastAPI = (source: string): Endpoint[] => {
    const endpoints: Endpoint[] = []
    const routerName = parseRouterName(source)
    const blocks = splitRouteBlocks(source, routerName)

    for (const block of blocks) {
        const endpoint = parseBlock(block)
        if (endpoint) endpoints.push(endpoint)
    }

    return endpoints
}

// 라우터 변수명 추출
// ex) router = APIRouter() → router
// ex) app = FastAPI() → app
const parseRouterName = (source: string): string => {
    const routerMatch = source.match(/(\w+)\s*=\s*APIRouter\s*\(/)
    if (routerMatch) return routerMatch[1]

    const appMatch = source.match(/(\w+)\s*=\s*FastAPI\s*\(/)
    if (appMatch) return appMatch[1]

    return 'app'
}

// 라우트 블록 단위로 분리
// @router.get ~ 다음 @router. 전까지
const splitRouteBlocks = (source: string, routerName: string): string[] => {
    const pattern = new RegExp(`@${routerName}\\.(get|post|put|patch|delete)`, 'gi')
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

// 라우트 블록 → 엔드포인트 변환
const parseBlock = (block: string): Endpoint | null => {
    const mapping = parseMappingInfo(block)
    if (!mapping) return null

    const funcSignature = parseFuncSignature(block)
    if (!funcSignature) return null

    const parameters = parseParameters(funcSignature, mapping.path)
    const requestBody = parseRequestBody(funcSignature)
    const summary = parseSummary(block)
    const tags = parseTags(block)

    return {
        id: generateId(),
        method: mapping.method,
        path: mapping.path,
        summary,
        description: parseDescription(block),
        tags,
        parameters,
        requestBody,
        responses: parseResponses(block),
    }
}

// 데코레이터에서 메서드 + 경로 추출
// ex) @router.get("/users/{id}", summary="유저 조회")
const parseMappingInfo = (block: string): { method: HttpMethod, path: string } | null => {
    const match = block.match(/@\w+\.(get|post|put|patch|delete)\s*\(\s*["']([^"']+)["']/)
    if (!match) return null

    return {
        method: match[1].toUpperCase() as HttpMethod,
        path: match[2],
    }
}

// 함수 시그니처 추출
// ex) async def get_user(id: int, name: str = Query(...)):
const parseFuncSignature = (block: string): string | null => {
    const match = block.match(/(?:async\s+)?def\s+\w+\s*\(([^)]*)\)/)
    return match ? match[1] : null
}

// 함수 파라미터 파싱
// path / query / header 구분
const parseParameters = (signature: string, path: string): Parameter[] => {
    const params: Parameter[] = []
    const pathParamNames = extractPathParamNames(path)

    // 파라미터 목록 분리 (콤마 기준, 중첩 괄호 고려)
    const paramList = splitParams(signature)

    for (const param of paramList) {
        const parsed = parseParam(param.trim(), pathParamNames)
        if (parsed) params.push(parsed)
    }

    return params
}

// 경로에서 파라미터 이름 추출
// ex) /users/{id}/posts/{postId} → ['id', 'postId']
const extractPathParamNames = (path: string): string[] => {
    const matches = path.match(/\{([^}]+)\}/g) ?? []
    return matches.map(m => m.replace(/[{}]/g, ''))
}

// 콤마로 파라미터 분리 (중첩 괄호 고려)
const splitParams = (signature: string): string[] => {
    const params: string[] = []
    let depth = 0
    let current = ''

    for (const char of signature) {
        if (char === '(' || char === '[') depth++
        else if (char === ')' || char === ']') depth--
        else if (char === ',' && depth === 0) {
            if (current.trim()) params.push(current.trim())
            current = ''
            continue
        }
        current += char
    }

    if (current.trim()) params.push(current.trim())
    return params
}

// 개별 파라미터 파싱
// ex) id: int → path 파라미터
// ex) name: str = Query(...) → query 파라미터
// ex) token: str = Header(...) → header 파라미터
// ex) body: UserCreate → requestBody (별도 처리)
const parseParam = (param: string, pathParams: string[]): Parameter | null => {
    // self, request 등 제외
    if (/^(self|cls|request|response|db|session)/.test(param)) return null

    // 이름 추출
    const nameMatch = param.match(/^(\w+)\s*:/)
    if (!nameMatch) return null
    const name = nameMatch[1]

    // 타입 추출
    const typeMatch = param.match(/:\s*(?:Optional\[)?(\w+)/)
    const rawType = typeMatch ? typeMatch[1] : 'str'
    const type = pythonTypeToParamType(rawType)

    // Depends, BackgroundTasks 등 FastAPI 내부 의존성 제외
    if (/Depends|BackgroundTasks|Request|Response/.test(param)) return null

    // Body 타입이면 requestBody로 처리 → null 반환 (parseRequestBody에서 처리)
    if (isBodyType(param, name, pathParams)) return null

    // Header() 여부
    if (param.includes('Header(')) {
        return { name, in: 'header', required: !param.includes('None'), type, description: '' }
    }

    // Cookie() 여부
    if (param.includes('Cookie(')) {
        return { name, in: 'cookie', required: !param.includes('None'), type, description: '' }
    }

    // path 파라미터 여부
    if (pathParams.includes(name) || param.includes('Path(')) {
        return { name, in: 'path', required: true, type, description: '' }
    }

    // Query() 또는 기본값 없는 파라미터 → query
    const required = !param.includes('=') || param.includes('Query(...)')
    return { name, in: 'query', required, type, description: '' }
}

// Body 타입 여부 판단
// path 파라미터도 아니고 Query/Header/Cookie도 아닌 Pydantic 모델이면 body
const isBodyType = (param: string, name: string, pathParams: string[]): boolean => {
    if (pathParams.includes(name)) return false
    if (/Query|Header|Cookie|Path/.test(param)) return false

    // 대문자로 시작하는 타입 = Pydantic 모델로 간주
    const typeMatch = param.match(/:\s*(?:Optional\[)?([A-Z]\w+)/)
    return !!typeMatch
}

// requestBody 추출
// 대문자로 시작하는 타입 파라미터 = Pydantic 모델
const parseRequestBody = (signature: string): Endpoint['requestBody'] => {
    const match = signature.match(/\w+\s*:\s*(?:Optional\[)?([A-Z]\w+)/)
    if (!match) return undefined

    return {
        required: true,
        description: match[1], // Pydantic 모델명
        example: '',
    }
}

// 데코레이터 또는 docstring에서 summary 추출
// ex) @router.get("/users", summary="유저 목록 조회")
const parseSummary = (block: string): string => {
    const summaryMatch = block.match(/summary\s*=\s*["']([^"']+)["']/)
    if (summaryMatch) return summaryMatch[1]

    // docstring 첫 줄
    const docMatch = block.match(/"""\s*\n?\s*([^"\n]+)/)
    if (docMatch) return docMatch[1].trim()

    return ''
}

// docstring에서 description 추출
const parseDescription = (block: string): string => {
    const match = block.match(/"""([\s\S]*?)"""/)
    if (!match) return ''
    const lines = match[1].trim().split('\n')
    // 첫 줄은 summary이므로 제외
    return lines.slice(1).join('\n').trim()
}

// 태그 추출
// ex) @router.get("/users", tags=["users"])
const parseTags = (block: string): string[] => {
    const match = block.match(/tags\s*=\s*\[([^\]]+)\]/)
    if (!match) return []

    return match[1]
        .split(',')
        .map(t => t.replace(/["']/g, '').trim())
        .filter(Boolean)
        .map(normalizeTag)
}

// response_model 또는 status_code에서 응답 추출
const parseResponses = (block: string): Endpoint['responses'] => {
    const responses: Endpoint['responses'] = []

    const statusMatch = block.match(/status_code\s*=\s*(\d+)/)
    const statusCode = statusMatch ? statusMatch[1] : '200'

    const responseModel = block.match(/response_model\s*=\s*(\w+)/)
    responses.push({
        statusCode,
        description: responseModel ? responseModel[1] : 'OK',
    })

    return responses
}

// Python 타입 → 내부 타입 변환
const pythonTypeToParamType = (pythonType: string): ParameterType => {
    const map: Record<string, ParameterType> = {
        str: 'string',
        int: 'integer',
        float: 'number',
        bool: 'boolean',
        list: 'array',
        List: 'array',
        dict: 'object',
        Dict: 'object',
        UUID: 'string',
        datetime: 'string',
    }
    return map[pythonType] ?? 'string'
}