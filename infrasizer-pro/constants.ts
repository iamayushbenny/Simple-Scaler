
export const ENV_MULTIPLIERS = {
  DEV: 0.8,
  UAT: 1.0,
  PROD: 1.5, // Buffer for production stability
};

export const OS_VARIANTS = {
  LINUX: 'RHEL 9 / Centos stream 9 x86_64 bit',
  WINDOWS: 'Windows Server 2016+',
};

export const SOLUTIONS_METADATA = [
  { id: 'crm', label: 'CRM Solution', description: 'Core customer relationship management module' },
  { id: 'marketing', label: 'Marketing Automation', description: 'Campaign and lead management' },
  { id: 'ryaBot', label: 'R-Yabot (AI Layer)', description: 'Intelligent bot with LLM integration' },
  { id: 'clickhouse', label: 'Clickhouse Analytics', description: 'High-performance OLAP database' },
  { id: 'metabase', label: 'Metabase BI', description: 'Visualization and reporting layer' },
];
