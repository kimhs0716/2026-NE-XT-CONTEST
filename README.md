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
| 회원가입 | `/signup` | 신규 사용자 등록 |
| 대시보드 | `/dashboard` | 성적 요약, 일정, 분석 결과 한눈에 보기 |
| 성적 관리 | `/grades` | 과목별 시험 점수 입력·수정·삭제 |
| 성적 분석 | `/analytics` | 추이 그래프, 약점 과목, 예측 점수 |
| 캘린더 | `/calendar` | 시험·수행평가·과제 일정 등록 및 확인 |

---

## 핵심 기능

### 1. 사용자 계정 관리
- Supabase Auth 기반 회원가입 / 로그인
- 사용자별 데이터 완전 분리 (RLS 적용)
- 세션 유지 및 로그아웃

### 2. 성적 입력 및 관리
- 과목명, 시험 종류(중간·기말·수행평가 등), 점수, 날짜 입력
- 입력된 데이터 수정

### 3. 성적 추이 시각화
- 과목별 점수 변화 꺾은선 그래프
- 전체 평균 추이 확인
- 특정 과목의 상승/하락 경향 파악

### 4. 학업 일정 캘린더
- 시험, 수행평가, 과제 등 학업 일정 등록
- 캘린더 뷰

### 5. 성적 분석
- 과목별 평균 및 최근 성적 변화 분석
- 상대적으로 취약한 과목 자동 감지
- 강점·약점 요약 리포트

### 6. 맞춤 학습 전략
- 성적 흐름 기반 과목별 피드백 제공
- 예: 특정 과목 3회 연속 하락 → 복습 필요 안내
- 즉시 실천 가능한 학습 방향 제시

### 7. 성적 예측 (AI)
- 입력된 성적·학습 기록 기반 다음 시험 예측 점수 제공
- 학습 동기 부여 수단으로 활용

---

## 기술 스택

| 분류 | 기술 | 용도 |
|------|------|------|
| 프레임워크 | Next.js 16 (App Router) | 라우팅, SSR, Server Actions |
| 스타일링 | Tailwind CSS | 전체 레이아웃 및 유틸리티 |
| UI 컴포넌트 | shadcn/ui | 버튼, 폼, 모달, 테이블 등 |
| Auth + DB | Supabase | 인증, PostgreSQL DB, RLS |
| 차트 | Recharts | 성적 추이 그래프 |
| 배포 | Vercel | HTTPS, 도메인, Next.js 최적화 |

---

## DB 설계 (Supabase)

14개 테이블 + RLS 정책 + 관리자 확인 함수로 구성됩니다.

| 테이블 | 설명 |
|--------|------|
| `profiles` | 사용자 기본 정보 (이름, 학교 구분) |
| `user_roles` | 관리자/일반사용자 권한 구분 |
| `subjects` | 사용자별 과목 목록 |
| `subject_goals` | 과목별 목표 점수 |
| `exams` | 시험 단위 (종류, 날짜, 만점) |
| `grade_records` | 실제 성적 점수 (percentage는 자동 계산 컬럼) |
| `schedules` | 캘린더 일정 (시험/과제/학원 등) |
| `study_tasks` | 공부 할 일 체크리스트 |
| `study_logs` | 실제 공부 기록 (시간, 난이도, 집중도) |
| `analysis_reports` | 성적 분석 결과 |
| `weakness_reports` | 취약 과목/단원 리포트 |
| `learning_recommendations` | 맞춤 학습 전략 추천 |
| `score_predictions` | AI 성적 예측 결과 |
| `admin_logs` | 관리자 작업 이력 |

> RLS(Row Level Security) 적용으로 각 사용자는 자신의 데이터만 조회·수정 가능  
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
│  │  ├─ grades/page.tsx
│  │  ├─ analytics/page.tsx
│  │  └─ calendar/page.tsx
│  ├─ layout.tsx
│  └─ page.tsx            (랜딩 페이지)
├─ components/
│  ├─ ui/                 (shadcn/ui 컴포넌트)
│  ├─ grades/             (성적 관련 컴포넌트)
│  └─ layout/             (Nav, LogoutButton 등)
├─ lib/
│  ├─ actions/            (Server Actions)
│  ├─ constants/          (공유 상수/타입)
│  └─ supabase/           (브라우저/서버 클라이언트)
├─ types/
│  └─ index.ts
└─ .env.local
```

---

## 시작하기

### 사전 요구사항

- Node.js 18 이상
- Supabase 계정 ([supabase.com](https://supabase.com))
- Vercel 계정 ([vercel.com](https://vercel.com)) — 배포 시 필요

### 설치

```bash
git clone https://github.com/your-repo/scorepilot.git
cd scorepilot
npm install
```

### 환경 변수 설정

`.env.local` 파일 생성 후 Supabase 프로젝트의 값을 입력하세요  
(Supabase 대시보드 → Project Settings → API):

```
NEXT_PUBLIC_SUPABASE_URL=https://xxxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_anon_key
```

### 개발 서버 실행

```bash
npm run dev
# http://localhost:3000
```

### Vercel 배포

```bash
# Vercel CLI 사용 시
npx vercel
```

또는 GitHub 레포를 Vercel에 연결하면 push할 때마다 자동 배포됩니다.

---

## 개발 로드맵

**기반**
- [x] 기획 및 화면 설계
- [x] DB 설계 (14개 테이블 + RLS)

**셋팅 (Phase 1)**
- [x] Next.js 프로젝트 생성 (TypeScript, Tailwind, App Router)
- [x] Supabase 프로젝트 생성 및 라이브러리 설치
- [x] Supabase 연결 파일 생성 (브라우저/서버 분리)
- [x] RLS 설정

**로그인 / 회원가입 (Phase 2)**
- [x] shadcn/ui 설치
- [x] 로그인 / 회원가입 구현 (이름, 학교 구분 포함)
- [x] 미들웨어 기반 라우트 보호

**랜딩 페이지 (Phase 3)**
- [x] 서비스 소개 + 로그인/회원가입 유도

**성적 관리 (Phase 4)**
- [x] 성적 입력 / 삭제 (Server Actions)
- [x] 성적 목록 테이블

**Main (진행 중)**
- [ ] 성적 추이 그래프 (Phase 5)
- [ ] 성적 분석 및 학습 전략 제공 (Phase 6)
- [ ] AI 성적 예측 기능 (Phase 7)
- [ ] 학업 캘린더 (Phase 8)
- [ ] 대시보드 제작 (Phase 9)
- [ ] UI 정리 및 반응형 대응 (Phase 10)

**배포 (Phase 11)**
- [ ] Vercel 배포

---

## 팀원

| 이름 | 역할 | 학번 | 학과 |
|------|------|------|------|
| 이무겸 | 기획 / 개발 | 2024320094 | 컴퓨터학과 |
| 김현수 | 개발 / 디자인 | 2024320087 | 컴퓨터학과 |

---

## 라이선스

본 프로젝트는 NE:XT Contest 2026 출품 목적으로 제작되었습니다.
