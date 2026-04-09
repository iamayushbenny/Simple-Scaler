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
import { AppFormData } from '../types';

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

export type ProductStackId = 'marketing' | 'ryabot' | 'chatbot' | 'crm';

export interface ProductStackRecommendations {
  marketing: SoftwareRecommendation[];
  ryabot: SoftwareRecommendation[];
  chatbot: SoftwareRecommendation[];
  crm: SoftwareRecommendation[];
}

export interface PlatformRecommendations {
  software?: SoftwareRecommendation[];
  browsers: BrowserRecommendation[];
  productStacks: ProductStackRecommendations;
}

export const PRODUCT_STACKS: Array<{ id: ProductStackId; label: string }> = [
  { id: 'marketing', label: 'Marketing Stack' },
  { id: 'ryabot', label: 'RyaBot Stack' },
  { id: 'chatbot', label: 'Chatbot / Rocket.Chat Stack' },
  { id: 'crm', label: 'CRM Stack' },
];

const defaultRecommendations: PlatformRecommendations = {
  software: [
    {
      software: 'Linux/Centos',
      supportedVersion: 'RHEL 9 / Centos 9 x86_64bit',
      componentHosted: 'CRM Stack',
      comments: '',
    },
    {
      software: 'Windows',
      supportedVersion: 'Windows Server 2016+',
      componentHosted: 'CRM Stack',
      comments: '',
    },
    {
      software: 'Apache',
      supportedVersion: '2.4',
      componentHosted: 'CRM Stack',
      comments: '',
    },
    {
      software: 'PHP',
      supportedVersion: '8.4',
      componentHosted: 'CRM Stack',
      comments: '',
    },
    {
      software: 'MySQL',
      supportedVersion: '8.4',
      componentHosted: 'CRM Stack',
      comments: '',
    },
    {
      software: 'MSSQL',
      supportedVersion: '2016+',
      componentHosted: 'CRM Stack',
      comments: '',
    },
    {
      software: 'Oracle',
      supportedVersion: '21+',
      componentHosted: 'CRM Stack',
      comments: '',
    },
    {
      software: 'HAProxy (Software Loadbalancer)',
      supportedVersion: '2.6',
      componentHosted: 'CRM Stack',
      comments: '',
    },
    {
      software: 'ReactJS',
      supportedVersion: '18.14',
      componentHosted: 'CRM Stack',
      comments: '',
    },
    {
      software: 'NodeJS',
      supportedVersion: '20.17',
      componentHosted: 'CRM Stack',
      comments: '',
    },
    {
      software: 'Talend',
      supportedVersion: '8',
      componentHosted: 'CRM Stack',
      comments: '',
    },
    {
      software: 'Java',
      supportedVersion: '11+',
      componentHosted: 'CRM Stack',
      comments: '',
    },
  ],
  browsers: [
    { browser: 'Chrome', supportedVersion: 'version 109 and above' },
    { browser: 'Firefox', supportedVersion: 'version 109 and above' },
    { browser: 'Edge', supportedVersion: 'version 109 and above' },
    { browser: 'Safari', supportedVersion: 'version 16 and above' },
  ],
  productStacks: {
    marketing: [
      {
        software: 'Linux/Centos',
        supportedVersion: 'RHEL 9 / Centos 9 x86_64bit',
        componentHosted: 'Marketing Stack',
        comments: '',
      },
      {
        software: 'Windows',
        supportedVersion: 'Windows Server 2016+',
        componentHosted: 'Marketing Stack',
        comments: '',
      },
      {
        software: 'Apache',
        supportedVersion: '2.4',
        componentHosted: 'Marketing Stack',
        comments: '',
      },
      {
        software: 'PHP',
        supportedVersion: '8.4',
        componentHosted: 'Marketing Stack',
        comments: '',
      },
      {
        software: 'MySQL',
        supportedVersion: '8',
        componentHosted: 'Marketing Stack',
        comments: '',
      },
      {
        software: 'Nginx (Forwarder)',
        supportedVersion: '1.22.1',
        componentHosted: 'Marketing Stack',
        comments: '',
      },
    ],
    ryabot: [
      {
        software: 'Linux/Centos',
        supportedVersion: 'RHEL 9 / Centos 9 x86_64bit',
        componentHosted: 'Rya Bot Stack',
        comments: '',
      },
      {
        software: 'Windows',
        supportedVersion: 'Windows Server 2016+',
        componentHosted: 'Rya Bot Stack',
        comments: '',
      },
      {
        software: 'Nginx',
        supportedVersion: '1.22.1',
        componentHosted: 'Rya Bot Stack',
        comments: '',
      },
      {
        software: 'MySQL',
        supportedVersion: '8',
        componentHosted: 'Rya Bot Stack',
        comments: '',
      },
      {
        software: 'MSSQL',
        supportedVersion: '2016+',
        componentHosted: 'Rya Bot Stack',
        comments: '',
      },
      {
        software: 'Python',
        supportedVersion: '3.11',
        componentHosted: 'Rya Bot Stack',
        comments: '',
      },
      {
        software: 'HAProxy (Software Loadbalancer)',
        supportedVersion: '2.6',
        componentHosted: 'Rya Bot Stack',
        comments: '',
      },
      {
        software: 'ReactJS',
        supportedVersion: '18.14',
        componentHosted: 'Rya Bot Stack',
        comments: '',
      },
      {
        software: 'NodeJS',
        supportedVersion: '18.12',
        componentHosted: 'Rya Bot Stack',
        comments: '',
      },
    ],
    chatbot: [
      {
        software: 'Linux/Centos',
        supportedVersion: 'RHEL 8 / Centos 8 x86_64bit',
        componentHosted: 'Chatbot Stack',
        comments: '',
      },
      {
        software: 'Nginx',
        supportedVersion: '1.14.1',
        componentHosted: 'Chatbot Stack',
        comments: '',
      },
      {
        software: 'Mongo DB',
        supportedVersion: '5.0.21',
        componentHosted: 'Chatbot Stack',
        comments: '',
      },
      {
        software: 'npm',
        supportedVersion: '9.5.1',
        componentHosted: 'Chatbot Stack',
        comments: '',
      },
      {
        software: 'Meteor JS',
        supportedVersion: '2.9.0',
        componentHosted: 'Chatbot Stack',
        comments: '',
      },
      {
        software: 'NodeJS',
        supportedVersion: '18.16.0',
        componentHosted: 'Chatbot Stack',
        comments: '',
      },
    ],
    crm: [
      {
        software: 'Linux/Centos',
        supportedVersion: 'RHEL 9 / Centos 9 x86_64bit',
        componentHosted: 'CRM Stack',
        comments: '',
      },
      {
        software: 'Windows',
        supportedVersion: 'Windows Server 2016+',
        componentHosted: 'CRM Stack',
        comments: '',
      },
      {
        software: 'Apache',
        supportedVersion: '2.4',
        componentHosted: 'CRM Stack',
        comments: '',
      },
      {
        software: 'PHP',
        supportedVersion: '8.4',
        componentHosted: 'CRM Stack',
        comments: '',
      },
      {
        software: 'MySQL',
        supportedVersion: '8.4',
        componentHosted: 'CRM Stack',
        comments: '',
      },
      {
        software: 'MSSQL',
        supportedVersion: '2016+',
        componentHosted: 'CRM Stack',
        comments: '',
      },
      {
        software: 'Oracle',
        supportedVersion: '21+',
        componentHosted: 'CRM Stack',
        comments: '',
      },
      {
        software: 'HAProxy (Software Loadbalancer)',
        supportedVersion: '2.6',
        componentHosted: 'CRM Stack',
        comments: '',
      },
      {
        software: 'ReactJS',
        supportedVersion: '18.14',
        componentHosted: 'CRM Stack',
        comments: '',
      },
      {
        software: 'NodeJS',
        supportedVersion: '20.17',
        componentHosted: 'CRM Stack',
        comments: '',
      },
      {
        software: 'Talend',
        supportedVersion: '8',
        componentHosted: 'CRM Stack',
        comments: '',
      },
      {
        software: 'Java',
        supportedVersion: '11+',
        componentHosted: 'CRM Stack',
        comments: '',
      },
    ],
  },
};

