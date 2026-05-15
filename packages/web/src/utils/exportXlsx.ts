// @ts-ignore – xlsx-js-style has no bundled TS types
import * as XLSX from 'xlsx-js-style'
import type { Project, Endpoint } from '@helloapi/core'

// ─── Colors ──────────────────────────────────────────────────────────────────

const C = {
    white:      'FFFFFF',
    text:       '212121',
    muted:      '78909C',
    // section
    sectionBg:  'ECEFF1',
    subHdrBg:   'CFD8DC',
    border:     'B0BEC5',
    // method
    get:        '2E7D32',
    post:       '1565C0',
    put:        'E65100',
    patch:      '6A1B9A',
    delete:     'B71C1C',
    methodDef:  '37474F',
    // status
    ok:         '2E7D32',
    error:      'B71C1C',
}

const METHOD_BG: Record<string, string> = {
    GET:    C.get,
    POST:   C.post,
    PUT:    C.put,
    PATCH:  C.patch,
    DELETE: C.delete,
}

// ─── Cell factory helpers ─────────────────────────────────────────────────────

type Style = Record<string, unknown>

const thin = (rgb = C.border) => ({ style: 'thin', color: { rgb } })
const borders = (rgb = C.border) => ({ top: thin(rgb), bottom: thin(rgb), left: thin(rgb), right: thin(rgb) })

const mk = (v: string | number, s: Style = {}) => ({ v: v ?? '', t: 's' as const, s })

const methodCell = (method: string) => mk(method, {
    fill:      { fgColor: { rgb: METHOD_BG[method] ?? C.methodDef } },
    font:      { bold: true, color: { rgb: C.white }, sz: 11 },
    alignment: { horizontal: 'center', vertical: 'center' },
    border:    borders(),
})

const pathCell = (path: string) => mk(path, {
    font:      { bold: true, color: { rgb: C.text }, sz: 11 },
    alignment: { horizontal: 'left', vertical: 'center' },
    border:    borders(),
})

const summaryCell = (v: string) => mk(v, {
    font:      { color: { rgb: C.muted }, sz: 10, italic: true },
    alignment: { horizontal: 'left', vertical: 'center' },
    border:    borders(),
})

const sectionLabel = (label: string) => mk(label, {
    fill:      { fgColor: { rgb: C.sectionBg } },
    font:      { bold: true, color: { rgb: C.text }, sz: 10 },
    alignment: { horizontal: 'left', vertical: 'center' },
    border:    borders(),
})

const colHeader = (label: string) => mk(label, {
    fill:      { fgColor: { rgb: C.subHdrBg } },
    font:      { bold: true, color: { rgb: C.text }, sz: 9 },
    alignment: { horizontal: 'center', vertical: 'center' },
    border:    borders(),
})

const dataCell = (v: string) => mk(v, {
    font:      { color: { rgb: C.text }, sz: 10 },
    alignment: { horizontal: 'left', vertical: 'top', wrapText: true },
    border:    borders(),
})

const tagCell = (v: string, color: string) => mk(v, {
    font:      { bold: true, color: { rgb: color }, sz: 10 },
    alignment: { horizontal: 'center', vertical: 'center' },
    border:    borders(),
})

const emptyCell = () => mk('', { border: borders() })

// ─── Sheet builder ────────────────────────────────────────────────────────────

const NCOLS = 5
// Col layout: 0=A(method/label) 1=B(path/value) 2=C(type) 3=D(required/summary) 4=E(description)

type Merge = { s: { r: number; c: number }; e: { r: number; c: number } }

