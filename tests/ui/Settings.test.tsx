import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it } from 'vitest';
import App from '../../src/App';

const region = {
  regionId: '광주광역시/북구/용봉동',
  sido: '광주광역시',
  sigungu: '북구',
  areaName: '용봉동',
};

const rule = {
  id: 'bukgu-general',
  regionId: region.regionId,
  category: 'general' as const,
  weekdays: [5],
  timeWindows: [{ start: '19:00', end: '23:00' }],
  excludedDates: [],
  instructions: ['종량제봉투에 배출'],
  confidence: 'verified' as const,
  provenance: {
    sourceId: 'official-household-waste',
    sourceName: '행정안전부 전국생활쓰레기배출정보표준데이터',
    sourceUrl: 'https://www.data.go.kr/data/15025450/standard.do',
    sourceUpdatedAt: '2026-08-25',
    importedAt: '2026-08-28T00:00:00.000Z',
    authorityName: '북구청',
    authorityContact: '062-000-0000',
  },
};

const dataSummary = {
  importedAt: '2026-08-28T00:00:00.000Z',
  totalRows: 7398,
  acceptedRows: 7000,
  rejectedRows: 398,
};

function chooseRegion() {
  fireEvent.click(screen.getByRole('button', { name: '지역 설정하기' }));
  fireEvent.change(screen.getByLabelText('시/도'), { target: { value: region.sido } });
  fireEvent.change(screen.getByLabelText('시/군/구'), { target: { value: region.sigungu } });
  fireEvent.change(screen.getByLabelText('관리구역'), { target: { value: region.areaName } });
  fireEvent.click(screen.getByRole('button', { name: '이 지역으로 시작하기' }));
}

describe('settings', () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  it('shows the saved region, privacy boundary, and data provenance', () => {
    render(<App regions={[region]} rules={[rule]} dataSummary={dataSummary} />);
    chooseRegion();

    fireEvent.click(screen.getByRole('button', { name: '설정' }));

    expect(screen.getByRole('heading', { name: '설정' })).toBeInTheDocument();
    expect(screen.getByText('광주광역시 북구 용봉동')).toBeInTheDocument();
    expect(screen.getByText('GPS와 상세 주소는 저장하지 않습니다.')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: '데이터 및 안내' })).toBeInTheDocument();
    expect(screen.getByText('행정안전부 전국생활쓰레기배출정보표준데이터')).toBeInTheDocument();
    expect(screen.getByText(/원본 7398건 중 7000건 반영/)).toBeInTheDocument();
    expect(screen.getByText('지자체 정책은 변경될 수 있으므로 중요한 배출 전에는 공식 안내를 함께 확인하세요.')).toBeInTheDocument();
  });

  it('returns to region setup without requesting GPS or an exact address', () => {
    render(<App regions={[region]} rules={[rule]} />);
    chooseRegion();

    fireEvent.click(screen.getByRole('button', { name: '설정' }));
    fireEvent.click(screen.getByRole('button', { name: '지역 다시 설정' }));

    expect(screen.getByRole('heading', { name: '지역을 선택하세요' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: '현재 위치 사용' })).not.toBeInTheDocument();
    expect(screen.queryByLabelText('상세 주소')).not.toBeInTheDocument();
  });

  it('clears only the saved local region and returns to the first-visit home', () => {
    render(<App regions={[region]} rules={[rule]} />);
    chooseRegion();

    expect(window.localStorage.getItem('beriday:saved-region:v1')).not.toBeNull();

    fireEvent.click(screen.getByRole('button', { name: '설정' }));
    fireEvent.click(screen.getByRole('button', { name: '저장된 지역 삭제' }));

    expect(window.localStorage.getItem('beriday:saved-region:v1')).toBeNull();
    expect(screen.getByRole('button', { name: '지역 설정하기' })).toBeInTheDocument();
  });
});
