import type { Endpoint, HttpMethod, Parameter, ParameterType } from '../types'
import { generateId, extractPathParams, normalizeTag } from '../utils'

// Spring 컨트롤러 파일 내용을 엔드포인트 목록으로 변환
export const parseSpring = (source: string): Endpoint[] => {
    const endpoints: Endpoint[] = []
    const classTag = parseClassTag(source)
    const classPath = parseClassPath(source)

    // 메서드 단위로 분리해서 파싱
    const methods = splitMethods(source)

    for (const method of methods) {
        const endpoint = parseMethod(method, classPath, classTag)
        if (endpoint) endpoints.push(endpoint)
    }

    return endpoints
}

// 클래스 레벨 @RequestMapping 경로 추출
// ex) @RequestMapping("/api/users") → /api/users
const parseClassPath = (source: string): string => {
    const match = source.match(/@RequestMapping\s*\(\s*(?:value\s*=\s*)?["']([^"']+)["']/)
    return match ? match[1] : ''
}

// 클래스 레벨 태그 추출
// ex) @Tag(name = "User") → User
// 없으면 클래스명에서 추출
// ex) UserController → User
const parseClassTag = (source: string): string => {
    const tagMatch = source.match(/@Tag\s*\(\s*name\s*=\s*["']([^"']+)["']/)
    if (tagMatch) return normalizeTag(tagMatch[1])

    const classMatch = source.match(/class\s+(\w+)Controller/)
    if (classMatch) return normalizeTag(classMatch[1])

    return ''
}

// 메서드 블록 단위로 분리
// @GetMapping ~ 다음 @Mapping 전까지
const splitMethods = (source: string): string[] => {
    const mappingPattern = /@(GetMapping|PostMapping|PutMapping|PatchMapping|DeleteMapping|RequestMapping)/g
    const indices: number[] = []

    let match
    while ((match = mappingPattern.exec(source)) !== null) {
        indices.push(match.index)
    }

    return indices.map((start, i) => {
        const end = indices[i + 1] ?? source.length
        return source.slice(start, end)
    })
}

// 메서드 블록 → 엔드포인트 변환
const parseMethod = (
    block: string,
    classPath: string,
    classTag: string
): Endpoint | null => {
    const mapping = parseMappingInfo(block)
    if (!mapping) return null

    const fullPath = normalizePath(classPath + mapping.path)
    const parameters = parseParameters(block, fullPath)
    const requestBody = parseRequestBody(block)
    const summary = parseSummary(block)
    const tags = parseMethodTags(block, classTag)

    return {
        id: generateId(),
        method: mapping.method,
        path: fullPath,
        summary,
        description: '',
        tags,
        parameters,
        requestBody,
        responses: [{ statusCode: '200', description: 'OK' }],
    }
}

// @GetMapping, @PostMapping 등에서 메서드 + 경로 추출
const parseMappingInfo = (block: string): { method: HttpMethod, path: string } | null => {
    const patterns: [RegExp, HttpMethod][] = [
        [/@GetMapping\s*\(?\s*(?:value\s*=\s*)?["']?([^"',)\s]*)["']?\s*\)?/, 'GET'],
        [/@PostMapping\s*\(?\s*(?:value\s*=\s*)?["']?([^"',)\s]*)["']?\s*\)?/, 'POST'],
        [/@PutMapping\s*\(?\s*(?:value\s*=\s*)?["']?([^"',)\s]*)["']?\s*\)?/, 'PUT'],
        [/@PatchMapping\s*\(?\s*(?:value\s*=\s*)?["']?([^"',)\s]*)["']?\s*\)?/, 'PATCH'],
        [/@DeleteMapping\s*\(?\s*(?:value\s*=\s*)?["']?([^"',)\s]*)["']?\s*\)?/, 'DELETE'],
    ]

    for (const [pattern, method] of patterns) {
        const match = block.match(pattern)
        if (match) return { method, path: match[1] || '/' }
    }

    // @RequestMapping(method = RequestMethod.GET, value = "/path")
    const reqMatch = block.match(/@RequestMapping\s*\(([^)]+)\)/)
    if (reqMatch) {
        const inner = reqMatch[1]
        const methodMatch = inner.match(/method\s*=\s*RequestMethod\.(\w+)/)
        const pathMatch = inner.match(/(?:value\s*=\s*)?["']([^"']+)["']/)
        if (methodMatch && pathMatch) {
            return {
                method: methodMatch[1] as HttpMethod,
                path: pathMatch[1],
            }
        }
    }

    return null
}

// 파라미터 추출
// @PathVariable, @RequestParam, @RequestHeader
const parseParameters = (block: string, path: string): Parameter[] => {
    const params: Parameter[] = []
    const pathParams = extractPathParams(path)

    // @PathVariable
    const pathVarPattern = /@PathVariable\s*(?:\([^)]*\))?\s*(\w+)\s+(\w+)/g
    let match
    while ((match = pathVarPattern.exec(block)) !== null) {
        params.push({
            name: match[2],
            in: 'path',
            required: true,
            type: javaTypeToParamType(match[1]),
            description: '',
        })
    }

    // @RequestParam
    const reqParamPattern = /@RequestParam\s*(?:\(([^)]*)\))?\s*(?:\w+\s+)?(\w+)\s*[,)]/g
    while ((match = reqParamPattern.exec(block)) !== null) {
        const options = match[1] ?? ''
        const name = parseParamName(options) || match[2]
        const required = !options.includes('required = false') && !options.includes('defaultValue')
        params.push({
            name,
            in: 'query',
            required,
            type: 'string',
            description: '',
        })
    }

    // @RequestHeader
    const headerPattern = /@RequestHeader\s*(?:\(([^)]*)\))?\s*(?:\w+\s+)?(\w+)\s*[,)]/g
    while ((match = headerPattern.exec(block)) !== null) {
        const options = match[1] ?? ''
        const name = parseParamName(options) || match[2]
        params.push({
            name,
            in: 'header',
            required: !options.includes('required = false'),
            type: 'string',
            description: '',
        })
    }

    // path 파라미터 선언됐으나 누락된 경우 자동 추가
    for (const name of pathParams) {
        if (!params.find(p => p.name === name && p.in === 'path')) {
            params.push({ name, in: 'path', required: true, type: 'string', description: '' })
        }
    }

    return params
}

