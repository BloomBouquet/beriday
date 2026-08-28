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
- Settings에서 선택 지역 확인, 지역 재설정, 저장된 지역 삭제 지원
- Settings에서 GPS·상세 주소를 저장하지 않는 개인정보 경계 명시
- 저장된 지역 삭제 시 해당 LocalStorage 키만 제거하고 첫 방문 화면으로 복귀
- Settings에서 선택 지역의 공식 출처, 검증 요약, 정책 변경 주의사항 표시
- 출처가 명시된 최소 품목 검색
- 품목 검색 화면에서 공식 배출 가이드와 선택 지역 일정을 별도 근거로 표시
- 검색 결과가 없는 품목은 배출 방법을 임의 생성하지 않고 fail-closed 처리
- 검증된 지자체 대형폐기물 공식 절차 registry
- 검증된 대형폐기물 URL만 외부 링크로 제공하고 미검증 지역은 임의 링크를 생성하지 않음
- 대형폐기물 공식 링크가 없는 지역은 일정 provenance의 서로 다른 담당기관/연락처를 임의 선택하지 않고 모두 표시
- 대형폐기물은 정보 안내만 제공하며 신고·결제·수거 기능은 제공하지 않음
- 공식 외부 링크 allowlist 검증
- React/Vite 첫 방문 화면
- 시/도 → 시/군/구 → 관리구역 지역 선택 흐름
- 선택 지역 LocalStorage 저장 및 재진입 복원
- Today 화면에서 공식 rule 기반 `가능`/`예정`/`마감`/`불가`/`확인 필요` 상태 계산
- rule이 없거나 ambiguous한 카테고리는 임의 판단하지 않고 `확인 필요` 처리
- Today 화면에서 공식 출처, 데이터 기준일, 담당기관/연락처, 원본 검증 요약 표시
- 허용된 HTTPS 공공기관 출처만 클릭 가능한 공식 링크로 노출
- Asia/Seoul 기준 현재 주의 월요일~일요일 Weekly 일정 투영
- Weekly에서 verified 일정만 날짜별로 표시하고 ambiguous 품목은 `확인 필요 품목`으로 별도 분리
- Weekly에서 미수거일을 해당 날짜 일정에서 제외하고 월/연도 경계를 포함한 주차 계산 검증
- 행정안전부 전국생활쓰레기배출정보 표준 CSV source parser
- UTF-8 BOM, quoted comma/newline, escaped quote 처리
- 공식 CSV 필수 헤더 및 필수 지역 키 검증
- 공식 Open API 응답 envelope와 item 필드를 기존 source row 계약으로 변환
- Open API `totalCount` 기준 pagination 및 전역 `sourceRow` 보존
- Open API 필수 지역 키가 없는 source row 제외 및 validation report 누적
- `관리구역대상지역명` 기반 사용자 선택 지역 canonical catalog 생성
- 사용자 선택 지역과 `관리구역명` 수거권역을 별도 엔티티로 분리
- 동일 target→collection zone 중복 source provenance 병합
- 한 대상지역이 여러 수거권역에 매핑되면 selectable catalog에서 제외하고 ambiguous 보고
- 공식 target-area mapping을 기존 `CollectionRule` 정규화 계층으로 연결하는 adapter
- 공식 `+` 요일 구분자와 시작/종료 시각을 기존 parser 입력 계약으로 변환
- 원본 source `sourceRow`를 rule provenance와 validation error까지 유지
- 구체 날짜로 안전하게 표현할 수 없는 `미수거일`은 verified rule 생성을 차단
- CSV 또는 Open API source row → adapter 결과를 `schemaVersion: 1` production bundle로 조합
- bundle에 source/mapping/normalization/adapter 검증 report를 함께 보존
- Region/CollectionRule을 locale/ICU 비의존 UTF-16 코드 단위 순서로 정렬해 deterministic output 보장
- production bundle을 2-space pretty JSON + 단일 trailing newline 형식으로 deterministic 직렬화
- JSON asset loader에서 malformed JSON, 지원하지 않는 schema version, 필수 top-level shape를 fail-fast 검증
- 공식 CSV 파일을 deterministic JSON asset으로 만드는 CLI build command
- 공식 Open API를 pagination으로 수집해 production asset과 별도 validation summary를 함께 생성하는 CLI command
- validation summary에서 selectable region/rule이 0건이면 critical error로 처리해 output 갱신 차단
- 수동 GitHub Actions refresh가 검증 성공 데이터만 별도 data branch와 PR로 생성
- CLI/API validation 실패 시 기존 output 보존
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

공식 생활쓰레기 CSV 파일을 직접 확보한 경우 아래 수동 경로를 사용할 수 있습니다.

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
- fixture 기반 JSON은 production asset으로 사용하지 않습니다.

## 공식 Open API 갱신

자동 갱신 경로는 공공데이터포털의 행정안전부 생활쓰레기 Open API를 직접 사용합니다. API 키는 명령행 인자로 받지 않고 환경변수로만 주입합니다.

```bash
export DATA_GO_KR_API_KEY='<공공데이터포털 인증키>'

npm run refresh:official-data -- \
  --output ./public/data/official-data.json \
  --report-output ./data/reports/official-data-validation.json \
  --imported-at 2026-08-28T00:00:00.000Z
```

PowerShell에서는 다음처럼 설정할 수 있습니다.

```powershell
$env:DATA_GO_KR_API_KEY='<공공데이터포털 인증키>'
```

