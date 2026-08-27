import { useMemo, useState } from 'react';
import { getSavedRegion, saveRegion } from './storage/savedRegion';

type RegionOption = {
  regionId: string;
  sido: string;
  sigungu: string;
  areaName: string;
};

type View = 'home' | 'setup' | 'today';

const regionCatalog: RegionOption[] = [
  {
    regionId: '광주광역시/북구/테스트동',
    sido: '광주광역시',
    sigungu: '북구',
    areaName: '테스트동',
  },
  {
    regionId: '부산광역시/테스트구/샘플동',
    sido: '부산광역시',
    sigungu: '테스트구',
    areaName: '샘플동',
  },
  {
    regionId: '서울특별시/테스트구/예시동',
    sido: '서울특별시',
    sigungu: '테스트구',
    areaName: '예시동',
  },
];

const validRegionIds = new Set(regionCatalog.map((region) => region.regionId));

const previewItems = [
  { label: '일반쓰레기', state: '지역 설정 후 확인', icon: '●' },
  { label: '음식물', state: '오늘 일정 계산', icon: '▲' },
  { label: '재활용', state: '다음 배출일 안내', icon: '◆' },
];

function findRegion(regionId: string): RegionOption | null {
  return regionCatalog.find((region) => region.regionId === regionId) ?? null;
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
              <div className="preview-item" key={item.label}>
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

function RegionSetupView({ onComplete }: { onComplete: (region: RegionOption) => void }) {
  const [sido, setSido] = useState('');
  const [sigungu, setSigungu] = useState('');
  const [areaName, setAreaName] = useState('');

  const sidoOptions = useMemo(
    () => [...new Set(regionCatalog.map((region) => region.sido))],
    [],
  );
  const sigunguOptions = useMemo(
    () => [...new Set(regionCatalog.filter((region) => region.sido === sido).map((region) => region.sigungu))],
    [sido],
  );
  const areaOptions = useMemo(
    () => regionCatalog.filter((region) => region.sido === sido && region.sigungu === sigungu),
    [sido, sigungu],
  );

  const selected = areaOptions.find((region) => region.areaName === areaName) ?? null;

  return (
    <section className="setup-panel" aria-labelledby="region-setup-title">
      <div className="setup-copy">
        <p className="eyebrow">지역 설정</p>
        <h1 id="region-setup-title">지역을 선택하세요</h1>
        <p className="hero-description">
          현재 단계에서는 실데이터 importer가 연결되기 전이라 개발용 샘플 지역만 제공합니다.
          GPS나 상세 주소는 요청하지 않습니다.
        </p>
      </div>

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

        <p className="fixture-note">개발용 샘플 데이터 · 실제 배출 안내로 사용하지 마세요.</p>
        <button className="primary-button" type="submit" disabled={!selected}>이 지역으로 시작하기</button>
      </form>
    </section>
  );
}

function TodayView({ region, onChangeRegion }: { region: RegionOption; onChangeRegion: () => void }) {
  return (
    <section className="today-page" aria-labelledby="today-title">
      <div className="today-header">
        <div>
          <p className="eyebrow">선택한 지역</p>
          <p className="region-name">{region.sido} {region.sigungu} {region.areaName}</p>
          <h1 id="today-title">오늘의 배출</h1>
        </div>
        <button className="secondary-button" type="button" onClick={onChangeRegion}>지역 다시 설정</button>
      </div>

      <div className="sample-banner" role="note">
        <strong>샘플 데이터로 흐름을 검증 중입니다.</strong>
        <span>실제 공공데이터 importer 연결 전이므로 아래 상태를 실생활 배출 판단에 사용하지 않습니다.</span>
      </div>

      <div className="today-grid" aria-label="오늘 배출 상태">
        {previewItems.map((item) => (
          <article key={item.label} className="today-card">
            <span className="preview-icon" aria-hidden="true">{item.icon}</span>
            <strong>{item.label}</strong>
            <span>실데이터 연결 대기</span>
          </article>
        ))}
      </div>
    </section>
  );
}

export default function App() {
  const [region, setRegion] = useState<RegionOption | null>(() => {
    try {
      const saved = getSavedRegion(validRegionIds);
      return saved ? findRegion(saved.regionId) : null;
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
        <a className="brand" href="#top" aria-label="버리데이 홈" onClick={() => setView(region ? 'today' : 'home')}>
          <span className="brand-mark" aria-hidden="true">B</span>
          <span>버리데이</span>
        </a>
        <span className="source-chip">공공데이터 기반</span>
      </header>

      {view === 'home' && <HomeView onStart={() => setView('setup')} />}
      {view === 'setup' && <RegionSetupView onComplete={completeRegionSetup} />}
      {view === 'today' && region && (
        <TodayView region={region} onChangeRegion={() => setView('setup')} />
      )}
    </main>
  );
}
