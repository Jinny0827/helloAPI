import type { Endpoint } from '../types'
import { extractPathParams } from '../utils'

export interface ValidationError {
    field: string
    message: string
    fix?: string       // 어떻게 고치는지 안내
}

export interface ValidationResult {
    valid: boolean
    errors: ValidationError[]
}

// 엔드포인트 유효성 검사
export const validateEndpoint = (endpoint: Endpoint): ValidationResult => {
    const errors: ValidationError[] = []

    validateMethod(endpoint, errors)
    validatePath(endpoint, errors)
    validatePathParams(endpoint, errors)
    validateParameters(endpoint, errors)
    validateRequestBody(endpoint, errors)
    validateResponses(endpoint, errors)

    return { valid: errors.length === 0, errors }
}

// method 검사
const validateMethod = (endpoint: Endpoint, errors: ValidationError[]) => {
    if (!endpoint.method) {
        errors.push({
            field: 'method',
            message: 'HTTP 메서드가 선택되지 않았어요.',
            fix: 'GET, POST, PUT, PATCH, DELETE 중 하나를 선택해주세요.',
        })
    }
}

// path 검사
const validatePath = (endpoint: Endpoint, errors: ValidationError[]) => {
    if (!endpoint.path) {
        errors.push({
            field: 'path',
            message: 'path가 입력되지 않았어요.',
            fix: '/users 또는 /users/{id} 형식으로 입력해주세요.',
        })
        return
    }

    // 슬래시로 시작하는지
    if (!endpoint.path.startsWith('/')) {
        errors.push({
            field: 'path',
            message: 'path는 /로 시작해야 해요.',
            fix: `/${endpoint.path} 로 수정해주세요.`,
        })
    }

    // 공백 포함 여부
    if (endpoint.path.includes(' ')) {
        errors.push({
            field: 'path',
            message: 'path에 공백이 포함되어 있어요.',
            fix: '공백을 제거하거나 %20으로 인코딩해주세요.',
        })
    }

    // 연속 슬래시
    if (endpoint.path.includes('//')) {
        errors.push({
            field: 'path',
            message: 'path에 연속된 슬래시(//)가 있어요.',
            fix: '슬래시를 하나로 줄여주세요.',
        })
    }
}

// path 파라미터 선언 일치 검사
// ex) path: /users/{id} 인데 parameters에 id가 없는 경우
const validatePathParams = (endpoint: Endpoint, errors: ValidationError[]) => {
    if (!endpoint.path) return

    const declaredInPath = extractPathParams(endpoint.path)
    const declaredInParams = endpoint.parameters
        .filter(p => p.in === 'path')
        .map(p => p.name)

    for (const name of declaredInPath) {
        if (!declaredInParams.includes(name)) {
            errors.push({
                field: 'parameters',
                message: `path 파라미터 {${name}}가 선언되어 있으나 Parameters에 정의되지 않았어요.`,
                fix: `Parameters에 name: ${name}, in: path 항목을 추가해주세요.`,
            })
        }
    }

    // 반대로 parameters에 path로 선언됐는데 path에 없는 경우
    for (const name of declaredInParams) {
        if (!declaredInPath.includes(name)) {
            errors.push({
                field: 'parameters',
                message: `Parameters에 path로 선언된 {${name}}가 path에 존재하지 않아요.`,
                fix: `path에 {${name}}를 추가하거나 파라미터의 in 값을 query로 변경해주세요.`,
            })
        }
    }
}

// 개별 파라미터 검사
const validateParameters = (endpoint: Endpoint, errors: ValidationError[]) => {
    endpoint.parameters.forEach((param, index) => {
        // 이름 공백
        if (!param.name || !param.name.trim()) {
            errors.push({
                field: `parameters[${index}].name`,
                message: `${index + 1}번째 파라미터 이름이 비어있어요.`,
                fix: '파라미터 이름을 입력해주세요.',
            })
        }

        // 이름에 공백 포함
        if (param.name && param.name.includes(' ')) {
            errors.push({
                field: `parameters[${index}].name`,
                message: `파라미터 이름 "${param.name}"에 공백이 포함되어 있어요.`,
                fix: '카멜케이스(userId) 또는 스네이크케이스(user_id)로 입력해주세요.',
            })
        }

        // in 값 검사
        const validIn = ['path', 'query', 'header', 'cookie']
        if (!validIn.includes(param.in)) {
            errors.push({
                field: `parameters[${index}].in`,
                message: `파라미터 위치 값이 올바르지 않아요. (현재: ${param.in})`,
                fix: `path, query, header, cookie 중 하나를 선택해주세요.`,
            })
        }

        // type 값 검사
        const validTypes = ['string', 'number', 'integer', 'boolean', 'array', 'object']
        if (!validTypes.includes(param.type)) {
            errors.push({
                field: `parameters[${index}].type`,
                message: `파라미터 타입 값이 올바르지 않아요. (현재: ${param.type})`,
                fix: `string, number, integer, boolean, array, object 중 하나를 선택해주세요.`,
            })
        }
    })
}

// requestBody 검사
const validateRequestBody = (endpoint: Endpoint, errors: ValidationError[]) => {
    if (!endpoint.requestBody) return

    // GET, DELETE는 body 불필요
    if (['GET', 'DELETE', 'HEAD'].includes(endpoint.method) && endpoint.requestBody) {
        errors.push({
            field: 'requestBody',
            message: `${endpoint.method} 메서드는 일반적으로 Request Body를 사용하지 않아요.`,
            fix: 'Request Body를 제거하거나 메서드를 POST / PUT / PATCH로 변경해주세요.',
        })
    }

    // example이 JSON 형식인지 검사
    if (endpoint.requestBody.example) {
        try {
            JSON.parse(endpoint.requestBody.example)
        } catch {
            errors.push({
                field: 'requestBody.example',
                message: 'Request Body example이 올바른 JSON 형식이 아니에요.',
                fix: '{"key": "value"} 형식으로 입력해주세요.',
            })
        }
    }
}

// responses 검사
const validateResponses = (endpoint: Endpoint, errors: ValidationError[]) => {
    // 중복 상태코드
    const statusCodes = endpoint.responses.map(r => r.statusCode)
    const duplicates = statusCodes.filter((code, i) => statusCodes.indexOf(code) !== i)

    for (const code of [...new Set(duplicates)]) {
        errors.push({
            field: 'responses',
            message: `상태코드 ${code}가 중복 정의되어 있어요.`,
            fix: `중복된 ${code} 응답 중 하나를 제거해주세요.`,
        })
    }

    // 상태코드 형식 검사
    endpoint.responses.forEach((res, index) => {
        if (!/^\d{3}$/.test(res.statusCode)) {
            errors.push({
                field: `responses[${index}].statusCode`,
                message: `상태코드 "${res.statusCode}"가 올바르지 않아요.`,
                fix: '200, 201, 400, 404, 500 같은 3자리 숫자로 입력해주세요.',
            })
        }
    })
}