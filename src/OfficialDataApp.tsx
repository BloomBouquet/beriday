import { useEffect, useState } from 'react';
import App, { type RegionOption } from './App';
import { loadOfficialDataAsset } from './data/canonical/officialDataAsset';
import type { OfficialDataBundle } from './data/canonical/officialDataBundle';

const DEFAULT_DATA_URL = '/data/official-data.json';

type OfficialDataAppProps = {
  dataUrl?: string;
};

type LoadState =
  | { status: 'loading' }
  | { status: 'ready'; bundle: OfficialDataBundle }
  | { status: 'error' };

function toRegionOptions(bundle: OfficialDataBundle): RegionOption[] {
  return bundle.regions.map((region) => ({
    regionId: region.id,
    sido: region.sido,
    sigungu: region.sigungu,
    areaName: region.areaName,
  }));
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

export default function OfficialDataApp({ dataUrl = DEFAULT_DATA_URL }: OfficialDataAppProps) {
  const [state, setState] = useState<LoadState>({ status: 'loading' });

  useEffect(() => {
    let active = true;

    const load = async () => {
      try {
        const response = await fetch(dataUrl, { cache: 'no-cache' });
        if (!response.ok) {
          throw new Error(`Official data request failed: ${response.status}`);
        }

        const bundle = loadOfficialDataAsset(await response.text());
        if (active) setState({ status: 'ready', bundle });
      } catch {
        if (active) setState({ status: 'error' });
      }
    };

    void load();

    return () => {
      active = false;
    };
  }, [dataUrl]);

  if (state.status === 'loading') {
    return (
      <DataStateView
        title="공식 데이터를 불러오는 중입니다."
        message="검증된 생활쓰레기 배출 정보를 준비하고 있습니다."
      />
    );
  }

  if (state.status === 'error') {
    return (
      <DataStateView
        title="데이터를 불러오지 못했습니다."
        message="공식 데이터 파일을 확인할 수 없어 배출 가능 여부를 표시하지 않습니다."
      />
    );
  }

  return <App regions={toRegionOptions(state.bundle)} />;
}
