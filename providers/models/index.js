const GPT3Model = require('./gpt3');
const LlamaRoleplayModel = require('./llama-roleplay');

class ModelRouter {
  constructor(uidManager) {
    this.uidManager = uidManager;
    this.models = {
      'geningai/gpt3': new GPT3Model(uidManager),
      'geningai/llama-roleplay': new LlamaRoleplayModel(uidManager)
    };
    
    this.aliasMap = {
      'gpt-3': 'geningai/gpt3',
      'gpt3': 'geningai/gpt3',
      'llama-roleplay': 'geningai/llama-roleplay',
      'llama': 'geningai/llama-roleplay',
      'roleplay': 'geningai/llama-roleplay'
    };
  }

  getModel(modelId) {
    const resolvedId = this.aliasMap[modelId] || modelId;
    const model = this.models[resolvedId];
    
    if (!model) {
      const available = Object.keys(this.models).join(', ');
      throw new Error(`Model not found: ${modelId}. Available: ${available}`);
    }
    
    return model;
  }

  getAvailableModels() {
    return Object.keys(this.models);
  }

  supportsStreaming(modelId) {
    const model = this.getModel(modelId);
    return model.supportsStreaming;
  }
}

module.exports = ModelRouter;