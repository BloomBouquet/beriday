# Beriday (버리데이)

공공데이터를 바탕으로 사용자가 선택한 지역의 생활쓰레기 배출 일정을 빠르게 확인하는 웹 앱입니다.

## 현재 구현 상태

이 작업공간에는 네트워크 의존성 없이 검증 가능한 핵심 도메인 계층이 구현되어 있습니다.

- 한국어 요일/시간 파서
- 지역 및 생활/음식물/재활용 규칙 정규화
- 충돌 규칙 `ambiguous` 보존
- Asia/Seoul 기준 일정 계산
- 자정 교차 시간대 처리
- 미수거일 우선 처리
- 다음 배출일 계산
- LocalStorage 저장 지역 검증
- 출처가 명시된 최소 품목 검색
- 공식 외부 링크 allowlist 검증

## 검증

```bash
npm run typecheck
npm run test:domain
```

현재 실행 환경은 npm registry 접근이 차단되어 React/Vite/Vitest/Playwright 의존성을 설치할 수 없습니다. UI scaffold와 브라우저 E2E는 온라인 개발 환경에서 계획 문서의 Task 1/6/7/9를 이어서 실행해야 합니다.

## 데이터 원칙

실제 production 일정은 행정안전부 생활쓰레기배출정보의 원본을 정규화한 뒤 사용합니다. `data/fixtures`는 테스트용 예시 데이터이며 실제 지자체 배출 규칙으로 사용하면 안 됩니다.
