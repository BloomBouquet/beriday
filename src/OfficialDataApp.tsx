import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import App, {
  type DataVerificationSummary,
  type RegionDataStatus,
  type RegionOption,
} from './App';
import type { CollectionRule } from './domain/waste/types';
import { createOfficialRuntimeLoader } from './data/runtime/officialRuntimeLoader';
import type { OfficialRuntimeManifest } from './data/runtime/officialRuntimeData';

const DEFAULT_MANIFEST_URL = `${import.meta.env.BASE_URL}data/runtime/manifest.json`;

type OfficialDataAppProps = {
  manifestUrl?: string;
};

type ManifestState =
  | { status: 'loading' }
  | { status: 'ready'; manifest: OfficialRuntimeManifest }
  | { status: 'error' };

type RuleState =
  | { status: 'idle'; regionId: null; rules: readonly CollectionRule[] }
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

export default function OfficialDataApp({
  manifestUrl = DEFAULT_MANIFEST_URL,
}: OfficialDataAppProps) {
  const loader = useMemo(
    () => createOfficialRuntimeLoader({ manifestUrl }),
    [manifestUrl],
  );
  const [manifestState, setManifestState] = useState<ManifestState>({ status: 'loading' });
  const [ruleState, setRuleState] = useState<RuleState>({
    status: 'idle',
    regionId: null,
    rules: [],
  });
  const requestVersion = useRef(0);
  const requestedRegionId = useRef<string | null>(null);

  useEffect(() => {
    let active = true;
    requestVersion.current += 1;
    requestedRegionId.current = null;
    setManifestState({ status: 'loading' });
    setRuleState({ status: 'idle', regionId: null, rules: [] });

    void loader.loadManifest()
      .then((manifest) => {
        if (active) setManifestState({ status: 'ready', manifest });
      })
      .catch(() => {
        if (active) setManifestState({ status: 'error' });
      });

    return () => {
      active = false;
      requestVersion.current += 1;
    };
  }, [loader]);

  const handleRegionChange = useCallback((regionId: string | null) => {
    if (requestedRegionId.current === regionId) return;
    requestedRegionId.current = regionId;
    const version = ++requestVersion.current;

    if (!regionId) {
      setRuleState({ status: 'idle', regionId: null, rules: [] });
      return;
    }

    setRuleState({ status: 'loading', regionId, rules: [] });
    void loader.loadRulesForRegion(regionId)
      .then((rules) => {
        if (requestVersion.current !== version) return;
        setRuleState({ status: 'ready', regionId, rules });
      })
      .catch(() => {
        if (requestVersion.current !== version) return;
        setRuleState({ status: 'error', regionId, rules: [] });
      });
  }, [loader]);

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
  const regionDataStatus: RegionDataStatus = ruleState.status;

  return (
    <App
      regions={toRegionOptions(manifest)}
      rules={ruleState.rules}
      dataSummary={toDataVerificationSummary(manifest)}
      onRegionChange={handleRegionChange}
      regionDataStatus={regionDataStatus}
    />
  );
}
