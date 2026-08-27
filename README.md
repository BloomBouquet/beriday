# Beriday (버리데이)

공공데이터를 바탕으로 사용자가 선택한 지역의 생활쓰레기 배출 일정을 빠르게 확인하는 웹 앱입니다.

## 현재 구현 상태

핵심 도메인 계층과 React/Vite 웹 앱 기반이 구현되어 있습니다.

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
- React/Vite 첫 방문 화면
- 시/도 → 시/군/구 → 관리구역 지역 선택 흐름
- 선택 지역 LocalStorage 저장 및 재진입 복원
- Today 화면 진입 상태
- 행정안전부 전국생활쓰레기배출정보 표준 CSV source parser
- UTF-8 BOM, quoted comma/newline, escaped quote 처리
- 공식 CSV 필수 헤더 및 필수 지역 키 검증

## 검증

```bash
npm install
npm run test:domain
npm test
npm run typecheck
npm run build
```

GitHub Actions에서도 도메인 테스트, UI 테스트, TypeScript 검사, production build를 함께 검증합니다.

## 데이터 원칙

실제 production 일정은 행정안전부 전국생활쓰레기배출정보표준데이터 원본을 정규화하고 검증한 뒤 사용합니다.

공식 출처:
- https://www.data.go.kr/data/15025450/standard.do?recommendDataYn=Y
- https://www.data.go.kr/data/15075534/fileData.do?recommendDataYn=Y

- `data/fixtures`는 테스트 전용이며 실제 지자체 배출 규칙으로 사용하지 않습니다.
- production 앱에는 테스트용 지역 catalog를 기본으로 포함하지 않습니다.
- 공식 지역 catalog가 연결되지 않은 상태에서는 지역 선택 화면에 `지역 데이터 준비 중`을 표시합니다.
- 공식 일정이 연결되기 전에는 배출 가능 여부를 추측하거나 생성하지 않습니다.
- GPS와 상세 주소를 요청하거나 저장하지 않습니다.
- CSV source parser는 `관리구역명`과 `관리구역대상지역명`을 별도로 보존합니다.
- `관리구역명`은 `1권역` 같은 수거 관리권역일 수 있으므로 사용자 행정동으로 간주하지 않습니다.
- `관리구역대상지역명`의 실제 대상지역과 수거 관리권역 사이의 매핑은 별도 canonical mapping 단계에서 검증한 뒤 UI에 연결합니다.

다음 구현 단계는 source parser 결과를 사용자 대상지역 → 수거 관리권역 구조로 변환하고, 그 검증된 mapping을 기존 region/rule 도메인에 연결하는 작업입니다.
