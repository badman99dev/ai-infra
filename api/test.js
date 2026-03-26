const provider = require('../providers/geningai');

// Test endpoint
module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Content-Type', 'application/json');
  
  const { messages, model, stream = false, temperature, max_tokens, ...options } = req.body;
  
  try {
    console.log('[Test] Request received, model:', model, 'stream:', stream);
    
    if (stream) {
      res.setHeader('Content-Type', 'text/event-stream');
      res.setHeader('Cache-Control', 'no-cache');
      res.setHeader('Connection', 'keep-alive');
      
      await provider.chatComplete(messages, {
        model,
        stream: true,
        onChunk: (chunk) => {
          const content = chunk.choices[0]?.delta?.content || '';
          console.log('[Test] Chunk:', content.substring(0, 20));
          
          const data = `data: ${JSON.stringify({
            id: `test-${Date.now()}`,
            object: 'chat.completion.chunk',
            created: Math.floor(Date.now() / 1000),
            model: model,
            choices: [{ index: 0, delta: chunk.choices[0].delta, finish_reason: null }]
          })}\n\n`;
          
          res.write(data);
        }
      });
      
      res.write('data: [DONE]\n\n');
      return res.end();
    } else {
      const result = await provider.chatComplete(messages, { model, stream: false });
      console.log('[Test] Result content:', result.choices[0].message.content.substring(0, 50));
      return res.status(200).json(result);
    }
  } catch (error) {
    console.error('[Test] Error:', error.message);
    return res.status(500).json({ error: error.message });
  }
};