import type { Project, Endpoint, Parameter } from '@helloapi/core'

export const exportOpenAPI = (project: Project): void => {
    const spec = convertToOpenAPI(project)
    const json = JSON.stringify(spec, null, 2)
    const blob = new Blob([json], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    const dateStr = new Date().toISOString().slice(0, 10).replace(/-/g, '')
    const safeTitle = project.info.title.replace(/[^\w가-힣-]/g, '_')
    a.href = url
    a.download = `${safeTitle}_${dateStr}_openapi.json`
    a.click()
    URL.revokeObjectURL(url)
}

const convertToOpenAPI = (project: Project) => {
    return {
        openapi: '3.0.0',
        info: {
            title: project.info.title,
            description: project.info.description ?? '',
            version: project.info.version,
        },
        servers: project.info.baseUrl
            ? [{ url: project.info.baseUrl }]
            : [],
        tags: project.tags.map(tag => ({ name: tag })),
        paths: buildPaths(project.endpoints),
    }
}

const buildPaths = (endpoints: Endpoint[]) => {
    const paths: Record<string, Record<string, unknown>> = {}

    for (const endpoint of endpoints) {
        const path = endpoint.path
        const method = endpoint.method.toLowerCase()

        if (!paths[path]) paths[path] = {}

        paths[path][method] = buildOperation(endpoint)
    }

    return paths
}

const buildOperation = (endpoint: Endpoint) => {
    const operation: Record<string, unknown> = {
        summary: endpoint.summary || '',
        tags: endpoint.tags,
        parameters: buildParameters(endpoint.parameters),
        responses: buildResponses(endpoint.responses),
    }

    if (endpoint.description) {
        operation.description = endpoint.description
    }

    if (endpoint.requestBody) {
        operation.requestBody = {
            required: endpoint.requestBody.required,
            content: {
                'application/json': {
                    schema: { type: 'object' },
                    ...(endpoint.requestBody.example
                        ? { example: tryParseJson(endpoint.requestBody.example) }
                        : {}),
                },
            },
        }
    }

    return operation
}

const buildParameters = (parameters: Parameter[]) => {
    return parameters.map(param => ({
        name: param.name,
        in: param.in,
        required: param.required,
        description: param.description ?? '',
        schema: { type: paramTypeToOpenAPI(param.type) },
    }))
}

const buildResponses = (responses: Endpoint['responses']) => {
    const result: Record<string, unknown> = {}

    for (const res of responses) {
        result[res.statusCode] = {
            description: res.description,
        }
    }

    return result
}

// helloAPI 타입 → OpenAPI 타입
const paramTypeToOpenAPI = (type: string): string => {
    const map: Record<string, string> = {
        string: 'string',
        integer: 'integer',
        number: 'number',
        boolean: 'boolean',
        array: 'array',
        object: 'object',
    }
    return map[type] ?? 'string'
}

// requestBody example이 JSON 문자열이면 파싱, 아니면 그대로
const tryParseJson = (value: string): unknown => {
    try {
        return JSON.parse(value)
    } catch {
        return value
    }
}