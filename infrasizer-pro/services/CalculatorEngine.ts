
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
    metabaseServer: { cpu: 4, ram: 8, hdd: 80 },
  };
};

export const calculateInfra = (data: AppFormData): CalculationResult => {
  const servers: ServerSpec[] = [];
  const config = loadConfig();
  const envMult = config.envMultipliers[data.environment];
  const isDev = data.environment === 'DEV';
  const isUat = data.environment === 'UAT';
  const isProd = data.environment === 'PROD';
  const isDevOrUat = isDev || isUat;

  // CRM Calculations
  const crmActiveUsers = (data.crm.namedUsers * data.crm.concurrencyRate) / 100;
  const crmTriggersPerSec = (crmActiveUsers * data.crm.triggersPerMinute) / 60;

  // Bot Calculations
  const botRPM = data.bot.activeUsers * data.bot.requestsPerMinute;
  const tpm = botRPM * data.bot.avgTokensPerRequest;

  // ========================
  // 5. DEV/UAT CONSOLIDATION
  // ========================
  // If DEV/UAT AND both CRM + Metabase are enabled, combine them into one server
  const shouldConsolidateCrmMetabase = isDevOrUat && data.solutions.crm && data.solutions.metabase;

  // ========================
  // 1. CRM SERVER LOGIC WITH MINIMUM SIZES
  // ========================
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

    // Apply environment multiplier then enforce minimums
    let finalCpu = Math.ceil(cpu * envMult);
    let finalRam = Math.ceil(ram * envMult);
    let finalHdd = Math.ceil(hdd * envMult);

    // HARD MINIMUM for CRM: 4 CPU, 12 GB RAM
    finalCpu = Math.max(4, finalCpu);
    finalRam = Math.max(12, finalRam);

    // If consolidating with Metabase, increase RAM minimum to 16 GB
    if (shouldConsolidateCrmMetabase) {
      finalRam = Math.max(16, finalRam);
    }

    const serverName = shouldConsolidateCrmMetabase 
      ? `${data.environment} CRM + DB + Metabase (Combined)`
      : `${data.environment} APP+DB Server (CRM)`;

    servers.push({
      id: 'crm-server',
      name: serverName,
      specification: shouldConsolidateCrmMetabase ? 'Consolidated Application & Analytics Server' : '',
      cpu: `${finalCpu} Core Xeon Processor or equivalent`,
      ram: `${finalRam} GB`,
      hdd: `${finalHdd} GB Available`,
      os: OS_VARIANTS.LINUX,
      loadCategory: loadCat,
      networkZone: 'Internal'
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
      loadCategory: 'Medium',
      networkZone: 'Internal'
    });
  }

  // ========================
  // 2. MARKETING SERVER LOGIC
  // ========================
  if (data.solutions.marketing) {
    servers.push({
      id: 'mkt-server',
      name: `${data.environment} Web Server + Marketing APP + DB`,
      specification: 'Web Server',
      cpu: `${Math.ceil(config.marketingServer.cpu * envMult)} Core Xeon Processor or equivalent`,
      ram: `${Math.ceil(config.marketingServer.ram * envMult)} GB`,
      hdd: `${config.marketingServer.hdd} GB Available`,
      os: OS_VARIANTS.LINUX,
      loadCategory: 'Medium',
      networkZone: 'Internal'
    });
  }

  // ========================
  // 3. CLICKHOUSE LOGIC
  // ========================
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
      loadCategory: 'Medium',
      networkZone: 'Internal'
    });
  }

  // ========================
  // 6. RYABOT LOGIC WITH GPU-BASED SIZING
  // ========================
  if (data.solutions.ryaBot) {
    let loadCat: ServerSpec['loadCategory'] = 'Low';
    let cpu = config.botSpecs.low.cpu;
    let ram = config.botSpecs.low.ram;
    let hdd = config.botSpecs.low.hdd;
    let gpuConfig: ServerSpec['gpu'] = undefined;

    // Determine GPU requirements based on TPM (Tokens Per Minute) - the true AI workload metric
    if (tpm > 1000000) {
      // High-end GPU server (A100 class) - for very high token throughput
      loadCat = 'High';
      cpu = Math.max(config.botSpecs.high.cpu, 16);
      ram = Math.max(config.botSpecs.high.ram, 64);
      hdd = config.botSpecs.high.hdd;
      gpuConfig = {
        enabled: true,
        type: 'NVIDIA A100',
        vram: '80GB'
      };
    } else if (tpm > 100000) {
      // Mid-tier GPU server (T4 equivalent) - for moderate AI workloads
      loadCat = 'Medium';
      cpu = Math.max(config.botSpecs.medium.cpu, 8);
      ram = Math.max(config.botSpecs.medium.ram, 32);
      hdd = config.botSpecs.medium.hdd;
      gpuConfig = {
        enabled: true,
        type: 'NVIDIA T4',
        vram: '16GB'
      };
    } else {
      // CPU-only server for lighter workloads
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
    }

    // Ryabot API Server
    const apiServer: ServerSpec = {
      id: 'bot-server',
      name: `${data.environment} R-Yabot Server API`,
      specification: gpuConfig ? 'GPU-Accelerated AI Server' : '',
      cpu: `${cpu} Core Xeon Processor or equivalent`,
      ram: `${ram} GB`,
      hdd: `${hdd} GB`,
      os: OS_VARIANTS.LINUX,
      loadCategory: loadCat,
      networkZone: 'Internal'
    };

    if (gpuConfig) {
      apiServer.gpu = gpuConfig;
    }

    servers.push(apiServer);

    // ========================
    // 3. RYABOT FRONTEND HOSTING LOGIC
    // ========================
    // If Ryabot is enabled but CRM is NOT, create a separate frontend server
    if (!data.solutions.crm) {
      servers.push({
        id: 'bot-frontend',
        name: `${data.environment} R-Yabot Frontend`,
        specification: 'Web Application Hosting',
        cpu: `2 Core Xeon Processor or equivalent`,
        ram: `4 GB`,
        hdd: `50 GB`,
        os: OS_VARIANTS.LINUX,
        loadCategory: 'Low',
        networkZone: 'DMZ'
      });
    }
    // If CRM is enabled, frontend is hosted with CRM (no separate server)
  }

  // ========================
  // 2. METABASE SIZING RULES (FIXED)
  // ========================
  if (data.solutions.metabase && !shouldConsolidateCrmMetabase) {
    // Only create separate Metabase server if NOT consolidated
    // Fixed sizing: PROD and UAT use 4 CPU / 8 GB RAM
    const metabaseCpu = (isProd || isUat) ? 4 : 4;
    const metabaseRam = 8;

    servers.push({
      id: 'metabase-server',
      name: `${data.environment} Metabase Visualization`,
      specification: 'Reporting Engine',
      cpu: `${metabaseCpu} Core Xeon Processor or equivalent`,
      ram: `${metabaseRam} GB`,
      hdd: `${config.metabaseServer.hdd} GB Available`,
      os: OS_VARIANTS.LINUX,
      loadCategory: 'Low',
      networkZone: 'Internal'
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
