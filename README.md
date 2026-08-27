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
- Today 화면에서 공식 rule 기반 `가능`/`예정`/`마감`/`불가`/`확인 필요` 상태 계산
- rule이 없거나 ambiguous한 카테고리는 임의 판단하지 않고 `확인 필요` 처리
- 행정안전부 전국생활쓰레기배출정보 표준 CSV source parser
- UTF-8 BOM, quoted comma/newline, escaped quote 처리
- 공식 CSV 필수 헤더 및 필수 지역 키 검증
- `관리구역대상지역명` 기반 사용자 선택 지역 canonical catalog 생성
- 사용자 선택 지역과 `관리구역명` 수거권역을 별도 엔티티로 분리
- 동일 target→collection zone 중복 source provenance 병합
- 한 대상지역이 여러 수거권역에 매핑되면 selectable catalog에서 제외하고 ambiguous 보고
- 공식 target-area mapping을 기존 `CollectionRule` 정규화 계층으로 연결하는 adapter
- 공식 `+` 요일 구분자와 시작/종료 시각을 기존 parser 입력 계약으로 변환
- 원본 CSV `sourceRow`를 rule provenance와 validation error까지 유지
- 구체 날짜로 안전하게 표현할 수 없는 `미수거일`은 verified rule 생성을 차단
- 공식 CSV → parser → adapter 결과를 `schemaVersion: 1` production bundle로 조합
- bundle에 source/mapping/normalization/adapter 검증 report를 함께 보존
- Region/CollectionRule을 locale/ICU 비의존 UTF-16 코드 단위 순서로 정렬해 deterministic output 보장
- production bundle을 2-space pretty JSON + 단일 trailing newline 형식으로 deterministic 직렬화
- JSON asset loader에서 malformed JSON, 지원하지 않는 schema version, 필수 top-level shape를 fail-fast 검증
- 공식 CSV 파일을 deterministic JSON asset으로 만드는 CLI build command
- CLI 필수 인자 검증 및 CSV validation 실패 시 기존 output 보존
- 브라우저 시작 시 `/data/official-data.json`을 read-only로 로드하고 schema v1 검증 후 지역/rule을 앱에 주입
- 공식 asset HTTP 오류 또는 malformed JSON이면 fallback 없이 `데이터를 불러오지 못했습니다.` 상태로 fail-closed

## 검증

```bash
npm install
npm run test:domain
npm test
npm run typecheck
npm run build
```

GitHub Actions에서도 도메인 테스트, UI 테스트, TypeScript 검사, production build를 함께 검증합니다.

## 공식 데이터 asset 생성

먼저 공식 생활쓰레기 CSV 파일을 준비한 뒤 아래처럼 실행합니다.

```bash
npm run build:official-data -- \
  --input ./data/raw/official.csv \
  --output ./public/data/official-data.json \
  --imported-at 2026-08-27T15:45:00.000Z
```

- `--input`, `--output`, `--imported-at`은 모두 필수입니다.
- `--imported-at`을 명시적으로 전달해 동일 입력으로 재현 가능한 asset을 만듭니다.
- 명령은 먼저 domain TypeScript를 빌드한 뒤 공식 CSV parser → canonical mapping → rule adapter → bundle → serializer 순서로 실행됩니다.
- CSV/header/domain 검증이 실패하면 output 쓰기 전에 종료하므로 기존 asset을 덮어쓰지 않습니다.
- 실제 공식 CSV 전체 ingest가 검증되기 전에는 fixture 기반 JSON을 production asset으로 사용하지 않습니다.

## 브라우저 데이터 로딩

production 앱은 시작할 때 같은 origin의 `/data/official-data.json`만 읽습니다.

