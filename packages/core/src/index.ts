// 타입 정의 export
export type {
    ParameterIn,
    HttpMethod,
    ParameterType,
    Parameter,
    RequestBody,
    Response,
    Endpoint,
    ProjectInfo,
    Project,
} from './types'

// 유틸 export
export {
    generateId,
    now,
    extractPathParams,
    normalizePath,
    normalizeTag,
} from './utils'

// 파서 export
export { parseOpenAPI } from './parsers/openapi'
export { parseCurl } from './parsers/curl'
export { parseSpring } from './parsers/spring'
export { parseFastAPI } from './parsers/fastapi'
export { parseNestJS } from './parsers/nestjs'

// 유효성 검사 export
export { validateEndpoint } from './validators/endpoint'
export { validateProject } from './validators/project'
export type { ValidationError, ValidationResult } from './validators/endpoint'
export type { ProjectValidationResult } from './validators/project'

// TODO: 2차 확장 시 아래 export 추가
// export { exportSwagger } from './exporters/swagger'