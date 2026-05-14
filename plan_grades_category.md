# 내신(grades) 카테고리 계층 반영 계획

## 현재 문제

`subjects` 테이블에 `category` 컬럼이 있지만 어디서도 저장·조회하지 않음.  
고등학생의 경우 `국어 > 화법과작문`, `수학 > 수학I` 같은 계층이 있는데  
현재는 모든 과목이 평면 카드 그리드로 표시됨.

---

## 변경 파일 목록 (6개)

### 1. `lib/constants/grades.ts`
**카테고리 목록 상수 추가 (세부 과목 목록은 제거)**

```ts
// 카테고리 선택 목록 (표시 순서 겸)
export const subjectCategories = [
  "국어", "수학", "영어", "사회", "과학",
  "한국사", "역사", "체육", "음악", "미술", "도덕",
];

// 카테고리 표시 순서 (grades 페이지 그룹 정렬용)
export const categoryOrder = subjectCategories;
```

세부 과목명은 사용자가 직접 입력.

---

### 2. `lib/actions/grades.ts`
**`addGrade` 서버 액션에 category 저장 추가**

- formData에서 `category` 추출
- subjects upsert 시 `category` 컬럼에 저장
- `updateGrade` 도 동일하게 처리

---

### 3. `components/grades/GradeForm.tsx`
**카테고리 드롭다운 + 과목명 텍스트 입력 UI**

```
[카테고리 선택 ▼]   [과목명 직접 입력________]
  국어                화법과작문
  수학                수학I
  영어                (사용자가 자유 입력)
```

- 카테고리: `subjectCategories` 드롭다운 (선택 선택)
- 과목명: 항상 text input (기존 custom 입력 방식으로 통일)
- 기존 "과목 선택 or 직접 입력" 분기 제거 → 단순화
- `hidden input`으로 `category` 값 폼에 포함

---

### 4. `app/(main)/grades/page.tsx`
**카테고리별 그룹 레이아웃으로 개편**

현재: 과목 카드 4컬럼 그리드 (평면)  
변경: 카테고리 섹션 헤더 + 해당 과목 카드들

```
── 국어 ──────────────────────────
  [화법과작문 82점]  [문학 79점]

── 수학 ──────────────────────────
  [수학I 58점]  [수학II 71점]

── 영어 ──────────────────────────
  [영어I 74점]
```

- subjects 쿼리에 `category` 추가
- category 없는 과목은 "기타" 섹션으로
- categoryOrder 기준으로 섹션 정렬

---

### 5. `app/(main)/grades/[subject]/page.tsx`
**카테고리 breadcrumb 및 컨텍스트 표시**

```
← 내신 / 국어            (현재: ← 내신)
화법과작문               (과목명)
```

- subjects 쿼리에 `category` 추가
- 헤더에 `국어 > 화법과작문` 형태 표시
- category 있을 때만 표시 (없으면 기존 그대로)

---

### 6. `lib/actions/ai-feedback.ts` + `lib/ai/prompt.ts`
**AI 프롬프트에 카테고리 반영**

- subjects 쿼리에 `category` 추가
- `StudyFeedbackContext`에 `category: string | null` 추가
- 프롬프트 라인: `sub=화법과작문 cat=국어 avg=82 ...`

---

## 구현 순서

1. `lib/constants/grades.ts` — 상수 추가
2. `lib/actions/grades.ts` — category 저장
3. `GradeForm.tsx` — 2단계 선택 UI
4. `grades/page.tsx` — 카테고리 그룹 레이아웃
5. `grades/[subject]/page.tsx` — breadcrumb
6. `ai-feedback.ts` + `prompt.ts` — 프롬프트 반영

---

## 변경하지 않는 것
- DB 스키마 (category 컬럼 이미 존재)
- analytics 페이지 (과목 단위로 표시 유지)
- SubjectCharts, GradeTable 컴포넌트 (내부 로직 무관)
