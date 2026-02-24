
export type Environment = 'DEV' | 'UAT' | 'PROD';

// --- NEW: Solution deployment type ---
export type SolutionType = 'on-prem' | 'on-cloud' | 'saas';

// --- NEW: RyaBot deployment mode ---
export type RyabotMode = 'cloud' | 'premise';

export type Industry = 'BFSI' | 'Non BFSI/Healthcare';

export interface CRMInputs {
  namedUsers: number;
  concurrencyRate: number; // percentage
  triggersPerMinute: number;
}

export interface MarketingInputs {
  namedUsers: number;
  concurrencyRate: number; // percentage
  triggersPerMinute: number;
}

export interface BotInputs {
  activeUsers: number;
  requestsPerMinute: number;
  avgTokensPerRequest: number;
  ryaBotPerformance: 'average' | 'high';
}

export interface SolutionSelection {
  crm: boolean;
  marketing: boolean;
  ryaBot: boolean;
  clickhouse: boolean;
  metabase: boolean;
  rocketChat: boolean;
}

export interface AppFormData {
  clientName: string; // NEW: Client name field
  industry: Industry; // NEW: Industry selector
  environment: Environment;
  solutionType: SolutionType; // NEW: Solution type selector
  crm: CRMInputs;
  marketing: MarketingInputs;
  bot: BotInputs;
  solutions: SolutionSelection;
  dataVolumeGB: number; // for Clickhouse
  ryabotMode: RyabotMode; // NEW: RyaBot deployment mode (cloud vs premise)
  haEnabled: boolean; // NEW: High Availability toggle
  drEnabled: boolean; // NEW: Disaster Recovery toggle
}

export interface ServerSpec {
  id: string;
  name: string;
  specification: string; // Detailed spec title or description
  ram: string;
  hdd: string;
  cpu: string;
  os: string;
  loadCategory: 'Low' | 'Medium' | 'High' | 'Enterprise';
  networkZone: 'DMZ' | 'Internal';
  gpu?: {
    enabled: boolean;
    type: string;
    vram: string;
  };
  additionalNotes?: string;
}

// --- NEW: Cloud cost estimate for RyaBot on-cloud mode ---
export interface CloudCostEstimate {
  tpm: number;
  monthlyCostUSD: number;
  provider: string;
  notes: string;
}

export interface CalculationResult {
  clientName: string; // NEW: Included in result for exports
  industry: Industry; // NEW: Industry in result for exports
  solutionType: SolutionType; // NEW: Track solution type in result
  servers: ServerSpec[];
  crmMetrics: {
    triggersPerSecond: number;
    activeLoadUsers: number;
  };
  marketingMetrics: {
    triggersPerSecond: number;
    activeLoadUsers: number;
  };
  botMetrics: {
    requestsPerMinute: number;
    tpm: number;
  };
  // --- NEW: Cloud cost for RyaBot when on-cloud ---
  ryaBotCloudCost?: CloudCostEstimate;
  // --- NEW: SaaS message when saas mode ---
  saasMessage?: string;
  // --- DR informational message ---
  drMessage?: string;
}
