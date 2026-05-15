import { useState } from 'react'
import { useProjectStore } from '../store/projectStore'
import { validateEndpoint } from '@helloapi/core'
import type { Project, Endpoint } from '@helloapi/core'

interface Props {
    project: Project
    onEdit: (endpoint: Endpoint) => void
    onTest: (endpoint: Endpoint) => void
}

export default function EndpointList({ project, onEdit, onTest }: Props) {
    const { deleteEndpoint } = useProjectStore()
    const [expandedId, setExpandedId] = useState<string | null>(null)
    const [filterTag, setFilterTag] = useState<string>('all')
    const [filterMethod, setFilterMethod] = useState<string>('all')

    const filtered = project.endpoints.filter(ep => {
        const tagMatch = filterTag === 'all' || ep.tags.includes(filterTag)
        const methodMatch = filterMethod === 'all' || ep.method === filterMethod
        return tagMatch && methodMatch
    })

    const handleDelete = (ep: Endpoint) => {
        if (!confirm(`${ep.method} ${ep.path} 를 삭제할까요?`)) return
        deleteEndpoint(project.id, ep.id)
    }

    const toggleExpand = (id: string) => {
        setExpandedId(prev => prev === id ? null : id)
    }

    if (project.endpoints.length === 0) {
        return <EmptyEndpoints />
    }

    return (
        <div>
            {/* 필터 */}
            <div style={styles.filters}>
                <select
                    style={styles.select}
                    value={filterTag}
                    onChange={e => setFilterTag(e.target.value)}
                >
                    <option value="all">모든 태그</option>
                    {project.tags.map(tag => (
                        <option key={tag} value={tag}>{tag}</option>
                    ))}
                </select>
                <select
                    style={styles.select}
                    value={filterMethod}
                    onChange={e => setFilterMethod(e.target.value)}
                >
                    <option value="all">모든 메서드</option>
                    {['GET', 'POST', 'PUT', 'PATCH', 'DELETE'].map(m => (
                        <option key={m} value={m}>{m}</option>
                    ))}
                </select>
                <span style={styles.filterCount}>
          {filtered.length} / {project.endpoints.length}개
        </span>
            </div>

            {/* 엔드포인트 목록 */}
            <div style={styles.list}>
                {filtered.map(ep => {
                    const validation = validateEndpoint(ep)
                    const isExpanded = expandedId === ep.id

                    return (
                        <div key={ep.id} style={styles.card}>
                            {/* 카드 헤더 */}
                            <div style={styles.cardHeader} onClick={() => toggleExpand(ep.id)}>
                                <div style={styles.cardLeft}>
                                    <MethodBadge method={ep.method} />
                                    <span style={styles.path}>{ep.path}</span>
                                    {ep.summary && (
                                        <span style={styles.summary}>{ep.summary}</span>
                                    )}
                                </div>
                                <div style={styles.cardRight}>
                                    {!validation.valid && (
                                        <span style={styles.errorBadge} title={validation.errors[0]?.message}>
                      ⚠️ {validation.errors.length}
                    </span>
                                    )}
                                    {ep.tags.map(tag => (
                                        <span key={tag} style={styles.tag}>{tag}</span>
                                    ))}
                                    <span style={styles.chevron}>{isExpanded ? '▲' : '▼'}</span>
                                </div>
                            </div>

                            {/* 카드 상세 */}
                            {isExpanded && (
                                <div style={styles.cardBody}>
                                    {/* 유효성 오류 표시 */}
                                    {!validation.valid && (
                                        <div style={styles.errorBox}>
                                            {validation.errors.map((err, i) => (
                                                <div key={i} style={styles.errorItem}>
                                                    <span style={styles.errorMsg}>⚠️ {err.message}</span>
                                                    {err.fix && (
                                                        <span style={styles.errorFix}>→ {err.fix}</span>
                                                    )}
                                                </div>
                                            ))}
                                        </div>
                                    )}

                                    {/* 파라미터 */}
                                    {ep.parameters.length > 0 && (
                                        <div style={styles.section}>
                                            <p style={styles.sectionTitle}>Parameters</p>
                                            <table style={styles.table}>
                                                <thead>
                                                <tr>
                                                    {['name', 'in', 'type', 'required', 'example', 'description'].map(h => (
                                                        <th key={h} style={styles.th}>{h}</th>
                                                    ))}
                                                </tr>
                                                </thead>
                                                <tbody>
                                                {ep.parameters.map((p, i) => (
                                                    <tr key={i}>
                                                        <td style={styles.td}><code>{p.name}</code></td>
                                                        <td style={styles.td}>
                                                            <span style={inBadgeStyle(p.in)}>{p.in}</span>
                                                        </td>
                                                        <td style={styles.td}>{p.type}</td>
                                                        <td style={styles.td}>
                                                            {p.required
                                                                ? <span style={styles.required}>required</span>
                                                                : <span style={styles.optional}>optional</span>
                                                            }
                                                        </td>
                                                        <td style={styles.td}>{p.example ?? '-'}</td>
                                                        <td style={styles.td}>{p.description ?? '-'}</td>
                                                    </tr>
                                                ))}
                                                </tbody>
                                            </table>
                                        </div>
                                    )}

                                    {/* Request Body */}
                                    {ep.requestBody && (
                                        <div style={styles.section}>
                                            <p style={styles.sectionTitle}>Request Body</p>
                                            {ep.requestBody.description && (
                                                <p style={styles.bodyDesc}>{ep.requestBody.description}</p>
                                            )}
                                            {ep.requestBody.example && (
                                                <pre style={styles.pre}>{ep.requestBody.example}</pre>
                                            )}
                                        </div>
                                    )}

                                    {/* Responses */}
                                    {ep.responses.length > 0 && (
                                        <div style={styles.section}>
                                            <p style={styles.sectionTitle}>Responses</p>
                                            <div style={styles.responses}>
                                                {ep.responses.map((r, i) => (
                                                    <div key={i} style={styles.responseItem}>
                            <span style={statusBadgeStyle(r.statusCode)}>
                              {r.statusCode}
                            </span>
                                                        <span style={styles.responseDesc}>{r.description}</span>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    )}

                                    {/* 액션 버튼 */}
                                    <div style={styles.cardActions}>
                                        <button style={styles.btnTest} onClick={() => onTest(ep)}>
                                            ▶ 테스트
                                        </button>
                                        <button style={styles.btnEdit} onClick={() => onEdit(ep)}>
                                            수정
                                        </button>
                                        <button style={styles.btnDelete} onClick={() => handleDelete(ep)}>
                                            삭제
                                        </button>
                                    </div>
                                </div>
                            )}
                        </div>
                    )
                })}
            </div>
        </div>
    )
}

function MethodBadge({ method }: { method: string }) {
    const colorMap: Record<string, string> = {
        GET: 'var(--color-get)',
        POST: 'var(--color-post)',
        PUT: 'var(--color-put)',
        PATCH: 'var(--color-patch)',
        DELETE: 'var(--color-delete)',
    }
    return (
        <span style={{
            ...styles.methodBadge,
            background: colorMap[method] ?? 'var(--color-surface-2)',
        }}>
      {method}
    </span>
    )
}

function EmptyEndpoints() {
    return (
        <div style={styles.empty}>
            <p style={styles.emptyIcon}>📋</p>
            <p style={styles.emptyTitle}>엔드포인트가 없어요</p>
            <p style={styles.emptyDesc}>
                + 엔드포인트 버튼으로 추가하거나<br />
                CLI로 코드에서 자동 추출해주세요.
            </p>
        </div>
    )
}

const inBadgeStyle = (inVal: string): React.CSSProperties => {
    const colorMap: Record<string, string> = {
        path: '#6c7bff33',
        query: '#4caf8233',
        header: '#f0a04b33',
        cookie: '#e05c5c33',
    }
    return {
        fontSize: 11,
        padding: '1px 6px',
        borderRadius: 4,
        background: colorMap[inVal] ?? 'var(--color-surface-2)',
    }
}

const statusBadgeStyle = (code: string): React.CSSProperties => {
    const n = parseInt(code)
    const color = n < 300
        ? 'var(--color-success)'
        : n < 400
            ? 'var(--color-warning)'
            : 'var(--color-danger)'
    return {
        fontSize: 12,
        fontWeight: 700,
        color,
        fontFamily: 'monospace',
        minWidth: 36,
    }
}

const styles: Record<string, React.CSSProperties> = {
    filters: {
        display: 'flex',
        gap: 8,
        alignItems: 'center',
        marginBottom: 16,
    },
    select: {
        background: 'var(--color-surface)',
        color: 'var(--color-text)',
        border: '1px solid var(--color-border)',
        borderRadius: 'var(--radius)',
        padding: '6px 10px',
        fontSize: 13,
    },
    filterCount: {
        fontSize: 12,
        color: 'var(--color-text-secondary)',
        marginLeft: 4,
    },
    list: {
        display: 'flex',
        flexDirection: 'column',
        gap: 8,
    },
    card: {
        background: 'var(--color-surface)',
        border: '1px solid var(--color-border)',
        borderRadius: 'var(--radius-lg)',
        overflow: 'hidden',
    },
    cardHeader: {
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: '12px 16px',
        cursor: 'pointer',
    },
    cardLeft: {
        display: 'flex',
        alignItems: 'center',
        gap: 10,
        flex: 1,
        overflow: 'hidden',
    },
    cardRight: {
        display: 'flex',
        alignItems: 'center',
        gap: 6,
        flexShrink: 0,
    },
    methodBadge: {
        fontSize: 11,
        fontWeight: 700,
        padding: '2px 8px',
        borderRadius: 4,
        color: '#fff',
        fontFamily: 'monospace',
        flexShrink: 0,
    },
    path: {
        fontFamily: 'monospace',
        fontSize: 13,
        color: 'var(--color-text)',
    },
    summary: {
        fontSize: 12,
        color: 'var(--color-text-secondary)',
        overflow: 'hidden',
        textOverflow: 'ellipsis',
        whiteSpace: 'nowrap',
    },
    tag: {
        fontSize: 11,
        padding: '2px 8px',
        borderRadius: 4,
        background: 'var(--color-surface-2)',
        color: 'var(--color-text-secondary)',
    },
    errorBadge: {
        fontSize: 12,
        color: 'var(--color-danger)',
        cursor: 'help',
    },
    chevron: {
        fontSize: 10,
        color: 'var(--color-text-secondary)',
    },
    cardBody: {
        padding: '0 16px 16px',
        borderTop: '1px solid var(--color-border)',
    },
    errorBox: {
        background: '#e05c5c15',
        border: '1px solid var(--color-danger)',
        borderRadius: 'var(--radius)',
        padding: '10px 14px',
        margin: '12px 0',
        display: 'flex',
        flexDirection: 'column',
        gap: 6,
    },
    errorItem: {
        display: 'flex',
        flexDirection: 'column',
        gap: 2,
    },
    errorMsg: {
        fontSize: 12,
        color: 'var(--color-danger)',
    },
    errorFix: {
        fontSize: 12,
        color: 'var(--color-text-secondary)',
        paddingLeft: 20,
    },
    section: {
        marginTop: 16,
    },
    sectionTitle: {
        fontSize: 11,
        fontWeight: 600,
        color: 'var(--color-text-secondary)',
        textTransform: 'uppercase',
        letterSpacing: '0.5px',
        marginBottom: 8,
    },
    table: {
        width: '100%',
        borderCollapse: 'collapse',
        fontSize: 12,
    },
    th: {
        textAlign: 'left',
        padding: '6px 8px',
        color: 'var(--color-text-secondary)',
        borderBottom: '1px solid var(--color-border)',
        fontWeight: 500,
    },
    td: {
        padding: '6px 8px',
        borderBottom: '1px solid var(--color-border)',
        color: 'var(--color-text)',
    },
    required: {
        color: 'var(--color-danger)',
        fontSize: 11,
    },
    optional: {
        color: 'var(--color-text-secondary)',
        fontSize: 11,
    },
    bodyDesc: {
        fontSize: 12,
        color: 'var(--color-text-secondary)',
        marginBottom: 8,
    },
    pre: {
        background: 'var(--color-surface-2)',
        border: '1px solid var(--color-border)',
        borderRadius: 'var(--radius)',
        padding: '10px 12px',
        fontSize: 12,
        fontFamily: 'monospace',
        overflowX: 'auto',
        whiteSpace: 'pre-wrap',
    },
    responses: {
        display: 'flex',
        flexDirection: 'column',
        gap: 6,
    },
    responseItem: {
        display: 'flex',
        alignItems: 'center',
        gap: 10,
    },
    responseDesc: {
        fontSize: 12,
        color: 'var(--color-text-secondary)',
    },
    cardActions: {
        display: 'flex',
        gap: 8,
        marginTop: 16,
        paddingTop: 12,
        borderTop: '1px solid var(--color-border)',
    },
    btnTest: {
        background: 'var(--color-primary)',
        color: '#fff',
        border: 'none',
        borderRadius: 'var(--radius)',
        padding: '6px 14px',
        fontSize: 13,
        cursor: 'pointer',
    },
    btnEdit: {
        background: 'var(--color-surface-2)',
        color: 'var(--color-text)',
        border: '1px solid var(--color-border)',
        borderRadius: 'var(--radius)',
        padding: '6px 14px',
        fontSize: 13,
        cursor: 'pointer',
    },
    btnDelete: {
        background: 'none',
        color: 'var(--color-danger)',
        border: '1px solid var(--color-danger)',
        borderRadius: 'var(--radius)',
        padding: '6px 14px',
        fontSize: 13,
        cursor: 'pointer',
    },
    empty: {
        textAlign: 'center',
        padding: '60px 24px',
    },
    emptyIcon: {
        fontSize: 40,
        marginBottom: 12,
    },
    emptyTitle: {
        fontSize: 16,
        fontWeight: 600,
        marginBottom: 8,
    },
    emptyDesc: {
        color: 'var(--color-text-secondary)',
        fontSize: 13,
        lineHeight: 1.8,
    },
}