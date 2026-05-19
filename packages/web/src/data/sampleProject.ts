import type { Project } from '@helloapi/core'

export const sampleProject: Project = {
    id: 'sample-project-001',
    info: {
        title: 'helloAPI Demo',
        description: 'helloAPI CLI로 자동 생성된 샘플 프로젝트입니다.',
        version: '1.0.0',
        baseUrl: 'https://api.example.com',
    },
    tags: ['Users', 'Posts'],
    endpoints: [
        {
            id: 'ep-001',
            method: 'GET',
            path: '/users',
            summary: '유저 목록 조회',
            description: '',
            tags: ['Users'],
            parameters: [
                { name: 'page', in: 'query', required: false, type: 'integer', description: '페이지 번호' },
                { name: 'size', in: 'query', required: false, type: 'integer', description: '페이지 크기' },
            ],
            responses: [{ statusCode: '200', description: 'OK' }],
        },
        {
            id: 'ep-002',
            method: 'GET',
            path: '/users/{id}',
            summary: '유저 상세 조회',
            description: '',
            tags: ['Users'],
            parameters: [
                { name: 'id', in: 'path', required: true, type: 'string', description: '유저 ID' },
            ],
            responses: [
                { statusCode: '200', description: 'OK' },
                { statusCode: '404', description: 'Not Found' },
            ],
        },
        {
            id: 'ep-003',
            method: 'POST',
            path: '/users',
            summary: '유저 생성',
            description: '',
            tags: ['Users'],
            parameters: [],
            requestBody: { required: true, description: 'CreateUserDto', example: '{\n  "email": "user@example.com",\n  "name": "홍길동"\n}' },
            responses: [
                { statusCode: '201', description: 'Created' },
                { statusCode: '400', description: 'Bad Request' },
            ],
        },
        {
            id: 'ep-004',
            method: 'DELETE',
            path: '/users/{id}',
            summary: '유저 삭제',
            description: '',
            tags: ['Users'],
            parameters: [
                { name: 'id', in: 'path', required: true, type: 'string', description: '유저 ID' },
            ],
            responses: [
                { statusCode: '204', description: 'No Content' },
                { statusCode: '404', description: 'Not Found' },
            ],
        },
        {
            id: 'ep-005',
            method: 'GET',
            path: '/posts',
            summary: '게시글 목록 조회',
            description: '',
            tags: ['Posts'],
            parameters: [
                { name: 'page', in: 'query', required: false, type: 'integer', description: '페이지 번호' },
            ],
            responses: [{ statusCode: '200', description: 'OK' }],
        },
        {
            id: 'ep-006',
            method: 'POST',
            path: '/posts',
            summary: '게시글 작성',
            description: '',
            tags: ['Posts'],
            parameters: [],
            requestBody: { required: true, description: 'CreatePostDto', example: '{\n  "title": "제목",\n  "content": "내용"\n}' },
            responses: [
                { statusCode: '201', description: 'Created' },
                { statusCode: '400', description: 'Bad Request' },
            ],
        },
        {
            id: 'ep-007',
            method: 'PUT',
            path: '/posts/{id}',
            summary: '게시글 수정',
            description: '',
            tags: ['Posts'],
            parameters: [
                { name: 'id', in: 'path', required: true, type: 'string', description: '게시글 ID' },
            ],
            requestBody: { required: true, description: 'UpdatePostDto', example: '{\n  "title": "수정된 제목",\n  "content": "수정된 내용"\n}' },
            responses: [
                { statusCode: '200', description: 'OK' },
                { statusCode: '404', description: 'Not Found' },
            ],
        },
    ],
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
}