function normalizePlatformRecommendations(config: PlatformRecommendations): PlatformRecommendations {
  const stacks = config.productStacks || ({} as Partial<ProductStackRecommendations>);

  return {
    software: config.software && config.software.length > 0
      ? config.software
      : defaultRecommendations.software,
    browsers: config.browsers && config.browsers.length > 0
      ? config.browsers
      : defaultRecommendations.browsers,
    productStacks: {
      marketing: stacks.marketing && stacks.marketing.length > 0
        ? stacks.marketing
        : defaultRecommendations.productStacks.marketing,
      ryabot: stacks.ryabot && stacks.ryabot.length > 0
        ? stacks.ryabot
        : defaultRecommendations.productStacks.ryabot,
      chatbot: stacks.chatbot && stacks.chatbot.length > 0
        ? stacks.chatbot
        : defaultRecommendations.productStacks.chatbot,
      crm: stacks.crm && stacks.crm.length > 0
        ? stacks.crm
        : (config.software && config.software.length > 0
            ? config.software
            : defaultRecommendations.productStacks.crm),
    },
  };
}

export function getSelectedStackIds(formData: Pick<AppFormData, 'solutions'>): ProductStackId[] {
  const selected: ProductStackId[] = [];
  if (formData.solutions.crm) selected.push('crm');
  if (formData.solutions.marketing) selected.push('marketing');
  if (formData.solutions.ryaBot) selected.push('ryabot');
  if (formData.solutions.rocketChat) selected.push('chatbot');
  return selected;
}

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
    if (remoteConfig) return normalizePlatformRecommendations(remoteConfig);

    // 2. One-time migration from legacy key
    migrateLegacyConfig();

    // 3. localStorage admin overrides
    const adminConfig = loadPlatformConfig();
    if (adminConfig) return normalizePlatformRecommendations(adminConfig);
  } catch {
    // Fallback to defaults on any error
  }
  return normalizePlatformRecommendations(defaultRecommendations);
};
