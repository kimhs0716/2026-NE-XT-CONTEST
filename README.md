# Scorepilot

> AI 기반 학업 관리 시스템 — 성적 분석, 예측, 맞춤 학습 전략 제공

고려대학교 정보대학 소프트웨어 경진대회 **NE:XT Contest 2026** 출품작

---

## 프로젝트 소개

중·고등학생들은 성적이 오르거나 내려가도 그 원인을 정확히 파악하지 못하고 **감에 의존하는 경우가 많습니다.**  
기존 학습 도구(캘린더, 문제집, 인강 등)는 풍부하지만, 자신의 학습 상태를 **객관적으로 분석**해주는 도구는 부족합니다.

**Scorepilot**은 학생의 성적 데이터와 학습 기록을 바탕으로:
- 성적 변화 원인을 시각적으로 분석하고
- 다음 시험 점수를 AI로 예측하며
- 지금 당장 실천 가능한 맞춤 학습 전략을 제시합니다

향후 학생·교사 계정을 분리하면 **학원 학생 관리 시스템**으로도 확장 가능합니다.

---

## 화면 구성

| 페이지 | 경로 | 설명 |
|--------|------|------|
| 메인(랜딩) | `/` | 서비스 소개, 로그인/회원가입 유도 |
| 로그인 | `/login` | 이메일·비밀번호 로그인 |
| 회원가입 | `/signup` | 신규 사용자 등록 (학교급 선택 포함) |
| 대시보드 | `/dashboard` | 성적 요약, 일정 캘린더, 할 일 한눈에 보기 |
| 성적 관리 | `/grades` | 과목별 시험·수행평가 성적 입력·수정·삭제 |
| 과목 상세 | `/grades/[subject]` | 과목별 전체 성적 이력 및 예측 그래프 |
| 성적 분석 | `/analytics` | 추이 그래프, 공부 기록, 카테고리별 피드백, 예측 |
| 과목별 분석 | `/analytics/[subject]` | 과목 단위 상세 분석 및 예측 |
| 캘린더 | `/calendar` | 시험·수행평가·과제 일정 등록 및 확인 |
| 맞춤전략 | `/strategy` | 성적·공부 기록·일정 기반 AI 학습 전략 |
| 모의고사 | `/mock-exam` | 고등학생 전용 수능 모의고사 성적 관리 |

---

## 핵심 기능

### 1. 사용자 계정 관리
- Supabase Auth 기반 회원가입 / 로그인 (이메일·비밀번호)
- 가입 시 학교급(중학교/고등학교) 등록 — 이후 기능 분기의 기반
- 사용자별 데이터 완전 분리 (RLS 적용)
- `proxy.ts`(Next.js 16) 기반 라우트 보호 및 세션 갱신

### 2. 성적 입력 및 관리
- 과목별·학기별·시험 종류별로 성적 입력·수정·삭제
- 과목 상세 페이지에서 전체 이력 통합 관리
- Server Action으로 서버 측 데이터 처리

### 3. 성적 추이 시각화
- Recharts 꺾은선 그래프로 학기별 점수 변화 시각화
- 학교급에 따라 Y축 자동 전환 (고등: 1~9등급 역축 / 중등: 0~100점)
- 과목 카테고리(국어, 수학 등) 단위 집계 필터 제공
- 예측 점수도 같은 그래프에 함께 표시

### 4. 학업 일정 캘린더
- 시험, 수행평가, 과제, 학원 등 일정 등록·조회·삭제
- 대시보드 미니 캘린더 + 캘린더 전체 페이지 이중 확인
- 다가오는 일정 자동 정렬 표시

### 5. 성적 분석
- 과목별 평균, 최근 변화량, 변동성(표준편차) 산출
- 위험도 3단계 분류 (위험/주의/안정) + 구체적 판정 이유 제공
- 분석 피드백을 과목 카테고리 단위로 집계하여 시인성 개선

