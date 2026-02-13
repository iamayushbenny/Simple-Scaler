
import { AppFormData, CalculationResult, ServerSpec, CloudCostEstimate } from '../types';
import { ENV_MULTIPLIERS, OS_VARIANTS, CLICKHOUSE_SCALE_SPECS, RYABOT_CLOUD_COST } from '../constants';

// Load configuration from localStorage or use defaults
const loadConfig = () => {
  const savedConfig = localStorage.getItem('calculationConfig');
  if (savedConfig) {
    return JSON.parse(savedConfig);
  }
  return {
    envMultipliers: ENV_MULTIPLIERS,
    crmThresholds: {
      lowToMedium: { triggersPerSec: 10, namedUsers: 300 },
      mediumToHigh: { triggersPerSec: 100, namedUsers: 3000 },
    },
    crmSpecs: {
      low: { cpu: 4, ram: 16, hdd: 100 },
      medium: { cpu: 8, ram: 32, hdd: 200 },
      high: { cpu: 16, ram: 64, hdd: 200 },
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

// ============================
// POST-PROCESSING: HA Layer
// Duplicates ONLY APP and DB servers with -1/-2 naming.
// RyaBot, ClickHouse, Metabase, Analytics, GPU workers are NOT duplicated.
// ============================
function applyHALayer(servers: ServerSpec[]): ServerSpec[] {
  const result: ServerSpec[] = [];
  for (const server of servers) {
    // HA applies ONLY to APP and Database servers — NOT to RyaBot, ClickHouse, Metabase, GPU workers
    const isExcluded = /ryabot|r-yabot|clickhouse|metabase|analytics|gpu.*worker/i.test(server.name);
    const isAppOrDb = /app|db|database|crm/i.test(server.name) && !/talend|etl|frontend/i.test(server.name);
    if (!isExcluded && isAppOrDb) {
      result.push({ ...server, id: `${server.id}-1`, name: `${server.name} (Node-1)` });
      result.push({ ...server, id: `${server.id}-2`, name: `${server.name} (Node-2)` });
    } else {
      result.push(server);
    }
  }
  return result;
}

// ============================
// POST-PROCESSING: DR Layer
// Duplicates entire stack with -DR suffix
// ============================
function applyDRLayer(servers: ServerSpec[]): ServerSpec[] {
  const drServers = servers.map(server => ({
    ...server,
    id: `${server.id}-dr`,
    name: `${server.name} -DR`,
    networkZone: 'Private' as const,
  }));
  return [...servers, ...drServers];
}

// ============================
// POST-PROCESSING: PROD split APP+DB
// Ensures no consolidated APP+DB in PROD
// ============================
function enforceProductionSplit(servers: ServerSpec[], env: string): ServerSpec[] {
  if (env !== 'PROD') return servers;
  const result: ServerSpec[] = [];
  for (const server of servers) {
    // Only split CRM consolidated servers — NOT analytics combined servers
    const isCrmCombined = /app\+db/i.test(server.name) || (/crm/i.test(server.name) && /combined|\+ db|\+ metabase/i.test(server.name));
    if (isCrmCombined) {
      // Split into APP and DB with clean names
      result.push({
        ...server,
        id: `${server.id}-app`,
        name: `${env} APP Server (CRM)`,
        specification: 'Application Server',
      });
      result.push({
        ...server,
        id: `${server.id}-db`,
        name: `${env} Database Server`,
        specification: 'Database Server',
      });
    } else {
      result.push(server);
    }
  }
  return result;
}

export const calculateInfra = (data: AppFormData): CalculationResult => {
  // --- NEW: SaaS early return ---
  if (data.solutionType === 'saas') {
    const crmActiveUsers = (data.crm.namedUsers * data.crm.concurrencyRate) / 100;
    const crmTriggersPerSec = (crmActiveUsers * data.crm.triggersPerMinute) / 60;
    const botRPM = data.bot.activeUsers * data.bot.requestsPerMinute;
    const tpm = botRPM * data.bot.avgTokensPerRequest;

    return {
      clientName: data.clientName,
      solutionType: data.solutionType,
      servers: [],
      crmMetrics: {
        triggersPerSecond: Number(crmTriggersPerSec.toFixed(2)),
        activeLoadUsers: Math.ceil(crmActiveUsers),
      },
      botMetrics: { requestsPerMinute: botRPM, tpm },
      saasMessage:
        'Infrastructure is managed by provider. Sizing and pricing are based on number of users and pay-as-you-go usage.',
    };
  }

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
    finalHdd = Math.max(finalHdd, Math.ceil(data.dataVolumeGB * 1.2));

    // HARD MINIMUM for CRM: 4 CPU, 12 GB RAM
    finalCpu = Math.max(4, finalCpu);
    finalRam = Math.max(16, finalRam);

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
  // ANALYTICS: ClickHouse + Metabase (always on)
  // < 100 concurrent → single combined server (4 CPU / 16 GB)
  // >= 100 concurrent → separate ClickHouse + Metabase servers
  // ========================
  const concurrentUsersForAnalytics = Math.ceil(crmActiveUsers);
  const lowConcurrency = concurrentUsersForAnalytics < 100;

  if (lowConcurrency) {
    // Combined Clickhouse + Metabase server for low concurrency
    const storageNeeded = Math.max(config.clickhouseServer.baseHdd, data.dataVolumeGB * config.clickhouseServer.storageMultiplier);
    servers.push({
      id: 'analytics-combined',
      name: `${data.environment} Clickhouse + Metabase (Combined)`,
      specification: 'Consolidated Analytics & Reporting Server (low concurrency)',
      cpu: '4 Core Xeon Processor or equivalent',
      ram: '16 GB',
      hdd: `${Math.ceil(storageNeeded)} GB Available for CRM`,
      os: OS_VARIANTS.LINUX,
      loadCategory: 'Medium',
      networkZone: 'Internal'
    });
  } else {
    // Separate ClickHouse server — tiered by concurrency
    // 100–999: 8 CPU / 24 GB | 1000+: 16 CPU / 64 GB
    const useHighSpec = concurrentUsersForAnalytics >= CLICKHOUSE_SCALE_SPECS.userThreshold;
    const chCpu = useHighSpec ? CLICKHOUSE_SCALE_SPECS.large.cpu : CLICKHOUSE_SCALE_SPECS.standard.cpu;
    const chRam = useHighSpec ? CLICKHOUSE_SCALE_SPECS.large.ram : CLICKHOUSE_SCALE_SPECS.standard.ram;

    const storageNeeded = Math.max(config.clickhouseServer.baseHdd, data.dataVolumeGB * config.clickhouseServer.storageMultiplier);
    servers.push({
      id: 'clickhouse-server',
      name: `${data.environment} Analytical + Clickhouse`,
      specification: useHighSpec ? 'High-Scale Analytics Cluster' : 'Analytics Engine',
      cpu: `${chCpu} Core Xeon Processor or equivalent`,
      ram: `${chRam} GB`,
      hdd: `${Math.ceil(storageNeeded)} GB Available for CRM`,
      os: OS_VARIANTS.LINUX,
      loadCategory: useHighSpec ? 'High' : 'Medium',
      networkZone: 'Internal'
    });

    // Separate Metabase server (as-is)
    if (!shouldConsolidateCrmMetabase) {
      servers.push({
        id: 'metabase-server',
        name: `${data.environment} Metabase Visualization`,
        specification: 'Reporting Engine',
        cpu: '4 Core Xeon Processor or equivalent',
        ram: '8 GB',
        hdd: `${config.metabaseServer.hdd} GB Available`,
        os: OS_VARIANTS.LINUX,
        loadCategory: 'Low',
        networkZone: 'Internal'
      });
    }
  }

  // ========================
  // 6. RYABOT SIZING — Branched by ryabotMode (cloud vs premise)
  // GPU is NOT tied to solutionType anymore; it depends on ryabotMode.
  // ========================
  let ryaBotCloudCost: CloudCostEstimate | undefined;

  if (data.solutions.ryaBot) {
    if (data.ryabotMode === 'cloud') {
      // --- CLOUD MODE: TPM-based cost model, no GPU, no GPU server ---
      const monthlyTokens = tpm * 60 * 24 * 30; // tokens per month
      const monthlyCost = (monthlyTokens / 1_000_000) * RYABOT_CLOUD_COST.costPerMillionTokens;
      ryaBotCloudCost = {
        tpm,
        monthlyCostUSD: Math.round(monthlyCost * 100) / 100,
        provider: RYABOT_CLOUD_COST.provider,
        notes: `Estimated based on ${tpm.toLocaleString()} TPM continuous usage. Actual cost depends on provider pricing.`,
      };

      // Lightweight API proxy server (no GPU)
      servers.push({
        id: 'bot-server',
        name: `${data.environment} R-Yabot API Proxy (Cloud)`,
        specification: 'Cloud API Proxy — No GPU required',
        cpu: `4 Core Xeon Processor or equivalent`,
        ram: `8 GB`,
        hdd: `50 GB`,
        os: OS_VARIANTS.LINUX,
        loadCategory: 'Low',
        networkZone: 'Internal',
      });
    } else {
      // --- PREMISE MODE: Control server (CPU/RAM only) + optional GPU worker ---

      // RyaBot Control Server — never has GPU, minimum 16 GB RAM floor
      let controlCpu = config.botSpecs.low.cpu;
      let controlRam = config.botSpecs.low.ram;
      let controlHdd = config.botSpecs.low.hdd;
      let loadCat: ServerSpec['loadCategory'] = 'Low';

      if (tpm > 5000) {
        loadCat = 'High';
        controlCpu = Math.max(config.botSpecs.high.cpu, 8);
        controlRam = Math.max(config.botSpecs.high.ram, 32);
        controlHdd = config.botSpecs.high.hdd;
      } else if (botRPM > 200) {
        loadCat = 'Medium';
        controlCpu = Math.max(config.botSpecs.medium.cpu, 8);
        controlRam = Math.max(config.botSpecs.medium.ram, 16);
        controlHdd = config.botSpecs.medium.hdd;
      } else {
        loadCat = 'Low';
        controlCpu = config.botSpecs.low.cpu;
        controlRam = config.botSpecs.low.ram;
        controlHdd = config.botSpecs.low.hdd;
      }

      // POST-SIZING OVERRIDE: Enforce 16 GB RAM floor for RyaBot control server
      controlRam = Math.max(controlRam, 16);

      servers.push({
        id: 'bot-server',
        name: `${data.environment} R-Yabot Control Server`,
        specification: 'RyaBot Application Server (CPU/RAM — no GPU)',
        cpu: `${controlCpu} Core Xeon Processor or equivalent`,
        ram: `${controlRam} GB`,
        hdd: `${controlHdd} GB`,
        os: OS_VARIANTS.LINUX,
        loadCategory: loadCat,
        networkZone: 'Internal',
        // No GPU on control server
      });

      // GPU Worker Node — only when workload threshold requires GPU
      // Threshold: botRPM > 200 indicates meaningful AI workload that warrants GPU
      if (botRPM > 200) {
        const gpuConfig: ServerSpec['gpu'] = data.bot.ryaBotPerformance === 'high'
          ? { enabled: true, type: 'NVIDIA H100', vram: '80GB' }
          : { enabled: true, type: 'NVIDIA A100', vram: '80GB' };

        const gpuCpu = tpm > 30000 ? 16 : 8;
        const gpuRam = tpm > 30000 ? 64 : 32;

        servers.push({
          id: 'bot-gpu-worker',
          name: `${data.environment} R-Yabot GPU Worker`,
          specification: `GPU-Accelerated AI Worker (${gpuConfig.type})`,
          cpu: `${gpuCpu} Core Xeon Processor or equivalent`,
          ram: `${gpuRam} GB`,
          hdd: `100 GB`,
          os: OS_VARIANTS.LINUX,
          loadCategory: botRPM > 1000 ? 'High' : 'Medium',
          networkZone: 'Internal',
          gpu: gpuConfig,
        });
      }
    }

    // Frontend hosting if CRM is not enabled
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
  }

  // ============================
  // POST-PROCESSING PIPELINE
  // ============================

  // Rule 9: PROD must split APP+DB
  let finalServers = enforceProductionSplit(servers, data.environment);

  // Rule 5: HA duplication
  if (data.haEnabled) {
    finalServers = applyHALayer(finalServers);
  }

  // Rule 5: DR duplication
  if (data.drEnabled) {
    finalServers = applyDRLayer(finalServers);
  }

  return {
    clientName: data.clientName,
    solutionType: data.solutionType,
    servers: finalServers,
    crmMetrics: {
      triggersPerSecond: Number(crmTriggersPerSec.toFixed(2)),
      activeLoadUsers: Math.ceil(crmActiveUsers)
    },
    botMetrics: {
      requestsPerMinute: botRPM,
      tpm: tpm
    },
    ryaBotCloudCost,
  };
};
