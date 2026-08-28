import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import OfficialDataApp from '../../src/OfficialDataApp';

const importedAt = '2026-08-28T00:00:00.000Z';
const sourceUpdatedAt = '2026-08-25';
const gwangjuShardId = 'municipality-11111111';
const seoulShardId = 'municipality-22222222';

const manifest = {
  schemaVersion: 1,
  importedAt,
  sourceUpdatedAt,
  source: { totalRows: 10, acceptedRows: 9, rejectedRows: 1 },
  regionCount: 3,
  ruleCount: 3,
  regions: [
    {
      regionId: '광주광역시/북구/일곡동',
      sido: '광주광역시',
      sigungu: '북구',
      areaName: '일곡동',
      shardId: gwangjuShardId,
    },
    {
      regionId: '광주광역시/북구/용봉동',
      sido: '광주광역시',
      sigungu: '북구',
      areaName: '용봉동',
      shardId: gwangjuShardId,
    },
    {
      regionId: '서울특별시/강남구/역삼동',
      sido: '서울특별시',
      sigungu: '강남구',
      areaName: '역삼동',
      shardId: seoulShardId,
    },
  ],
  shards: {
    [gwangjuShardId]: {
      path: `shards/${gwangjuShardId}.json`,
      regionCount: 2,
      ruleCount: 2,
    },
    [seoulShardId]: {
      path: `shards/${seoulShardId}.json`,
      regionCount: 1,
      ruleCount: 1,
    },
  },
};

function rule(id: string, regionId: string, category = 'general', start = '19:00') {
  return {
    id,
    regionId,
    category,
    weekdays: [5],
    timeWindows: [{ start, end: '23:00' }],
    excludedDates: [],
    instructions: ['종량제봉투에 배출'],
    confidence: 'verified',
    provenance: {
      sourceId: `official-${id}`,
      sourceName: '행정안전부 전국생활쓰레기배출정보표준데이터',
      sourceUrl: 'https://www.data.go.kr/data/15025450/standard.do',
      sourceUpdatedAt,
      importedAt,
      authorityName: regionId.includes('광주') ? '북구청' : '강남구청',
      authorityContact: regionId.includes('광주') ? '062-000-0000' : '02-000-0000',
    },
  };
}

const gwangjuShard = {
  schemaVersion: 1,
  importedAt,
  sourceUpdatedAt,
  shardId: gwangjuShardId,
  regionIds: ['광주광역시/북구/일곡동', '광주광역시/북구/용봉동'],
  rules: [
    rule('ilgok-general', '광주광역시/북구/일곡동'),
    rule('yongbong-food', '광주광역시/북구/용봉동', 'food'),
  ],
};

const seoulShard = {
  schemaVersion: 1,
  importedAt,
  sourceUpdatedAt,
  shardId: seoulShardId,
  regionIds: ['서울특별시/강남구/역삼동'],
  rules: [rule('yeoksam-general', '서울특별시/강남구/역삼동', 'general', '20:00')],
};

function response(value: unknown, ok = true, status = 200) {
  return Promise.resolve({
    ok,
    status,
    text: async () => (typeof value === 'string' ? value : JSON.stringify(value)),
  } as Response);
}

function normalFetch() {
  return vi.fn((input: RequestInfo | URL) => {
    const url = String(input);
    if (url === '/data/runtime/manifest.json') return response(manifest);
    if (url === `/data/runtime/shards/${gwangjuShardId}.json`) return response(gwangjuShard);
    if (url === `/data/runtime/shards/${seoulShardId}.json`) return response(seoulShard);
    return response('', false, 404);
  });
}

async function openSetup() {
  await screen.findByRole('button', { name: '지역 설정하기' });
  fireEvent.click(screen.getByRole('button', { name: '지역 설정하기' }));
}

function chooseRegion(sido: string, sigungu: string, areaName: string) {
  fireEvent.change(screen.getByLabelText('시/도'), { target: { value: sido } });
  fireEvent.change(screen.getByLabelText('시/군/구'), { target: { value: sigungu } });
  fireEvent.change(screen.getByLabelText('관리구역'), { target: { value: areaName } });
  fireEvent.click(screen.getByRole('button', { name: '이 지역으로 시작하기' }));
}

