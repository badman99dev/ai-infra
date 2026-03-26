const axios = require('axios');

const BASE_URL = 'https://www.gening.ai';
const API_BASE = 'https://www.gening.ai/cgi-bin/auth';

class UIDManager {
  constructor() {
    this.stock = [];
    this.running = null;
    this.requestsUsed = 0;
    this.maxRequestsPerUID = 3;
    this.targetStock = 10;
    this.initializing = false;
    this.initPromise = null;
  }

  async init() {
    if (this.stock.length > 0 || this.initializing) {
      return;
    }
    
    this.initializing = true;
    console.log('[UID Manager] Initializing stock...');
    
    while (this.stock.length < this.targetStock) {
      try {
        const cred = await this.createNewUID();
        this.stock.push(cred);
        console.log(`[UID Manager] Added UID to stock: ${cred.uid} (${this.stock.length}/${this.targetStock})`);
      } catch (e) {
        console.error('[UID Manager] Error creating UID:', e.message);
        await this.sleep(1000);
      }
    }
    
    this.running = this.stock.pop();
    console.log(`[UID Manager] Running UID: ${this.running.uid}`);
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
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' }
    });
    
    if (response.data.code !== 0) {
      throw new Error('Failed to create UID');
    }
    
    return {
      uid: response.data.data.uid,
      ticket: response.data.data.ticket,
      credits: response.data.data.remain
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