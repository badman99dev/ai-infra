const axios = require('axios');

const BASE_URL = 'https://www.gening.ai';
const API_BASE = 'https://www.gening.ai/cgi-bin/auth';

class UIDManager {
  constructor() {
    this.stock = [];
    this.running = null;
    this.requestsUsed = 0;
    this.maxRequestsPerUID = 1;
    this.targetStock = 20;
    this.initializing = false;
    this.initPromise = null;
  }

  async init() {
    if (this.running || this.initializing) {
      return;
    }
    
    this.initializing = true;
    console.log('[UID Manager] Initializing stock...');
    
    let attempts = 0;
    const maxAttempts = 30;
    
    while (this.stock.length < this.targetStock && attempts < maxAttempts) {
      attempts++;
      try {
        const cred = await this.createNewUID();
        this.stock.push(cred);
        console.log(`[UID Manager] Added UID to stock: ${cred.uid} credits:${cred.credits} (${this.stock.length}/${this.targetStock})`);
      } catch (e) {
        console.error('[UID Manager] Error creating UID:', e.message);
        await this.sleep(2000);
      }
    }
    
    if (this.stock.length > 0) {
      this.running = this.stock.pop();
      console.log(`[UID Manager] Running UID: ${this.running.uid}`);
    } else {
      console.error('[UID Manager] FAILED TO CREATE ANY UIDs');
    }
    this.initializing = false;
  }

  async ensureReady() {
    if (this.initPromise) {
      return this.initPromise;
    }
    this.initPromise = this.init();
    return this.initPromise;
  }

  async createNewUID() {
    const response = await axios.post(`${BASE_URL}/cgi-bin/login`, 'code=0', {
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      timeout: 10000
    });
    
    if (response.data.code !== 0) {
      throw new Error(`Login failed: ${response.data.message}`);
    }
    
    const credits = response.data.data.remain;
    if (credits < 1) {
      throw new Error(`No credits: got ${credits}`);
    }
    
    return {
      uid: response.data.data.uid,
      ticket: response.data.data.ticket,
      credits: credits
    };
  }

  getRunningCredentials() {
    if (!this.running) {
      throw new Error('No running credentials');
    }
    return {
      uid: this.running.uid,
      ticket: this.running.ticket,
      cookie: `uid=${this.running.uid}; ticket=${this.running.ticket}`
    };
  }

  async handleResponseDone() {
    this.requestsUsed++;
    console.log(`[UID Manager] Request done. Used: ${this.requestsUsed}/${this.maxRequestsPerUID} for UID ${this.running?.uid}`);
    
    if (this.requestsUsed >= this.maxRequestsPerUID) {
      console.log('[UID Manager] UID exhausted, switching...');
      this.running = null;
      this.requestsUsed = 0;
    }
    
    await this.replenishStock();
    
    if (!this.running && this.stock.length > 0) {
      this.running = this.stock.pop();
      console.log(`[UID Manager] New running UID: ${this.running.uid}`);
    }
  }

  async replenishStock() {
    if (this.stock.length >= this.targetStock) {
      return;
    }
    
    const needed = this.targetStock - this.stock.length;
    console.log(`[UID Manager] Replenishing stock (need ${needed})...`);
    
    for (let i = 0; i < needed; i++) {
      try {
        const cred = await this.createNewUID();
        this.stock.push(cred);
        console.log(`[UID Manager] Replenished: ${cred.uid} (stock: ${this.stock.length})`);
      } catch (e) {
        console.error('[UID Manager] Error replenishing:', e.message);
        await this.sleep(1000);
      }
    }
  }

  sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  getStatus() {
    return {
      stockCount: this.stock.length,
      running: this.running ? this.running.uid : null,
      requestsUsed: this.requestsUsed
    };
  }
}

const uidManager = new UIDManager();

module.exports = uidManager;