describe('OfficialDataApp', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.useRealTimers();
    window.localStorage.clear();
  });

  it('loads only the runtime manifest at startup and exposes its region catalog', async () => {
    const fetchMock = normalFetch();
    vi.stubGlobal('fetch', fetchMock);

    render(<OfficialDataApp />);

    expect(screen.getByText('공식 데이터를 불러오는 중입니다.')).toBeInTheDocument();
    await openSetup();

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock).toHaveBeenCalledWith('/data/runtime/manifest.json', { cache: 'no-cache' });
    expect(fetchMock.mock.calls.some(([url]) => String(url).includes('official-data.json'))).toBe(false);

    fireEvent.change(screen.getByLabelText('시/도'), { target: { value: '광주광역시' } });
    fireEvent.change(screen.getByLabelText('시/군/구'), { target: { value: '북구' } });
    expect(screen.getByRole('option', { name: '일곡동' })).toBeInTheDocument();
    expect(screen.getByRole('option', { name: '용봉동' })).toBeInTheDocument();
  });

  it('loads the selected municipality shard before calculating Today and preserves source summary', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-08-28T11:00:00.000Z'));
    const fetchMock = normalFetch();
    vi.stubGlobal('fetch', fetchMock);

    render(<OfficialDataApp />);
    await vi.waitFor(() => expect(screen.getByRole('button', { name: '지역 설정하기' })).toBeInTheDocument());
    fireEvent.click(screen.getByRole('button', { name: '지역 설정하기' }));
    chooseRegion('광주광역시', '북구', '일곡동');

    await vi.waitFor(() => {
      const generalCard = screen.getByText('일반쓰레기').closest('article');
      expect(generalCard).not.toBeNull();
      expect(within(generalCard!).getByText('가능')).toBeInTheDocument();
    });

    expect(fetchMock).toHaveBeenCalledWith(
      `/data/runtime/shards/${gwangjuShardId}.json`,
      { cache: 'default' },
    );
    expect(screen.getByText('데이터 기준일 2026-08-25')).toBeInTheDocument();
    expect(screen.getByText('담당기관 북구청 · 062-000-0000')).toBeInTheDocument();
    expect(screen.getByText('원본 10건 중 9건 반영 · 1건 제외')).toBeInTheDocument();
  });

  it('reuses an already loaded municipality shard when switching to another region in the same municipality', async () => {
    const fetchMock = normalFetch();
    vi.stubGlobal('fetch', fetchMock);

    render(<OfficialDataApp />);
    await openSetup();
    chooseRegion('광주광역시', '북구', '일곡동');
    await screen.findByRole('button', { name: '지역 다시 설정' });

    fireEvent.click(screen.getByRole('button', { name: '지역 다시 설정' }));
    chooseRegion('광주광역시', '북구', '용봉동');
    await waitFor(() => expect(screen.getByText('광주광역시 북구 용봉동')).toBeInTheDocument());

    const shardCalls = fetchMock.mock.calls.filter(
      ([url]) => String(url) === `/data/runtime/shards/${gwangjuShardId}.json`,
    );
    expect(shardCalls).toHaveLength(1);
  });

  it('loads the saved region shard immediately after the manifest becomes ready', async () => {
    window.localStorage.setItem(
      'beriday:saved-region:v1',
      JSON.stringify({ regionId: '서울특별시/강남구/역삼동', savedAt: '2026-08-28T00:00:00.000Z' }),
    );
    const fetchMock = normalFetch();
    vi.stubGlobal('fetch', fetchMock);

    render(<OfficialDataApp />);

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith(
        `/data/runtime/shards/${seoulShardId}.json`,
        { cache: 'default' },
      );
    });
    expect(await screen.findByText('서울특별시 강남구 역삼동')).toBeInTheDocument();
  });

  it('fails closed for a selected region when its shard request fails and does not keep previous rules', async () => {
    const fetchMock = vi.fn((input: RequestInfo | URL) => {
      const url = String(input);
      if (url === '/data/runtime/manifest.json') return response(manifest);
      if (url === `/data/runtime/shards/${gwangjuShardId}.json`) return response(gwangjuShard);
      if (url === `/data/runtime/shards/${seoulShardId}.json`) return response('', false, 503);
      return response('', false, 404);
    });
    vi.stubGlobal('fetch', fetchMock);

    render(<OfficialDataApp />);
    await openSetup();
    chooseRegion('광주광역시', '북구', '일곡동');
    await screen.findByText('공식 일정 기준');

    fireEvent.click(screen.getByRole('button', { name: '지역 다시 설정' }));
    chooseRegion('서울특별시', '강남구', '역삼동');

    expect(await screen.findByText('지역 일정 데이터를 불러오지 못했습니다.')).toBeInTheDocument();
    expect(screen.queryByText('담당기관 북구청 · 062-000-0000')).not.toBeInTheDocument();
    expect(screen.queryByText('19:00~23:00')).not.toBeInTheDocument();
  });

  it('ignores a slower previous shard response after the user selects a newer region', async () => {
    let resolveGwangju: ((value: Response) => void) | undefined;
    const fetchMock = vi.fn((input: RequestInfo | URL) => {
      const url = String(input);
      if (url === '/data/runtime/manifest.json') return response(manifest);
      if (url === `/data/runtime/shards/${gwangjuShardId}.json`) {
        return new Promise<Response>((resolve) => {
          resolveGwangju = resolve;
        });
      }
      if (url === `/data/runtime/shards/${seoulShardId}.json`) return response(seoulShard);
      return response('', false, 404);
    });
    vi.stubGlobal('fetch', fetchMock);

    render(<OfficialDataApp />);
    await openSetup();
    chooseRegion('광주광역시', '북구', '일곡동');

    await screen.findByText('지역 일정 데이터를 불러오는 중입니다.');
    fireEvent.click(screen.getByRole('button', { name: '지역 다시 설정' }));
    chooseRegion('서울특별시', '강남구', '역삼동');
    await screen.findByText('서울특별시 강남구 역삼동');

    resolveGwangju?.(await response(gwangjuShard));

    await waitFor(() => {
      expect(screen.getByText('서울특별시 강남구 역삼동')).toBeInTheDocument();
      expect(screen.queryByText('담당기관 북구청 · 062-000-0000')).not.toBeInTheDocument();
    });
  });

  it('fails closed when the runtime manifest request returns an HTTP error', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false, status: 404, text: async () => '' }));

    render(<OfficialDataApp />);

    expect(await screen.findByRole('heading', { name: '데이터를 불러오지 못했습니다.' })).toBeInTheDocument();
    expect(screen.getByText('공식 데이터 파일을 확인할 수 없어 배출 가능 여부를 표시하지 않습니다.')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: '지역 설정하기' })).not.toBeInTheDocument();
  });
});
