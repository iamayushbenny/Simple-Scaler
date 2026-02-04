
export type Environment = 'DEV' | 'UAT' | 'PROD';

export interface CRMInputs {
  namedUsers: number;
  concurrencyRate: number; // percentage
  triggersPerMinute: number;
}

export interface BotInputs {
  activeUsers: number;
  requestsPerMinute: number;
  avgTokensPerRequest: number;
}

export interface SolutionSelection {
  crm: boolean;
  marketing: boolean;
  ryaBot: boolean;
  clickhouse: boolean;
  metabase: boolean;
}

export interface AppFormData {
  environment: Environment;
  crm: CRMInputs;
  bot: BotInputs;
  solutions: SolutionSelection;
  dataVolumeGB: number; // for Clickhouse
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
  additionalNotes?: string;
}

export interface CalculationResult {
  servers: ServerSpec[];
  crmMetrics: {
    triggersPerSecond: number;
    activeLoadUsers: number;
  };
  botMetrics: {
    requestsPerMinute: number;
    tpm: number;
  };
}
