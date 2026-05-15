import { useState, useEffect } from 'react'
import type { Project, Endpoint, Parameter } from '@helloapi/core'

interface Props {
    project: Project
    initialEndpoint: Endpoint | null
}

interface ParamValues {
    [key: string]: string
}

interface ApiResponse {
    status: number
    statusText: string
    headers: Record<string, string>
    body: string
    duration: number
}

export default function ApiTester({ project, initialEndpoint }: Props) {
    const [selectedEndpoint, setSelectedEndpoint] = useState<Endpoint | null>(initialEndpoint)
    const [paramValues, setParamValues] = useState<ParamValues>({})
    const [bodyValue, setBodyValue] = useState('')
    const [baseUrl, setBaseUrl] = useState(project.info.baseUrl ?? '')
    const [response, setResponse] = useState<ApiResponse | null>(null)
    const [loading, setLoading] = useState(false)
    const [error, setError] = useState('')

    // 엔드포인트 선택 시 초기화
    useEffect(() => {
        if (!selectedEndpoint) return
        const initial: ParamValues = {}
        selectedEndpoint.parameters.forEach(p => {
            initial[`${p.in}::${p.name}`] = p.example ?? ''
        })
        setParamValues(initial)
        setBodyValue(selectedEndpoint.requestBody?.example ?? '')
        setResponse(null)
        setError('')
    }, [selectedEndpoint])

    const handleSelectEndpoint = (ep: Endpoint) => {
        setSelectedEndpoint(ep)
    }

    const getParamValue = (p: Parameter) => paramValues[`${p.in}::${p.name}`] ?? ''

    const setParamValue = (p: Parameter, value: string) => {
        setParamValues(prev => ({ ...prev, [`${p.in}::${p.name}`]: value }))
    }

    // 유효성 검사
    const validateBeforeSend = (): string => {
        if (!baseUrl) return 'Base URL을 입력해주세요.'
        if (!selectedEndpoint) return '엔드포인트를 선택해주세요.'

        const missingRequired = selectedEndpoint.parameters.filter(p => {
            return p.required && !getParamValue(p).trim()
        })

        if (missingRequired.length > 0) {
            const names = missingRequired.map(p => p.name).join(', ')
            return `필수 파라미터가 비어있어요: ${names}`
        }

        if (selectedEndpoint.requestBody?.required && !bodyValue.trim()) {
            return 'Request Body가 비어있어요.'
        }

        if (bodyValue.trim()) {
            try {
                JSON.parse(bodyValue)
            } catch {
                return 'Request Body가 올바른 JSON 형식이 아니에요.'
            }
        }

        return ''
    }

    // URL 조합
    const buildUrl = (): string => {
        if (!selectedEndpoint) return ''
        let path = selectedEndpoint.path

        // path 파라미터 치환
        selectedEndpoint.parameters
            .filter(p => p.in === 'path')
            .forEach(p => {
                path = path.replace(`{${p.name}}`, getParamValue(p) || `{${p.name}}`)
            })

        // query 파라미터 조합
        const queryParams = selectedEndpoint.parameters
            .filter(p => p.in === 'query' && getParamValue(p))
            .map(p => `${encodeURIComponent(p.name)}=${encodeURIComponent(getParamValue(p))}`)
            .join('&')

        const base = baseUrl.replace(/\/$/, '')
        return queryParams ? `${base}${path}?${queryParams}` : `${base}${path}`
    }

    // API 요청
    const handleSend = async () => {
        const validationError = validateBeforeSend()
        if (validationError) {
            setError(validationError)
            return
        }

        setError('')
        setLoading(true)
        setResponse(null)

        const url = buildUrl()
        const headers: Record<string, string> = {}

        // header 파라미터 추가
        selectedEndpoint!.parameters
            .filter(p => p.in === 'header' && getParamValue(p))
            .forEach(p => { headers[p.name] = getParamValue(p) })

        if (bodyValue.trim()) {
            headers['Content-Type'] = 'application/json'
        }

        const startTime = Date.now()

        try {
            const res = await fetch(url, {
                method: selectedEndpoint!.method,
                headers,
                body: bodyValue.trim() ? bodyValue : undefined,
            })

            const duration = Date.now() - startTime
            const resHeaders: Record<string, string> = {}
            res.headers.forEach((value, key) => { resHeaders[key] = value })

            const text = await res.text()
            let body = text
            try {
                body = JSON.stringify(JSON.parse(text), null, 2)
            } catch { /* 텍스트 그대로 */ }

            setResponse({
                status: res.status,
                statusText: res.statusText,
                headers: resHeaders,
                body,
                duration,
            })
        } catch (err) {
            const msg = (err as Error).message
            if (msg.includes('Failed to fetch') || msg.includes('CORS')) {
                setError(
                    'CORS 오류가 발생했어요.\n' +
                    '브라우저 보안 정책으로 직접 요청이 차단됐어요.\n' +
                    '서버에 CORS 설정을 추가하거나, 개발 환경에서 테스트해주세요.'
                )
            } else {
                setError(`요청 실패: ${msg}`)
            }
        } finally {
            setLoading(false)
        }
    }

    const previewUrl = buildUrl()

    return (
        <div style={styles.container}>
            {/* 엔드포인트 선택 */}
            <div style={styles.sidebar}>
                <p style={styles.sidebarTitle}>엔드포인트</p>
                <div style={styles.epList}>
                    {project.endpoints.map(ep => (
                        <div
                            key={ep.id}
                            style={{
                                ...styles.epItem,
                                ...(selectedEndpoint?.id === ep.id ? styles.epItemActive : {}),
                            }}
                            onClick={() => handleSelectEndpoint(ep)}
                        >
                            <MethodBadge method={ep.method} />
                            <span style={styles.epPath}>{ep.path}</span>
                        </div>
                    ))}
                </div>
            </div>

            {/* 요청 설정 */}
            <div style={styles.main}>
                {!selectedEndpoint ? (
                    <div style={styles.empty}>
                        <p style={styles.emptyIcon}>🚀</p>
                        <p style={styles.emptyTitle}>엔드포인트를 선택해주세요</p>
                    </div>
                ) : (
                    <>
                        {/* Base URL */}
                        <div style={styles.section}>
                            <label style={styles.label}>Base URL</label>
                            <input
                                style={{
                                    ...styles.input,
                                    ...(error.includes('Base URL') ? styles.inputError : {}),
                                }}
                                placeholder="https://api.example.com"
                                value={baseUrl}
                                onChange={e => setBaseUrl(e.target.value)}
                            />
                        </div>

                        {/* URL 미리보기 */}
                        <div style={styles.urlPreview}>
                            <MethodBadge method={selectedEndpoint.method} />
                            <span style={styles.urlPreviewText}>{previewUrl || '—'}</span>
                        </div>

                        {/* 파라미터 */}
                        {selectedEndpoint.parameters.length > 0 && (
                            <div style={styles.section}>
                                <p style={styles.sectionTitle}>Parameters</p>
                                <div style={styles.paramList}>
                                    {selectedEndpoint.parameters.map((p, i) => (
                                        <div key={i} style={styles.paramRow}>
                                            <div style={styles.paramMeta}>
                                                <span style={inBadgeStyle(p.in)}>{p.in}</span>
                                                <code style={styles.paramName}>{p.name}</code>
                                                <span style={styles.paramType}>{p.type}</span>
                                                {p.required && <span style={styles.required}>*</span>}
                                            </div>
                                            <input
                                                style={{
                                                    ...styles.input,
                                                    ...(p.required && !getParamValue(p) ? styles.inputRequired : {}),
                                                }}
                                                placeholder={p.example ?? p.name}
                                                value={getParamValue(p)}
                                                onChange={e => setParamValue(p, e.target.value)}
                                            />
                                            {p.description && (
                                                <p style={styles.paramDesc}>{p.description}</p>
                                            )}
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}

                        {/* Request Body */}
                        {selectedEndpoint.requestBody && (
                            <div style={styles.section}>
                                <p style={styles.sectionTitle}>
                                    Request Body
                                    {selectedEndpoint.requestBody.required && (
                                        <span style={styles.required}> *</span>
                                    )}
                                </p>
                                <textarea
                                    style={{
                                        ...styles.textarea,
                                        ...(error.includes('Body') ? styles.inputError : {}),
                                    }}
                                    placeholder={'{\n  "key": "value"\n}'}
                                    value={bodyValue}
                                    onChange={e => setBodyValue(e.target.value)}
                                    rows={6}
                                />
                            </div>
                        )}

                        {/* 오류 메시지 */}
                        {error && (
                            <div style={styles.errorBox}>
                                <p style={styles.errorText}>{error}</p>
                            </div>
                        )}

                        {/* 전송 버튼 */}
                        <button
                            style={{ ...styles.btnSend, ...(loading ? styles.btnSendLoading : {}) }}
                            onClick={handleSend}
                            disabled={loading}
                        >
                            {loading ? '요청 중...' : '▶ 요청 보내기'}
                        </button>

                        {/* 응답 */}
                        {response && (
                            <div style={styles.responseBox}>
                                <div style={styles.responseHeader}>
                  <span style={statusBadgeStyle(response.status)}>
                    {response.status} {response.statusText}
                  </span>
                                    <span style={styles.duration}>{response.duration}ms</span>
                                </div>

                                {/* 응답 헤더 */}
                                <details style={styles.details}>
                                    <summary style={styles.summary}>응답 헤더</summary>
                                    <div style={styles.headersBox}>
                                        {Object.entries(response.headers).map(([k, v]) => (
                                            <div key={k} style={styles.headerRow}>
                                                <span style={styles.headerKey}>{k}</span>
                                                <span style={styles.headerValue}>{v}</span>
                                            </div>
                                        ))}
                                    </div>
                                </details>

                                {/* 응답 바디 */}
                                <p style={styles.sectionTitle}>응답 바디</p>
                                <pre style={styles.responseBody}>{response.body}</pre>
                            </div>
                        )}
                    </>
                )}
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
            fontSize: 11,
            fontWeight: 700,
            padding: '2px 7px',
            borderRadius: 4,
            color: '#fff',
            background: colorMap[method] ?? '#666',
            fontFamily: 'monospace',
            flexShrink: 0,
        }}>
      {method}
    </span>
    )
}

const inBadgeStyle = (_inVal: string): React.CSSProperties => ({
    fontSize: 10,
    padding: '1px 5px',
    borderRadius: 3,
    background: 'var(--color-surface-2)',
    color: 'var(--color-text-secondary)',
    border: '1px solid var(--color-border)',
})

const statusBadgeStyle = (status: number): React.CSSProperties => ({
    fontWeight: 700,
    fontSize: 15,
    fontFamily: 'monospace',
    color: status < 300
        ? 'var(--color-success)'
        : status < 400
            ? 'var(--color-warning)'
            : 'var(--color-danger)',
})

const styles: Record<string, React.CSSProperties> = {
    container: {
        display: 'flex',
        gap: 20,
        height: 'calc(100vh - 220px)',
    },
    sidebar: {
        width: 260,
        flexShrink: 0,
        background: 'var(--color-surface)',
        border: '1px solid var(--color-border)',
        borderRadius: 'var(--radius-lg)',
        padding: '16px',
        overflowY: 'auto',
    },
    sidebarTitle: {
        fontSize: 11,
        fontWeight: 600,
        color: 'var(--color-text-secondary)',
        textTransform: 'uppercase',
        letterSpacing: '0.5px',
        marginBottom: 12,
    },
    epList: {
        display: 'flex',
        flexDirection: 'column',
        gap: 4,
    },
    epItem: {
        display: 'flex',
        alignItems: 'center',
        gap: 8,
        padding: '7px 10px',
        borderRadius: 'var(--radius)',
        cursor: 'pointer',
        border: '1px solid transparent',
    },
    epItemActive: {
        background: 'var(--color-surface-2)',
        border: '1px solid var(--color-border)',
    },
    epPath: {
        fontSize: 12,
        fontFamily: 'monospace',
        color: 'var(--color-text)',
        overflow: 'hidden',
        textOverflow: 'ellipsis',
        whiteSpace: 'nowrap',
    },
    main: {
        flex: 1,
        background: 'var(--color-surface)',
        border: '1px solid var(--color-border)',
        borderRadius: 'var(--radius-lg)',
        padding: '20px',
        overflowY: 'auto',
        display: 'flex',
        flexDirection: 'column',
        gap: 16,
    },
    empty: {
        flex: 1,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 12,
    },
    emptyIcon: { fontSize: 40 },
    emptyTitle: {
        color: 'var(--color-text-secondary)',
        fontSize: 14,
    },
    section: {
        display: 'flex',
        flexDirection: 'column',
        gap: 8,
    },
    label: {
        fontSize: 12,
        color: 'var(--color-text-secondary)',
        fontWeight: 500,
    },
    sectionTitle: {
        fontSize: 11,
        fontWeight: 600,
        color: 'var(--color-text-secondary)',
        textTransform: 'uppercase',
        letterSpacing: '0.5px',
    },
    urlPreview: {
        display: 'flex',
        alignItems: 'center',
        gap: 8,
        background: 'var(--color-surface-2)',
        border: '1px solid var(--color-border)',
        borderRadius: 'var(--radius)',
        padding: '8px 12px',
    },
    urlPreviewText: {
        fontSize: 12,
        fontFamily: 'monospace',
        color: 'var(--color-text)',
        wordBreak: 'break-all',
    },
    paramList: {
        display: 'flex',
        flexDirection: 'column',
        gap: 10,
    },
    paramRow: {
        display: 'flex',
        flexDirection: 'column',
        gap: 4,
    },
    paramMeta: {
        display: 'flex',
        alignItems: 'center',
        gap: 6,
    },
    paramName: {
        fontSize: 12,
        color: 'var(--color-text)',
    },
    paramType: {
        fontSize: 11,
        color: 'var(--color-text-secondary)',
    },
    paramDesc: {
        fontSize: 11,
        color: 'var(--color-text-secondary)',
    },
    required: {
        color: 'var(--color-danger)',
        fontWeight: 700,
    },
    input: {
        background: 'var(--color-surface-2)',
        border: '1px solid var(--color-border)',
        borderRadius: 'var(--radius)',
        padding: '7px 10px',
        color: 'var(--color-text)',
        fontSize: 13,
        width: '100%',
    },
    inputError: {
        borderColor: 'var(--color-danger)',
    },
    inputRequired: {
        borderColor: 'var(--color-warning)',
    },
    textarea: {
        background: 'var(--color-surface-2)',
        border: '1px solid var(--color-border)',
        borderRadius: 'var(--radius)',
        padding: '8px 10px',
        color: 'var(--color-text)',
        fontFamily: 'monospace',
        fontSize: 12,
        resize: 'vertical',
        width: '100%',
    },
    errorBox: {
        background: '#e05c5c15',
        border: '1px solid var(--color-danger)',
        borderRadius: 'var(--radius)',
        padding: '10px 14px',
    },
    errorText: {
        fontSize: 13,
        color: 'var(--color-danger)',
        whiteSpace: 'pre-line',
    },
    btnSend: {
        background: 'var(--color-primary)',
        color: '#fff',
        border: 'none',
        borderRadius: 'var(--radius)',
        padding: '10px 24px',
        fontWeight: 600,
        fontSize: 14,
        cursor: 'pointer',
        alignSelf: 'flex-start',
    },
    btnSendLoading: {
        opacity: 0.6,
        cursor: 'not-allowed',
    },
    responseBox: {
        display: 'flex',
        flexDirection: 'column',
        gap: 12,
        borderTop: '1px solid var(--color-border)',
        paddingTop: 16,
    },
    responseHeader: {
        display: 'flex',
        alignItems: 'center',
        gap: 12,
    },
    duration: {
        fontSize: 12,
        color: 'var(--color-text-secondary)',
    },
    details: {
        background: 'var(--color-surface-2)',
        border: '1px solid var(--color-border)',
        borderRadius: 'var(--radius)',
        padding: '8px 12px',
    },
    summary: {
        fontSize: 12,
        color: 'var(--color-text-secondary)',
        cursor: 'pointer',
    },
    headersBox: {
        marginTop: 8,
        display: 'flex',
        flexDirection: 'column',
        gap: 4,
    },
    headerRow: {
        display: 'flex',
        gap: 8,
        fontSize: 11,
        fontFamily: 'monospace',
    },
    headerKey: {
        color: 'var(--color-text-secondary)',
        minWidth: 160,
    },
    headerValue: {
        color: 'var(--color-text)',
        wordBreak: 'break-all',
    },
    responseBody: {
        background: 'var(--color-surface-2)',
        border: '1px solid var(--color-border)',
        borderRadius: 'var(--radius)',
        padding: '12px',
        fontSize: 12,
        fontFamily: 'monospace',
        overflowX: 'auto',
        whiteSpace: 'pre-wrap',
        wordBreak: 'break-all',
        maxHeight: 400,
        overflowY: 'auto',
    },
}