- `--output`, `--report-output`, `--imported-at`은 모두 필수입니다.
- deployable asset과 validation report는 서로 다른 경로를 사용해야 합니다.
- API의 `totalCount`를 기준으로 필요한 모든 page를 순차 수집합니다.
- 필수 지역 키가 비어 있는 source row는 제외하고 source validation report에 기록합니다.
- 제외된 row가 있어도 page 진행 여부는 accepted row 수가 아니라 실제 처리한 source row 수로 판단합니다.
- `totalCount`가 남아 있는데 빈 page가 반환되면 무한 pagination 대신 refresh를 실패 처리합니다.
- API source row는 CSV와 동일한 canonical mapping → rule adapter → serializer 경로를 사용합니다.
- validation summary에는 source/accepted/rejected row 수, ambiguous row 수, selectable region 수, rule 수, 최신 source 기준일, warning/critical error를 기록합니다.
- selectable region 또는 rule이 0건이면 critical error로 처리하며 asset/report를 갱신하지 않습니다.
- 전체 수집·검증·bundle 생성이 성공한 뒤에만 asset과 validation report를 최종 경로로 이동합니다.
- `npm run build`는 네트워크를 호출하지 않고 마지막으로 검증된 asset만 사용합니다. 공공 API 장애가 application build를 깨뜨리지 않도록 refresh와 build를 분리합니다.
- 실제 refresh를 실행하는 환경에는 `DATA_GO_KR_API_KEY`를 secret 또는 환경변수로 주입해야 합니다.

### GitHub Actions 수동 refresh

`.github/workflows/refresh-official-data.yml`은 `workflow_dispatch`로만 실행합니다.

- 저장소 Actions secret `DATA_GO_KR_API_KEY`를 사용하며 로그나 PR에 인증키를 기록하지 않습니다.
- UTC import timestamp를 명시적으로 생성해 refresh CLI에 전달합니다.
- refresh 후 Domain/UI/typecheck/production build를 다시 검증합니다.
- 생성된 `official-data.json`과 validation report를 workflow artifact로 보존합니다.
- 모든 검증이 성공한 경우에만 `data/official-refresh-<run id>` 브랜치를 만들고 정해진 PR 형식으로 `main` 대상 PR을 생성합니다.
- validation critical error, API 오류, 테스트 실패가 발생하면 data branch와 PR을 생성하지 않습니다.

## 브라우저 데이터 로딩

production 앱은 시작할 때 같은 origin의 `/data/official-data.json`만 읽습니다.

- 응답이 성공하면 `loadOfficialDataAsset()`으로 schema version과 필수 top-level shape를 검증합니다.
- 검증된 `regions`만 지역 선택 catalog로 사용합니다.
- 검증된 `rules`만 선택 지역의 Today와 Weekly 계산에 사용합니다.
- HTTP 오류, JSON 파싱 오류, 지원하지 않는 schema version은 모두 오류 상태로 전환합니다.
- 오류 상태에서는 테스트 fixture나 임의 지역을 fallback으로 노출하지 않습니다.
- verified rule이 없는 카테고리는 `불가`로 단정하지 않고 `확인 필요`로 표시합니다.
- Weekly는 Today와 별도 규칙을 만들지 않고 같은 schedule engine을 사용해 현재 서울 주차의 월요일~일요일을 계산합니다.
- ambiguous rule은 특정 요일에 임의 배치하지 않고 주간 `확인 필요 품목`으로 분리합니다.

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
- source parser는 `관리구역명`과 `관리구역대상지역명`을 별도로 보존합니다.
- `관리구역명`은 `1권역` 같은 수거 관리권역일 수 있으므로 사용자 행정동으로 간주하지 않습니다.
- `관리구역대상지역명`에 명시된 대상지역만 사용자 선택 지역 후보로 생성합니다.
- 대상지역 정보가 없는 source row는 임의의 선택 지역을 생성하지 않고 unresolved로 보고합니다.
- 같은 대상지역이 서로 다른 수거권역에 연결되면 임의로 하나를 선택하지 않고 selectable catalog에서 제외합니다.
- 같은 대상지역→수거권역 연결이 여러 source row에 반복되면 association은 하나로 합치되 source row와 기준일 provenance는 보존합니다.
- 공식 일정 adapter는 안전한 selectable target area에 대해서만 생활/음식물/재활용 `CollectionRule`을 생성합니다.
- 공식 source의 `월+수+금` 같은 요일 표현은 기존 요일 parser가 처리할 수 있도록 구분자만 정규화합니다.
- 시작/종료 시각은 기존 시간 parser가 검증하도록 하나의 range 문자열로 조립하며, 값이 불완전하면 rule을 생성하지 않습니다.
- `미수거일`이 `YYYY-MM-DD` 목록이면 excluded date로 변환하지만 `명절`, `임시공휴일`처럼 현재 모델이 정확히 표현할 수 없는 의미가 포함되면 해당 source row의 rule 생성을 차단합니다.
- schedule parsing error와 rule provenance는 adapter에서 재번호화하지 않고 원본 `sourceRow`를 유지합니다.
- production bundle은 raw source row를 다시 포함하지 않고 앱에 필요한 canonical Region/CollectionRule과 검증 report만 보존합니다.
- 같은 source와 같은 `importedAt` 입력은 런타임 locale 설정에 관계없이 동일한 Region/CollectionRule ordering을 갖습니다.
- asset serializer는 동일 bundle 입력에 동일한 JSON text를 만들고 파일 diff가 안정적이도록 정확히 하나의 trailing newline을 붙입니다.
- asset loader는 문자열만 읽으며 파일시스템/네트워크 I/O를 수행하지 않습니다.
- fixture로 만든 JSON을 production asset처럼 커밋하지 않습니다.

다음 구현 단계는 실제 production refresh를 실행해 전국 데이터 validation report를 검토하고 production 배포 검증을 이어서 진행하는 작업입니다.
