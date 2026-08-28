import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import App, { type DataVerificationSummary, type RegionOption } from './App';
import type { CollectionRule } from './domain/waste/types';
import {
  createOfficialRuntimeLoader,
  type OfficialRuntimeLoader,
} from './data/runtime/officialRuntimeLoader';
import type { OfficialRuntimeManifest } from './data/runtime/officialRuntimeData';
import {
  getSavedRegion,
  saveRegion,
  subscribeSavedRegionChanges,
} from './storage/savedRegion';

const DEFAULT_MANIFEST_URL = '/data/runtime/manifest.json';

type OfficialDataAppProps = {
  manifestUrl?: string;
};

type ManifestState =
  | { status: 'loading' }
  | { status: 'ready'; manifest: OfficialRuntimeManifest }
  | { status: 'error' };

type RegionDataState =
  | { status: 'idle'; rules: readonly CollectionRule[] }
  | { status: 'loading'; regionId: string; rules: readonly CollectionRule[] }
  | { status: 'ready'; regionId: string; rules: readonly CollectionRule[] }
  | { status: 'error'; regionId: string; rules: readonly CollectionRule[] };

function toRegionOptions(manifest: OfficialRuntimeManifest): RegionOption[] {
  return manifest.regions.map((region) => ({
    regionId: region.regionId,
    sido: region.sido,
    sigungu: region.sigungu,
    areaName: region.areaName,
  }));
}

function toDataVerificationSummary(manifest: OfficialRuntimeManifest): DataVerificationSummary {
  return {
    importedAt: manifest.importedAt,
    totalRows: manifest.source.totalRows,
    acceptedRows: manifest.source.acceptedRows,
    rejectedRows: manifest.source.rejectedRows,
  };
}

function DataStateView({ title, message }: { title: string; message: string }) {
  return (
    <main className="app-shell">
      <header className="topbar">
        <a className="brand" href="#top" aria-label="버리데이 홈">
          <span className="brand-mark" aria-hidden="true">B</span>
          <span>버리데이</span>
        </a>
        <span className="source-chip">공공데이터 기반</span>
      </header>
      <section className="setup-panel" role="status" aria-live="polite">
        <div className="setup-copy">
          <p className="eyebrow">공식 데이터</p>
          <h1>{title}</h1>
          <p className="hero-description">{message}</p>
        </div>
      </section>
    </main>
  );
}

function RegionDataStateView({
  title,
  message,
  onChangeRegion,
}: {
  title: string;
  message: string;
  onChangeRegion: () => void;
}) {
  return (
    <main className="app-shell">
      <header className="topbar">
        <a className="brand" href="#top" aria-label="버리데이 홈">
          <span className="brand-mark" aria-hidden="true">B</span>
          <span>버리데이</span>
        </a>
        <span className="source-chip">공공데이터 기반</span>
      </header>
      <section className="setup-panel" role="status" aria-live="polite">
        <div className="setup-copy">
          <p className="eyebrow">지역 일정</p>
          <h1>{title}</h1>
          <p className="hero-description">{message}</p>
          <button className="secondary-button" type="button" onClick={onChangeRegion}>
            지역 다시 설정
          </button>
        </div>
      </section>
    </main>
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
    <main className="app-shell">
      <header className="topbar">
        <a className="brand" href="#top" aria-label="버리데이 홈">
          <span className="brand-mark" aria-hidden="true">B</span>
          <span>버리데이</span>
        </a>
        <span className="source-chip">공공데이터 기반</span>
      </header>
      <section className="setup-panel" aria-labelledby="region-setup-title">
        <div className="setup-copy">
          <p className="eyebrow">지역 설정</p>
          <h1 id="region-setup-title">지역을 선택하세요</h1>
          <p className="hero-description">
            시/도에서 관리구역 순서로 선택합니다. GPS나 상세 주소는 요청하지 않습니다.
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
          <button className="primary-button" type="submit" disabled={!selected}>
            이 지역으로 시작하기
          </button>
        </form>
      </section>
    </main>
  );
}

