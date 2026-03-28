const axios = require('axios');

const API_BASE = 'https://www.gening.ai/cgi-bin/auth';

class LlamaRoleplayModel {
  constructor(uidManager) {
    this.uidManager = uidManager;
    this.modelName = 'llama-roleplay';
    this.supportsStreaming = true;
    this.characterId = '2e6cd507-dd9c-4f2c-add1-8551a944da95';
  }

  async generate(messages, options = {}, retryCount = 0) {
    const MAX_RETRIES = 2;
    console.log('[LlamaRoleplay] ===== START =====');
    console.log('[LlamaRoleplay] Getting credentials...');
    
    const credentials = this.uidManager.getRunningCredentials();
    console.log('[LlamaRoleplay] Using UID:', credentials.uid);
    
    const payload = {
      inputs: {
        char_id: this.characterId
      },
      query: messages[messages.length - 1].content,
      messages: this.formatMessages(messages)
    };

    console.log('[LlamaRoleplay] Payload:', JSON.stringify(payload).substring(0, 200));
    console.log('[LlamaRoleplay] Calling Gening AI API...');

    try {
      const response = await axios.post(
        `${API_BASE}/aigc/character2?id=${this.characterId}`,
        payload,
        {
          headers: {
            'Content-Type': 'application/json',
            'Cookie': credentials.cookie
          },
          timeout: 90000,
          responseType: 'stream'
        }
      );

      console.log('[LlamaRoleplay] Response status:', response.status);
      console.log('[LlamaRoleplay] Response headers:', JSON.stringify(response.headers).substring(0, 100));
      
      return this.formatStreamResponse(response.data, options.onChunk);

    } catch (error) {
      console.error('[LlamaRoleplay] Error:', error.message);
      if (error.isCredentialError && retryCount < MAX_RETRIES) {
        console.warn(`[LlamaRoleplay] Credential error, force rotating and retrying (${retryCount + 1}/${MAX_RETRIES})`);
        await this.uidManager.forceRotate();
        return this.generate(messages, options, retryCount + 1);
      }
      if (error.response) {
        console.error('[LlamaRoleplay] Response status:', error.response.status);
        console.error('[LlamaRoleplay] Response data:', error.response.data?.substring?.(0, 200) || error.response.data);
      }
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
    
    // If no history, add a starter message
    if (formatted.length === 0) {
      formatted.push({ role: 'user', content: 'Hi' });
    }
    
    console.log('[LlamaRoleplay] Formatted messages:', JSON.stringify(formatted).substring(0, 200));
    return formatted;
  }

  formatStreamResponse(stream, onChunk) {
    console.log('[LlamaRoleplay] Starting stream processing...');
    let fullText = '';
    let chunkCount = 0;
    let firstChunk = true;
    let lineBuffer = ''; // Buffer for partial lines across TCP chunks

    return new Promise((resolve, reject) => {
      stream.on('data', (chunk) => {
        const chunkStr = chunk.toString();
        console.log('[LlamaRoleplay] Received chunk, length:', chunkStr.length);
        
        // Prepend any leftover partial line from previous chunk
        const incoming = lineBuffer + chunkStr;
        lineBuffer = '';

        const lines = incoming.split('\n');

        // Last element may be incomplete — save it for next chunk
        lineBuffer = lines.pop();
        
        for (const line of lines) {
          if (line.startsWith('data: ')) {
            const dataStr = line.slice(6).trim();
            if (dataStr === '{}' || !dataStr) {
              console.log('[LlamaRoleplay] Skipping empty data');
              continue;
            }
            
            try {
              const data = JSON.parse(dataStr);
              console.log('[LlamaRoleplay] Event:', data.event, ', answer:', data.answer?.substring(0, 30));
              
              if (data.event === 'error') {
                const msg = data.message || 'API Error';
                console.error('[LlamaRoleplay] API Error:', msg);
                const isCredentialError = data.code === 100002 ||
                  /credit|score|lack|quota|limit|expired|invalid/i.test(msg);
                if (isCredentialError) {
                  const err = new Error(msg);
                  err.isCredentialError = true;
                  reject(err);
                } else {
                  reject(new Error(msg));
                }
                return;
              }
              
              if (data.event === 'message' && data.answer) {
                fullText += data.answer;
                chunkCount++;
                
                if (firstChunk) {
                  console.log('[LlamaRoleplay] First content chunk:', data.answer.substring(0, 50));
                  firstChunk = false;
                }
                
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
                console.log('[LlamaRoleplay] Message end event, handling response done');
                this.uidManager.handleResponseDone();
              }
              
            } catch (e) {
              console.log('[LlamaRoleplay] JSON parse error:', e.message, 'data:', dataStr.substring(0, 50));
            }
          }
        }
      });

      stream.on('end', () => {
        console.log('[LlamaRoleplay] Stream ended');
        console.log('[LlamaRoleplay] Total chunks received:', chunkCount);
        console.log('[LlamaRoleplay] Total content length:', fullText.length);
        console.log('[LlamaRoleplay] Content preview:', fullText.substring(0, 100));
        
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

      stream.on('error', (err) => {
        console.error('[LlamaRoleplay] Stream error:', err.message);
        reject(err);
      });
    });
  }
}

module.exports = LlamaRoleplayModel;