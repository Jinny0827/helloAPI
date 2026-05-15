import type { Project } from '@helloapi/core'
import { parseOpenAPI } from '@helloapi/core'
import { generateId, now } from '@helloapi/core'


// spec.json 또는 Open API JSON 파일을 읽어서 Proejct로 변환
export const importFromFile = (file: File): Promise<Project> => {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();

        reader.onload = (e) => {
            try {
                const text = e.target?.result as string
                const json = JSON.parse(text);
                const project = detectAndParse(json);
                resolve(project);
            } catch (err) {
                reject(new Error(`파일을 읽을 수 없어요: ${(err as Error).message}`))
            }
        }

        reader.onerror = () => {
            reject(new Error('파일 읽기에 실패했어요. 다시 시도해주세요.'))
        }

        reader.readAsText(file);
    })
}


// JSON 형식 감지 후 파싱
// // 1. spec.json (helloAPI 내부 포맷) → 그대로 사용
// // 2. OpenAPI 2.0 / 3.x → parseOpenAPI로 변환
const detectAndParse = (json: unknown): Project => {
    const obj = json as Record<string, unknown>

    // helloAPI spec.json 포맷 감지
    // id, info, endpoints 필드가 있으면 내부 포맷으로 판단
    if (isHelloAPISpec(obj)) {
        return validateAndFill(obj as unknown as Project)
    }

    // OpenAPI 포맷 감지
    if (isOpenAPISpec(obj)) {
        return parseOpenAPI(json)
    }

    throw new Error(
        'OpenAPI JSON 형식이 아닙니다. ' +
        'openapi 또는 swagger 필드가 포함된 JSON 파일을 업로드해주세요.'
    )
}

// helloAPI 내부 포맷 여부 판단
const isHelloAPISpec = (obj: Record<string, unknown>): boolean => {
    return (
        typeof obj.id === 'string' &&
        typeof obj.info === 'object' &&
        Array.isArray(obj.endpoints)
    )
}

// OpenAPI 포맷 여부 판단
const isOpenAPISpec = (obj: Record<string, unknown>): boolean => {
    return 'openapi' in obj || 'swagger' in obj
}

// spec.json import 시 누락 필드 보완
// 버전 업 등으로 필드가 추가된 경우 기본값으로 채움
const validateAndFill = (project: Project): Project => {
    return {
        ...project,
        id: project.id ?? generateId(),
        tags: project.tags ?? [],
        endpoints: (project.endpoints ?? []).map(endpoint => ({
            ...endpoint,
            id: endpoint.id ?? generateId(),
            tags: endpoint.tags ?? [],
            parameters: endpoint.parameters ?? [],
            responses: endpoint.responses ?? [],
            summary: endpoint.summary ?? '',
            description: endpoint.description ?? '',
        })),
        createdAt: project.createdAt ?? now(),
        updatedAt: now(),
    }
}

// curl 문자열 → 프로젝트에 엔드포인트 추가용
// 웹앱에서 직접 호출
export const importFromCurl = async (curl: string): Promise<import('@helloapi/core').Endpoint> => {
    const { parseCurl } = await import('@helloapi/core')
    return parseCurl(curl)
}