const buildSheet = (endpoints: Endpoint[]) => {
    const ws: Record<string, unknown> = {}
    const merges: Merge[] = []
    let r = 0

    const ref  = (row: number, col: number) => XLSX.utils.encode_cell({ r: row, c: col })
    const set  = (row: number, col: number, cell: unknown) => { ws[ref(row, col)] = cell }
    const fill = (row: number, c1: number, c2: number) => { for (let c = c1; c <= c2; c++) set(row, c, emptyCell()) }
    const span = (row: number, c1: number, c2: number) => { if (c1 < c2) merges.push({ s: { r: row, c: c1 }, e: { r: row, c: c2 } }) }

    for (const ep of endpoints) {

        // ── Endpoint header: [METHOD] [PATH......B-C] [SUMMARY...D-E] ──────
        set(r, 0, methodCell(ep.method))
        set(r, 1, pathCell(ep.path));    fill(r, 2, 2);  span(r, 1, 2)
        set(r, 3, summaryCell(ep.summary ?? '')); fill(r, 4, 4); span(r, 3, 4)
        r++

        // ── Description ───────────────────────────────────────────────────
        if (ep.description) {
            set(r, 0, sectionLabel('설명'))
            set(r, 1, dataCell(ep.description)); fill(r, 2, 4); span(r, 1, 4)
            r++
        }

        // ── Parameters ────────────────────────────────────────────────────
        if (ep.parameters.length > 0) {
            set(r, 0, sectionLabel('Parameters')); fill(r, 1, 4); span(r, 0, 4); r++

            set(r, 0, colHeader('이름'))
            set(r, 1, colHeader('위치'))
            set(r, 2, colHeader('타입'))
            set(r, 3, colHeader('필수'))
            set(r, 4, colHeader('설명'))
            r++

            for (const p of ep.parameters) {
                set(r, 0, dataCell(p.name))
                set(r, 1, tagCell(p.in,   C.muted))
                set(r, 2, tagCell(p.type, C.muted))
                set(r, 3, tagCell(p.required ? '필수' : '선택', p.required ? C.error : C.muted))
                set(r, 4, dataCell(p.description ?? ''))
                r++
            }
        }

        // ── Request Body ──────────────────────────────────────────────────
        if (ep.requestBody) {
            set(r, 0, sectionLabel('Request Body')); fill(r, 1, 4); span(r, 0, 4); r++

            if (ep.requestBody.description) {
                set(r, 0, colHeader('설명'));  fill(r, 1, 1); span(r, 0, 1)
                set(r, 2, dataCell(ep.requestBody.description)); fill(r, 3, 4); span(r, 2, 4)
                r++
            }
            if (ep.requestBody.example) {
                set(r, 0, colHeader('예시'));  fill(r, 1, 1); span(r, 0, 1)
                set(r, 2, dataCell(ep.requestBody.example)); fill(r, 3, 4); span(r, 2, 4)
                r++
            }
        }

        // ── Responses ────────────────────────────────────────────────────
        if (ep.responses.length > 0) {
            set(r, 0, sectionLabel('Responses')); fill(r, 1, 4); span(r, 0, 4); r++

            set(r, 0, colHeader('상태코드'))
            set(r, 1, colHeader('설명')); fill(r, 2, 4); span(r, 1, 4)
            r++

            for (const resp of ep.responses) {
                const isError = parseInt(resp.statusCode) >= 400
                set(r, 0, tagCell(resp.statusCode, isError ? C.error : C.ok))
                set(r, 1, dataCell(resp.description ?? '')); fill(r, 2, 4); span(r, 1, 4)
                r++
            }
        }

        // ── Empty separator ───────────────────────────────────────────────
        for (let i = 0; i < 2; i++) {
            for (let c = 0; c < NCOLS; c++) ws[ref(r, c)] = { v: '', t: 's' }
            r++
        }
    }

    ws['!ref']    = XLSX.utils.encode_range({ s: { r: 0, c: 0 }, e: { r: r - 1, c: NCOLS - 1 } })
    ws['!merges'] = merges
    ws['!cols']   = [{ wch: 14 }, { wch: 30 }, { wch: 16 }, { wch: 12 }, { wch: 38 }]
    ws['!rows']   = Array.from({ length: r }, () => ({ hpt: 20 }))

    return ws
}

// ─── Tag grouping ─────────────────────────────────────────────────────────────

const groupByTag = (project: Project): Record<string, Endpoint[]> => {
    const groups: Record<string, Endpoint[]> = {}
    for (const ep of project.endpoints) {
        const tag = ep.tags[0] ?? 'General'
        groups[tag] = [...(groups[tag] ?? []), ep]
    }
    if (Object.keys(groups).length === 0) groups['General'] = []
    return groups
}

// ─── Public ───────────────────────────────────────────────────────────────────

export const exportXlsx = (project: Project): void => {
    const wb = XLSX.utils.book_new()

    for (const [tag, endpoints] of Object.entries(groupByTag(project))) {
        const ws = buildSheet(endpoints)
        XLSX.utils.book_append_sheet(wb, ws, tag.slice(0, 30))
    }

    XLSX.writeFile(wb, `${project.info.title}_API_Spec.xlsx`)
}