### 6. 맞춤 학습 전략
- Google Gemini API로 개인 맞춤 학습 전략 자동 생성
- 원본 데이터가 아닌 분석 파이프라인을 거친 지표를 압축 프롬프트로 전달
- API 호출 실패 시 규칙 기반 fallback 함수로 서비스 무중단 유지

### 7. 성적 예측
- 외부 ML 라이브러리 없이 자체 구현한 가중 이동 평균 + 선형 회귀 결합 알고리즘
- 예측값과 함께 신뢰도(0.35~0.95) 및 분석 근거 표시
- 데이터가 1개인 초기 상태에서도 에러 없이 동작

### 8. 공부 기록 및 할 일 관리
- 실제 공부 시간, 난이도, 집중도, 내용 기록
- 공부 할 일 추가·수정·완료 처리
- 맞춤전략을 공부 할 일로 전환하는 워크플로 지원

### 9. 모의고사 관리 (고등학생 전용)
- 수능 모의고사 성적(원점수, 백분위, 등급, 목표점수) 회차별 기록
- 내신 성적 체계와 분리된 별도 페이지 — 중학생에게는 메뉴 미표시
- URL 직접 접근도 서버 컴포넌트 레벨에서 차단

---

## 기술 스택

| 분류 | 기술 | 용도 |
|------|------|------|
| 프레임워크 | Next.js 16 (App Router, Turbopack) | 라우팅, SSR, Server Actions |
| 스타일링 | Tailwind CSS v4 | 전체 레이아웃 및 유틸리티 |
| UI 컴포넌트 | shadcn/ui | 버튼, 폼, 모달, 테이블 등 |
| Auth + DB | Supabase | 인증, PostgreSQL DB, RLS |
| AI | Google Gemini API (`@google/genai`) | 맞춤 학습 전략 문장 생성 |
| 차트 | Recharts | 성적 추이 그래프 |
| 배포 | Vercel | HTTPS, 자동 배포 (main 브랜치) |

---

## DB 설계 (Supabase)

RLS(Row Level Security) 정책이 적용되어 각 사용자는 자신의 데이터만 조회·수정 가능합니다.

| 테이블 | 설명 |
|--------|------|
| `profiles` | 사용자 기본 정보 (이름, 학교급) |
| `subjects` | 사용자별 과목 목록 |
| `subject_goals` | 과목별 목표 점수 |
| `exams` | 시험 단위 (종류, 날짜, 만점) |
| `grade_records` | 실제 성적 점수 (`percentage` 자동 계산 컬럼 포함) |
| `schedules` | 캘린더 일정 (시험/수행평가/학원 등) |
| `study_tasks` | 공부 할 일 체크리스트 |
| `study_logs` | 실제 공부 기록 (시간, 난이도, 집중도) |
| `analysis_reports` | AI 분석 결과 저장 (재사용) |
| `score_predictions` | AI 성적 예측 결과 |
| `mock_exam_records` | 수능 모의고사 성적 (고등학생 전용) |

> 전체 스키마: `initial_schema_Scorepilot.sql`

---

## 프로젝트 구조

```
scorepilot/
├─ app/
│  ├─ (auth)/
│  │  ├─ login/page.tsx
│  │  └─ signup/page.tsx
│  ├─ (main)/
│  │  ├─ dashboard/page.tsx
│  │  ├─ grades/
│  │  │  ├─ page.tsx
│  │  │  └─ [subject]/page.tsx
│  │  ├─ analytics/
│  │  │  ├─ page.tsx
│  │  │  └─ [subject]/page.tsx
│  │  ├─ calendar/page.tsx
│  │  ├─ strategy/page.tsx
│  │  └─ mock-exam/page.tsx       (고등학생 전용)
│  ├─ layout.tsx
│  └─ page.tsx                    (랜딩 페이지)
├─ components/
│  ├─ ui/                         (shadcn/ui 컴포넌트)
│  ├─ analytics/                  (그래프, 분석 카드, 예측 섹션)
│  ├─ grades/                     (성적 입력·수정 폼)
│  ├─ calendar/                   (캘린더 뷰)
│  ├─ dashboard/                  (대시보드 캘린더)
│  ├─ mock-exam/                  (모의고사 폼·테이블)
│  ├─ strategy/                   (학습 전략 카드)
│  └─ layout/                     (Nav, LogoutButton)
├─ lib/
│  ├─ actions/                    (Server Actions)
│  ├─ ai/                         (Gemini 프롬프트·호출·fallback)
│  ├─ analytics/                  (metrics, risk, strategy, prediction)
│  ├─ constants/                  (공유 상수·타입)
│  └─ supabase/                   (브라우저/서버 클라이언트)
├─ types/
│  └─ index.ts
├─ proxy.ts                       (Next.js 16 라우트 보호 + 세션 갱신)
└─ .env.local
```