- 응답이 성공하면 `loadOfficialDataAsset()`으로 schema version과 필수 top-level shape를 검증합니다.
- 검증된 `regions`만 지역 선택 catalog로 사용합니다.
- 검증된 `rules`만 선택 지역의 Today 계산에 사용합니다.
- HTTP 오류, JSON 파싱 오류, 지원하지 않는 schema version은 모두 오류 상태로 전환합니다.
- 오류 상태에서는 테스트 fixture나 임의 지역을 fallback으로 노출하지 않습니다.
- verified rule이 없는 카테고리는 `불가`로 단정하지 않고 `확인 필요`로 표시합니다.

## 데이터 원칙

실제 production 일정은 행정안전부 전국생활쓰레기배출정보표준데이터 원본을 정규화하고 검증한 뒤 사용합니다.

공식 출처:
- https://www.data.go.kr/data/15025450/standard.do?recommendDataYn=Y
- https://www.data.go.kr/data/15075534/fileData.do?recommendDataYn=Y

- `data/fixtures`는 테스트 전용이며 실제 지자체 배출 규칙으로 사용하지 않습니다.
- production 앱에는 테스트용 지역 catalog를 기본으로 포함하지 않습니다.
- production official asset이 없거나 검증에 실패하면 지역/일정을 추측하지 않고 오류 상태를 표시합니다.
- 공식 일정이 연결되기 전에는 배출 가능 여부를 추측하거나 생성하지 않습니다.
- GPS와 상세 주소를 요청하거나 저장하지 않습니다.
- CSV source parser는 `관리구역명`과 `관리구역대상지역명`을 별도로 보존합니다.
- `관리구역명`은 `1권역` 같은 수거 관리권역일 수 있으므로 사용자 행정동으로 간주하지 않습니다.
- `관리구역대상지역명`에 명시된 대상지역만 사용자 선택 지역 후보로 생성합니다.
- 대상지역 정보가 없는 source row는 임의의 선택 지역을 생성하지 않고 unresolved로 보고합니다.
- 같은 대상지역이 서로 다른 수거권역에 연결되면 임의로 하나를 선택하지 않고 selectable catalog에서 제외합니다.
- 같은 대상지역→수거권역 연결이 여러 source row에 반복되면 association은 하나로 합치되 source row와 기준일 provenance는 보존합니다.
- 공식 일정 adapter는 안전한 selectable target area에 대해서만 생활/음식물/재활용 `CollectionRule`을 생성합니다.
- 공식 CSV의 `월+수+금` 같은 요일 표현은 기존 요일 parser가 처리할 수 있도록 구분자만 정규화합니다.
- 시작/종료 시각은 기존 시간 parser가 검증하도록 하나의 range 문자열로 조립하며, 값이 불완전하면 rule을 생성하지 않습니다.
- `미수거일`이 `YYYY-MM-DD` 목록이면 excluded date로 변환하지만 `명절`, `임시공휴일`처럼 현재 모델이 정확히 표현할 수 없는 의미가 포함되면 해당 source row의 rule 생성을 차단합니다.
- schedule parsing error와 rule provenance는 adapter에서 재번호화하지 않고 공식 CSV `sourceRow`를 유지합니다.
- production bundle은 raw CSV row를 다시 포함하지 않고 앱에 필요한 canonical Region/CollectionRule과 검증 report만 보존합니다.
- 같은 CSV와 같은 `importedAt` 입력은 런타임 locale 설정에 관계없이 동일한 Region/CollectionRule ordering을 갖습니다.
- asset serializer는 동일 bundle 입력에 동일한 JSON text를 만들고 파일 diff가 안정적이도록 정확히 하나의 trailing newline을 붙입니다.
- asset loader는 문자열만 읽으며 파일시스템/네트워크 I/O를 수행하지 않습니다.
- 실제 공식 CSV 전체 ingest가 성공하기 전에는 테스트 fixture로 만든 JSON을 production asset처럼 커밋하지 않습니다.

다음 구현 단계는 실제 전국 공식 CSV 전체 ingest를 수행해 production asset을 생성·검증하고, 검증 report와 출처 정보를 사용자 화면에 연결하는 작업입니다.
