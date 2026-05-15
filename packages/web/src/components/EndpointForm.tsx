import { useState } from 'react'
import { useProjectStore } from '../store/projectStore'
import { validateEndpoint, generateId } from '@helloapi/core'
import { importFromCurl } from '../utils/importSpec'
import type { Endpoint, Parameter, Response, HttpMethod } from '@helloapi/core'
import type { Project } from '@helloapi/core'

interface Props {
    project: Project
    endpoint: Endpoint | null
    onClose: () => void
}

const DEFAULT_ENDPOINT: Endpoint = {
    id: '',
    method: 'GET',
    path: '',
    summary: '',
    description: '',
    tags: [],
    parameters: [],
    responses: [{ statusCode: '200', description: 'OK' }],
}

export default function EndpointForm({ project, endpoint, onClose }: Props) {
    const { addEndpoint, updateEndpoint } = useProjectStore()
    const isEdit = !!endpoint

    const [form, setForm] = useState<Endpoint>(() =>
        endpoint ? { ...endpoint } : { ...DEFAULT_ENDPOINT, id: generateId() }
    )
    const [curlInput, setCurlInput] = useState('')
    const [curlError, setCurlError] = useState('')
    const [errors, setErrors] = useState<Record<string, string>>({})

    // curl 파싱
    const handleParseCurl = async () => {
        setCurlError('')
        try {
            const parsed = await importFromCurl(curlInput)
            setForm(prev => ({ ...prev, ...parsed, id: prev.id }))
            setCurlInput('')
        } catch (err) {
            setCurlError((err as Error).message)
        }
    }

    // 저장
    const handleSave = () => {
        const result = validateEndpoint(form)
        if (!result.valid) {
            const map: Record<string, string> = {}
            result.errors.forEach(e => { map[e.field] = e.message })
            setErrors(map)
            return
        }
        if (isEdit) {
            updateEndpoint(project.id, form)
        } else {
            addEndpoint(project.id, form)
        }
        onClose()
    }

    // 파라미터 추가
    const addParameter = () => {
        const param: Parameter = {
            name: '',
            in: 'query',
            required: false,
            type: 'string',
            description: '',
            example: '',
        }
        setForm(prev => ({ ...prev, parameters: [...prev.parameters, param] }))
    }

    // 파라미터 수정
    const updateParameter = (index: number, partial: Partial<Parameter>) => {
        setForm(prev => ({
            ...prev,
            parameters: prev.parameters.map((p, i) => i === index ? { ...p, ...partial } : p),
        }))
    }

    // 파라미터 삭제
    const deleteParameter = (index: number) => {
        setForm(prev => ({
            ...prev,
            parameters: prev.parameters.filter((_, i) => i !== index),
        }))
    }

    // 응답 추가
    const addResponse = () => {
        const res: Response = { statusCode: '', description: '' }
        setForm(prev => ({ ...prev, responses: [...prev.responses, res] }))
    }

    // 응답 수정
    const updateResponse = (index: number, partial: Partial<Response>) => {
        setForm(prev => ({
            ...prev,
            responses: prev.responses.map((r, i) => i === index ? { ...r, ...partial } : r),
        }))
    }

    // 응답 삭제
    const deleteResponse = (index: number) => {
        setForm(prev => ({
            ...prev,
            responses: prev.responses.filter((_, i) => i !== index),
        }))
    }

    // 태그 입력 (콤마 구분)
    const handleTagInput = (value: string) => {
        const tags = value.split(',').map(t => t.trim()).filter(Boolean)
        setForm(prev => ({ ...prev, tags }))
    }

    return (
        <div style={styles.overlay}>
            <div style={styles.modal}>
                {/* 헤더 */}
                <div style={styles.modalHeader}>
                    <h2 style={styles.modalTitle}>
                        {isEdit ? '엔드포인트 수정' : '엔드포인트 추가'}
                    </h2>
                    <button style={styles.btnClose} onClick={onClose}>✕</button>
                </div>

                <div style={styles.modalBody}>
                    {/* curl 파싱 */}
                    {!isEdit && (
                        <div style={styles.curlBox}>
                            <p style={styles.curlTitle}>curl로 빠르게 입력</p>
                            <div style={styles.curlRow}>
                <textarea
                    style={styles.curlInput}
                    placeholder={'curl https://api.example.com/users \\\n  -H "Authorization: Bearer token"'}
                    value={curlInput}
                    onChange={e => setCurlInput(e.target.value)}
                    rows={3}
                />
                                <button style={styles.btnParse} onClick={handleParseCurl}>
                                    파싱
                                </button>
                            </div>
                            {curlError && <p style={styles.curlError}>{curlError}</p>}
                        </div>
                    )}

                    {/* 기본 정보 */}
                    <div style={styles.section}>
                        <p style={styles.sectionTitle}>기본 정보</p>

                        {/* Method + Path */}
                        <div style={styles.row}>
                            <select
                                style={{ ...styles.select, width: 120 }}
                                value={form.method}
                                onChange={e => setForm(prev => ({ ...prev, method: e.target.value as HttpMethod }))}
                            >
                                {['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'HEAD', 'OPTIONS'].map(m => (
                                    <option key={m} value={m}>{m}</option>
                                ))}
                            </select>
                            <div style={{ flex: 1 }}>
                                <input
                                    style={{ ...styles.input, ...(errors['path'] ? styles.inputError : {}) }}
                                    placeholder="/users/{id}"
                                    value={form.path}
                                    onChange={e => setForm(prev => ({ ...prev, path: e.target.value }))}
                                />
                                {errors['path'] && <p style={styles.errorMsg}>{errors['path']}</p>}
                            </div>
                        </div>

                        {/* Summary */}
                        <div style={styles.field}>
                            <label style={styles.label}>Summary</label>
                            <input
                                style={styles.input}
                                placeholder="한줄 설명"
                                value={form.summary ?? ''}
                                onChange={e => setForm(prev => ({ ...prev, summary: e.target.value }))}
                            />
                        </div>

                        {/* Tags */}
                        <div style={styles.field}>
                            <label style={styles.label}>Tags <span style={styles.hint}>(콤마로 구분)</span></label>
                            <input
                                style={styles.input}
                                placeholder="users, admin"
                                value={form.tags.join(', ')}
                                onChange={e => handleTagInput(e.target.value)}
                            />
                        </div>
                    </div>

                    {/* 파라미터 */}
                    <div style={styles.section}>
                        <div style={styles.sectionHeader}>
                            <p style={styles.sectionTitle}>Parameters</p>
                            <button style={styles.btnAdd} onClick={addParameter}>+ 추가</button>
                        </div>
                        {errors['parameters'] && (
                            <p style={styles.errorMsg}>{errors['parameters']}</p>
                        )}
                        {form.parameters.length === 0 ? (
                            <p style={styles.emptyText}>파라미터가 없어요</p>
                        ) : (
                            <div style={styles.paramList}>
                                {form.parameters.map((p, i) => (
                                    <div key={i} style={styles.paramRow}>
                                        <input
                                            style={{ ...styles.input, flex: 2 }}
                                            placeholder="name"
                                            value={p.name}
                                            onChange={e => updateParameter(i, { name: e.target.value })}
                                        />
                                        <select
                                            style={{ ...styles.select, flex: 1 }}
                                            value={p.in}
                                            onChange={e => updateParameter(i, { in: e.target.value as Parameter['in'] })}
                                        >
                                            {['path', 'query', 'header', 'cookie'].map(v => (
                                                <option key={v} value={v}>{v}</option>
                                            ))}
                                        </select>
                                        <select
                                            style={{ ...styles.select, flex: 1 }}
                                            value={p.type}
                                            onChange={e => updateParameter(i, { type: e.target.value as Parameter['type'] })}
                                        >
                                            {['string', 'number', 'integer', 'boolean', 'array', 'object'].map(v => (
                                                <option key={v} value={v}>{v}</option>
                                            ))}
                                        </select>
                                        <input
                                            style={{ ...styles.input, flex: 2 }}
                                            placeholder="example"
                                            value={p.example ?? ''}
                                            onChange={e => updateParameter(i, { example: e.target.value })}
                                        />
                                        <label style={styles.checkLabel}>
                                            <input
                                                type="checkbox"
                                                checked={p.required}
                                                onChange={e => updateParameter(i, { required: e.target.checked })}
                                            />
                                            필수
                                        </label>
                                        <button
                                            style={styles.btnRemove}
                                            onClick={() => deleteParameter(i)}
                                        >
                                            ✕
                                        </button>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>

                    {/* Request Body */}
                    <div style={styles.section}>
                        <div style={styles.sectionHeader}>
                            <p style={styles.sectionTitle}>Request Body</p>
                            {!form.requestBody && (
                                <button
                                    style={styles.btnAdd}
                                    onClick={() => setForm(prev => ({
                                        ...prev,
                                        requestBody: { required: true, description: '', example: '' },
                                    }))}
                                >
                                    + 추가
                                </button>
                            )}
                        </div>
                        {form.requestBody && (
                            <div style={styles.bodyBox}>
                                <div style={styles.row}>
                                    <input
                                        style={{ ...styles.input, flex: 1 }}
                                        placeholder="설명 (ex: UserCreateDto)"
                                        value={form.requestBody.description ?? ''}
                                        onChange={e => setForm(prev => ({
                                            ...prev,
                                            requestBody: { ...prev.requestBody!, description: e.target.value },
                                        }))}
                                    />
                                    <label style={styles.checkLabel}>
                                        <input
                                            type="checkbox"
                                            checked={form.requestBody.required}
                                            onChange={e => setForm(prev => ({
                                                ...prev,
                                                requestBody: { ...prev.requestBody!, required: e.target.checked },
                                            }))}
                                        />
                                        필수
                                    </label>
                                    <button
                                        style={styles.btnRemove}
                                        onClick={() => setForm(prev => ({ ...prev, requestBody: undefined }))}
                                    >
                                        ✕
                                    </button>
                                </div>
                                <textarea
                                    style={styles.textarea}
                                    placeholder={'{\n  "name": "홍길동",\n  "email": "hong@example.com"\n}'}
                                    value={form.requestBody.example ?? ''}
                                    onChange={e => setForm(prev => ({
                                        ...prev,
                                        requestBody: { ...prev.requestBody!, example: e.target.value },
                                    }))}
                                    rows={5}
                                />
                                {errors['requestBody.example'] && (
                                    <p style={styles.errorMsg}>{errors['requestBody.example']}</p>
                                )}
                            </div>
                        )}
                    </div>

                    {/* Responses */}
                    <div style={styles.section}>
                        <div style={styles.sectionHeader}>
                            <p style={styles.sectionTitle}>Responses</p>
                            <button style={styles.btnAdd} onClick={addResponse}>+ 추가</button>
                        </div>
                        {errors['responses'] && (
                            <p style={styles.errorMsg}>{errors['responses']}</p>
                        )}
                        <div style={styles.paramList}>
                            {form.responses.map((r, i) => (
                                <div key={i} style={styles.paramRow}>
                                    <input
                                        style={{ ...styles.input, width: 80 }}
                                        placeholder="200"
                                        value={r.statusCode}
                                        onChange={e => updateResponse(i, { statusCode: e.target.value })}
                                    />
                                    <input
                                        style={{ ...styles.input, flex: 1 }}
                                        placeholder="OK"
                                        value={r.description ?? ''}
                                        onChange={e => updateResponse(i, { description: e.target.value })}
                                    />
                                    <button style={styles.btnRemove} onClick={() => deleteResponse(i)}>✕</button>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>

                {/* 푸터 */}
                <div style={styles.modalFooter}>
                    <button style={styles.btnCancel} onClick={onClose}>취소</button>
                    <button style={styles.btnSave} onClick={handleSave}>
                        {isEdit ? '수정 완료' : '추가'}
                    </button>
                </div>
            </div>
        </div>
    )
}

const styles: Record<string, React.CSSProperties> = {
    overlay: {
        position: 'fixed',
        inset: 0,
        background: 'rgba(0,0,0,0.6)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 100,
    },
    modal: {
        background: 'var(--color-surface)',
        border: '1px solid var(--color-border)',
        borderRadius: 'var(--radius-lg)',
        width: '100%',
        maxWidth: 720,
        maxHeight: '90vh',
        display: 'flex',
        flexDirection: 'column',
    },
    modalHeader: {
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: '16px 20px',
        borderBottom: '1px solid var(--color-border)',
    },
    modalTitle: {
        fontSize: 16,
        fontWeight: 600,
    },
    btnClose: {
        background: 'none',
        border: 'none',
        color: 'var(--color-text-secondary)',
        cursor: 'pointer',
        fontSize: 16,
    },
    modalBody: {
        flex: 1,
        overflowY: 'auto',
        padding: '20px',
        display: 'flex',
        flexDirection: 'column',
        gap: 24,
    },
    modalFooter: {
        display: 'flex',
        justifyContent: 'flex-end',
        gap: 8,
        padding: '16px 20px',
        borderTop: '1px solid var(--color-border)',
    },
    curlBox: {
        background: 'var(--color-surface-2)',
        border: '1px solid var(--color-border)',
        borderRadius: 'var(--radius)',
        padding: '14px 16px',
    },
    curlTitle: {
        fontSize: 12,
        fontWeight: 600,
        color: 'var(--color-text-secondary)',
        marginBottom: 8,
    },
    curlRow: {
        display: 'flex',
        gap: 8,
    },
    curlInput: {
        flex: 1,
        background: 'var(--color-surface)',
        border: '1px solid var(--color-border)',
        borderRadius: 'var(--radius)',
        padding: '8px 10px',
        color: 'var(--color-text)',
        fontFamily: 'monospace',
        fontSize: 12,
        resize: 'vertical',
    },
    curlError: {
        fontSize: 12,
        color: 'var(--color-danger)',
        marginTop: 6,
    },
    btnParse: {
        background: 'var(--color-primary)',
        color: '#fff',
        border: 'none',
        borderRadius: 'var(--radius)',
        padding: '0 14px',
        cursor: 'pointer',
        fontWeight: 600,
        fontSize: 13,
        alignSelf: 'flex-start',
    },
    section: {
        display: 'flex',
        flexDirection: 'column',
        gap: 10,
    },
    sectionHeader: {
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
    },
    sectionTitle: {
        fontSize: 12,
        fontWeight: 600,
        color: 'var(--color-text-secondary)',
        textTransform: 'uppercase',
        letterSpacing: '0.5px',
    },
    field: {
        display: 'flex',
        flexDirection: 'column',
        gap: 4,
    },
    label: {
        fontSize: 12,
        color: 'var(--color-text-secondary)',
    },
    hint: {
        fontWeight: 400,
        fontSize: 11,
    },
    row: {
        display: 'flex',
        gap: 8,
        alignItems: 'flex-start',
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
    select: {
        background: 'var(--color-surface-2)',
        border: '1px solid var(--color-border)',
        borderRadius: 'var(--radius)',
        padding: '7px 10px',
        color: 'var(--color-text)',
        fontSize: 13,
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
    paramList: {
        display: 'flex',
        flexDirection: 'column',
        gap: 8,
    },
    paramRow: {
        display: 'flex',
        gap: 6,
        alignItems: 'center',
    },
    checkLabel: {
        display: 'flex',
        alignItems: 'center',
        gap: 4,
        fontSize: 12,
        color: 'var(--color-text-secondary)',
        whiteSpace: 'nowrap',
        cursor: 'pointer',
    },
    btnAdd: {
        background: 'none',
        border: '1px solid var(--color-border)',
        borderRadius: 'var(--radius)',
        padding: '4px 10px',
        color: 'var(--color-text-secondary)',
        fontSize: 12,
        cursor: 'pointer',
    },
    btnRemove: {
        background: 'none',
        border: 'none',
        color: 'var(--color-text-secondary)',
        cursor: 'pointer',
        fontSize: 14,
        padding: '0 4px',
        flexShrink: 0,
    },
    bodyBox: {
        display: 'flex',
        flexDirection: 'column',
        gap: 8,
    },
    emptyText: {
        fontSize: 12,
        color: 'var(--color-text-secondary)',
    },
    errorMsg: {
        fontSize: 12,
        color: 'var(--color-danger)',
        marginTop: 2,
    },
    btnCancel: {
        background: 'var(--color-surface-2)',
        color: 'var(--color-text)',
        border: '1px solid var(--color-border)',
        borderRadius: 'var(--radius)',
        padding: '8px 20px',
        cursor: 'pointer',
    },
    btnSave: {
        background: 'var(--color-primary)',
        color: '#fff',
        border: 'none',
        borderRadius: 'var(--radius)',
        padding: '8px 20px',
        fontWeight: 600,
        cursor: 'pointer',
    },
}