# 🔌 helloAPI — API Spec Explorer

백엔드 코드를 스캔해서 API 명세(spec.json)를 자동으로 뽑아내고, 웹에서 정리·테스트·문서화까지 할 수 있는 툴입니다.

---

## 📌 주요 기능

### CLI — 코드에서 API 명세 추출
- Spring / FastAPI / NestJS / Express / Flask 프로젝트를 스캔해서 엔드포인트를 자동 추출
- 프레임워크 자동 감지(`auto`) 또는 `--framework` 옵션으로 직접 지정
- 결과를 `spec.json` 파일로 저장

### 웹앱 — 명세 관리 / 테스트 / 내보내기
- `spec.json` 또는 OpenAPI JSON을 import해서 프로젝트로 관리
- 엔드포인트 목록 조회, 태그별 정리, 직접 추가/수정
- API Tester로 실제 요청을 보내고 응답 확인
- OpenAPI 3.0 JSON / 스타일이 적용된 xlsx로 내보내기

---

## 🏗️ 프로젝트 구조 (pnpm 워크스페이스)

```
helloAPI/
├─ packages/
│   ├─ core/     # 공용 타입 정의 + 프레임워크별 파서 (@helloapi/core)
│   ├─ cli/      # 코드 스캐너 CLI (helloapi-scanner)
│   └─ web/      # React 웹앱 — 명세 관리 / 테스트 / 내보내기
```

---

## 🛠️ 기술 스택

| 영역 | 기술 |
|---|---|
| CLI | Node.js + TypeScript (tsx / tsup) |
| Core | TypeScript (프레임워크별 파서) |
| 웹앱 | React + TypeScript + Vite + Zustand |
| 내보내기 | xlsx-js-style (엑셀), OpenAPI 3.0 JSON |
| 배포 | S3 + CloudFront (GitHub Actions) |

---

## 🚀 사용법

### 1. CLI로 API 명세 추출

```bash
npx helloapi-scanner scan ./src
```

```
사용법:
  npx helloapi-scanner scan [폴더경로] [옵션]
  폴더경로 생략 시 현재 디렉토리를 스캔합니다.

옵션:
  --framework=<이름>   프레임워크 지정 (기본값: auto)
                       spring | fastapi | nestjs | express | flask | auto

지원 프레임워크:
  spring   *Controller.java 파일 스캔
  fastapi  *.py 파일 스캔
  nestjs   *.controller.ts 파일 스캔
  express  *-routes.ts / *-routes.js 파일 스캔
  flask    *.py 파일 스캔 (Flask Blueprint/route 패턴)
```

실행하면 현재 디렉토리에 `{프로젝트명}_{날짜}_spec.json`이 생성됩니다.

### 2. 웹앱에서 열기

```bash
pnpm install
pnpm dev
```

웹앱에서 방금 생성된 `spec.json`을 import하면 엔드포인트 목록 확인, API 테스트, xlsx/OpenAPI 내보내기가 가능합니다.

---

## 📦 로컬 개발

```bash
pnpm install       # 전체 워크스페이스 설치

pnpm dev           # 웹앱 개발 서버 실행
pnpm build         # 웹앱 빌드
pnpm cli           # CLI 실행 (packages/cli)
```
