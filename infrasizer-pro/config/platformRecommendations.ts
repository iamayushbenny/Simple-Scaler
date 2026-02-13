/**
 * Platform Recommendations Configuration
 * 
 * Admin-editable config for software and browser recommendations
 * used in the "Platform Recommendation" sheet of the export workbook.
 * 
 * To customize: edit this file or extend with a localStorage-backed
 * admin config system.
 */

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
      software: 'RHEL / CentOS Stream',
      supportedVersion: '9.x (x86_64)',
      componentHosted: 'All Application & Database Servers',
      comments: 'Recommended Linux distribution for production workloads',
    },
    {
      software: 'Windows Server',
      supportedVersion: '2016 / 2019 / 2022',
      componentHosted: 'Talend / ETL Server',
      comments: 'Required for Talend integration runtime',
    },
    {
      software: 'Java (OpenJDK)',
      supportedVersion: '17 LTS',
      componentHosted: 'CRM Application Server',
      comments: 'Runtime for CRM backend services',
    },
    {
      software: 'Node.js',
      supportedVersion: '20 LTS',
      componentHosted: 'Web Server / Marketing / R-Yabot Frontend',
      comments: 'Runtime for frontend SSR and API proxy',
    },
    {
      software: 'PostgreSQL',
      supportedVersion: '15.x / 16.x',
      componentHosted: 'Database Server',
      comments: 'Primary relational database',
    },
    {
      software: 'ClickHouse',
      supportedVersion: '24.x',
      componentHosted: 'Analytics / Clickhouse Server',
      comments: 'OLAP engine for analytical queries',
    },
    {
      software: 'Metabase',
      supportedVersion: '0.49+',
      componentHosted: 'Metabase Visualization Server',
      comments: 'BI dashboard and reporting layer',
    },
    {
      software: 'Nginx',
      supportedVersion: '1.24+',
      componentHosted: 'Web / Reverse Proxy',
      comments: 'Load balancer and reverse proxy for HA',
    },
    {
      software: 'Docker',
      supportedVersion: '24.x / 25.x',
      componentHosted: 'All Servers (optional)',
      comments: 'Container runtime for microservice deployments',
    },
    {
      software: 'NVIDIA CUDA Toolkit',
      supportedVersion: '12.x',
      componentHosted: 'R-Yabot GPU Worker',
      comments: 'Required only for on-premise GPU inference nodes',
    },
  ],
  browsers: [
    { browser: 'Google Chrome', supportedVersion: '120+' },
    { browser: 'Microsoft Edge', supportedVersion: '120+ (Chromium-based)' },
    { browser: 'Mozilla Firefox', supportedVersion: '115+ ESR / 120+' },
    { browser: 'Apple Safari', supportedVersion: '17+' },
  ],
};

/**
 * Load platform recommendations from localStorage admin config,
 * falling back to defaults.
 */
export const getPlatformRecommendations = (): PlatformRecommendations => {
  try {
    const saved = localStorage.getItem('platformRecommendations');
    if (saved) {
      return JSON.parse(saved) as PlatformRecommendations;
    }
  } catch {
    // Fallback to defaults on parse error
  }
  return defaultRecommendations;
};
