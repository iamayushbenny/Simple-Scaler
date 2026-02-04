
import { AppFormData, CalculationResult, ServerSpec } from '../types';
import { ENV_MULTIPLIERS, OS_VARIANTS } from '../constants';

// Load configuration from localStorage or use defaults
const loadConfig = () => {
  const savedConfig = localStorage.getItem('calculationConfig');
  if (savedConfig) {
    return JSON.parse(savedConfig);
  }
  return {
    envMultipliers: ENV_MULTIPLIERS,
    crmThresholds: {
      lowToMedium: { triggersPerSec: 5, namedUsers: 200 },
      mediumToHigh: { triggersPerSec: 20, namedUsers: 1000 },
    },
    crmSpecs: {
      low: { cpu: 2, ram: 8, hdd: 200 },
      medium: { cpu: 4, ram: 16, hdd: 300 },
      high: { cpu: 8, ram: 32, hdd: 500 },
    },
    botThresholds: {
      lowToMedium: 5000,
      mediumToHigh: 20000,
    },
    botSpecs: {
      low: { cpu: 4, ram: 12, hdd: 100 },
      medium: { cpu: 6, ram: 16, hdd: 100 },
      high: { cpu: 8, ram: 32, hdd: 100 },
    },
    talendServer: { cpu: 4, ram: 16, hdd: 200 },
    marketingServer: { cpu: 4, ram: 12, hdd: 80 },
    clickhouseServer: { cpu: 4, ram: 12, baseHdd: 80, storageMultiplier: 1.5 },
    metabaseServer: { cpu: 2, ram: 8, hdd: 80 },
  };
};

export const calculateInfra = (data: AppFormData): CalculationResult => {
  const servers: ServerSpec[] = [];
  const config = loadConfig();
  const envMult = config.envMultipliers[data.environment];

  // CRM Calculations
  const crmActiveUsers = (data.crm.namedUsers * data.crm.concurrencyRate) / 100;
  const crmTriggersPerSec = (crmActiveUsers * data.crm.triggersPerMinute) / 60;

  // Bot Calculations
  const botRPM = data.bot.activeUsers * data.bot.requestsPerMinute;
  const tpm = botRPM * data.bot.avgTokensPerRequest;

  // 1. CRM Server Logic
  if (data.solutions.crm) {
    let loadCat: ServerSpec['loadCategory'] = 'Low';
    let cpu = config.crmSpecs.low.cpu;
    let ram = config.crmSpecs.low.ram;
    let hdd = config.crmSpecs.low.hdd;

    if (crmTriggersPerSec > config.crmThresholds.mediumToHigh.triggersPerSec || 
        data.crm.namedUsers > config.crmThresholds.mediumToHigh.namedUsers) {
      loadCat = 'High';
      cpu = config.crmSpecs.high.cpu;
      ram = config.crmSpecs.high.ram;
      hdd = config.crmSpecs.high.hdd;
    } else if (crmTriggersPerSec > config.crmThresholds.lowToMedium.triggersPerSec || 
               data.crm.namedUsers > config.crmThresholds.lowToMedium.namedUsers) {
      loadCat = 'Medium';
      cpu = config.crmSpecs.medium.cpu;
      ram = config.crmSpecs.medium.ram;
      hdd = config.crmSpecs.medium.hdd;
    }

    servers.push({
      id: 'crm-server',
      name: `${data.environment} APP+DB Server (CRM)`,
      specification: '',
      cpu: `${Math.ceil(cpu * envMult)} Core Xeon Processor or equivalent`,
      ram: `${Math.ceil(ram * envMult)} GB`,
      hdd: `${Math.ceil(hdd * envMult)} GB Available`,
      os: OS_VARIANTS.LINUX,
      loadCategory: loadCat
    });

    // Always add a Talend/ETL server for CRM
    servers.push({
      id: 'talend-server',
      name: `${data.environment} Talend Server`,
      specification: 'Integration Server',
      cpu: `${config.talendServer.cpu} Core Xeon Processor or equivalent`,
      ram: `${config.talendServer.ram} GB`,
      hdd: `${config.talendServer.hdd} GB Available`,
      os: OS_VARIANTS.WINDOWS,
      loadCategory: 'Medium'
    });
  }

  // 2. Marketing Server Logic
  if (data.solutions.marketing) {
    servers.push({
      id: 'mkt-server',
      name: `${data.environment} Web Server + Marketing APP + DB`,
      specification: 'Web Server',
      cpu: `${Math.ceil(config.marketingServer.cpu * envMult)} Core Xeon Processor or equivalent`,
      ram: `${Math.ceil(config.marketingServer.ram * envMult)} GB`,
      hdd: `${config.marketingServer.hdd} GB Available`,
      os: OS_VARIANTS.LINUX,
      loadCategory: 'Medium'
    });
  }

  // 3. Clickhouse Logic
  if (data.solutions.clickhouse) {
    const storageNeeded = Math.max(config.clickhouseServer.baseHdd, data.dataVolumeGB * config.clickhouseServer.storageMultiplier);
    servers.push({
      id: 'clickhouse-server',
      name: `${data.environment} Analytical + Clickhouse`,
      specification: '',
      cpu: `${config.clickhouseServer.cpu} Core Xeon Processor or equivalent`,
      ram: `${Math.max(config.clickhouseServer.ram, Math.ceil(config.clickhouseServer.ram * envMult))} GB`,
      hdd: `${Math.ceil(storageNeeded)} GB Available for CRM`,
      os: OS_VARIANTS.LINUX,
      loadCategory: 'Medium'
    });
  }

  // 4. Rya Bot Logic
  if (data.solutions.ryaBot) {
    let loadCat: ServerSpec['loadCategory'] = 'Low';
    let cpu = config.botSpecs.low.cpu;
    let ram = config.botSpecs.low.ram;
    let hdd = config.botSpecs.low.hdd;

    if (tpm > config.botThresholds.mediumToHigh) {
      loadCat = 'High';
      cpu = config.botSpecs.high.cpu;
      ram = config.botSpecs.high.ram;
      hdd = config.botSpecs.high.hdd;
    } else if (tpm > config.botThresholds.lowToMedium) {
      loadCat = 'Medium';
      cpu = config.botSpecs.medium.cpu;
      ram = config.botSpecs.medium.ram;
      hdd = config.botSpecs.medium.hdd;
    }

    servers.push({
      id: 'bot-server',
      name: `R-Yabot Server API`,
      specification: '',
      cpu: `${cpu} Core Xeon Processor or equivalent`,
      ram: `${ram} GB`,
      hdd: `${hdd} GB`,
      os: OS_VARIANTS.LINUX,
      loadCategory: loadCat
    });
  }

  // 5. Metabase Logic
  if (data.solutions.metabase) {
    servers.push({
      id: 'metabase-server',
      name: `${data.environment} Metabase Visualization`,
      specification: 'Reporting Engine',
      cpu: `${config.metabaseServer.cpu} Core Xeon Processor or equivalent`,
      ram: `${config.metabaseServer.ram} GB`,
      hdd: `${config.metabaseServer.hdd} GB Available`,
      os: OS_VARIANTS.LINUX,
      loadCategory: 'Low'
    });
  }

  return {
    servers,
    crmMetrics: {
      triggersPerSecond: Number(crmTriggersPerSec.toFixed(2)),
      activeLoadUsers: Math.ceil(crmActiveUsers)
    },
    botMetrics: {
      requestsPerMinute: botRPM,
      tpm: tpm
    }
  };
};
