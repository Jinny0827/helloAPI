import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { Project, Endpoint } from '@helloapi/core'
import { generateId, now, normalizePath } from '@helloapi/core'

interface ProjectStore {
    // 상태
    projects: Project[]
    activeProjectId: string | null

    // 프로젝트 CRUD
    createProject: (title: string) => Project
    updateProject: (id: string, partial: Partial<Project>) => void
    deleteProject: (id: string) => void
    setActiveProject: (id: string | null) => void

    // 엔드포인트 CRUD
    addEndpoint: (projectId: string, endpoint: Endpoint) => void
    updateEndpoint: (projectId: string, endpoint: Endpoint) => void
    deleteEndpoint: (projectId: string, endpointId: string) => void

    // import / export
    importProject: (project: Project) => void
    exportProject: (id: string) => Project | null

    // 헬퍼
    getActiveProject: () => Project | null
}

export const useProjectStore = create<ProjectStore>()(
    persist(
        (set, get) => ({
            projects: [],
            activeProjectId: null,

            createProject: (title) => {
                const project: Project = {
                    id: generateId(),
                    info: {
                        title,
                        description: '',
                        version: '1.0.0',
                        baseUrl: '',
                    },
                    tags: [],
                    endpoints: [],
                    createdAt: now(),
                    updatedAt: now(),
                }
                set(state => ({ projects: [...state.projects, project] }))
                return project
            },

            updateProject: (id, partial) => {
                set(state => ({
                    projects: state.projects.map(p =>
                        p.id === id ? { ...p, ...partial, updatedAt: now() } : p
                    ),
                }))
            },

            deleteProject: (id) => {
                set(state => ({
                    projects: state.projects.filter(p => p.id !== id),
                    activeProjectId: state.activeProjectId === id ? null : state.activeProjectId,
                }))
            },

            setActiveProject: (id) => {
                set({ activeProjectId: id })
            },

            addEndpoint: (projectId, endpoint) => {
                const ep = { ...endpoint, path: normalizePath(endpoint.path) }
                set(state => ({
                    projects: state.projects.map(p => {
                        if (p.id !== projectId) return p
                        const tags = mergeTag(p.tags, ep.tags)
                        return {
                            ...p,
                            endpoints: [...p.endpoints, ep],
                            tags,
                            updatedAt: now(),
                        }
                    }),
                }))
            },

            updateEndpoint: (projectId, endpoint) => {
                const ep = { ...endpoint, path: normalizePath(endpoint.path) }
                set(state => ({
                    projects: state.projects.map(p => {
                        if (p.id !== projectId) return p
                        const endpoints = p.endpoints.map(e =>
                            e.id === ep.id ? ep : e
                        )
                        const tags = mergeTag([], endpoints.flatMap(e => e.tags))
                        return { ...p, endpoints, tags, updatedAt: now() }
                    }),
                }))
            },

            deleteEndpoint: (projectId, endpointId) => {
                set(state => ({
                    projects: state.projects.map(p => {
                        if (p.id !== projectId) return p
                        const endpoints = p.endpoints.filter(e => e.id !== endpointId)
                        const tags = mergeTag([], endpoints.flatMap(e => e.tags))
                        return { ...p, endpoints, tags, updatedAt: now() }
                    }),
                }))
            },

            importProject: (project) => {
                const normalized = {
                    ...project,
                    endpoints: project.endpoints.map(e => ({ ...e, path: normalizePath(e.path) })),
                }
                // 이미 같은 id가 있으면 덮어쓰기
                set(state => {
                    const exists = state.projects.find(p => p.id === normalized.id)
                    if (exists) {
                        return {
                            projects: state.projects.map(p =>
                                p.id === normalized.id ? normalized : p
                            ),
                        }
                    }
                    return { projects: [...state.projects, normalized] }
                })
            },

            exportProject: (id) => {
                return get().projects.find(p => p.id === id) ?? null
            },

            getActiveProject: () => {
                const { projects, activeProjectId } = get()
                return projects.find(p => p.id === activeProjectId) ?? null
            },
        }),
        {
            name: 'helloapi-projects',
            migrate: (state: any) => {
                state.projects = (state.projects ?? []).map((p: any) => ({
                    ...p,
                    endpoints: (p.endpoints ?? []).map((e: any) => ({
                        ...e,
                        path: normalizePath(e.path ?? ''),
                    })),
                }))
                return state
            },
        }
    )
)

// 태그 병합 (중복 제거)
const mergeTag = (existing: string[], incoming: string[]): string[] => {
    return [...new Set([...existing, ...incoming])]
}