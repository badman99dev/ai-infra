const axios = require('axios');

const BASE_URL = 'https://www.gening.ai';
const API_BASE = 'https://www.gening.ai/cgi-bin/auth';

let cachedCredentials = null;
let lastFetchTime = 0;
const CACHE_DURATION = 55000;

class UIDManager {
  constructor() {
    this.requestsUsed = 0;
    this.maxRequestsPerUID = 1;
  }

  async ensureReady() {
    const now = Date.now();
    if (cachedCredentials && (now - lastFetchTime) < CACHE_DURATION) {
      console.log('[UID Manager] Using cached credentials');
      return;
    }
    
    console.log('[UID Manager] Getting fresh credentials...');
    try {
      cachedCredentials = await this.createNewUID();
      lastFetchTime = now;
      console.log(`[UID Manager] Got new credentials: ${cachedCredentials.uid} credits:${cachedCredentials.credits}`);
    } catch (e) {
      console.error('[UID Manager] Failed to get credentials:', e.message);
      throw e;
    }
  }

  async createNewUID() {
    const response = await axios.post(`${BASE_URL}/cgi-bin/login`, 'code=0', {
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      timeout: 10000
    });
    
    if (response.data.code !== 0) {
      throw new Error(`Login failed: ${response.data.message}`);
    }
    
    return {
      uid: response.data.data.uid,
      ticket: response.data.data.ticket,
      credits: response.data.data.remain
    };
  }

  getRunningCredentials() {
    if (!cachedCredentials) {
      throw new Error('No running credentials');
    }
    return {
      uid: cachedCredentials.uid,
      ticket: cachedCredentials.ticket,
      cookie: `uid=${cachedCredentials.uid}; ticket=${cachedCredentials.ticket}`
    };
  }

  async handleResponseDone() {
    this.requestsUsed++;
    console.log(`[UID Manager] Request done. Used: ${this.requestsUsed}/${this.maxRequestsPerUID}`);
    
    if (this.requestsUsed >= this.maxRequestsPerUID) {
      console.log('[UID Manager] UID exhausted, invalidating cache');
      cachedCredentials = null;
      this.requestsUsed = 0;
    }
  }

  getStatus() {
    return {
      cached: cachedCredentials ? cachedCredentials.uid : null,
      requestsUsed: this.requestsUsed
    };
  }
}

const uidManager = new UIDManager();

module.exports = uidManager;