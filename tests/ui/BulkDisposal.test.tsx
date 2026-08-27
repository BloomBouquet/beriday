import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it } from 'vitest';
import App from '../../src/App';

const gangnamRegion = {
  regionId: '서울특별시/강남구/역삼동',
  sido: '서울특별시',
  sigungu: '강남구',
  areaName: '역삼동',
};

const bukguRegion = {
  regionId: '광주광역시/북구/테스트동',
  sido: '광주광역시',
  sigungu: '북구',
  areaName: '테스트동',
};

const bukguRule = {
  id: 'bukgu-general',
  regionId: bukguRegion.regionId,
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

function selectRegion(region: typeof gangnamRegion | typeof bukguRegion) {
  fireEvent.click(screen.getByRole('button', { name: '지역 설정하기' }));
  fireEvent.change(screen.getByLabelText('시/도'), { target: { value: region.sido } });
  fireEvent.change(screen.getByLabelText('시/군/구'), { target: { value: region.sigungu } });
  fireEvent.change(screen.getByLabelText('관리구역'), { target: { value: region.areaName } });
  fireEvent.click(screen.getByRole('button', { name: '이 지역으로 시작하기' }));
  fireEvent.click(screen.getByRole('button', { name: '품목 검색' }));
  fireEvent.click(screen.getByRole('button', { name: '대형폐기물 안내' }));
}

describe('bulk disposal guidance', () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  it('links only to a verified official municipal bulk-waste procedure', () => {
    render(<App regions={[gangnamRegion]} />);

    selectRegion(gangnamRegion);

    expect(screen.getByRole('heading', { name: '대형폐기물은 공식 절차를 확인하세요' })).toBeInTheDocument();
    expect(screen.getByText('강남구청')).toBeInTheDocument();
    expect(screen.getByText('자원순환과')).toBeInTheDocument();
    expect(screen.getByText('02-3423-5974')).toBeInTheDocument();
    expect(screen.getByText('검증일 2026-08-28')).toBeInTheDocument();

    const officialLink = screen.getByRole('link', { name: '공식 배출 절차 보기' });
    expect(officialLink).toHaveAttribute(
      'href',
      'https://www.gangnam.go.kr/waste/apply/info.do?mid=ID03_030702',
    );
    expect(screen.getByText('버리데이에서는 신고·결제·수거를 받지 않습니다.')).toBeInTheDocument();
  });

  it('falls back to the official authority contact when no procedure URL is verified', () => {
    render(<App regions={[bukguRegion]} rules={[bukguRule]} />);

    selectRegion(bukguRegion);

    expect(screen.getByRole('heading', { name: '대형폐기물은 공식 절차를 확인하세요' })).toBeInTheDocument();
    expect(screen.getByText('공식 신청 링크를 아직 검증하지 못했습니다.')).toBeInTheDocument();
    expect(screen.getByText('북구청')).toBeInTheDocument();
    expect(screen.getByText('062-000-0000')).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: '공식 배출 절차 보기' })).not.toBeInTheDocument();
  });
});
