import type { OfficialHouseholdWasteRow } from '../import/householdWasteCsv.js';
import { makeRegionId } from '../../domain/waste/parse.js';
import type { Region } from '../../domain/waste/types.js';

export type ManagementArea = {
  id: string;
  sido: string;
  sigungu: string;
  name: string;
};

export type TargetAreaAssociationSource = {
  sourceRow: number;
  sourceUpdatedAt: string;
  authorityName: string;
  authorityContact: string;
};

export type TargetAreaAssociation = {
  regionId: string;
  managementAreaId: string;
  sources: TargetAreaAssociationSource[];
};

export type TargetAreaMappingIssue =
  | {
      row: number;
      code: 'missing-target-area';
      message: string;
    }
  | {
      regionId: string;
      code: 'ambiguous-target-area';
      message: string;
    };

export type TargetAreaMappingReport = {
  selectableRegions: number;
  unresolvedRows: number;
  ambiguousTargetAreas: number;
  issues: TargetAreaMappingIssue[];
};

export type TargetAreaCatalog = {
  regions: Region[];
  managementAreas: ManagementArea[];
  associations: TargetAreaAssociation[];
  report: TargetAreaMappingReport;
};

function makeManagementAreaId(sido: string, sigungu: string, name: string): string {
  return `collection:${[sido, sigungu, name]
    .map((part) => encodeURIComponent(part.trim()))
    .join('/')}`;
}

function compareById<T extends { id: string }>(left: T, right: T): number {
  return left.id.localeCompare(right.id, 'ko');
}

export function buildTargetAreaCatalog(
  rows: readonly OfficialHouseholdWasteRow[],
): TargetAreaCatalog {
  const regionsById = new Map<string, Region>();
  const managementAreasById = new Map<string, ManagementArea>();
  const associationsByKey = new Map<string, TargetAreaAssociation>();
  const zoneNamesByRegionId = new Map<string, Map<string, string>>();
  const issues: TargetAreaMappingIssue[] = [];
  let unresolvedRows = 0;

  rows.forEach((row, index) => {
    const sourceRow = Number.isInteger(row.sourceRow) ? row.sourceRow : index + 1;
    const managementAreaId = makeManagementAreaId(
      row.sido,
      row.sigungu,
      row.managementAreaName,
    );

    if (!managementAreasById.has(managementAreaId)) {
      managementAreasById.set(managementAreaId, {
        id: managementAreaId,
        sido: row.sido,
        sigungu: row.sigungu,
        name: row.managementAreaName,
      });
    }

    const targetAreaNames = [...new Set(row.targetAreaNames.map((name) => name.trim()).filter(Boolean))];

    if (targetAreaNames.length === 0) {
      unresolvedRows += 1;
      issues.push({
        row: sourceRow,
        code: 'missing-target-area',
        message: `No 관리구역대상지역명 available for ${row.managementAreaName}`,
      });
      return;
    }

    targetAreaNames.forEach((areaName) => {
      const regionId = makeRegionId(row.sido, row.sigungu, areaName);

      if (!regionsById.has(regionId)) {
        regionsById.set(regionId, {
          id: regionId,
          sido: row.sido,
          sigungu: row.sigungu,
          areaName,
          displayName: `${row.sido} ${row.sigungu} ${areaName}`,
        });
      }

      const zones = zoneNamesByRegionId.get(regionId) ?? new Map<string, string>();
      zones.set(managementAreaId, row.managementAreaName);
      zoneNamesByRegionId.set(regionId, zones);

      const associationKey = `${regionId}\u0000${managementAreaId}`;
      const association = associationsByKey.get(associationKey);
      const source: TargetAreaAssociationSource = {
        sourceRow,
        sourceUpdatedAt: row.sourceUpdatedAt,
        authorityName: row.authorityName,
        authorityContact: row.authorityContact,
      };

      if (association) {
        association.sources.push(source);
      } else {
        associationsByKey.set(associationKey, {
          regionId,
          managementAreaId,
          sources: [source],
        });
      }
    });
  });

  const ambiguousRegionIds = new Set<string>();

  [...zoneNamesByRegionId.entries()]
    .sort(([left], [right]) => left.localeCompare(right, 'ko'))
    .forEach(([regionId, zones]) => {
      if (zones.size <= 1) return;

      ambiguousRegionIds.add(regionId);
      const zoneNames = [...zones.values()].sort((left, right) => left.localeCompare(right, 'ko'));
      issues.push({
        regionId,
        code: 'ambiguous-target-area',
        message: `Target area maps to multiple collection zones: ${zoneNames.join(', ')}`,
      });
    });

  const regions = [...regionsById.values()]
    .filter((region) => !ambiguousRegionIds.has(region.id))
    .sort(compareById);

  const managementAreas = [...managementAreasById.values()].sort(compareById);
  const associations = [...associationsByKey.values()].sort((left, right) => {
    const regionOrder = left.regionId.localeCompare(right.regionId, 'ko');
    if (regionOrder !== 0) return regionOrder;
    return left.managementAreaId.localeCompare(right.managementAreaId, 'ko');
  });

  return {
    regions,
    managementAreas,
    associations,
    report: {
      selectableRegions: regions.length,
      unresolvedRows,
      ambiguousTargetAreas: ambiguousRegionIds.size,
      issues,
    },
  };
}
