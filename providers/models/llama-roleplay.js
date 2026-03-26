const axios = require('axios');

const API_BASE = 'https://www.gening.ai/cgi-bin/auth';

class LlamaRoleplayModel {
  constructor(uidManager) {
    this.uidManager = uidManager;
    this.modelName = 'llama-roleplay';
    this.supportsStreaming = true;
    this.characterId = '2e6cd507-dd9c-4f2c-add1-8551a944da95';
  }

  async generate(messages, options = {}) {
    const credentials = this.uidManager.getRunningCredentials();
    
    const payload = {
      inputs: {
        char_id: this.characterId
      },
      query: messages[messages.length - 1].content,
      messages: this.formatMessages(messages)
    };

    try {
      const response = await axios.post(
        `${API_BASE}/aigc/character2?id=${this.characterId}`,
        payload,
        {
          headers: {
            'Content-Type': 'application/json',
            'Cookie': credentials.cookie
          },
          timeout: 60000,
          responseType: 'stream'
        }
      );

      return this.formatStreamResponse(response.data, options.onChunk);

    } catch (error) {
      console.error('[LlamaRoleplay] Error:', error.message);
      throw error;
    }
  }

  formatMessages(messages) {
    const formatted = [];
    for (let i = 0; i < messages.length - 1; i++) {
      formatted.push({
        role: messages[i].role === 'assistant' ? 'assistant' : 'user',
        content: messages[i].content
      });
    }
    return formatted;
  }

  formatStreamResponse(stream, onChunk) {
    let fullText = '';
    let chunks = [];
    let chunkCount = 0;

    return new Promise((resolve, reject) => {
      stream.on('data', (chunk) => {
        const lines = chunk.toString().split('\n');
        
        for (const line of lines) {
          if (line.startsWith('data: ')) {
            const dataStr = line.slice(6);
            if (dataStr === '{}' || !dataStr.trim()) continue;
            
            try {
              const data = JSON.parse(dataStr);
              
              if (data.event === 'message' && data.answer) {
                fullText += data.answer;
                chunkCount++;
                chunks.push(data.answer);
                
                if (onChunk) {
                  onChunk({
                    id: `geningai-${data.task_id || Date.now()}`,
                    choices: [{
                      delta: { content: data.answer },
                      index: 0
                    }]
                  });
                }
              }
              
              if (data.event === 'message_end') {
                this.uidManager.handleResponseDone();
              }
              
            } catch (e) {
              // Skip invalid JSON
            }
          }
        }
      });

      stream.on('end', () => {
        resolve({
          id: `geningai-${Date.now()}`,
          object: 'chat.completion',
          created: Math.floor(Date.now() / 1000),
          model: this.modelName,
          choices: [{
            index: 0,
            message: {
              role: 'assistant',
              content: fullText
            },
            finish_reason: 'stop'
          }],
          usage: {
            prompt_tokens: 0,
            completion_tokens: fullText.split(' ').length,
            total_tokens: fullText.split(' ').length
          }
        });
      });

      stream.on('error', reject);
    });
  }
}

module.exports = LlamaRoleplayModel;