function validRegionIds(manifest: OfficialRuntimeManifest): Set<string> {
  return new Set(manifest.regions.map((region) => region.regionId));
}

export default function OfficialDataApp({
  manifestUrl = DEFAULT_MANIFEST_URL,
}: OfficialDataAppProps) {
  const loader: OfficialRuntimeLoader = useMemo(
    () => createOfficialRuntimeLoader({ manifestUrl }),
    [manifestUrl],
  );
  const [manifestState, setManifestState] = useState<ManifestState>({ status: 'loading' });
  const [regionDataState, setRegionDataState] = useState<RegionDataState>({
    status: 'idle',
    rules: [],
  });
  const [showRegionSetup, setShowRegionSetup] = useState(false);
  const requestVersion = useRef(0);

  const loadRegion = useCallback(async (regionId: string) => {
    const version = ++requestVersion.current;
    setShowRegionSetup(false);
    setRegionDataState({ status: 'loading', regionId, rules: [] });

    try {
      const rules = await loader.loadRulesForRegion(regionId);
      if (requestVersion.current !== version) return;
      setRegionDataState({ status: 'ready', regionId, rules });
    } catch {
      if (requestVersion.current !== version) return;
      setRegionDataState({ status: 'error', regionId, rules: [] });
    }
  }, [loader]);

  useEffect(() => {
    const unsubscribe = subscribeSavedRegionChanges((saved) => {
      if (!saved) {
        requestVersion.current += 1;
        setRegionDataState({ status: 'idle', rules: [] });
        return;
      }
      void loadRegion(saved.regionId);
    });

    return unsubscribe;
  }, [loadRegion]);

  useEffect(() => {
    let active = true;
    requestVersion.current += 1;
    setManifestState({ status: 'loading' });
    setRegionDataState({ status: 'idle', rules: [] });
    setShowRegionSetup(false);

    const load = async () => {
      try {
        const manifest = await loader.loadManifest();
        if (!active) return;
        setManifestState({ status: 'ready', manifest });

        const saved = getSavedRegion(validRegionIds(manifest));
        if (saved) void loadRegion(saved.regionId);
      } catch {
        if (active) setManifestState({ status: 'error' });
      }
    };

    void load();

    return () => {
      active = false;
      requestVersion.current += 1;
    };
  }, [loader, loadRegion]);

  if (manifestState.status === 'loading') {
    return (
      <DataStateView
        title="공식 데이터를 불러오는 중입니다."
        message="검증된 생활쓰레기 배출 정보를 준비하고 있습니다."
      />
    );
  }

  if (manifestState.status === 'error') {
    return (
      <DataStateView
        title="데이터를 불러오지 못했습니다."
        message="공식 데이터 파일을 확인할 수 없어 배출 가능 여부를 표시하지 않습니다."
      />
    );
  }

  const manifest = manifestState.manifest;
  const regions = toRegionOptions(manifest);
  const regionIds = validRegionIds(manifest);

  if (showRegionSetup) {
    return (
      <RegionSetupView
        regions={regions}
        onComplete={(region) => {
          saveRegion(region.regionId, regionIds);
        }}
      />
    );
  }

  if (regionDataState.status === 'loading') {
    return (
      <RegionDataStateView
        title="지역 일정 데이터를 불러오는 중입니다."
        message="선택한 시/군/구의 검증된 일정 규칙을 준비하고 있습니다."
        onChangeRegion={() => {
          requestVersion.current += 1;
          setShowRegionSetup(true);
        }}
      />
    );
  }

  if (regionDataState.status === 'error') {
    return (
      <RegionDataStateView
        title="지역 일정 데이터를 불러오지 못했습니다."
        message="선택한 지역의 검증된 일정 규칙을 확인할 수 없어 배출 가능 여부를 표시하지 않습니다."
        onChangeRegion={() => setShowRegionSetup(true)}
      />
    );
  }

  return (
    <App
      regions={regions}
      rules={regionDataState.rules}
      dataSummary={toDataVerificationSummary(manifest)}
    />
  );
}
