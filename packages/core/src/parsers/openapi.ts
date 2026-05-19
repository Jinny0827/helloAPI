import type { Project, Endpoint, Parameter, Response, HttpMethod, ParameterType } from '../types'
import { generateId, now, extractPathParams, normalizeTag } from '../utils'

// OpenAPI 2.0 / 3.x JSON을 내부 모델로 변환
export const parseOpenAPI = (json: unknown): Project => {
    const spec = json as Record<string, unknown>

    // 버전 감지
    const isV3 = 'openapi' in spec
    const isV2 = 'swagger' in spec

    if (!isV3 && !isV2) {
        throw new Error('OpenAPI JSON 형식이 아닙니다. openapi 또는 swagger 필드가 필요해요.')
    }

    const info = parseInfo(spec)
    const baseUrl = parseBaseUrl(spec, isV3)
    const { endpoints, tags } = parsePaths(spec)

    return {
        id: generateId(),
        info: {
            title: info.title,
            description: info.description,
            version: info.version,
            baseUrl,
        },
        tags,
        endpoints,
        createdAt: now(),
        updatedAt: now(),
    }
}

// info 섹션 파싱
const parseInfo = (spec: Record<string, unknown>) => {
    const info = (spec.info ?? {}) as Record<string, unknown>
    return {
        title: (info.title as string) ?? '제목 없음',
        description: (info.description as string) ?? '',
        version: (info.version as string) ?? '1.0.0',
    }
}

// baseUrl 파싱 (v2 / v3 구조 다름)
const parseBaseUrl = (spec: Record<string, unknown>, isV3: boolean): string => {
    if (isV3) {
        const servers = spec.servers as Array<Record<string, unknown>> | undefined
        return (servers?.[0]?.url as string) ?? ''
    }
    // v2: host + basePath 조합
    const host = (spec.host as string) ?? ''
    const basePath = (spec.basePath as string) ?? ''
    return host ? `https://${host}${basePath}` : basePath
}

// paths 섹션 파싱 → 엔드포인트 목록 + 태그 목록 추출
const parsePaths = (spec: Record<string, unknown>): { endpoints: Endpoint[], tags: string[] } => {
    const paths = (spec.paths ?? {}) as Record<string, unknown>
    const endpoints: Endpoint[] = []
    const tagSet = new Set<string>()

    for (const [path, pathItem] of Object.entries(paths)) {
        const methods = ['get', 'post', 'put', 'patch', 'delete', 'head', 'options']

        for (const method of methods) {
            const operation = (pathItem as Record<string, unknown>)[method] as Record<string, unknown> | undefined
            if (!operation) continue

            const tags = ((operation.tags as string[]) ?? []).map(normalizeTag)
            tags.forEach(t => tagSet.add(t))

            const parameters = parseParameters(operation, path)
            const responses = parseResponses(operation)

            endpoints.push({
                id: generateId(),
                method: method.toUpperCase() as HttpMethod,
                path,
                summary: (operation.summary as string) ?? '',
                description: (operation.description as string) ?? '',
                tags,
                parameters,
                requestBody: parseRequestBody(operation),
                responses,
            })
        }
    }

    return { endpoints, tags: Array.from(tagSet) }
}

// 파라미터 파싱
const parseParameters = (operation: Record<string, unknown>, path: string): Parameter[] => {
    const raw = (operation.parameters as Array<Record<string, unknown>>) ?? []
    const pathParams = extractPathParams(path)
    const parsed: Parameter[] = []

    for (const p of raw) {
        const schema = (p.schema as Record<string, unknown>) ?? {}
        parsed.push({
            name: (p.name as string) ?? '',
            in: (p.in as Parameter['in']) ?? 'query',
            required: (p.required as boolean) ?? false,
            type: ((schema.type ?? p.type) as ParameterType) ?? 'string',
            format: (schema.format as string) ?? undefined,
            example: String(schema.example ?? p.example ?? ''),
            description: (p.description as string) ?? '',
        })
    }

    // path 파라미터 선언됐으나 parameters에 없는 경우 자동 추가
    for (const name of pathParams) {
        if (!parsed.find(p => p.name === name && p.in === 'path')) {
            parsed.push({
                name,
                in: 'path',
                required: true,
                type: 'string',
                description: '',
            })
        }
    }

    return parsed
}

// requestBody 파싱 (OpenAPI 3.x)
const parseRequestBody = (operation: Record<string, unknown>): Project['endpoints'][0]['requestBody'] => {
    const rb = operation.requestBody as Record<string, unknown> | undefined
    if (!rb) return undefined

    const content = (rb.content as Record<string, unknown>) ?? {}
    const jsonContent = (content['application/json'] as Record<string, unknown>) ?? {}
    const example = (jsonContent.example as string) ?? ''

    return {
        required: (rb.required as boolean) ?? false,
        description: (rb.description as string) ?? '',
        example: example ? JSON.stringify(example, null, 2) : '',
    }
}

// responses 파싱
const parseResponses = (operation: Record<string, unknown>): Response[] => {
    const raw = (operation.responses as Record<string, unknown>) ?? {}
    return Object.entries(raw).map(([statusCode, res]) => {
        const r = res as Record<string, unknown>
        return {
            statusCode,
            description: (r.description as string) ?? '',
        }
    })
}