# Scorepilot 구현 계획

---

## 개발 순서

### Phase 1. 셋팅 ✅

1. `create-next-app`으로 Next.js 16 프로젝트 생성 (TypeScript, Tailwind, App Router)
2. Supabase, shadcn/ui, Recharts, `@google/genai` 패키지 설치
3. Supabase 대시보드에서 12개 테이블 생성 및 RLS 설정 (`initial_schema_Scorepilot.sql`)
4. 브라우저용 / 서버용 Supabase 클라이언트 파일 분리 생성
5. `.env.local`에 Supabase 및 Gemini 환경 변수 등록

---

### Phase 2. 로그인 / 회원가입 ✅

1. `proxy.ts`(Next.js 16 컨벤션)로 라우트 보호
   - Supabase `createServerClient` + `getUser()`로 실제 세션 검증
   - 만료된 refresh token 자동 정리 (쿠키 삭제 후 로그인 리다이렉트)
   - 비로그인 → `/login` 리다이렉트
   - 로그인 상태에서 `/login`, `/signup` 접근 → `/dashboard` 리다이렉트
2. 회원가입 페이지 (`/signup`) — 이메일·비밀번호·학교급(중/고) 입력
3. 로그인 페이지 (`/login`) — 이메일·비밀번호 입력, Supabase Auth 연동
4. 공통 헤더에 로그아웃 버튼 배치
5. 학교급 데이터는 `profiles` 테이블에 저장 → 이후 전체 기능 분기 기반

---

### Phase 3. 메인(랜딩) 페이지 (`/`) ✅

- 서비스 소개 + 로그인/회원가입 유도 버튼
- 로그인 상태면 `/dashboard`로 자동 이동

---

### Phase 4. 성적 입력 및 관리 (`/grades`) ✅

1. 서버에서 해당 유저 성적 데이터 조회 후 렌더링
2. 입력 폼: 과목명, 시험 종류, 점수(원점수/만점), 등급, 날짜
3. 입력·수정·삭제는 Server Actions으로 처리
4. 과목 단위 상세 페이지 (`/grades/[subject]`) — 전체 이력 + 예측 그래프

---

### Phase 5. 성적 추이 그래프 (`/analytics`) ✅

1. 성적 데이터를 과목별·학기별로 그룹핑
2. Recharts `LineChart`로 점수 변화 시각화
3. 학교급에 따라 Y축 자동 전환
   - 고등학생: 1~9등급 역축 (`grade_level` 컬럼 사용)
   - 중학생: 0~100 원점수 (`percentage` 컬럼 사용)
4. 과목 카테고리(괄호 앞 문자열) 단위 집계 필터 제공
5. 전체 분석/과목별 분석 이동 드롭다운 추가

---

### Phase 6. 성적 분석 및 맞춤 학습 전략 (`/analytics`, `/strategy`) ✅

1. 성적 데이터 기반 지표 계산 (`lib/analytics/`)
   - 과목별 평균, 최근 성적 변화량, 변동성(표준편차)
2. 위험도 3단계 분류 (`high` / `medium` / `low` / `insufficient`)
   - high 조건: 최근 10점 이상 하락 OR 평균 60점 미만 OR 변동성 15점 이상
   - 판정 이유 문장도 함께 제공
3. 규칙 기반 학습 전략 생성 (`lib/analytics/strategy.ts`)
4. 분석 피드백을 과목 카테고리 단위로 집계하여 표시 (`CategoryAnalysisCard`)
5. `study_logs`, `study_tasks` 기반 최근 공부 기록/진행 중 할 일 표시
6. 맞춤전략 페이지에서 Gemini AI 기반 개인화 전략 제공

---

### Phase 7. AI 성적 예측 (`/analytics`) ✅

1. 자체 구현 예측 알고리즘 (`lib/analytics/prediction.ts`)
   - 가중 이동 평균(최근 회차 가중치 높음) + 최근 5회 선형 회귀 기울기 결합
   - 신뢰도(0.35~0.95)와 분석 근거 함께 산출
2. 예측 결과 DB 저장 (Server Action) → 재사용
3. Gemini API로 AI 학습 피드백 문장 생성
   - 원본 데이터가 아닌 분석 파이프라인 결과를 압축 프롬프트로 전달
   - API 실패 시 규칙 기반 fallback 자동 동작

---

### Phase 8. 학업 일정 캘린더 (`/calendar`) ✅

1. 일정 등록 폼: 제목, 종류(시험/수행평가/모의고사/학원 등), 날짜
2. 월별 캘린더 뷰 렌더링 (Client Component)
3. 일정 CRUD는 Server Actions으로 처리
4. 대시보드 미니 캘린더 컴포넌트 (`DashboardCalendar`) 별도 구현

---

### Phase 9. 대시보드 (`/dashboard`) ✅

- 성적 요약 (이번 학기 평균)
- 다가오는 2주 내 일정 자동 정렬 표시
- 이번 주 할 일 목록
- 학교급별 메뉴 카드 분기 (고등: 내신+모의고사 / 중등: 내신 전폭)
- 분석, 맞춤전략 바로가기 카드

---

### Phase 10. UI 정리 및 추가 기능 ✅

1. 공통 네비게이션 — 학교급별 메뉴 자동 분기 (서버 컴포넌트 렌더링)
2. 고등학생 전용 모의고사 페이지 (`/mock-exam`)
   - 원점수·백분위·등급·목표점수 회차별 기록
   - URL 직접 접근도 서버 레벨에서 차단
3. 로고·파비콘 적용
4. [ ] 모바일 반응형 최적화 (향후 개선 과제)

---

### Phase 11. 배포 ✅

1. GitHub 레포와 Vercel 연결 (main 브랜치 자동 배포)
2. Vercel에 환경 변수 등록 (Supabase, Gemini API 키)
3. 배포 후 동작 최종 확인

---

## 폴더 구조

```
scorepilot/
├── app/
│   ├── (auth)/
│   │   ├── login/page.tsx
│   │   └── signup/page.tsx
│   ├── (main)/
│   │   ├── dashboard/page.tsx
│   │   ├── grades/
│   │   │   ├── page.tsx
│   │   │   └── [subject]/page.tsx
│   │   ├── analytics/
│   │   │   ├── page.tsx
│   │   │   └── [subject]/page.tsx
│   │   ├── calendar/page.tsx
│   │   ├── strategy/page.tsx
│   │   └── mock-exam/page.tsx
│   ├── layout.tsx
│   └── page.tsx
├── components/
│   ├── ui/               ← shadcn/ui
│   ├── analytics/
│   ├── grades/
│   ├── calendar/
│   ├── dashboard/
│   ├── mock-exam/
│   ├── strategy/
│   └── layout/
├── lib/
│   ├── supabase/
│   │   ├── client.ts
│   │   └── server.ts
│   ├── actions/
│   ├── ai/               ← Gemini 프롬프트·호출·fallback
│   ├── analytics/        ← metrics, risk, strategy, prediction
│   └── constants/
├── types/
│   └── index.ts
└── proxy.ts              ← Next.js 16 라우트 보호
```

---

## 핵심 설계 원칙

- 데이터 조회: Server Component에서 처리 → props로 전달
- 데이터 변경: Server Actions 사용 (API Route 최소화)
- 차트 등 브라우저 전용 라이브러리: Client Component로 분리
- 인증/세션: `proxy.ts`에서 Supabase SSR로 일괄 처리 및 만료 토큰 자동 정리
- AI 호출: 서버에서만 실행 (API 키 보호), 실패 시 fallback 보장
- 학교급 분기: 서버 컴포넌트 레벨에서 처리 (클라이언트 노출 없음)
