/**
 * Platform Recommendations Configuration
 * 
 * Admin-editable config for software and browser recommendations
 * used in the "Platform Recommendation" sheet of the export workbook.
 * 
 * To customize: edit this file or extend with a localStorage-backed
 * admin config system.
 */

import { migrateLegacyConfig, loadPlatformConfig } from '../admin/platformRecommendationsStore';
import { getRemotePlatformConfig } from '../services/configLoader';

export interface SoftwareRecommendation {
  software: string;
  supportedVersion: string;
  componentHosted: string;
  comments: string;
}

export interface BrowserRecommendation {
  browser: string;
  supportedVersion: string;
}

export interface PlatformRecommendations {
  software: SoftwareRecommendation[];
  browsers: BrowserRecommendation[];
}

const defaultRecommendations: PlatformRecommendations = {
  software: [
    {
      software: 'Linux (OS)',
      supportedVersion: 'RHEL 9 x86_64bit',
      componentHosted: 'CRM, GenAI, Metabase and Clickhouse',
      comments: '',
    },
    {
      software: 'Windows (OS)',
      supportedVersion: 'Windows Server 2016+',
      componentHosted: 'Talend',
      comments: '',
    },
    {
      software: 'Apache',
      supportedVersion: '2.4',
      componentHosted: 'Application Stack',
      comments: '',
    },
    {
      software: 'PHP',
      supportedVersion: '8.4',
      componentHosted: 'Application Stack',
      comments: '',
    },
    {
      software: 'MySQL',
      supportedVersion: '8.4',
      componentHosted: 'Database Stack',
      comments: '',
    },
    {
      software: 'MSSQL',
      supportedVersion: '2016+',
      componentHosted: 'Database Stack',
      comments: '',
    },
    {
      software: 'Oracle Database',
      supportedVersion: '21+',
      componentHosted: 'Database Stack',
      comments: '',
    },
    {
      software: 'HAProxy',
      supportedVersion: '2.6',
      componentHosted: 'Software Load Balancer',
      comments: 'Flexible to use hardware load balancer if client has and already using it',
    },
  ],
  browsers: [
    { browser: 'Chrome', supportedVersion: 'version 109 and above' },
    { browser: 'Firefox', supportedVersion: 'version 109 and above' },
    { browser: 'Edge', supportedVersion: 'version 109 and above' },
    { browser: 'Safari', supportedVersion: 'version 16 and above' },
  ],
};

/**
 * Re-export defaultRecommendations so admin UI can access it for reset.
 */
export { defaultRecommendations };

/**
 * Load platform recommendations from versioned admin config,
 * falling back to defaults.
 *
 * Resolution order:
 * 1. Migrate legacy key (one-time)
 * 2. Load from versioned store → validate
 * 3. Fallback to built-in defaults
 *
 * Signature is unchanged — exporter calls this as-is.
 */
export const getPlatformRecommendations = (): PlatformRecommendations => {
  try {
    // 1. Remote config (fetched at boot, cached in-memory)
    const remoteConfig = getRemotePlatformConfig();
    if (remoteConfig) return remoteConfig;

    // 2. One-time migration from legacy key
    migrateLegacyConfig();

    // 3. localStorage admin overrides
    const adminConfig = loadPlatformConfig();
    if (adminConfig) return adminConfig;
  } catch {
    // Fallback to defaults on any error
  }
  return defaultRecommendations;
};
