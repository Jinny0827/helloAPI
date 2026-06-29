# 🔍 HelloAPI — API Spec Explorer

API 명세를 입력받아 xlsx 문서로 출력하고, 파라미터를 입력해 실제 API를 즉시 테스트할 수 있는 도구입니다.  
내부 데이터 모델은 OpenAPI 스펙 구조 기반으로 설계되어, 추후 기능 추가 시 레이어 추가만으로 대응 가능합니다.

🌐 **서비스 URL**: [helloapi.bowling-manager.com](https://helloapi.bowling-manager.com)

---

## 📌 주요 기능

### 입력 방식 (4가지)
| 우선순위 | 방식 | 대상 |
|---|---|---|
| 1 | CLI 코드 파싱 → spec.json import | Spring / FastAPI / NestJS / Express / Flask |
| 2 | OpenAPI JSON import | 이미 문서화된 프로젝트 |
| 3 | curl 붙여넣기 | 문서 없는 프로젝트, 외부 API |
| 4 | 수동 직접 입력 | 신규 설계 단계 |

### 출력 기능
- **xlsx 출력**: 메서드별 컬러, 태그별 시트 분리, 블록 구조
- **OpenAPI 3.0 JSON 출력**: Swagger UI / Postman / Insomnia 바로 import 가능
- **API 테스트**: 파라미터 자동 폼 생성 → 실제 HTTP 요청 실행 → 응답 확인

---

## 🏗️ 서비스 구조

```
[CLI] 프로젝트 폴더 스캔 → 프로젝트명_날짜_spec.json 생성
[웹앱] spec.json import → 명세 확인 / 수정 / xlsx 출력 / OpenAPI 출력 / API 테스트
```

**아키텍처 레이어**
```
입력 (OpenAPI JSON / curl / 수동 / spec.json)
    ↓
내부 데이터 모델 (OpenAPI 구조 기반)
    ↓
┌──────────────┬──────────────┬──────────────────┐
xlsx 출력     API 테스트    OpenAPI JSON 출력
```

**패키지 구조 (모노레포)**
```
helloAPI/
├── packages/
│   ├── core/     # 내부 데이터 모델, 파서, 유효성 검사 (웹앱 + CLI 공유)
│   ├── web/      # React 웹앱
│   └── cli/      # Node.js CLI (npm: helloapi-scanner)
```

---

## 🛠️ 기술 스택

### 웹앱
| 항목 | 기술 |
|---|---|
| Framework | React + Vite |
| 상태관리 | Zustand |
| xlsx 생성 | xlsx-js-style |
| HTTP 테스트 | fetch API |

### CLI
| 항목 | 기술 |
|---|---|
| Runtime | Node.js |
| Language | TypeScript |
| 번들러 | tsup |
| 배포 | npm registry (npx 실행) |
| 파일 파싱 | 정규식 직접 구현 |

### 배포
| 대상 | 방식 |
|---|---|
| 웹앱 | S3 + CloudFront |
| CLI | npm registry |

**CI/CD**: GitHub Actions → main 푸시 시 자동 빌드 → S3 sync → CloudFront 캐시 무효화

---

## 🖥️ CLI 사용법

```bash
# 프로젝트 루트에서 실행
npx helloapi-scanner scan

# 생성된 spec.json을 웹앱에서 import
# → 명세 확인 후 xlsx 출력 또는 API 테스트
```

**지원 프레임워크**
| 프레임워크 | 파싱 대상 |
|---|---|
| Spring | @GetMapping, @RequestParam, @PathVariable, @RequestBody |
| FastAPI | @app.get, 타입힌트, Query() |
| NestJS | @Get, @Param, @Query, @Body |
| Express | router.get/post 등 라우트 파일 |
| Flask | @bp.route, request.args.get(), Blueprint |

---

## 📋 xlsx 출력 스펙

- 태그별 시트 분리 (태그 없는 엔드포인트 → `General` 시트)
- 메서드별 배경색: GET(초록) / POST(파랑) / PUT(주황) / PATCH(보라) / DELETE(빨강)
- 400 이상 응답 코드 빨간색 강조

---

## 🚧 TODO

- [ ] CORS 프록시 서버 (Lambda)
- [ ] 응답 스키마 정의 (중첩 객체, $ref)
- [ ] 서버 / Auth 설정 UI
- [ ] 계정 / 인증 도입 (현재 localStorage 기반)
- [ ] 국민/신한 카드 파서 추가
