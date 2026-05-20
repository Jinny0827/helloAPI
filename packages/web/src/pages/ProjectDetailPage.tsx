import { useState } from 'react'
import { useProjectStore } from '../store/projectStore'
import { exportXlsx } from '../utils/exportXlsx'
import { validateProject } from '@helloapi/core'
import { exportOpenAPI } from '../utils/exportOpenAPI'
import EndpointList from '../components/EndpointList'
import EndpointForm from '../components/EndpointForm'
import ApiTester from '../components/ApiTester'
import type { Endpoint } from '@helloapi/core'

interface Props {
    onBack: () => void
}

type Tab = 'endpoints' | 'test'

export default function ProjectDetailPage({ onBack }: Props) {
    const { getActiveProject, updateProject } = useProjectStore()
    const project = getActiveProject()

    const [tab, setTab] = useState<Tab>('endpoints')
    const [showForm, setShowForm] = useState(false)
    const [editingEndpoint, setEditingEndpoint] = useState<Endpoint | null>(null)
    const [selectedEndpoint, setSelectedEndpoint] = useState<Endpoint | null>(null)

    if (!project) return null

    const handleExport = () => {
        const result = validateProject(project)
        if (!result.valid) {
            const messages = result.errors.map(e => `• ${e.message}`).join('\n')
            alert(`xlsx 출력 전 오류를 수정해주세요.\n\n${messages}`)
            return
        }
        exportXlsx(project)
    }

    const handleEditInfo = () => {
        const title = prompt('프로젝트 이름', project.info.title)
        if (!title?.trim()) return
        const baseUrl = prompt('Base URL', project.info.baseUrl ?? '')
        const version = prompt('버전', project.info.version)
        updateProject(project.id, {
            info: {
                ...project.info,
                title: title.trim(),
                baseUrl: baseUrl?.trim() ?? '',
                version: version?.trim() ?? project.info.version,
            },
        })
    }

    const handleAddEndpoint = () => {
        setEditingEndpoint(null)
        setShowForm(true)
    }

    const handleEditEndpoint = (endpoint: Endpoint) => {
        setEditingEndpoint(endpoint)
        setShowForm(true)
    }

    const handleTestEndpoint = (endpoint: Endpoint) => {
        setSelectedEndpoint(endpoint)
        setTab('test')
    }

    const handleFormClose = () => {
        setShowForm(false)
        setEditingEndpoint(null)
    }

    return (
        <div style={styles.container}>
            {/* 헤더 */}
            <div style={styles.header}>
                <div style={styles.headerLeft}>
                    <button style={styles.btnBack} onClick={onBack}>← 목록</button>
                    <div>
                        <div style={styles.titleRow}>
                            <h1 style={styles.title}>{project.info.title}</h1>
                            <span style={styles.version}>v{project.info.version}</span>
                            <button style={styles.btnEdit} onClick={handleEditInfo}>수정</button>
                        </div>
                        {project.info.baseUrl && (
                            <p style={styles.baseUrl}>{project.info.baseUrl}</p>
                        )}
                    </div>
                </div>
                <div style={styles.headerRight}>
                    <button style={styles.btnSecondary} onClick={handleAddEndpoint}>
                        + 엔드포인트
                    </button>
                    <button style={styles.btnSecondary} onClick={() => exportOpenAPI(project)}>
                        OpenAPI
                    </button>
                    <button style={styles.btnPrimary} onClick={handleExport}>
                        xlsx 출력
                    </button>
                </div>
            </div>

            {/* 탭 */}
            <div style={styles.tabs}>
                <button
                    style={{ ...styles.tab, ...(tab === 'endpoints' ? styles.tabActive : {}) }}
                    onClick={() => setTab('endpoints')}
                >
                    엔드포인트 {project.endpoints.length}개
                </button>
                <button
                    style={{ ...styles.tab, ...(tab === 'test' ? styles.tabActive : {}) }}
                    onClick={() => setTab('test')}
                >
                    API 테스트
                </button>
            </div>

            {/* 탭 컨텐츠 */}
            <div style={styles.content}>
                {tab === 'endpoints' && (
                    <EndpointList
                        project={project}
                        onEdit={handleEditEndpoint}
                        onTest={handleTestEndpoint}
                    />
                )}
                {tab === 'test' && (
                    <ApiTester
                        project={project}
                        initialEndpoint={selectedEndpoint}
                    />
                )}
            </div>

            {/* 엔드포인트 추가/수정 폼 */}
            {showForm && (
                <EndpointForm
                    project={project}
                    endpoint={editingEndpoint}
                    onClose={handleFormClose}
                />
            )}
        </div>
    )
}

const styles: Record<string, React.CSSProperties> = {
    container: {
        maxWidth: 1100,
        margin: '0 auto',
        padding: '32px 24px',
    },
    header: {
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'flex-start',
        marginBottom: 24,
    },
    headerLeft: {
        display: 'flex',
        alignItems: 'flex-start',
        gap: 16,
    },
    headerRight: {
        display: 'flex',
        gap: 8,
    },
    btnBack: {
        background: 'none',
        border: 'none',
        color: 'var(--color-text-secondary)',
        cursor: 'pointer',
        fontSize: 14,
        padding: '4px 0',
        marginTop: 4,
    },
    titleRow: {
        display: 'flex',
        alignItems: 'center',
        gap: 10,
        marginBottom: 4,
    },
    title: {
        fontSize: 22,
        fontWeight: 700,
    },
    version: {
        fontSize: 12,
        color: 'var(--color-text-secondary)',
        background: 'var(--color-surface)',
        padding: '2px 8px',
        borderRadius: 'var(--radius)',
        border: '1px solid var(--color-border)',
    },
    btnEdit: {
        background: 'none',
        border: 'none',
        color: 'var(--color-text-secondary)',
        cursor: 'pointer',
        fontSize: 12,
        textDecoration: 'underline',
    },
    baseUrl: {
        fontSize: 12,
        color: 'var(--color-primary)',
        fontFamily: 'monospace',
    },
    btnPrimary: {
        background: 'var(--color-primary)',
        color: '#fff',
        border: 'none',
        borderRadius: 'var(--radius)',
        padding: '8px 16px',
        fontWeight: 600,
        cursor: 'pointer',
    },
    btnSecondary: {
        background: 'var(--color-surface)',
        color: 'var(--color-text)',
        border: '1px solid var(--color-border)',
        borderRadius: 'var(--radius)',
        padding: '8px 16px',
        cursor: 'pointer',
    },
    tabs: {
        display: 'flex',
        gap: 4,
        borderBottom: '1px solid var(--color-border)',
        marginBottom: 24,
    },
    tab: {
        background: 'none',
        border: 'none',
        color: 'var(--color-text-secondary)',
        padding: '10px 16px',
        cursor: 'pointer',
        fontSize: 14,
        borderBottom: '2px solid transparent',
        marginBottom: -1,
    },
    tabActive: {
        color: 'var(--color-primary)',
        borderBottomColor: 'var(--color-primary)',
        fontWeight: 600,
    },
    content: {
        minHeight: 400,
    },
}