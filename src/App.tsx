import { useMemo, useState } from 'react';
import { buildWeeklySchedule, type WeeklyScheduleDay } from './domain/schedule/buildWeeklySchedule';
import { evaluateSchedule, type ScheduleResult, type ScheduleStatus } from './domain/schedule/evaluateSchedule';
import type { CollectionRule, RuleProvenance, TimeWindow, WasteCategory } from './domain/waste/types';
import { isAllowedOfficialUrl } from './security/officialUrl';
import { getSavedRegion, saveRegion } from './storage/savedRegion';

export type RegionOption = {
  regionId: string;
  sido: string;
  sigungu: string;
  areaName: string;
};

export type DataVerificationSummary = {
  importedAt: string;
  totalRows: number | null;
  acceptedRows: number | null;
  rejectedRows: number | null;
};

type AppProps = {
  regions?: readonly RegionOption[];
  rules?: readonly CollectionRule[];
  dataSummary?: DataVerificationSummary | null;
};

type View = 'home' | 'setup' | 'today' | 'weekly';

type TodayItem = {
  category: Extract<WasteCategory, 'general' | 'food' | 'recycling'>;
  label: string;
  state: string;
  icon: string;
};

const EMPTY_REGIONS: readonly RegionOption[] = [];
const EMPTY_RULES: readonly CollectionRule[] = [];

const previewItems: readonly TodayItem[] = [
  { category: 'general', label: '일반쓰레기', state: '지역 설정 후 확인', icon: '●' },
  { category: 'food', label: '음식물', state: '오늘 일정 계산', icon: '▲' },
  { category: 'recycling', label: '재활용', state: '다음 배출일 안내', icon: '◆' },
];

const STATUS_LABELS: Record<ScheduleStatus, string> = {
  available: '가능',
  upcoming: '예정',
  closed: '마감',
  unavailable: '불가',
  'needs-verification': '확인 필요',
};

const CATEGORY_LABELS: Record<WasteCategory, string> = {
  general: '일반쓰레기',
  food: '음식물',
  recycling: '재활용',
  bulk: '대형폐기물',
  other: '기타',
};

const WEEKDAY_SHORT: Record<number, string> = {
  0: '일',
  1: '월',
  2: '화',
  3: '수',
  4: '목',
  5: '금',
  6: '토',
};

const WEEKDAY_FULL: Record<number, string> = {
  0: '일요일',
  1: '월요일',
  2: '화요일',
  3: '수요일',
  4: '목요일',
  5: '금요일',
  6: '토요일',
};

function findRegion(regions: readonly RegionOption[], regionId: string): RegionOption | null {
  return regions.find((region) => region.regionId === regionId) ?? null;
}

function formatWindow(window: TimeWindow | null): string | null {
  if (!window?.start) return null;
  if (!window.end) return `${window.start} 이후`;
  return `${window.start}~${window.end}`;
}

