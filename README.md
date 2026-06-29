# 🛠️ nginx-devops-study

DevOps 관점에서 nginx를 활용한 현대적 웹 인프라 구축을 실습하는 스터디 레포입니다.  
이론(노션) + 실습(GitHub) 병행 방식으로 진행하며, 4주 커리큘럼으로 구성됩니다.

---

## 🎯 학습 목표

- Infrastructure as Code: 모든 인프라 설정을 코드로 관리
- 자동화: 배포, 테스트, 모니터링 자동화
- 관찰가능성: 시스템 상태 실시간 파악
- 보안: 다층 보안 체계 구축
- 확장성: 트래픽 증가에 대응 가능한 구조

---

## 🗓️ 주차별 커리큘럼

### 1주차 — Infrastructure as Code 기초
```
week1-infrastructure-setup/
├── scripts/
│   ├── macos-setup.sh        # 전체 환경 자동 설정
│   ├── nginx-install.sh      # nginx 설치 자동화
│   └── initial-config.sh     # 기본 설정 적용
├── configs/
│   ├── nginx.conf            # 메인 설정 파일
│   └── default.conf          # 기본 서버 블록
└── tests/
    └── basic-test.py         # 기본 동작 테스트
```

### 2주차 — 서비스 디스커버리 & 로깅 인프라
```
week2-service-management/
├── sites/                    # 멀티 사이트 설정
├── logging/                  # 커스텀 로그 포맷, 분석
└── monitoring/               # 서비스 상태, 업타임 모니터링
```

### 3주차 — CI/CD Pipeline & 보안 자동화
```
week3-cicd-security/
├── nginx-configs/            # 리버스 프록시, SSL, API Gateway
├── security/                 # SSL 인증서, Rate Limiting, 보안 헤더
├── deployment/               # 무중단 배포, 롤백 스크립트
└── docker/                   # Docker Compose 기반 배포
```

### 4주차 — Production-Ready 인프라
```
week4-production-ready/
├── load-balancing/           # 로드 밸런서, 헬스체크, 장애 복구
├── performance/              # 캐시, Gzip/Brotli 압축, 워커 튜닝
├── monitoring/               # Prometheus, Grafana, ELK Stack
└── testing/                  # 부하 테스트(K6), 보안 테스트, E2E 테스트
```

---

## 🏗️ 최종 아키텍처

```
[Internet]
    ↓
[nginx Load Balancer + SSL Termination]
    ↓
[nginx Reverse Proxy + API Gateway]
    ↓
[Microservices (Docker)]
    ↓
[Monitoring Stack (Prometheus + Grafana)]
    ↓
[Logging Pipeline (ELK)]
    ↓
[Backup & Recovery System]
```

---

## 🛠️ 도구 스택

| 분류 | 도구 |
|---|---|
| 웹서버 | nginx |
| 컨테이너 | Docker |
| 모니터링 | Prometheus + Grafana |
| 로그 분석 | ELK Stack |
| 성능 테스트 | Artillery / K6 |
| 보안 테스트 | OWASP ZAP |
| IaC | Terraform |
| 오케스트레이션 | Kubernetes |

---

## 📝 기여 가이드라인

1. 모든 설정 파일은 주석과 함께 작성
2. 스크립트는 실행 전 검증 단계 포함
3. 테스트 코드 필수 작성
