import { useRef } from 'react'
import { useProjectStore } from '../store/projectStore'
import { importFromFile } from '../utils/importSpec'
import type { Project } from '@helloapi/core'

interface Props {
    onSelectProject: (id: string) => void
}

export default function ProjectListPage({ onSelectProject }: Props) {
    const { projects, createProject, deleteProject, importProject } = useProjectStore()
    const fileInputRef = useRef<HTMLInputElement>(null)

    const handleCreate = () => {
        const title = prompt('프로젝트 이름을 입력해주세요.')
        if (!title?.trim()) return
        const project = createProject(title.trim())
        onSelectProject(project.id)
    }

    const handleImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0]
        if (!file) return

        try {
            const project = await importFromFile(file)
            importProject(project)
            onSelectProject(project.id)
        } catch (err) {
            alert((err as Error).message)
        } finally {
            e.target.value = ''
        }
    }

    const handleDelete = (e: React.MouseEvent, id: string, title: string) => {
        e.stopPropagation()
        if (!confirm(`"${title}" 프로젝트를 삭제할까요?`)) return
        deleteProject(id)
    }

    const handleExport = (e: React.MouseEvent, project: Project) => {
        e.stopPropagation()
        const json = JSON.stringify(project, null, 2)
        const blob = new Blob([json], { type: 'application/json' })
        const url = URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = url
        a.download = `${project.info.title}_spec.json`
        a.click()
        URL.revokeObjectURL(url)
    }

    return (
        <div style={styles.container}>
            {/* 헤더 */}
            <div style={styles.header}>
                <div>
                    <h1 style={styles.title}>helloAPI</h1>
                    <p style={styles.subtitle}>API 명세서를 빠르게 작성하고 테스트하세요</p>
                </div>
                <div style={styles.actions}>
                    <button style={styles.btnSecondary} onClick={() => fileInputRef.current?.click()}>
                        import
                    </button>
                    <button style={styles.btnPrimary} onClick={handleCreate}>
                        + 새 프로젝트
                    </button>
                    <input
                        ref={fileInputRef}
                        type="file"
                        accept=".json"
                        style={{ display: 'none' }}
                        onChange={handleImport}
                    />
                </div>
            </div>

            {/* CLI 안내 */}
            <div style={styles.cliBox}>
                <p style={styles.cliTitle}>🔍 코드에서 자동으로 import하기</p>
                <p style={styles.cliDesc}>
                    Spring / FastAPI / NestJS 프로젝트라면 CLI로 자동 추출할 수 있어요.
                </p>
                <div style={styles.cliSteps}>
                    <div style={styles.cliStep}>
                        <span style={styles.cliStepNum}>1</span>
                        <code style={styles.cliCode}>npx helloapi scan ./src</code>
                    </div>
                    <div style={styles.cliStep}>
                        <span style={styles.cliStepNum}>2</span>
                        <span style={styles.cliStepDesc}>생성된 spec.json을 위 import 버튼으로 불러오기</span>
                    </div>
                </div>
                <p style={styles.cliNote}>
                    Express / Netty 등 어노테이션이 없는 프레임워크는 OpenAPI JSON 또는 curl로 import하세요.
                </p>
            </div>

            {/* 프로젝트 목록 */}
            {projects.length === 0 ? (
                <EmptyState onCreate={handleCreate} onImport={() => fileInputRef.current?.click()} />
            ) : (
                <div style={styles.grid}>
                    {projects.map(project => (
                        <div
                            key={project.id}
                            style={styles.card}
                            onClick={() => onSelectProject(project.id)}
                            onMouseEnter={e => (e.currentTarget.style.borderColor = 'var(--color-primary)')}
                            onMouseLeave={e => (e.currentTarget.style.borderColor = 'var(--color-border)')}
                        >
                            <div style={styles.cardHeader}>
                                <h2 style={styles.cardTitle}>{project.info.title}</h2>
                                <span style={styles.cardVersion}>v{project.info.version}</span>
                            </div>
                            {project.info.description && (
                                <p style={styles.cardDesc}>{project.info.description}</p>
                            )}
                            <div style={styles.cardMeta}>
                <span style={styles.cardMetaItem}>
                  엔드포인트 {project.endpoints.length}개
                </span>
                                <span style={styles.cardMetaItem}>
                  태그 {project.tags.length}개
                </span>
                            </div>
                            {project.info.baseUrl && (
                                <p style={styles.cardUrl}>{project.info.baseUrl}</p>
                            )}
                            <div style={styles.cardFooter}>
                <span style={styles.cardDate}>
                  {new Date(project.updatedAt).toLocaleDateString('ko-KR')}
                </span>
                                <div style={styles.cardBtns}>
                                    <button
                                        style={styles.btnIcon}
                                        onClick={e => handleExport(e, project)}
                                        title="spec.json 내보내기"
                                    >
                                        ↓
                                    </button>
                                    <button
                                        style={{ ...styles.btnIcon, color: 'var(--color-danger)' }}
                                        onClick={e => handleDelete(e, project.id, project.info.title)}
                                        title="삭제"
                                    >
                                        ✕
                                    </button>
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    )
}

// 빈 상태
function EmptyState({
                        onCreate,
                        onImport,
                    }: {
    onCreate: () => void
    onImport: () => void
}) {
    return (
        <div style={styles.empty}>
            <p style={styles.emptyIcon}>📭</p>
            <p style={styles.emptyTitle}>프로젝트가 없어요</p>
            <p style={styles.emptyDesc}>새 프로젝트를 만들거나 spec.json / OpenAPI JSON을 import해주세요.</p>
            <div style={styles.emptyActions}>
                <button style={styles.btnPrimary} onClick={onCreate}>+ 새 프로젝트</button>
                <button style={styles.btnSecondary} onClick={onImport}>import</button>
            </div>
        </div>
    )
}

const styles: Record<string, React.CSSProperties> = {
    container: {
        maxWidth: 900,
        margin: '0 auto',
        padding: '40px 24px',
    },
    header: {
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 32,
    },
    title: {
        fontSize: 28,
        fontWeight: 700,
        color: 'var(--color-text)',
        letterSpacing: '-0.5px',
    },
    subtitle: {
        fontSize: 14,
        color: 'var(--color-text-secondary)',
        marginTop: 4,
    },
    actions: {
        display: 'flex',
        gap: 8,
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
    btnIcon: {
        background: 'none',
        border: 'none',
        color: 'var(--color-text-secondary)',
        cursor: 'pointer',
        padding: '4px 8px',
        borderRadius: 'var(--radius)',
        fontSize: 16,
    },
    cliBox: {
        background: 'var(--color-surface)',
        border: '1px solid var(--color-border)',
        borderRadius: 'var(--radius-lg)',
        padding: '20px 24px',
        marginBottom: 32,
    },
    cliTitle: {
        fontWeight: 600,
        marginBottom: 6,
    },
    cliDesc: {
        color: 'var(--color-text-secondary)',
        marginBottom: 12,
        fontSize: 13,
    },
    cliSteps: {
        display: 'flex',
        flexDirection: 'column',
        gap: 8,
        marginBottom: 12,
    },
    cliStep: {
        display: 'flex',
        alignItems: 'center',
        gap: 10,
    },
    cliStepNum: {
        background: 'var(--color-primary)',
        color: '#fff',
        borderRadius: '50%',
        width: 20,
        height: 20,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontSize: 11,
        fontWeight: 700,
        flexShrink: 0,
    },
    cliCode: {
        background: 'var(--color-surface-2)',
        border: '1px solid var(--color-border)',
        borderRadius: 'var(--radius)',
        padding: '4px 10px',
        fontFamily: 'monospace',
        fontSize: 13,
        color: 'var(--color-primary)',
    },
    cliStepDesc: {
        color: 'var(--color-text-secondary)',
        fontSize: 13,
    },
    cliNote: {
        fontSize: 12,
        color: 'var(--color-text-secondary)',
        borderTop: '1px solid var(--color-border)',
        paddingTop: 12,
    },
    grid: {
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))',
        gap: 16,
    },
    card: {
        background: 'var(--color-surface)',
        border: '1px solid var(--color-border)',
        borderRadius: 'var(--radius-lg)',
        padding: '20px',
        cursor: 'pointer',
        transition: 'border-color 0.15s',
    },
    cardHeader: {
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 8,
    },
    cardTitle: {
        fontSize: 16,
        fontWeight: 600,
    },
    cardVersion: {
        fontSize: 11,
        color: 'var(--color-text-secondary)',
        background: 'var(--color-surface-2)',
        padding: '2px 8px',
        borderRadius: 'var(--radius)',
    },
    cardDesc: {
        fontSize: 13,
        color: 'var(--color-text-secondary)',
        marginBottom: 12,
    },
    cardMeta: {
        display: 'flex',
        gap: 12,
        marginBottom: 8,
    },
    cardMetaItem: {
        fontSize: 12,
        color: 'var(--color-text-secondary)',
    },
    cardUrl: {
        fontSize: 11,
        color: 'var(--color-primary)',
        fontFamily: 'monospace',
        marginBottom: 8,
        overflow: 'hidden',
        textOverflow: 'ellipsis',
        whiteSpace: 'nowrap',
    },
    cardFooter: {
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginTop: 12,
        paddingTop: 12,
        borderTop: '1px solid var(--color-border)',
    },
    cardDate: {
        fontSize: 12,
        color: 'var(--color-text-secondary)',
    },
    cardBtns: {
        display: 'flex',
        gap: 4,
    },
    empty: {
        textAlign: 'center',
        padding: '80px 24px',
    },
    emptyIcon: {
        fontSize: 48,
        marginBottom: 16,
    },
    emptyTitle: {
        fontSize: 18,
        fontWeight: 600,
        marginBottom: 8,
    },
    emptyDesc: {
        color: 'var(--color-text-secondary)',
        marginBottom: 24,
    },
    emptyActions: {
        display: 'flex',
        gap: 8,
        justifyContent: 'center',
    },
}