function formatNextAvailable(value: string | null): string | null {
  if (!value) return null;

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;

  return new Intl.DateTimeFormat('ko-KR', {
    timeZone: 'Asia/Seoul',
    month: 'numeric',
    day: 'numeric',
    weekday: 'short',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(date);
}

function formatImportedAt(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;

  return new Intl.DateTimeFormat('ko-KR', {
    timeZone: 'Asia/Seoul',
    year: 'numeric',
    month: 'numeric',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(date);
}

function dateParts(dateKey: string): { month: number; day: number } {
  const [, month, day] = dateKey.split('-').map(Number);
  return { month, day };
}

function formatWeekDate(dateKey: string): string {
  const { month, day } = dateParts(dateKey);
  return `${month}.${day}`;
}

function formatWeekRange(days: readonly WeeklyScheduleDay[]): string {
  if (days.length === 0) return '';
  return `${formatWeekDate(days[0].dateKey)} ~ ${formatWeekDate(days[days.length - 1].dateKey)}`;
}

function weeklyDayAriaLabel(day: WeeklyScheduleDay): string {
  const parts = dateParts(day.dateKey);
  return `${WEEKDAY_FULL[day.weekday]} ${parts.month}월 ${parts.day}일`;
}

function uniqueProvenance(rules: readonly CollectionRule[]): RuleProvenance[] {
  const byKey = new Map<string, RuleProvenance>();

  for (const rule of rules) {
    const provenance = rule.provenance;
    const key = [
      provenance.sourceId,
      provenance.sourceUrl,
      provenance.sourceUpdatedAt ?? '',
      provenance.authorityName ?? '',
      provenance.authorityContact ?? '',
    ].join('|');
    if (!byKey.has(key)) byKey.set(key, provenance);
  }

  return [...byKey.values()];
}

function provenanceKey(source: RuleProvenance): string {
  return [
    source.sourceId,
    source.sourceUrl,
    source.sourceUpdatedAt ?? '',
    source.authorityName ?? '',
    source.authorityContact ?? '',
  ].join('|');
}

function getVerificationReason(result: ScheduleResult | null): string | null {
  if (!result) return '검증된 일정 규칙이 없어 자동 판단하지 않습니다.';
  if (result.status === 'needs-verification') {
    return '공식 데이터의 일정 규칙이 서로 충돌하거나 모호해 자동 판단하지 않습니다.';
  }
  return null;
}

function HomeView({ onStart }: { onStart: () => void }) {
  return (
    <>
      <section className="hero" id="top">
        <div className="hero-copy">
          <p className="eyebrow">오늘, 이 동네에서</p>
          <h1>오늘 버릴 수 있는 것부터 확인하세요</h1>
          <p className="hero-description">
            복잡한 지자체 안내를 다시 찾지 않아도 돼요. 지역을 한 번 선택하면
            생활쓰레기, 음식물, 재활용 배출 가능 시간과 다음 일정을 빠르게 보여드려요.
          </p>
          <div className="hero-actions">
            <button className="primary-button" type="button" onClick={onStart}>지역 설정하기</button>
            <span className="privacy-note">GPS 없이 행정구역만 저장합니다.</span>
          </div>
        </div>

        <aside className="today-preview" aria-label="오늘 일정 미리보기">
          <div className="preview-heading">
            <span>오늘의 배출</span>
            <span className="preview-status">지역 미설정</span>
          </div>
          <div className="preview-list">
            {previewItems.map((item) => (
              <div className="preview-item" key={item.category}>
                <span className="preview-icon" aria-hidden="true">{item.icon}</span>
                <div>
                  <strong>{item.label}</strong>
                  <span>{item.state}</span>
                </div>
              </div>
            ))}
          </div>
          <p className="preview-footnote">정보가 모호하면 임의로 판단하지 않고 ‘확인 필요’로 표시합니다.</p>
        </aside>
      </section>

      <section className="feature-grid" aria-label="버리데이 주요 기능">
        <article>
          <span className="feature-index">01</span>
          <h2>오늘 먼저</h2>
          <p>지도보다 먼저 지금 배출 가능한 품목과 시간을 확인합니다.</p>
        </article>
        <article>
          <span className="feature-index">02</span>
          <h2>근거까지</h2>
          <p>각 일정에 공식 출처와 담당기관 정보를 함께 연결합니다.</p>
        </article>
        <article>
          <span className="feature-index">03</span>
          <h2>개인정보 최소화</h2>
          <p>상세 주소나 위치 이력 없이 선택한 행정구역만 기기에 저장합니다.</p>
        </article>
      </section>
    </>
  );
}

function RegionSetupView({
  regions,
  onComplete,
}: {
  regions: readonly RegionOption[];
  onComplete: (region: RegionOption) => void;
}) {
  const [sido, setSido] = useState('');
  const [sigungu, setSigungu] = useState('');
  const [areaName, setAreaName] = useState('');

  const sidoOptions = useMemo(
    () => [...new Set(regions.map((region) => region.sido))],
    [regions],
  );
  const sigunguOptions = useMemo(
    () => [...new Set(regions.filter((region) => region.sido === sido).map((region) => region.sigungu))],
    [regions, sido],
  );
  const areaOptions = useMemo(
    () => regions.filter((region) => region.sido === sido && region.sigungu === sigungu),
    [regions, sido, sigungu],
  );

  const selected = areaOptions.find((region) => region.areaName === areaName) ?? null;

  return (
    <section className="setup-panel" aria-labelledby="region-setup-title">
      <div className="setup-copy">
        <p className="eyebrow">지역 설정</p>
        <h1 id="region-setup-title">지역을 선택하세요</h1>
        <p className="hero-description">
          시/도에서 관리구역 순서로 선택합니다. GPS나 상세 주소는 요청하지 않습니다.
        </p>
      </div>

      {regions.length === 0 ? (
        <div className="region-form" role="status">
          <strong>지역 데이터 준비 중</strong>
          <p className="fixture-note">
            검증된 공식 지역 데이터가 연결되기 전에는 임의의 지역이나 배출 일정을 제공하지 않습니다.
          </p>
        </div>
      ) : (
        <form
          className="region-form"
          onSubmit={(event) => {
            event.preventDefault();
            if (selected) onComplete(selected);
          }}
        >
          <label>
            <span>시/도</span>
            <select
              aria-label="시/도"
              value={sido}
              onChange={(event) => {
                setSido(event.target.value);
                setSigungu('');
                setAreaName('');
              }}
            >
              <option value="">선택</option>
              {sidoOptions.map((option) => <option key={option} value={option}>{option}</option>)}
            </select>
          </label>

          <label>
            <span>시/군/구</span>
            <select
              aria-label="시/군/구"
              value={sigungu}
              disabled={!sido}
              onChange={(event) => {
                setSigungu(event.target.value);
                setAreaName('');
              }}
            >
              <option value="">선택</option>
              {sigunguOptions.map((option) => <option key={option} value={option}>{option}</option>)}
            </select>
          </label>

          <label>
            <span>관리구역</span>
            <select
              aria-label="관리구역"
              value={areaName}
              disabled={!sigungu}
              onChange={(event) => setAreaName(event.target.value)}
            >
              <option value="">선택</option>
              {areaOptions.map((region) => (
                <option key={region.regionId} value={region.areaName}>{region.areaName}</option>
              ))}
            </select>
          </label>

          <button className="primary-button" type="submit" disabled={!selected}>이 지역으로 시작하기</button>
        </form>
      )}
    </section>
  );
}

function DataTrustPanel({
  rules,
  dataSummary,
}: {
  rules: readonly CollectionRule[];
  dataSummary: DataVerificationSummary | null;
}) {
  const provenance = uniqueProvenance(rules);
  const hasValidationCounts = Boolean(
    dataSummary &&
    dataSummary.totalRows !== null &&
    dataSummary.acceptedRows !== null &&
    dataSummary.rejectedRows !== null,
  );

  if (provenance.length === 0 && !dataSummary) return null;

  return (
    <section className="data-trust-panel" aria-labelledby="data-trust-title">
      <div className="data-trust-heading">
        <div>
          <p className="eyebrow">공식 데이터</p>
          <h2 id="data-trust-title">데이터 근거</h2>
        </div>
        <p>오늘 일정에 사용된 출처와 전체 원본 검증 상태를 확인할 수 있습니다.</p>
      </div>

      <div className="data-trust-grid">
        {provenance.map((source) => {
          const isTrustedLink = isAllowedOfficialUrl(source.sourceUrl);

          return (
            <article className="data-source-card" key={provenanceKey(source)}>
              <span className="data-card-label">공식 출처</span>
              {isTrustedLink ? (
                <a href={source.sourceUrl} target="_blank" rel="noopener noreferrer">
                  {source.sourceName}
                </a>
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
            </article>
          );
        })}

        {dataSummary && (
          <article className="data-source-card">
            <span className="data-card-label">전체 데이터 검증</span>
            {hasValidationCounts && (
              <strong>
                원본 {dataSummary.totalRows}건 중 {dataSummary.acceptedRows}건 반영 · {dataSummary.rejectedRows}건 제외
              </strong>
            )}
            <span>가져온 시각 {formatImportedAt(dataSummary.importedAt)}</span>
            {(dataSummary.rejectedRows ?? 0) > 0 && (
              <p>검증에서 제외된 원본 행은 배출 일정 계산에 사용하지 않습니다.</p>
            )}
          </article>
        )}
      </div>
    </section>
  );
}

function TodayView({
  region,
  rules,
  dataSummary,
  onWeekly,
  onChangeRegion,
}: {
  region: RegionOption;
  rules: readonly CollectionRule[];
  dataSummary: DataVerificationSummary | null;
  onWeekly: () => void;
  onChangeRegion: () => void;
}) {
  const regionRules = rules.filter((rule) => rule.regionId === region.regionId);
  const results = evaluateSchedule([...regionRules], new Date());
  const resultByCategory = new Map<WasteCategory, ScheduleResult>(
    results.map((result) => [result.category, result]),
  );

  return (
    <section className="today-page" aria-labelledby="today-title">
      <div className="today-header">
        <div>
          <p className="eyebrow">선택한 지역</p>
          <p className="region-name">{region.sido} {region.sigungu} {region.areaName}</p>
          <h1 id="today-title">오늘의 배출</h1>
        </div>
        <div className="today-actions">
          <button className="secondary-button" type="button" onClick={onWeekly}>주간 일정 보기</button>
          <button className="secondary-button" type="button" onClick={onChangeRegion}>지역 다시 설정</button>
        </div>
      </div>

      <div className="sample-banner" role="note">
        <strong>{regionRules.length > 0 ? '공식 일정 기준' : '확인 필요'}</strong>
        <span>
          {regionRules.length > 0
            ? '검증된 공식 데이터로 오늘 상태를 계산합니다.'
            : '선택한 지역의 검증된 일정 규칙이 없어 임의로 판단하지 않습니다.'}
        </span>
      </div>

      <div className="today-grid" aria-label="오늘 배출 상태">
        {previewItems.map((item) => {
          const result = resultByCategory.get(item.category) ?? null;
          const window = result ? formatWindow(result.currentWindow) : null;
          const next = result ? formatNextAvailable(result.nextAvailableAt) : null;
          const verificationReason = getVerificationReason(result);

          return (
            <article key={item.category} className="today-card">
              <span className="preview-icon" aria-hidden="true">{item.icon}</span>
              <strong>{item.label}</strong>
              <span>{result ? STATUS_LABELS[result.status] : '확인 필요'}</span>
              {window && <span>{window}</span>}
              {next && <span>다음 일정 {next}</span>}
              {verificationReason && <span className="verification-reason">{verificationReason}</span>}
            </article>
          );
        })}
      </div>

      <DataTrustPanel rules={regionRules} dataSummary={dataSummary} />
    </section>
  );
}

function WeeklyView({
  region,
  rules,
  onToday,
  onChangeRegion,
}: {
  region: RegionOption;
  rules: readonly CollectionRule[];
  onToday: () => void;
  onChangeRegion: () => void;
}) {
  const regionRules = rules.filter((rule) => rule.regionId === region.regionId);
  const schedule = buildWeeklySchedule([...regionRules], new Date());

  return (
    <section className="weekly-page" aria-labelledby="weekly-title">
      <div className="today-header">
        <div>
          <p className="eyebrow">선택한 지역</p>
          <p className="region-name">{region.sido} {region.sigungu} {region.areaName}</p>
          <h1 id="weekly-title">이번 주 배출 일정</h1>
          <p className="weekly-range">{formatWeekRange(schedule.days)}</p>
        </div>
        <div className="today-actions">
          <button className="secondary-button" type="button" onClick={onToday}>오늘 보기</button>
          <button className="secondary-button" type="button" onClick={onChangeRegion}>지역 다시 설정</button>
        </div>
      </div>

      {schedule.needsVerification.length > 0 && (
        <div className="weekly-verification-banner" role="note" aria-label="확인 필요 품목">
          <strong>확인 필요 품목</strong>
          <div className="weekly-category-list">
            {schedule.needsVerification.map((category) => (
              <span key={category}>{CATEGORY_LABELS[category]}</span>
            ))}
          </div>
          <p>공식 일정 규칙이 충돌하거나 모호한 품목은 특정 요일에 임의로 배치하지 않습니다.</p>
        </div>
      )}

      <div className="weekly-grid" aria-label="월요일부터 일요일까지 배출 일정">
        {schedule.days.map((day) => {
          const parts = dateParts(day.dateKey);
          return (
            <article className="weekly-card" key={day.dateKey} aria-label={weeklyDayAriaLabel(day)}>
              <div className="weekly-card-heading">
                <strong>{WEEKDAY_SHORT[day.weekday]}</strong>
                <span>{parts.month}.{parts.day}</span>
              </div>
              {day.scheduledCategories.length > 0 ? (
                <div className="weekly-category-list">
                  {day.scheduledCategories.map((category) => (
                    <span key={category}>{CATEGORY_LABELS[category]}</span>
                  ))}
                </div>
              ) : (
                <span className="weekly-empty">배출 일정 없음</span>
              )}
            </article>
          );
        })}
      </div>
    </section>
  );
}

export default function App({ regions = EMPTY_REGIONS, rules = EMPTY_RULES, dataSummary = null }: AppProps) {
  const validRegionIds = useMemo(
    () => new Set(regions.map((region) => region.regionId)),
    [regions],
  );

  const [region, setRegion] = useState<RegionOption | null>(() => {
    try {
      const saved = getSavedRegion(validRegionIds);
      return saved ? findRegion(regions, saved.regionId) : null;
    } catch {
      return null;
    }
  });
  const [view, setView] = useState<View>(() => (region ? 'today' : 'home'));

  const completeRegionSetup = (selectedRegion: RegionOption) => {
    saveRegion(selectedRegion.regionId, validRegionIds);
    setRegion(selectedRegion);
    setView('today');
  };

  return (
    <main className="app-shell">
      <header className="topbar">
        <a
          className="brand"
          href="#top"
          aria-label="버리데이 홈"
          onClick={() => setView(region ? 'today' : 'home')}
        >
          <span className="brand-mark" aria-hidden="true">B</span>
          <span>버리데이</span>
        </a>
        <span className="source-chip">공공데이터 기반</span>
      </header>

      {view === 'home' && <HomeView onStart={() => setView('setup')} />}
      {view === 'setup' && <RegionSetupView regions={regions} onComplete={completeRegionSetup} />}
      {view === 'today' && region && (
        <TodayView
          region={region}
          rules={rules}
          dataSummary={dataSummary}
          onWeekly={() => setView('weekly')}
          onChangeRegion={() => setView('setup')}
        />
      )}
      {view === 'weekly' && region && (
        <WeeklyView
          region={region}
          rules={rules}
          onToday={() => setView('today')}
          onChangeRegion={() => setView('setup')}
        />
      )}
    </main>
  );
}
