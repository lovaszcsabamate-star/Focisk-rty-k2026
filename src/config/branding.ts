export type AssetLicense = {
  assetId: string;
  filePath: string;
  assetType:
    | 'club-logo'
    | 'league-logo'
    | 'player-photo'
    | 'font'
    | 'icon'
    | 'background'
    | 'sound';
  sourceType:
    | 'original'
    | 'licensed'
    | 'public-domain'
    | 'open-license'
    | 'placeholder';
  rightsHolder?: string;
  licenseName?: string;
  proofOfPermission?: string;
  sourceReference?: string;
  commercialUseAllowed: boolean;
  modificationAllowed: boolean;
  attributionRequired: boolean;
  attributionText?: string;
  validUntil?: string;
  approvedForRelease: boolean;
};

export type BrandingConfig = {
  allowOfficialBranding: boolean;
  licenseRegistryPath: string;
  playerPlaceholderPath: string;
  clubPlaceholderPath: string;
  blockRemotePlayerPhotos: boolean;
  blockRemoteClubLogos: boolean;
};

/**
 * Biztonságos alapérték: a kapcsoló önmagában nem engedélyez hivatalos arculatot.
 * Az egyes asseteknek a licencnyilvántartásban is kiadásra jóváhagyottnak kell lenniük.
 */
export const brandingConfig: Readonly<BrandingConfig> = Object.freeze({
  allowOfficialBranding: false,
  licenseRegistryPath: 'src/assets/licenses/assets-licenses.json',
  playerPlaceholderPath: 'src/assets/placeholders/player-silhouette.svg',
  clubPlaceholderPath: 'src/assets/placeholders/club-badge.svg',
  blockRemotePlayerPhotos: true,
  blockRemoteClubLogos: true,
});
