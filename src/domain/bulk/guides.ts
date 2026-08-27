export type BulkDisposalGuide = {
  sido: string;
  sigungu: string;
  authorityName: string;
  departmentName: string;
  contact: string;
  procedureUrl: string;
  sourceName: string;
  verifiedAt: string;
};

const GUIDES: readonly BulkDisposalGuide[] = [
  {
    sido: '서울특별시',
    sigungu: '강남구',
    authorityName: '강남구청',
    departmentName: '자원순환과',
    contact: '02-3423-5974',
    procedureUrl: 'https://www.gangnam.go.kr/waste/apply/info.do?mid=ID03_030702',
    sourceName: '강남구청 대형생활폐기물',
    verifiedAt: '2026-08-28',
  },
  {
    sido: '부산광역시',
    sigungu: '해운대구',
    authorityName: '해운대구청',
    departmentName: '자원순환과',
    contact: '051-749-4462',
    procedureUrl: 'https://www.haeundae.go.kr/board/list.do?boardId=BBS_0000323&menuCd=DOM_000000102014007003',
    sourceName: '해운대구청 대형폐기물 배출 신청',
    verifiedAt: '2026-08-28',
  },
];

export function getBulkDisposalGuide(sido: string, sigungu: string): BulkDisposalGuide | null {
  return GUIDES.find((guide) => guide.sido === sido && guide.sigungu === sigungu) ?? null;
}
