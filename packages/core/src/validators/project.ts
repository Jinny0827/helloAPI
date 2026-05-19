import type { Project } from '../types'
import { validateEndpoint } from './endpoint'
import type { ValidationError, ValidationResult } from './endpoint'

export interface ProjectValidationResult {
    valid: boolean
    errors: ValidationError[]                          // 프로젝트 레벨 오류
    endpointErrors: Record<string, ValidationError[]>  // 엔드포인트별 오류 (key: endpoint.id)
}

// 프로젝트 전체 유효성 검사
export const validateProject = (project: Project): ProjectValidationResult => {
    const errors: ValidationError[] = []
    const endpointErrors: Record<string, ValidationError[]> = {}

    validateInfo(project, errors)
    validateEndpoints(project, errors, endpointErrors)
    validateTags(project, errors)

    const valid = errors.length === 0 && Object.keys(endpointErrors).length === 0

    return { valid, errors, endpointErrors }
}

// 프로젝트 기본 정보 검사
const validateInfo = (project: Project, errors: ValidationError[]) => {
    if (!project.info.title || !project.info.title.trim()) {
        errors.push({
            field: 'info.title',
            message: '프로젝트 제목이 입력되지 않았어요.',
            fix: '프로젝트 제목을 입력해주세요.',
        })
    }

    // baseUrl 형식 검사 (입력된 경우에만)
    if (project.info.baseUrl) {
        try {
            new URL(project.info.baseUrl)
        } catch {
            errors.push({
                field: 'info.baseUrl',
                message: 'Base URL 형식이 올바르지 않아요.',
                fix: 'https://api.example.com 형식으로 입력해주세요.',
            })
        }
    }
}

// 엔드포인트 목록 검사
const validateEndpoints = (
    project: Project,
    errors: ValidationError[],
    endpointErrors: Record<string, ValidationError[]>
) => {
    // 엔드포인트 없으면 xlsx 출력 불가
    if (project.endpoints.length === 0) {
        errors.push({
            field: 'endpoints',
            message: '엔드포인트가 없어요. xlsx를 출력하려면 최소 1개 이상 필요해요.',
            fix: '엔드포인트를 추가해주세요.',
        })
        return
    }

    // 중복 엔드포인트 검사 (method + path 조합)
    const seen = new Set<string>()
    for (const endpoint of project.endpoints) {
        const key = `${endpoint.method}:${endpoint.path}`
        if (seen.has(key)) {
            errors.push({
                field: 'endpoints',
                message: `${endpoint.method} ${endpoint.path} 엔드포인트가 중복 정의되어 있어요.`,
                fix: '중복된 엔드포인트를 제거하거나 path를 변경해주세요.',
            })
        }
        seen.add(key)
    }

    // 개별 엔드포인트 검사
    for (const endpoint of project.endpoints) {
        const result: ValidationResult = validateEndpoint(endpoint)
        if (!result.valid) {
            endpointErrors[endpoint.id] = result.errors
        }
    }
}

// 태그 검사
const validateTags = (project: Project, errors: ValidationError[]) => {
    // 엔드포인트에서 사용된 태그가 프로젝트 태그 목록에 없는 경우
    const projectTags = new Set(project.tags)
    const missingTags = new Set<string>()

    for (const endpoint of project.endpoints) {
        for (const tag of endpoint.tags) {
            if (!projectTags.has(tag)) missingTags.add(tag)
        }
    }

    for (const tag of missingTags) {
        errors.push({
            field: 'tags',
            message: `태그 "${tag}"가 엔드포인트에서 사용됐으나 프로젝트 태그 목록에 없어요.`,
            fix: `프로젝트 태그 목록에 "${tag}"를 추가해주세요.`,
        })
    }
}