---

## 시작하기

### 사전 요구사항

- Node.js 18 이상
- Supabase 계정 ([supabase.com](https://supabase.com))
- Google AI Studio API 키 — Gemini API 사용 시 필요 ([aistudio.google.com](https://aistudio.google.com))

### 설치

```bash
git clone https://github.com/kimhs0716/2026-NE-XT-CONTEST.git
cd 2026-NE-XT-CONTEST/scorepilot
npm install
```

### 환경 변수 설정

`.env.local`을 만들고 아래 값을 입력하세요:

```
NEXT_PUBLIC_SUPABASE_URL=https://xxxx.supabase.co
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=your_publishable_key

# Gemini AI 피드백 (선택 — 미설정 시 규칙 기반 fallback 동작)
GEMINI_API_KEY=your_gemini_api_key
GEMINI_MODEL=gemini-3.1-flash-lite
```

### 개발 서버 실행

```bash
cd scorepilot
npm run dev
# http://localhost:3000
```

---

## 개발 로드맵

**기반**
- [x] 기획 및 화면 설계
- [x] DB 설계 (11개 테이블 + RLS)

**Phase 1 — 셋팅**
- [x] Next.js 16 프로젝트 생성 (TypeScript, Tailwind, App Router)
- [x] Supabase 프로젝트 생성 및 라이브러리 설치
- [x] RLS 설정

**Phase 2 — 로그인 / 회원가입**
- [x] `proxy.ts` 기반 라우트 보호 (Next.js 16)
- [x] 회원가입 (학교급 선택 포함) / 로그인 구현

**Phase 3 — 랜딩 페이지**
- [x] 서비스 소개 + 로그인/회원가입 유도

**Phase 4 — 성적 관리**
- [x] 성적 입력·수정·삭제 (Server Actions)
- [x] 과목 상세 페이지

**Phase 5 — 성적 추이 그래프**
- [x] 학기별 꺾은선 그래프 (Recharts)
- [x] 학교급별 Y축 자동 전환 (고등: 등급 / 중등: 원점수)
- [x] 카테고리 단위 필터

**Phase 6 — 성적 분석 및 맞춤 학습 전략**
- [x] 위험도 3단계 분류 + 판정 이유
- [x] 카테고리별 집계 피드백 카드
- [x] 공부 기록·할 일 관리

**Phase 7 — AI 성적 예측**
- [x] 자체 구현 예측 알고리즘 (가중 이동 평균 + 선형 회귀)
- [x] Gemini API 맞춤 학습 전략 + 규칙 기반 fallback

**Phase 8 — 학업 일정 캘린더**
- [x] 월별 캘린더 뷰
- [x] 대시보드 미니 캘린더

**Phase 9 — 대시보드**
- [x] 성적 요약 + 일정 + 할 일 한 화면 통합
- [x] 학교급별 내신/모의고사 카드 분기

**Phase 10 — UI 정리**
- [x] 공통 네비게이션 (학교급별 메뉴 분기)
- [x] 고등학생 전용 모의고사 페이지
- [ ] 모바일 반응형 최적화

**Phase 11 — 배포**
- [x] GitHub → Vercel 자동 배포 (main 브랜치)
- [x] Vercel 환경 변수 등록

---

## 라이선스

본 프로젝트는 NE:XT Contest 2026 출품 목적으로 제작되었습니다.
