import { fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import App from '../../src/App';

const testRegions = [
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
];

const provenance = {
  sourceId: 'official-household-waste',
  sourceName: '행정안전부 전국생활쓰레기배출정보표준데이터',
  sourceUrl: 'https://www.data.go.kr/data/15025450/standard.do',
  sourceUpdatedAt: '2026-08-25',
  importedAt: '2026-08-28T00:00:00.000Z',
  authorityName: '북구청',
  authorityContact: '062-000-0000',
};

const testRules = [
  {
    id: 'general-rule',
    regionId: '광주광역시/북구/테스트동',
    category: 'general' as const,
    weekdays: [5],
    timeWindows: [{ start: '19:00', end: '23:00' }],
    excludedDates: [],
    instructions: ['종량제봉투에 배출'],
    confidence: 'verified' as const,
    provenance,
  },
  {
    id: 'food-ambiguous-rule',
    regionId: '광주광역시/북구/테스트동',
    category: 'food' as const,
    weekdays: [5],
    timeWindows: [{ start: '18:00', end: '23:00' }],
    excludedDates: [],
    instructions: ['전용용기에 배출'],
    confidence: 'ambiguous' as const,
    provenance,
  },
];

const weeklyRules = [
  ...testRules,
  {
    id: 'recycling-monday-rule',
    regionId: '광주광역시/북구/테스트동',
    category: 'recycling' as const,
    weekdays: [1],
    timeWindows: [{ start: '08:00', end: '10:00' }],
    excludedDates: [],
    instructions: ['분리배출'],
    confidence: 'verified' as const,
    provenance,
  },
];

function selectTestRegion() {
  fireEvent.click(screen.getByRole('button', { name: '지역 설정하기' }));
  fireEvent.change(screen.getByLabelText('시/도'), { target: { value: '광주광역시' } });
  fireEvent.change(screen.getByLabelText('시/군/구'), { target: { value: '북구' } });
  fireEvent.change(screen.getByLabelText('관리구역'), { target: { value: '테스트동' } });
  fireEvent.click(screen.getByRole('button', { name: '이 지역으로 시작하기' }));
}

describe('Beriday app shell', () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('guides a first-time user to choose a region before showing a schedule', () => {
    render(<App regions={testRegions} />);

    expect(screen.getByRole('heading', { name: '오늘 버릴 수 있는 것부터 확인하세요' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '지역 설정하기' })).toBeInTheDocument();
    expect(screen.getByText('GPS 없이 행정구역만 저장합니다.')).toBeInTheDocument();
  });

  it('lets a user choose a region, saves it locally, and enters Today', () => {
    render(<App regions={testRegions} />);

    selectTestRegion();

    expect(screen.getByRole('heading', { name: '오늘의 배출' })).toBeInTheDocument();
    expect(screen.getByText('광주광역시 북구 테스트동')).toBeInTheDocument();
    expect(window.localStorage.getItem('beriday:saved-region:v1')).toContain('광주광역시/북구/테스트동');
  });

  it('restores a previously saved valid region on a new app render', () => {
    window.localStorage.setItem(
      'beriday:saved-region:v1',
      JSON.stringify({
        regionId: '광주광역시/북구/테스트동',
        savedAt: '2026-08-27T12:00:00.000Z',
      }),
    );

    render(<App regions={testRegions} />);

    expect(screen.getByRole('heading', { name: '오늘의 배출' })).toBeInTheDocument();
    expect(screen.getByText('광주광역시 북구 테스트동')).toBeInTheDocument();
  });

  it('does not expose fixture regions when no production catalog is provided', () => {
    render(<App />);

    fireEvent.click(screen.getByRole('button', { name: '지역 설정하기' }));

    expect(screen.getByText('지역 데이터 준비 중')).toBeInTheDocument();
    expect(screen.queryByRole('option', { name: '테스트동' })).not.toBeInTheDocument();
  });

  it('evaluates verified Today rules and explains ambiguous or missing categories', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-08-28T11:00:00.000Z'));

    render(<App regions={[testRegions[0]]} rules={testRules} />);

    selectTestRegion();

    const generalCard = screen.getByText('일반쓰레기').closest('article');
    const foodCard = screen.getByText('음식물').closest('article');
    const recyclingCard = screen.getByText('재활용').closest('article');

    expect(generalCard).not.toBeNull();
    expect(foodCard).not.toBeNull();
    expect(recyclingCard).not.toBeNull();

    expect(within(generalCard!).getByText('가능')).toBeInTheDocument();
    expect(within(generalCard!).getByText('19:00~23:00')).toBeInTheDocument();
    expect(within(foodCard!).getByText('확인 필요')).toBeInTheDocument();
    expect(
      within(foodCard!).getByText('공식 데이터의 일정 규칙이 서로 충돌하거나 모호해 자동 판단하지 않습니다.'),
    ).toBeInTheDocument();
    expect(within(recyclingCard!).getByText('확인 필요')).toBeInTheDocument();
    expect(
      within(recyclingCard!).getByText('검증된 일정 규칙이 없어 자동 판단하지 않습니다.'),
    ).toBeInTheDocument();
  });

  it('navigates to the current Seoul Monday-Sunday Weekly schedule and back to Today', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-08-28T11:00:00.000Z'));

    render(<App regions={[testRegions[0]]} rules={weeklyRules} />);

    selectTestRegion();
    fireEvent.click(screen.getByRole('button', { name: '주간 일정 보기' }));

    expect(screen.getByRole('heading', { name: '이번 주 배출 일정' })).toBeInTheDocument();
    expect(screen.getByText('8.24 ~ 8.30')).toBeInTheDocument();

    const monday = screen.getByRole('article', { name: '월요일 8월 24일' });
    const tuesday = screen.getByRole('article', { name: '화요일 8월 25일' });
    const friday = screen.getByRole('article', { name: '금요일 8월 28일' });

    expect(within(monday).getByText('재활용')).toBeInTheDocument();
    expect(within(tuesday).getByText('배출 일정 없음')).toBeInTheDocument();
    expect(within(friday).getByText('일반쓰레기')).toBeInTheDocument();

    const verificationBanner = screen.getByRole('note', { name: '확인 필요 품목' });
    expect(within(verificationBanner).getByText('음식물')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: '오늘 보기' }));
    expect(screen.getByRole('heading', { name: '오늘의 배출' })).toBeInTheDocument();
  });

  it('does not render an untrusted provenance URL as a clickable source link', () => {
    const unsafeRules = [
      {
        ...testRules[0],
        provenance: {
          ...provenance,
          sourceName: '검증되지 않은 출처',
          sourceUrl: 'https://data.go.kr.evil.example/rule',
        },
      },
    ];

    render(<App regions={[testRegions[0]]} rules={unsafeRules} />);

    selectTestRegion();

    expect(screen.getByText('검증되지 않은 출처')).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: '검증되지 않은 출처' })).not.toBeInTheDocument();
  });
});
