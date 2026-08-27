import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import OfficialDataApp from '../../src/OfficialDataApp';

const officialAsset = JSON.stringify({
  schemaVersion: 1,
  importedAt: '2026-08-28T00:00:00.000Z',
  regions: [
    {
      id: '광주광역시/북구/일곡동',
      sido: '광주광역시',
      sigungu: '북구',
      areaName: '일곡동',
      displayName: '광주광역시 북구 일곡동',
    },
  ],
  rules: [
    {
      id: 'general-official-rule',
      regionId: '광주광역시/북구/일곡동',
      category: 'general',
      weekdays: [5],
      timeWindows: [{ start: '19:00', end: '23:00' }],
      excludedDates: [],
      instructions: ['종량제봉투에 배출'],
      confidence: 'verified',
      provenance: {
        sourceId: 'official-household-waste',
        sourceName: '행정안전부 전국생활쓰레기배출정보표준데이터',
        sourceUrl: 'https://www.data.go.kr/data/15025450/standard.do',
        sourceUpdatedAt: '2026-08-25',
        importedAt: '2026-08-28T00:00:00.000Z',
        authorityName: '북구청',
        authorityContact: '062-000-0000',
      },
    },
  ],
  reports: {},
});

describe('OfficialDataApp', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.useRealTimers();
    window.localStorage.clear();
  });

  it('shows loading, then exposes regions from the validated official asset', async () => {
    let resolveFetch: ((value: unknown) => void) | undefined;

    vi.stubGlobal(
      'fetch',
      vi.fn(
        () =>
          new Promise((resolve) => {
            resolveFetch = resolve;
          }),
      ),
    );

    render(<OfficialDataApp />);

    expect(screen.getByText('공식 데이터를 불러오는 중입니다.')).toBeInTheDocument();

    resolveFetch?.({
      ok: true,
      text: async () => officialAsset,
    });

    await waitFor(() => {
      expect(screen.getByRole('button', { name: '지역 설정하기' })).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole('button', { name: '지역 설정하기' }));
    fireEvent.change(screen.getByLabelText('시/도'), { target: { value: '광주광역시' } });
    fireEvent.change(screen.getByLabelText('시/군/구'), { target: { value: '북구' } });

    expect(screen.getByRole('option', { name: '일곡동' })).toBeInTheDocument();
  });

  it('passes validated official rules through to the Today calculation', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-08-28T11:00:00.000Z'));
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        text: async () => officialAsset,
      }),
    );

    render(<OfficialDataApp />);

    await vi.waitFor(() => {
      expect(screen.getByRole('button', { name: '지역 설정하기' })).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole('button', { name: '지역 설정하기' }));
    fireEvent.change(screen.getByLabelText('시/도'), { target: { value: '광주광역시' } });
    fireEvent.change(screen.getByLabelText('시/군/구'), { target: { value: '북구' } });
    fireEvent.change(screen.getByLabelText('관리구역'), { target: { value: '일곡동' } });
    fireEvent.click(screen.getByRole('button', { name: '이 지역으로 시작하기' }));

    const generalCard = screen.getByText('일반쓰레기').closest('article');
    expect(generalCard).not.toBeNull();
    expect(within(generalCard!).getByText('가능')).toBeInTheDocument();
    expect(within(generalCard!).getByText('19:00~23:00')).toBeInTheDocument();
  });

  it('fails closed when the official asset request returns an HTTP error', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: false,
        status: 404,
        text: async () => '',
      }),
    );

    render(<OfficialDataApp />);

    expect(await screen.findByRole('heading', { name: '데이터를 불러오지 못했습니다.' })).toBeInTheDocument();
    expect(screen.getByText('공식 데이터 파일을 확인할 수 없어 배출 가능 여부를 표시하지 않습니다.')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: '지역 설정하기' })).not.toBeInTheDocument();
  });

  it('fails closed when the fetched official asset is malformed', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        text: async () => '{not-valid-json',
      }),
    );

    render(<OfficialDataApp />);

    expect(await screen.findByRole('heading', { name: '데이터를 불러오지 못했습니다.' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: '지역 설정하기' })).not.toBeInTheDocument();
    expect(screen.queryByText('일곡동')).not.toBeInTheDocument();
  });
});
