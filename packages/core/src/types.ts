// API 파라미터 위치
export type ParameterIn = 'path' | 'query' | 'header' | 'cookie'

// HTTP 메서드
export type HttpMethod = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE' | 'HEAD' | 'OPTIONS'

// 파라미터 타입
export type ParameterType = 'string' | 'number' | 'integer' | 'boolean' | 'array' | 'object'

// 파라미터 정의
export interface Parameter {
    name: string
    in: ParameterIn
    required: boolean
    type: ParameterType
    format?: string       // ex) date-time, uuid, email
    example?: string
    description?: string
}

// 요청 바디
export interface RequestBody {
    description?: string
    required: boolean
    example?: string      // MVP: 텍스트 / TODO 2차: JSON Schema 지원
}

// 응답 정의
export interface Response {
    statusCode: string    // ex) 200, 400, 404
    description?: string
    example?: string      // MVP: 텍스트 / TODO 2차: JSON Schema 지원
}

// 엔드포인트
export interface Endpoint {
    id: string
    method: HttpMethod
    path: string
    summary?: string
    description?: string
    tags: string[]
    parameters: Parameter[]
    requestBody?: RequestBody
    responses: Response[]
}

// 프로젝트 기본 정보
export interface ProjectInfo {
    title: string
    description?: string
    version: string
    baseUrl?: string
}

// 프로젝트 전체
export interface Project {
    id: string
    info: ProjectInfo
    tags: string[]        // 엔드포인트 그룹핑 / xlsx 시트 분리 기준
    endpoints: Endpoint[]
    createdAt: string
    updatedAt: string
}

// TODO: 2차 확장 시 아래 타입 추가
// export interface Schema { ... }         // JSON Schema 정의
// export interface SecurityScheme { ... } // Auth 방식 정의
// export interface Server { ... }         // 서버 목록 정의