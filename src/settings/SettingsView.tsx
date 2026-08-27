import type { DataVerificationSummary, RegionOption } from '../App';
import type { CollectionRule, RuleProvenance } from '../domain/waste/types';
import { isAllowedOfficialUrl } from '../security/officialUrl';

type SettingsViewProps = {
  region: RegionOption;
  rules: readonly CollectionRule[];
  dataSummary: DataVerificationSummary | null;
  onToday: () => void;
  onChangeRegion: () => void;
  onClearLocalData: () => void;
};

function provenanceKey(source: RuleProvenance): string {
  return [
    source.sourceId,
    source.sourceUrl,
    source.sourceUpdatedAt ?? '',
    source.authorityName ?? '',
    source.authorityContact ?? '',
  ].join('|');
}

function uniqueProvenance(rules: readonly CollectionRule[]): RuleProvenance[] {
  const sources = new Map<string, RuleProvenance>();

  for (const rule of rules) {
    const key = provenanceKey(rule.provenance);
    if (!sources.has(key)) sources.set(key, rule.provenance);
  }

  return [...sources.values()];
}

export function SettingsView({
  region,
  rules,
  dataSummary,
  onToday,
  onChangeRegion,
  onClearLocalData,
}: SettingsViewProps) {
  const regionRules = rules.filter((rule) => rule.regionId === region.regionId);
  const provenance = uniqueProvenance(regionRules);
  const hasValidationCounts = Boolean(
    dataSummary &&
    dataSummary.totalRows !== null &&
    dataSummary.acceptedRows !== null &&
    dataSummary.rejectedRows !== null,
  );

  return (
    <section className="search-page" aria-labelledby="settings-title">
      <div className="today-header">
        <div>
          <p className="eyebrow">내 기기 설정</p>
          <h1 id="settings-title">설정</h1>
        </div>
        <div className="today-actions">
          <button className="secondary-button" type="button" onClick={onToday}>오늘 보기</button>
        </div>
      </div>

      <div className="search-results">
        <article className="search-result-card" aria-labelledby="saved-region-title">
          <div className="search-result-heading">
            <div>
              <span className="data-card-label">저장된 지역</span>
              <h2 id="saved-region-title">{region.sido} {region.sigungu} {region.areaName}</h2>
            </div>
            <span className="preview-status">이 기기에만 저장</span>
          </div>

          <div className="search-result-section">
            <strong>개인정보 최소화</strong>
            <span>GPS와 상세 주소는 저장하지 않습니다.</span>
            <span>선택한 행정구역만 브라우저 LocalStorage에 저장합니다.</span>
          </div>

          <div className="today-actions">
            <button className="secondary-button" type="button" onClick={onChangeRegion}>지역 다시 설정</button>
            <button className="secondary-button" type="button" onClick={onClearLocalData}>저장된 지역 삭제</button>
          </div>
        </article>

        <article className="search-result-card" aria-labelledby="settings-data-title">
          <div className="search-result-heading">
            <div>
              <span className="data-card-label">공식 데이터</span>
              <h2 id="settings-data-title">데이터 및 안내</h2>
            </div>
          </div>

          {provenance.length > 0 ? (
            provenance.map((source) => (
              <div className="search-result-source" key={provenanceKey(source)}>
                <span>공식 출처</span>
                {isAllowedOfficialUrl(source.sourceUrl) ? (
                  <a href={source.sourceUrl} target="_blank" rel="noopener noreferrer">{source.sourceName}</a>
                ) : (
                  <strong>{source.sourceName}</strong>
                )}
                {source.sourceUpdatedAt && <span>데이터 기준일 {source.sourceUpdatedAt}</span>}
                {(source.authorityName || source.authorityContact) && (
                  <span>
                    담당기관 {source.authorityName ?? '기관명 미제공'}
                    {source.authorityContact ? ` · ${source.authorityContact}` : ''}
                  </span>
                )}
              </div>
            ))
          ) : (
            <div className="search-result-section">
              <strong>선택 지역의 공식 출처 정보가 없습니다.</strong>
              <span>확인되지 않은 출처를 임의로 표시하지 않습니다.</span>
            </div>
          )}

          {dataSummary && (
            <div className="search-result-section">
              <strong>전체 데이터 검증</strong>
              {hasValidationCounts && (
                <span>
                  원본 {dataSummary.totalRows}건 중 {dataSummary.acceptedRows}건 반영 · {dataSummary.rejectedRows}건 제외
                </span>
              )}
            </div>
          )}

          <div className="search-result-section" role="note">
            <strong>안내</strong>
            <span>지자체 정책은 변경될 수 있으므로 중요한 배출 전에는 공식 안내를 함께 확인하세요.</span>
          </div>
        </article>
      </div>
    </section>
  );
}
