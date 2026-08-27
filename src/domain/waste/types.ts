export type RegionId = string;

export type WasteCategory = 'general' | 'food' | 'recycling' | 'bulk' | 'other';

export type Region = {
  id: RegionId;
  sido: string;
  sigungu: string;
  areaName: string;
  displayName: string;
};

export type TimeWindow = {
  start: string | null;
  end: string | null;
};

export type RuleProvenance = {
  sourceId: string;
  sourceName: string;
  sourceUrl: string;
  sourceUpdatedAt: string | null;
  importedAt: string;
  authorityName: string | null;
  authorityContact: string | null;
};

export type CollectionRule = {
  id: string;
  regionId: RegionId;
  category: WasteCategory;
  weekdays: number[];
  timeWindows: TimeWindow[];
  excludedDates: string[];
  instructions: string[];
  confidence: 'verified' | 'ambiguous';
  provenance: RuleProvenance;
};
