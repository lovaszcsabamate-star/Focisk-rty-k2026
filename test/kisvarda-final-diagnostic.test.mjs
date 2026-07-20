import fs from 'node:fs';

import {
  applyClubEnrichmentPayload,
  prepareClubEnrichment,
} from '../js/data/club-enrichment.js';
import { applyOfficialStatPatches } from '../js/data/club-stat-patches.js';

const readJson = relative => JSON.parse(fs.readFileSync(new URL(relative, import.meta.url), 'utf8'));
const basePayload = readJson('../data/players.json');
const directory = readJson('../data/club-official-sources.json');
const enrichmentFiles = [
  '../data/club-official-enrichment.json',
  '../data/club-official-enrichment-2.json',
  '../data/club-official-enrichment-3-paks-nyir.json',
  '../data/club-official-enrichment-4-ujpest.json',
  '../data/club-official-enrichment-5-other.json',
  '../data/club-official-enrichment-6-eto-puskas.json',
  '../data/club-official-enrichment-7-kisvarda-selected10.json',
  '../data/club-official-enrichment-8-kisvarda-selected10.json',
  '../data/club-official-enrichment-9-kisvarda-selected10.json',
];
const correctionFiles = [
  '../data/club-official-corrections.json',
  '../data/club-official-corrections-2.json',
  '../data/club-official-corrections-3.json',
  '../data/club-official-corrections-4-kisvarda-selected10-2.json',
];
const statPatchFiles = [
  '../data/club-official-stat-patches-kisvarda.json',
  '../data/club-official-stat-patches-kisvarda-selected10.json',
  '../data/club-official-stat-patches-kisvarda-selected10-2.json',
  '../data/club-official-stat-patches-kisvarda-selected10-3.json',
];

const enrichmentParts = enrichmentFiles.map(readJson);
const correctionParts = correctionFiles.map(readJson);
const statPatchParts = statPatchFiles.map(readJson);
const rawEnrichment = {
  ...enrichmentParts[0],
  generatedAt: enrichmentParts.at(-1)?.generatedAt ?? enrichmentParts[0].generatedAt,
  sources: enrichmentParts.flatMap(part => part.sources ?? []),
  records: enrichmentParts.flatMap(part => part.records ?? []),
  clubDirectory: directory.clubs,
};
const corrections = {
  schemaVersion: 1,
  checkedAt: correctionParts.at(-1)?.checkedAt ?? null,
  addSources: correctionParts.flatMap(part => part.addSources ?? []),
  recordPatches: correctionParts.flatMap(part => part.recordPatches ?? []),
  excludeRecords: correctionParts.flatMap(part => part.excludeRecords ?? []),
  additions: correctionParts.flatMap(part => part.additions ?? []),
};
const enriched = applyClubEnrichmentPayload(basePayload, prepareClubEnrichment(rawEnrichment, corrections));
const patched = applyOfficialStatPatches(enriched, statPatchParts);

const blank = value => value == null || String(value).trim() === '' || value === 'Nincs adat';
const fields = [
  ['birthDate', player => player.birthDate],
  ['nation', player => player.nation],
  ['position', player => player.position],
  ['heightCm', player => player.stats?.heightCm],
  ['shirtNumber', player => player.stats?.shirtNumber],
  ['appearances', player => player.stats?.appearances],
  ['starts', player => player.stats?.starts],
  ['minutes', player => player.stats?.minutes],
  ['assists', player => player.stats?.assists],
  ['squads', player => player.stats?.squads],
  ['yellowCards', player => player.stats?.yellowCards],
  ['redCards', player => player.stats?.redCards],
  ['secondYellowRedCards', player => player.stats?.secondYellowRedCards],
  ['totalDismissals', player => player.stats?.totalDismissals],
];
const kisvarda = patched.players
  .filter(player => player.meta?.clubIds?.includes('kisvarda-master-good'))
  .map(player => ({
    id: player.id,
    name: player.name,
    missing: fields.filter(([, getter]) => blank(getter(player))).map(([field]) => field),
    sourceCount: player.meta?.clubOfficialSources?.length ?? 0,
    statSourceCount: player.meta?.officialStatSources?.length ?? 0,
    appearances: player.stats?.appearances ?? null,
    squads: player.stats?.squads ?? null,
  }))
  .sort((a, b) => b.missing.length - a.missing.length || a.name.localeCompare(b.name, 'hu'));

console.log('KISVARDA_DIAGNOSTIC_START');
console.log(JSON.stringify({ count: kisvarda.length, players: kisvarda }, null, 2));
console.log('KISVARDA_DIAGNOSTIC_END');
