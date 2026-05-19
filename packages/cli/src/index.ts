#!/usr/bin/env node
import { readFileSync, writeFileSync, existsSync } from 'fs'
import { readdir, readFile } from 'fs/promises'
import { resolve, extname, join } from 'path'
import { parseSpring } from '@helloapi/core'
import { parseFastAPI } from '@helloapi/core'
import { parseNestJS } from '@helloapi/core'
import { parseExpress, parseExpressBasePaths } from '@helloapi/core'
import { parseFlask } from '@helloapi/core'
import { generateId, now } from '@helloapi/core'
import { Project, Endpoint } from '@helloapi/core'

const args = process.argv.slice(2)
const command = args[0]
// 경로 미입력 시 현재 디렉토리('.')를 기본값으로 사용
const targetPath = args[1]?.startsWith('--') ? undefined : args[1]

const SUPPORTED_FRAMEWORKS = ['spring', 'fastapi', 'nestjs', 'express', 'flask', 'auto'] as const
type Framework = typeof SUPPORTED_FRAMEWORKS[number]

const run = async () => {
    if (command !== 'scan') {
        printHelp()
        process.exit(0)
    }

    const absolutePath = resolve(process.cwd(), targetPath ?? '.')

    if (!existsSync(absolutePath)) {
        console.error(`❌ 폴더를 찾을 수 없어요: ${absolutePath}`)
        process.exit(1)
    }

    // --framework 옵션 파싱
    const frameworkArg = args.find(a => a.startsWith('--framework='))
    const framework: Framework = frameworkArg
        ? (frameworkArg.split('=')[1] as Framework)
        : 'auto'

    if (!SUPPORTED_FRAMEWORKS.includes(framework)) {
        console.error(`❌ 지원하지 않는 프레임워크예요: ${framework}`)
        console.error(`   지원 목록: ${SUPPORTED_FRAMEWORKS.join(', ')}`)
        process.exit(1)
    }

    console.log(`\n🔍 스캔 시작: ${absolutePath}`)
    console.log(`   프레임워크: ${framework}\n`)

    const files = await collectFiles(absolutePath, framework)

    if (files.length === 0) {
        console.error('❌ 파싱 가능한 파일을 찾지 못했어요.')
        console.error('   Spring:   *Controller.java')
        console.error('   FastAPI:  *.py')
        console.error('   NestJS:   *.controller.ts')
        console.error('   Express:  *-routes.ts / *-routes.js')
        process.exit(1)
    }

    console.log(`📁 발견된 파일 ${files.length}개\n`)

    // Express: 진입점 파일에서 base path 맵 추출
    const basePathMap = (framework === 'express' || framework === 'auto')
        ? await loadExpressBasePaths(absolutePath)
        : {}

    const endpoints = await parseFiles(files, framework, basePathMap)

    if (endpoints.length === 0) {
        console.error('❌ 엔드포인트를 찾지 못했어요.')
        console.error('   어노테이션/데코레이터가 올바르게 작성되어 있는지 확인해주세요.')
        process.exit(1)
    }

    const project = buildProject(endpoints, absolutePath)
    const dateStr = new Date().toISOString().slice(0, 10).replace(/-/g, '')
    const safeTitle = project.info.title.replace(/[^\w가-힣-]/g, '_')
    const outputFileName = `${safeTitle}_${dateStr}_spec.json`
    const outputPath = join(process.cwd(), outputFileName)

    writeFileSync(outputPath, JSON.stringify(project, null, 2), 'utf-8')

    console.log(`✅ 완료! 엔드포인트 ${endpoints.length}개 추출`)
    console.log(`📄 저장 위치: ${outputPath}`)
    console.log(`\n👉 웹앱에서 ${outputFileName}을 import해주세요.\n`)
}

// 파일 수집
const collectFiles = async (dir: string, framework: Framework): Promise<string[]> => {
    const files: string[] = []
    await walk(dir, files, framework)
    return files
}

// 폴더 재귀 탐색
const walk = async (dir: string, result: string[], framework: Framework): Promise<void> => {
    const entries = await readdir(dir, { withFileTypes: true })

    for (const entry of entries) {
        // node_modules, .git 등 제외
        if (shouldSkip(entry.name)) continue

        const fullPath = join(dir, entry.name)

        if (entry.isDirectory()) {
            await walk(fullPath, result, framework)
        } else if (isTargetFile(entry.name, framework)) {
            result.push(fullPath)
        }
    }
}

// 스킵할 폴더/파일
const shouldSkip = (name: string): boolean => {
    return [
        'node_modules', '.git', 'dist', 'build',
        '__pycache__', '.idea', '.venv', 'venv',
        '.aws-sam', '.serverless', 'site-packages',
        'coverage', '.next', '.nuxt',
    ].includes(name)
}

// 프레임워크별 대상 파일 판단
const isTargetFile = (name: string, framework: Framework): boolean => {
    switch (framework) {
        case 'spring':
            return name.endsWith('Controller.java')
        case 'fastapi':
            return name.endsWith('.py') && !name.startsWith('test_')
        case 'nestjs':
            return name.endsWith('.controller.ts')
        case 'express':
            return name.endsWith('-routes.ts') || name.endsWith('-routes.js')
        case 'flask':
            return name.endsWith('.py') && !name.startsWith('test_')
        case 'auto':
            return (
                name.endsWith('Controller.java') ||
                name.endsWith('.controller.ts') ||
                (name.endsWith('.py') && !name.startsWith('test_')) ||
                name.endsWith('-routes.ts') ||
                name.endsWith('-routes.js')
            )
    }
}

