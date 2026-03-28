const axios = require('axios');

const BASE_URL = 'https://www.gening.ai';
const API_BASE = 'https://www.gening.ai/cgi-bin/auth';

const TARGET_STOCK = 10;
const MAX_RETRIES = 5;

let stock = [];
let running = null;
let requestsUsed = 0;
let maxRequestsPerUID = 10;
let initializing = false;
let initPromise = null;

async function ensureReady() {
  if (initPromise) {
    return initPromise;
  }
  
  if (stock.length > 0 || running) {
    return;
  }
  
  initPromise = initializeStock();
  return initPromise;
}

async function initializeStock() {
  if (initializing) return;
  initializing = true;
  
  console.log('[UID Manager] Initializing stock...');
  
  while (stock.length < TARGET_STOCK) {
    const cred = await createValidUID();
    if (cred) {
      stock.push(cred);
      console.log(`[UID Manager] Added to stock: ${cred.uid} (${stock.length}/${TARGET_STOCK}) credits:${cred.credits}`);
    }
  }
  
  if (stock.length > 0) {
    running = stock.pop();
    console.log(`[UID Manager] Running UID: ${running.uid}`);
  }
  
  initializing = false;
}

async function createValidUID() {
  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    try {
      const cred = await createNewUID();
      
      if (cred.credits >= 10) {
        console.log(`[UID Manager] Valid UID with 10 credits: ${cred.uid}`);
        return cred;
      } else {
        console.log(`[UID Manager] UID ${cred.uid} only has ${cred.credits} credits, retrying...`);
      }
    } catch (e) {
      console.error(`[UID Manager] Attempt ${attempt} failed:`, e.message);
      await sleep(1000);
    }
  }
  
  console.error('[UID Manager] Failed to create valid UID after retries');
  return null;
}

async function createNewUID() {
  const randomCode = Math.floor(Math.random() * 90000) + 10000;
  
  const response = await axios.post(`${BASE_URL}/cgi-bin/login`, `code=${randomCode}`, {
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    timeout: 10000
  });
  
  if (response.data.code !== 0) {
    throw new Error(`Login failed: ${response.data.message}`);
  }
  
  const credits = response.data.data.remain;
  
  return {
    uid: response.data.data.uid,
    ticket: response.data.data.ticket,
    credits: credits
  };
}

function getRunningCredentials() {
  if (!running) {
    throw new Error('No running credentials');
  }
  
  return {
    uid: running.uid,
    ticket: running.ticket,
    cookie: `uid=${running.uid}; ticket=${running.ticket}`
  };
}

async function handleResponseDone() {
  requestsUsed++;
  console.log(`[UID Manager] Request done. Used: ${requestsUsed}/${maxRequestsPerUID} for UID ${running?.uid}`);
  
  if (requestsUsed >= maxRequestsPerUID) {
    console.log('[UID Manager] UID exhausted, switching...');
    running = null;
    requestsUsed = 0;
    
    await replenishStock();
  }
  
  if (!running && stock.length > 0) {
    running = stock.pop();
    console.log(`[UID Manager] New running UID: ${running.uid} (${stock.length} in stock)`);
  }
}

async function replenishStock() {
  if (stock.length >= TARGET_STOCK) {
    console.log('[UID Manager] Stock full, skipping replenishment');
    return;
  }
  
  console.log(`[UID Manager] Replenishing stock (current: ${stock.length})...`);
  
  while (stock.length < TARGET_STOCK) {
    const cred = await createValidUID();
    if (cred) {
      stock.push(cred);
      console.log(`[UID Manager] Replenished: ${cred.uid} (${stock.length}/${TARGET_STOCK})`);
    }
    await sleep(500);
  }
  
  console.log('[UID Manager] Stock replenished');
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function getStatus() {
  return {
    stockCount: stock.length,
    running: running ? running.uid : null,
    requestsUsed: requestsUsed
  };
}

async function forceRotate() {
  console.log('[UID Manager] Force rotating UID...');
  running = null;
  requestsUsed = 0;
  if (stock.length > 0) {
    running = stock.pop();
    console.log('[UID Manager] Switched to stock UID:', running.uid);
    replenishStock().catch(() => {});
  } else {
    console.log('[UID Manager] Stock empty, creating fresh UID...');
    const cred = await createValidUID();
    if (cred) {
      running = cred;
      console.log('[UID Manager] Fresh UID created:', running.uid);
      replenishStock().catch(() => {});
    } else {
      throw new Error('Could not create new UID after rotation');
    }
  }
}

const uidManager = {
  ensureReady,
  getRunningCredentials,
  handleResponseDone,
  forceRotate,
  getStatus
};

module.exports = uidManager;