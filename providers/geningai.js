const uidManager = require('../lib/collectuid');
const ModelRouter = require('./models');

class GeningAIProvider {
  constructor() {
    this.modelRouter = new ModelRouter(uidManager);
    this.initialized = false;
  }

  async initialize() {
    if (this.initialized) return;
    await uidManager.ensureReady();
    this.initialized = true;
  }

  async chatComplete(messages, options = {}) {
    await this.initialize();
    
    const { model, stream = false } = options;
    const modelInstance = this.modelRouter.getModel(model);
    
    if (stream && !this.modelRouter.supportsStreaming(model)) {
      throw new Error(`Model ${model} does not support streaming`);
    }
    
    return await modelInstance.generate(messages, options);
  }

  getAvailableModels() {
    return this.modelRouter.getAvailableModels();
  }
}

const provider = new GeningAIProvider();

module.exports = provider;