// Express 앱 진입점에서 base path 맵 추출
const loadExpressBasePaths = async (dir: string): Promise<Record<string, string>> => {
    const candidates = ['index.ts', 'index.js', 'app.ts', 'app.js', 'main.ts', 'main.js']

    const searchDirs = [dir, join(dir, 'src')]
    for (const searchDir of searchDirs) {
        for (const candidate of candidates) {
            const filePath = join(searchDir, candidate)
            try {
                const source = await readFile(filePath, 'utf-8')
                const map = parseExpressBasePaths(source)
                if (Object.keys(map).length > 0) {
                    return map
                }
            } catch {
                // 파일 없으면 skip
            }
        }
    }
    return {}
}

// 파일 파싱
const parseFiles = async (
    files: string[],
    framework: Framework,
    basePathMap: Record<string, string> = {}
): Promise<Endpoint[]> => {
    const endpoints: Endpoint[] = []

    for (const file of files) {
        try {
            const source = await readFile(file, 'utf-8')
            const detected = framework === 'auto' ? detectFramework(file) : framework

            let parsed: Endpoint[]
            if (detected === 'express') {
                // 파일명(확장자 제외)으로 base path 조회
                const fileName = file.split(/[\\/]/).pop()?.replace(/\.[^.]+$/, '') ?? ''
                const basePath = basePathMap[fileName] ?? ''
                parsed = parseExpress(source, basePath)
            } else {
                parsed = parseByFramework(source, detected)
            }

            if (parsed.length > 0) {
                console.log(`  ✓ ${file.split(/[\\/]/).pop()} → ${parsed.length}개`)
                endpoints.push(...parsed)
            }
        } catch (err) {
            console.warn(`  ⚠️  ${file} 파싱 실패: ${(err as Error).message}`)
        }
    }

    return endpoints
}

// 파일 확장자/이름으로 프레임워크 자동 감지
const detectFramework = (filePath: string): Exclude<Framework, 'auto'> => {
    if (filePath.endsWith('.java')) return 'spring'
    if (filePath.endsWith('.controller.ts')) return 'nestjs'
    if (filePath.endsWith('-routes.ts') || filePath.endsWith('-routes.js')) return 'express'
    // Python 파일: Flask vs FastAPI 구분
    if (filePath.endsWith('.py')) return detectPythonFramework(filePath)
    return 'fastapi'
}

// Python 파일 내용으로 Flask vs FastAPI 구분
const detectPythonFramework = (filePath: string): 'flask' | 'fastapi' => {
    try {
        const source = readFileSync(filePath, 'utf-8')
        if (/from flask|import flask|Blueprint\s*\(|\.route\s*\(/i.test(source)) return 'flask'
        return 'fastapi'
    } catch {
        return 'fastapi'
    }
}

// 프레임워크별 파서 호출 (express 제외 — 별도 처리)
const parseByFramework = (source: string, framework: Exclude<Framework, 'auto'>): Endpoint[] => {
    switch (framework) {
        case 'spring': return parseSpring(source)
        case 'fastapi': return parseFastAPI(source)
        case 'nestjs': return parseNestJS(source)
        case 'flask': return parseFlask(source)
        case 'express': return parseExpress(source) // basePath 없이 fallback
    }
}

// 엔드포인트 목록으로 Project 구성
const buildProject = (endpoints: Endpoint[], scanPath: string): Project => {
    const tags = [...new Set(endpoints.flatMap(e => e.tags))]
    const folderName = scanPath.split(/[\\/]/).pop() ?? 'My Project'

    return {
        id: generateId(),
        info: {
            title: folderName,
            description: `${scanPath} 에서 자동 생성됨`,
            version: '1.0.0',
            baseUrl: '',
        },
        tags,
        endpoints,
        createdAt: now(),
        updatedAt: now(),
    }
}

// 도움말
const printHelp = () => {
    console.log(`
helloAPI CLI

사용법:
  npx helloapi-scanner scan [폴더경로] [옵션]
  폴더경로 생략 시 현재 디렉토리를 스캔합니다.

옵션:
  --framework=<이름>   프레임워크 지정 (기본값: auto)
                       spring | fastapi | nestjs | express | flask | auto

예시:
  npx helloapi-scanner scan
  npx helloapi-scanner scan ./src
  npx helloapi-scanner scan ./src --framework=spring
  npx helloapi-scanner scan ./app --framework=flask

지원 프레임워크:
  spring   *Controller.java 파일 스캔
  fastapi  *.py 파일 스캔
  nestjs   *.controller.ts 파일 스캔
  express  *-routes.ts / *-routes.js 파일 스캔
  flask    *.py 파일 스캔 (Flask Blueprint/route 패턴)
  auto     확장자/파일명으로 자동 감지

결과:
  프로젝트 루트에 spec.json 생성
  웹앱에서 해당 파일을 import 하세요.
  `)
}

run().catch(err => {
    console.error('❌ 오류 발생:', err.message)
    process.exit(1)
})