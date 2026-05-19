import type { Endpoint, HttpMethod, Parameter, ParameterType } from '../types'
import { generateId, extractPathParams, normalizeTag } from '../utils'

// NestJS 컨트롤러 파일 내용을 엔드포인트 목록으로 변환
export const parseNestJS = (source: string): Endpoint[] => {
    const endpoints: Endpoint[] = []
    const classPath = parseClassPath(source)
    const classTag = parseClassTag(source)
    const blocks = splitMethodBlocks(source)

    for (const block of blocks) {
        const endpoint = parseBlock(block, classPath, classTag)
        if (endpoint) endpoints.push(endpoint)
    }

    return endpoints
}

// 클래스 레벨 @Controller 경로 추출
// ex) @Controller('users') → /users
// ex) @Controller() → ''
const parseClassPath = (source: string): string => {
    const match = source.match(/@Controller\s*\(\s*['"]?([^'")\s]*)['"]?\s*\)/)
    if (!match || !match[1]) return ''
    return '/' + match[1].replace(/^\//, '')
}

// 클래스 레벨 태그 추출
// ex) @ApiTags('users') → users
// 없으면 클래스명에서 추출
// ex) UsersController → Users
const parseClassTag = (source: string): string => {
    const apiTagMatch = source.match(/@ApiTags\s*\(\s*['"]([^'"]+)['"]\s*\)/)
    if (apiTagMatch) return normalizeTag(apiTagMatch[1])

    const classMatch = source.match(/class\s+(\w+)Controller/)
    if (classMatch) return normalizeTag(classMatch[1])

    return ''
}

// 메서드 블록 단위로 분리
// @Get ~ 다음 @Get/@Post 등 전까지
const splitMethodBlocks = (source: string): string[] => {
    const pattern = /@(Get|Post|Put|Patch|Delete|Head|Options)\s*\(/gi
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

// 메서드 블록 → 엔드포인트 변환
const parseBlock = (
    block: string,
    classPath: string,
    classTag: string
): Endpoint | null => {
    const mapping = parseMappingInfo(block)
    if (!mapping) return null

    const fullPath = joinPaths(classPath, mapping.path)
    const funcSignature = parseFuncSignature(block)
    const parameters = funcSignature
        ? parseParameters(funcSignature, fullPath)
        : []
    const requestBody = funcSignature
        ? parseRequestBody(funcSignature)
        : undefined
    const summary = parseSummary(block)
    const tags = parseMethodTags(block, classTag)

    return {
        id: generateId(),
        method: mapping.method,
        path: fullPath,
        summary,
        description: parseDescription(block),
        tags,
        parameters,
        requestBody,
        responses: parseResponses(block),
    }
}

// 데코레이터에서 메서드 + 경로 추출
// ex) @Get(':id') → { method: GET, path: /{id} }
// ex) @Post() → { method: POST, path: '' }
const parseMappingInfo = (block: string): { method: HttpMethod, path: string } | null => {
    const match = block.match(/@(Get|Post|Put|Patch|Delete|Head|Options)\s*\(\s*['"]?([^'")\s]*)['"]?\s*\)/)
    if (!match) return null

    return {
        method: match[1].toUpperCase() as HttpMethod,
        // Express 스타일 :id → OpenAPI 스타일 {id}
        path: match[2].replace(/:([a-zA-Z_][a-zA-Z0-9_]*)/g, '{$1}'),
    }
}

// 함수 시그니처 추출
// ex) async getUser(@Param('id') id: string, @Query('name') name: string)
const parseFuncSignature = (block: string): string | null => {
    const match = block.match(/(?:async\s+)?\w+\s*\(([^)]*)\)\s*(?::\s*\w+)?(?:\s*\{|$)/)
    return match ? match[1] : null
}

// 함수 파라미터 파싱
const parseParameters = (signature: string, path: string): Parameter[] => {
    const params: Parameter[] = []
    const pathParamNames = extractPathParams(path)
    const paramList = splitParams(signature)

    for (const param of paramList) {
        const parsed = parseParam(param.trim(), pathParamNames)
        if (parsed) params.push(parsed)
    }

    // path 파라미터 선언됐으나 누락된 경우 자동 추가
    for (const name of pathParamNames) {
        if (!params.find(p => p.name === name && p.in === 'path')) {
            params.push({ name, in: 'path', required: true, type: 'string', description: '' })
        }
    }

    return params
}

// 콤마로 파라미터 분리 (중첩 괄호 고려)
const splitParams = (signature: string): string[] => {
    const params: string[] = []
    let depth = 0
    let current = ''

    for (const char of signature) {
        if (char === '(' || char === '<') depth++
        else if (char === ')' || char === '>') depth--
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
// ex) @Param('id') id: string → path 파라미터
// ex) @Query('name') name: string → query 파라미터
// ex) @Headers('authorization') auth: string → header 파라미터
// ex) @Body() body: CreateUserDto → requestBody
const parseParam = (param: string, _pathParams: string[]): Parameter | null => {
    // @Body() → requestBody로 별도 처리
    if (param.includes('@Body(')) return null

    // @Param()
    const paramMatch = param.match(/@Param\s*\(\s*['"]([^'"]+)['"]\s*\)/)
    if (paramMatch) {
        const typeMatch = param.match(/:\s*(\w+)/)
        return {
            name: paramMatch[1],
            in: 'path',
            required: true,
            type: tsTypeToParamType(typeMatch ? typeMatch[1] : 'string'),
            description: '',
        }
    }

    // @Query()
    const queryMatch = param.match(/@Query\s*\(\s*['"]?([^'")\s]*)['"]?\s*\)/)
    if (queryMatch) {
        const name = queryMatch[1]
        const typeMatch = param.match(/:\s*(\w+)/)
        const isOptional = param.includes('?:')
        return {
            name: name || param.match(/\w+\s*\??:/)?.[0].replace(/[\s?:]/g, '') || '',
            in: 'query',
            required: !isOptional,
            type: tsTypeToParamType(typeMatch ? typeMatch[1] : 'string'),
            description: '',
        }
    }

    // @Headers()
    const headerMatch = param.match(/@Headers\s*\(\s*['"]?([^'")\s]*)['"]?\s*\)/)
    if (headerMatch) {
        const typeMatch = param.match(/:\s*(\w+)/)
        return {
            name: headerMatch[1] || 'headers',
            in: 'header',
            required: false,
            type: tsTypeToParamType(typeMatch ? typeMatch[1] : 'string'),
            description: '',
        }
    }

    return null
}

// @Body() → requestBody 추출
const parseRequestBody = (signature: string): Endpoint['requestBody'] => {
    const match = signature.match(/@Body\s*\(\s*\)\s*\w+\s*:\s*(\w+)/)
    if (!match) return undefined

    return {
        required: true,
        description: match[1], // DTO 클래스명
        example: '',
    }
}

// @ApiOperation(summary) 또는 JSDoc에서 summary 추출
const parseSummary = (block: string): string => {
    const apiOpMatch = block.match(/@ApiOperation\s*\(\s*\{[^}]*summary\s*:\s*['"]([^'"]+)['"]/)
    if (apiOpMatch) return apiOpMatch[1]

    const jsDocMatch = block.match(/\/\*\*\s*\n\s*\*\s*([^@\n*]+)/)
    if (jsDocMatch) return jsDocMatch[1].trim()

    return ''
}

// JSDoc description 추출
const parseDescription = (block: string): string => {
    const match = block.match(/@ApiOperation\s*\(\s*\{[^}]*description\s*:\s*['"]([^'"]+)['"]/)
    return match ? match[1] : ''
}

// 메서드 레벨 태그, 없으면 클래스 태그 사용
const parseMethodTags = (block: string, classTag: string): string[] => {
    const match = block.match(/@ApiTags\s*\(\s*['"]([^'"]+)['"]\s*\)/)
    if (match) return [normalizeTag(match[1])]
    return classTag ? [classTag] : []
}

// @ApiResponse에서 응답 추출
const parseResponses = (block: string): Endpoint['responses'] => {
    const responses: Endpoint['responses'] = []
    const pattern = /@ApiResponse\s*\(\s*\{[^}]*status\s*:\s*(\d+)[^}]*description\s*:\s*['"]([^'"]+)['"]/g

    let match
    while ((match = pattern.exec(block)) !== null) {
        responses.push({ statusCode: match[1], description: match[2] })
    }

    if (responses.length === 0) {
        responses.push({ statusCode: '200', description: 'OK' })
    }

    return responses
}

// 경로 합치기
// ex) /users + /:id → /users/{id}
const joinPaths = (base: string, sub: string): string => {
    if (!sub) return base || '/'
    return ('/' + [base, sub].join('/').replace(/\/+/g, '/')).replace(/\/$/, '') || '/'
}

// TypeScript 타입 → 내부 타입 변환
const tsTypeToParamType = (tsType: string): ParameterType => {
    const map: Record<string, ParameterType> = {
        string: 'string',
        String: 'string',
        number: 'number',
        Number: 'number',
        boolean: 'boolean',
        Boolean: 'boolean',
        any: 'string',
        unknown: 'string',
    }
    return map[tsType] ?? 'string'
}