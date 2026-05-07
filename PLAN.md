# Scorepilot 구현 계획

---

## 개발 순서

### Phase 1. 셋팅 ✅

1. `create-next-app`으로 Next.js 16 프로젝트 생성 (TypeScript, Tailwind, App Router)
2. Supabase, shadcn/ui, Recharts 패키지 설치
3. Supabase 대시보드에서 14개 테이블 생성 및 RLS 설정 (`initial_schema_Scorepilot.sql`)
4. 브라우저용 / 서버용 Supabase 클라이언트 파일 분리 생성
5. `.env.local`에 Supabase 환경 변수 등록

---

### Phase 2. 로그인 / 회원가입 ✅

1. 미들웨어(`middleware.ts`)로 라우트 보호
   - 비로그인 → `/login` 리다이렉트
   - 로그인 상태에서 `/login`, `/signup` 접근 → `/dashboard` 리다이렉트
2. 회원가입 페이지 (`/signup`) — 이메일·비밀번호 입력, Supabase Auth 연동
3. 로그인 페이지 (`/login`) — 이메일·비밀번호 입력, Supabase Auth 연동
4. 공통 헤더에 로그아웃 버튼 배치

---

### Phase 3. 메인(랜딩) 페이지 (`/`) ✅

- 서비스 소개 + 로그인/회원가입 유도 버튼
- 로그인 상태면 `/dashboard`로 자동 이동

---

### Phase 4. 성적 입력 및 관리 (`/grades`) ✅

1. 서버에서 해당 유저 성적 데이터 조회 후 렌더링
2. 입력 폼: 과목명, 시험 종류, 점수, 날짜
3. 입력·수정·삭제는 Server Actions으로 처리 (API Route 불필요)
4. 성적 목록을 테이블로 표시

---

### Phase 5. 성적 추이 그래프 (`/analytics`)

1. 성적 데이터를 과목별로 그룹핑
2. Recharts `LineChart`로 시험 날짜 기준 점수 변화 시각화
3. 전체 평균 라인 추가
4. 차트 컴포넌트는 Client Component로 분리

---

### Phase 6. 성적 분석 및 맞춤 학습 전략 (`/analytics`)

1. 성적 데이터 기반으로 프론트에서 직접 계산
   - 과목별 평균, 최근 성적 변화, 취약 과목 감지
2. 규칙 기반 피드백 생성
   - ex) 3회 연속 하락 → 복습 필요 안내
3. 강점·약점 과목 리스트 및 과목별 한 줄 피드백 출력

---

### Phase 7. AI 성적 예측 (`/analytics`)

1. 유저의 과목별 성적 이력을 AI API에 전달
2. 다음 시험 예측 점수 + 코멘트 반환
3. API 호출은 Server Action에서 처리 (API 키 클라이언트 노출 방지)
4. AI API 키 환경 변수 등록 (사용할 서비스 결정 후 추가)

---

### Phase 8. 학업 일정 캘린더 (`/calendar`)

1. 일정 등록 폼: 제목, 종류(시험/수행평가/과제), 날짜
2. shadcn/ui `Calendar` 기반 월별 뷰 렌더링
3. 일정 CRUD는 Server Actions으로 처리

---

### Phase 9. 대시보드 (`/dashboard`)

- 최근 성적 요약
- 다가오는 일정
- 취약 과목 한눈에 보기
- 각 항목에서 해당 페이지로 링크

---

### Phase 10. UI 정리 및 반응형

1. 공통 네비게이션 구성
2. 전체 반응형 레이아웃 점검

---

### Phase 11. 배포

1. GitHub 레포와 Vercel 연결
2. Vercel에 환경 변수 등록 (Supabase, AI API 키)
3. 배포 후 동작 최종 확인

---

## 폴더 구조

```
app/
├── (auth)/
│   ├── login/page.tsx
│   └── signup/page.tsx
├── (main)/
│   ├── dashboard/page.tsx
│   ├── grades/page.tsx
│   ├── analytics/page.tsx
│   └── calendar/page.tsx
├── layout.tsx
└── page.tsx

components/
├── ui/                  ← shadcn/ui
├── grades/
├── analytics/
├── calendar/
└── dashboard/

lib/
├── supabase/
│   ├── client.ts
│   └── server.ts
└── actions/
    ├── grades.ts
    └── schedules.ts

types/
└── index.ts
```

---

## 핵심 설계 원칙

- 데이터 조회: Server Component에서 처리 → props로 전달
- 데이터 변경: Server Actions 사용 (API Route 최소화)
- 차트 등 브라우저 전용 라이브러리: Client Component로 분리
- 인증/세션: 미들웨어로 일괄 처리
- AI 호출: 서버에서만 실행 (API 키 보호)
