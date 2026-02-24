
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
  { id: 'ryaBot', label: 'R-YaBot (AI Layer)', description: 'Intelligent bot with LLM integration' },
  { id: 'clickhouse', label: 'Clickhouse Analytics', description: 'High-performance OLAP database' },
  { id: 'metabase', label: 'Metabase BI', description: 'Visualization and reporting layer' },
  { id: 'rocketChat', label: 'Rocket.Chat', description: 'Team communication and messaging platform' },
];

// --- NEW: Solution type options for deployment model ---
export const SOLUTION_TYPE_OPTIONS = [
  { value: 'on-prem' as const, label: 'On-Prem', description: 'Full hardware sizing with GPU support' },
  { value: 'on-cloud' as const, label: 'On-Cloud', description: 'Hardware sizing with cloud-based AI cost model' },
  { value: 'saas' as const, label: 'SaaS', description: 'Managed by provider — usage-based pricing' },
];

// --- NEW: ClickHouse auto-enable threshold ---
export const CLICKHOUSE_AUTO_ENABLE_THRESHOLD = 100; // concurrent users

// --- NEW: ClickHouse scale-based base specs ---
export const CLICKHOUSE_SCALE_SPECS = {
  standard: { cpu: 8, ram: 24 },  // users < 1000
  large: { cpu: 16, ram: 64 },     // users >= 1000
  userThreshold: 1000,
};

// --- Rocket.Chat scale-based specs ---
export const ROCKETCHAT_SCALE_SPECS = {
  standard: { cpu: 4, ram: 16 },   // concurrent users <= 50
  large: { cpu: 8, ram: 24 },       // concurrent users > 50
  userThreshold: 50,
};

// --- NEW: RyaBot cloud TPM cost model ---
export const RYABOT_CLOUD_COST = {
  costPerMillionTokens: 3.50, // USD per 1M tokens
  provider: 'Cloud LLM Provider',
};
