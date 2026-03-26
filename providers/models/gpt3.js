const axios = require('axios');

const API_BASE = 'https://www.gening.ai/cgi-bin/auth';

class GPT3Model {
  constructor(uidManager) {
    this.uidManager = uidManager;
    this.modelName = 'gpt-3';
    this.supportsStreaming = false;
  }

  async generate(messages, options = {}) {
    const credentials = this.uidManager.getRunningCredentials();
    
    const payload = {
      messages: this.formatMessages(messages)
    };

    try {
      const response = await axios.post(
        `${API_BASE}/aigc/text`,
        payload,
        {
          headers: {
            'Content-Type': 'application/json',
            'Cookie': credentials.cookie
          },
          timeout: 60000
        }
      );

      if (response.data.code !== 0) {
        if (response.data.code === 100002) {
          this.uidManager.running = null;
          this.uidManager.requestsUsed = this.uidManager.maxRequestsPerUID;
        }
        throw new Error(response.data.message || 'API Error');
      }

      await this.uidManager.handleResponseDone();

      const text = response.data.data.result;
      return this.formatResponse(text);

    } catch (error) {
      console.error('[GPT3] Error:', error.message);
      throw error;
    }
  }

  formatMessages(messages) {
    return messages.map(msg => ({
      role: msg.role === 'assistant' ? 'assistant' : 'user',
      content: msg.content
    }));
  }

  formatResponse(text) {
    return {
      id: `geningai-${Date.now()}`,
      object: 'chat.completion',
      created: Math.floor(Date.now() / 1000),
      model: this.modelName,
      choices: [{
        index: 0,
        message: {
          role: 'assistant',
          content: text
        },
        finish_reason: 'stop'
      }],
      usage: {
        prompt_tokens: 0,
        completion_tokens: text.split(' ').length,
        total_tokens: text.split(' ').length
      }
    };
  }
}

module.exports = GPT3Model;