import type { WasteCategory } from '../waste/types.js';

export type DisposalItem = {
  id: string;
  names: string[];
  category: WasteCategory;
  preparation: string[];
  warnings: string[];
  sourceName: string;
  sourceUrl: string;
};

const ENV_CARD_NEWS = 'https://me.go.kr/home/web/board/read.do?boardId=1402130&boardMasterId=713';

export const ITEMS: DisposalItem[] = [
  {
    id: 'styrofoam-box',
    names: ['스티로폼 상자', '스티로폼 박스', '택배 스티로폼'],
    category: 'recycling',
    preparation: ['상자에 붙은 테이프와 택배 스티커를 제거한다.', '흩날리지 않도록 모아 배출한다.'],
    warnings: ['지역별 기준이 다를 수 있으므로 선택 지역 일정을 함께 확인한다.'],
    sourceName: '기후에너지환경부 분리배출 가이드',
    sourceUrl: ENV_CARD_NEWS,
  },
  {
    id: 'plastic-container',
    names: ['플라스틱 포장용기', '플라스틱 용기'],
    category: 'recycling',
    preparation: ['내용물을 비우고 물로 헹군 뒤 배출한다.'],
    warnings: ['지역에 따라 종량제 봉투 배출 대상일 수 있다.'],
    sourceName: '기후에너지환경부 분리배출 가이드',
    sourceUrl: ENV_CARD_NEWS,
  },
  {
    id: 'gel-ice-pack',
    names: ['젤 아이스팩', '고흡수성수지 아이스팩'],
    category: 'general',
    preparation: ['자르지 않고 그대로 종량제 봉투에 배출한다.'],
    warnings: ['물로 된 아이스팩과 처리 방법이 다르다.'],
    sourceName: '기후에너지환경부 분리배출 가이드',
    sourceUrl: ENV_CARD_NEWS,
  },
];
