
import { AppFormData, CalculationResult, ServerSpec, CloudCostEstimate } from '../types';
import { ENV_MULTIPLIERS, OS_VARIANTS, CLICKHOUSE_SCALE_SPECS, RYABOT_CLOUD_COST, ROCKETCHAT_SCALE_SPECS } from '../constants';
import { getConfig } from './configLoader';

// Round up to the next power of 2 (minimum 4)
function nextPowerOf2(n: number): number {
  const min = 4;
  let v = Math.max(min, Math.ceil(n));
  // If already a power of 2, return as-is
  if ((v & (v - 1)) === 0) return v;
  // Round up to next power of 2
  v--;
  v |= v >> 1;
  v |= v >> 2;
  v |= v >> 4;
  v |= v >> 8;
  v |= v >> 16;
  v++;
  return v;
}

// Load configuration: remote cache → localStorage → defaults
const loadConfig = () => {
  const remoteConfig = getConfig();
  if (remoteConfig) return remoteConfig;
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
    // HA applies ONLY to CRM APP and Database servers — NOT marketing, RyaBot, ClickHouse, Metabase, GPU workers
    const isExcluded = /ryabot|r-yabot|clickhouse|metabase|analytics|gpu.*worker|marketing|mkt/i.test(server.name);
    const isAppOrDb = /app|db|database|crm/i.test(server.name) && !/talend|etl|frontend/i.test(server.name);
    if (!isExcluded && isAppOrDb) {
      result.push({ ...server, id: `${server.id}-1`, name: `${server.name} 1` });
      result.push({ ...server, id: `${server.id}-2`, name: `${server.name} 2` });
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
    networkZone: 'Internal' as const,
  }));
  return [...servers, ...drServers];
}