// @RequestBody 추출
const parseRequestBody = (block: string): Endpoint['requestBody'] => {
    const match = block.match(/@RequestBody\s+(\w+)\s+(\w+)/)
    if (!match) return undefined
    return {
        required: true,
        description: match[1], // DTO 클래스명
        example: '',
    }
}

// @Operation(summary = "...") 또는 주석에서 summary 추출
const parseSummary = (block: string): string => {
    const operationMatch = block.match(/@Operation\s*\([^)]*summary\s*=\s*["']([^"']+)["']/)
    if (operationMatch) return operationMatch[1]

    // Javadoc 첫 줄
    const javadocMatch = block.match(/\/\*\*\s*\n\s*\*\s*([^@\n]+)/)
    if (javadocMatch) return javadocMatch[1].trim()

    return ''
}

// 메서드 레벨 태그 추출, 없으면 클래스 태그 사용
const parseMethodTags = (block: string, classTag: string): string[] => {
    const match = block.match(/@Tag\s*\(\s*name\s*=\s*["']([^"']+)["']/)
    if (match) return [normalizeTag(match[1])]
    return classTag ? [classTag] : []
}

// 어노테이션 옵션에서 name / value 추출
// ex) (name = "userId", required = false) → userId
const parseParamName = (options: string): string => {
    const match = options.match(/(?:name|value)\s*=\s*["']([^"']+)["']/)
    return match ? match[1] : ''
}

// Java 타입 → 내부 타입 변환
const javaTypeToParamType = (javaType: string): ParameterType => {
    const map: Record<string, ParameterType> = {
        String: 'string',
        Long: 'integer',
        long: 'integer',
        Integer: 'integer',
        int: 'integer',
        Double: 'number',
        double: 'number',
        Float: 'number',
        float: 'number',
        Boolean: 'boolean',
        bool: 'boolean',
        List: 'array',
        Array: 'array',
    }
    return map[javaType] ?? 'string'
}

// 경로 정규화
// ex) /users//posts → /users/posts
const normalizePath = (path: string): string => {
    return ('/' + path).replace(/\/+/g, '/')
}