# 과목 카테고리 → AI 프롬프트 반영 계획

## 배경
`subjects` 테이블의 `category` 컬럼에 상위 과목명이 저장됨 (예: `name=화법과작문`, `category=국어`).  
현재 프롬프트는 `name`만 전달하므로 AI가 과목 간 계열 관계를 모름.

## 변경 파일 및 내용

### 1. `lib/actions/ai-feedback.ts`
- exams 쿼리 `subjects ( id, name )` → `subjects ( id, name, category )`
- `subjectMap` 타입: `{ name, category, grades }` 추가
- `subjectMap.set` 시 `category: sub.category ?? null` 저장
- studyContexts 빌더에서 `category` 를 subjectMap에서 lookup하여 전달

### 2. `lib/ai/prompt.ts`
- `StudyFeedbackContext` 타입에 `category: string | null` 추가
- 프롬프트 라인에 `cat=${study.category}` 필드 추가 (category 있을 때만)

## 프롬프트 출력 예시 (변경 후)
```
sub=화법과작문 cat=국어 avg=82 last=80 delta=-2 ...
sub=수학I      cat=수학 avg=71 last=58 delta=-13 ...
sub=통합사회   cat=사회 avg=75 last=78 delta=+3 ...
```

## 변경 없는 파일
- `lib/analytics/` — 순수 수치 계산만 담당, category 불필요
- `components/` — UI에 category 표시 불필요 (프롬프트 내부 데이터)

## 영향 범위
총 2개 파일, 소규모 수정.