// ============================
// POST-PROCESSING: PROD split APP+DB
// Ensures no consolidated APP+DB in PROD
// ============================
function enforceProductionSplit(servers: ServerSpec[], env: string): ServerSpec[] {
  const result: ServerSpec[] = [];
  for (const server of servers) {
    // Only split CRM consolidated servers — NOT analytics combined servers
    const isCrmCombined = /app\+db/i.test(server.name) || (/crm/i.test(server.name) && /combined|\+ db|\+ metabase/i.test(server.name));
    if (isCrmCombined) {
      // Split into APP and DB with clean names
      result.push({
        ...server,
        id: `${server.id}-app`,
        name: `${env} CRM APP Server`,
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
    const mktActiveUsers = (data.marketing.namedUsers * data.marketing.concurrencyRate) / 100;
    const mktTriggersPerSec = (mktActiveUsers * data.marketing.triggersPerMinute) / 60;
    const botRPM = data.bot.activeUsers * data.bot.requestsPerMinute;
    const tpm = botRPM * data.bot.avgTokensPerRequest;

    return {
      clientName: data.clientName,
      industry: data.industry,
      solutionType: data.solutionType,
      servers: [],
      crmMetrics: {
        triggersPerSecond: Number(crmTriggersPerSec.toFixed(2)),
        activeLoadUsers: Math.ceil(crmActiveUsers),
      },
      marketingMetrics: {
        triggersPerSecond: Number(mktTriggersPerSec.toFixed(2)),
        activeLoadUsers: Math.ceil(mktActiveUsers),
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

  // Marketing Calculations
  const mktActiveUsers = (data.marketing.namedUsers * data.marketing.concurrencyRate) / 100;
  const mktTriggersPerSec = (mktActiveUsers * data.marketing.triggersPerMinute) / 60;

  // Bot Calculations
  const botRPM = data.bot.activeUsers * data.bot.requestsPerMinute;
  const tpm = botRPM * data.bot.avgTokensPerRequest;

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
    let finalCpu = nextPowerOf2(Math.ceil(cpu * envMult));
    let finalRam = Math.ceil(ram * envMult);
    let finalHdd = Math.ceil(hdd * envMult);
    finalHdd = Math.max(finalHdd, Math.ceil(data.dataVolumeGB * 1.2));

    // HARD MINIMUM for CRM: 4 CPU, 16 GB RAM
    finalCpu = Math.max(4, nextPowerOf2(finalCpu));
    finalRam = Math.max(16, finalRam);

    servers.push({
      id: 'crm-server',
      name: `${data.environment} APP+DB Server (CRM)`,
      specification: '',
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
  // 2. MARKETING SERVER LOGIC (same tiered sizing as CRM)
  // ========================
  if (data.solutions.marketing) {
    let mktLoadCat: ServerSpec['loadCategory'] = 'Low';
    let mktCpu = config.crmSpecs.low.cpu;
    let mktRam = config.crmSpecs.low.ram;
    let mktHdd = config.crmSpecs.low.hdd;

    if (mktTriggersPerSec > config.crmThresholds.mediumToHigh.triggersPerSec ||
      data.marketing.namedUsers > config.crmThresholds.mediumToHigh.namedUsers) {
      mktLoadCat = 'High';
      mktCpu = config.crmSpecs.high.cpu;
      mktRam = config.crmSpecs.high.ram;
      mktHdd = config.crmSpecs.high.hdd;
    } else if (mktTriggersPerSec > config.crmThresholds.lowToMedium.triggersPerSec ||
      data.marketing.namedUsers > config.crmThresholds.lowToMedium.namedUsers) {
      mktLoadCat = 'Medium';
      mktCpu = config.crmSpecs.medium.cpu;
      mktRam = config.crmSpecs.medium.ram;
      mktHdd = config.crmSpecs.medium.hdd;
    }

    let mktFinalCpu = nextPowerOf2(Math.ceil(mktCpu * envMult));
    let mktFinalRam = Math.ceil(mktRam * envMult);
    let mktFinalHdd = Math.ceil(mktHdd * envMult);

    // HARD MINIMUM for Marketing: 4 CPU, 12 GB RAM
    mktFinalCpu = Math.max(4, nextPowerOf2(mktFinalCpu));
    mktFinalRam = Math.max(12, mktFinalRam);

    servers.push({
      id: 'mkt-app-server',
      name: `${data.environment} Marketing APP Server`,
      specification: 'Marketing Application Server',
      cpu: `${mktFinalCpu} Core Xeon Processor or equivalent`,
      ram: `${mktFinalRam} GB`,
      hdd: `${mktFinalHdd} GB Available`,
      os: OS_VARIANTS.LINUX,
      loadCategory: mktLoadCat,
      networkZone: 'Internal'
    });

    servers.push({
      id: 'mkt-db-server',
      name: `${data.environment} Marketing DB Server`,
      specification: 'Marketing Database Server',
      cpu: `${mktFinalCpu} Core Xeon Processor or equivalent`,
      ram: `${mktFinalRam} GB`,
      hdd: `${mktFinalHdd} GB Available`,
      os: OS_VARIANTS.LINUX,
      loadCategory: mktLoadCat,
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

      // Lightweight API server (no GPU)
      servers.push({
        id: 'bot-server',
        name: `${data.environment} R-YaBot API Server (Cloud)`,
        specification: 'Cloud API Server — No GPU required',
        cpu: `4 Core Xeon Processor or equivalent`,
        ram: `16 GB`,
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
        name: `${data.environment} R-YaBot Control Server`,
        specification: 'R-YaBot Application Server (CPU/RAM — no GPU)',
        cpu: `${nextPowerOf2(controlCpu)} Core Xeon Processor or equivalent`,
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
          name: `${data.environment} R-YaBot GPU Worker`,
          specification: `GPU-Accelerated AI Worker (${gpuConfig.type})`,
          cpu: `${nextPowerOf2(gpuCpu)} Core Xeon Processor or equivalent`,
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
        name: `${data.environment} R-YaBot Frontend`,
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

  // ========================
  // BFSI FORWARD SERVER — single shared server for Marketing + RyaBot
  // Only when industry is BFSI and at least one of Marketing or RyaBot is enabled
  // ========================
  if (data.industry === 'BFSI' && (data.solutions.marketing || data.solutions.ryaBot)) {
    servers.push({
      id: 'forward-server',
      name: `${data.environment} Forward Server`,
      specification: 'Forward / Proxy Server (BFSI)',
      cpu: '2 Core Xeon Processor or equivalent',
      ram: '4 GB',
      hdd: '50 GB',
      os: OS_VARIANTS.LINUX,
      loadCategory: 'Low',
      networkZone: 'DMZ',
    });
  }

  // ========================
  // ROCKET.CHAT SERVER
  // <= 50 concurrent users: 4 CPU / 16 GB RAM
  // > 50 concurrent users: 8 CPU / 24 GB RAM
  // ========================
  if (data.solutions.rocketChat) {
    const concurrentUsersForRC = Math.ceil(crmActiveUsers);
    const useHighSpec = concurrentUsersForRC > ROCKETCHAT_SCALE_SPECS.userThreshold;
    const rcCpu = useHighSpec ? ROCKETCHAT_SCALE_SPECS.large.cpu : ROCKETCHAT_SCALE_SPECS.standard.cpu;
    const rcRam = useHighSpec ? ROCKETCHAT_SCALE_SPECS.large.ram : ROCKETCHAT_SCALE_SPECS.standard.ram;

    servers.push({
      id: 'rocketchat-server',
      name: `${data.environment} Rocket.Chat Server`,
      specification: useHighSpec ? 'High-Scale Messaging Server' : 'Standard Messaging Server',
      cpu: `${rcCpu} Core Xeon Processor or equivalent`,
      ram: `${rcRam} GB`,
      hdd: '100 GB Available',
      os: OS_VARIANTS.LINUX,
      loadCategory: useHighSpec ? 'Medium' : 'Low',
      networkZone: 'Internal',
    });
  }

  // ============================
  // POST-PROCESSING PIPELINE
  // ============================

  // Rule 9: Always split APP+DB into separate servers
  let finalServers = enforceProductionSplit(servers, data.environment);

  // Rule 5: HA duplication — PROD always, UAT only if concurrent users > 100, DEV never
  if (data.haEnabled) {
    const concurrentUsers = Math.ceil(crmActiveUsers);
    if (isProd || (isUat && concurrentUsers > 100)) {
      finalServers = applyHALayer(finalServers);
    }
  }

  // Rule 5: DR — column-only indicator (no server duplication)
  // DR is shown as a 'Yes' column on PROD sheets only; UAT/DEV have no DR.

  // Assign global sequential node numbers
  finalServers = finalServers.map((server, idx) => ({
    ...server,
    name: `${server.name} (Node ${idx + 1})`,
  }));

  return {
    clientName: data.clientName,
    industry: data.industry,
    solutionType: data.solutionType,
    servers: finalServers,
    crmMetrics: {
      triggersPerSecond: Number(crmTriggersPerSec.toFixed(2)),
      activeLoadUsers: Math.ceil(crmActiveUsers)
    },
    marketingMetrics: {
      triggersPerSecond: Number(mktTriggersPerSec.toFixed(2)),
      activeLoadUsers: Math.ceil(mktActiveUsers)
    },
    botMetrics: {
      requestsPerMinute: botRPM,
      tpm: tpm
    },
    ryaBotCloudCost,
  };
};
