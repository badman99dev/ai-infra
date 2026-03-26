const provider = require('../providers/geningai');

module.exports = async function handler(req, res) {
  const requestId = `req-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  
  console.log(`[${requestId}] ===== NEW REQUEST =====`);
  console.log(`[${requestId}] Method: ${req.method}`);
  console.log(`[${requestId}] Headers:`, JSON.stringify(req.headers));
  
  if (req.method !== 'POST') {
    console.log(`[${requestId}] Method not allowed: ${req.method}`);
    return res.status(405).json({ error: 'Method not allowed' });
  }

  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    console.log(`[${requestId}] Handling CORS preflight`);
    return res.status(200).end();
  }

  try {
    const { messages, model, stream = false, temperature, max_tokens, ...options } = req.body;

    console.log(`[${requestId}] ===== REQUEST DETAILS =====`);
    console.log(`[${requestId}] model: ${model}`);
    console.log(`[${requestId}] stream: ${stream}`);
    console.log(`[${requestId}] messages count: ${messages?.length || 0}`);
    console.log(`[${requestId}] last message: ${messages?.[messages?.length - 1]?.content?.substring(0, 50)}...`);
    console.log(`[${requestId}] temperature: ${temperature}`);
    console.log(`[${requestId}] max_tokens: ${max_tokens}`);

    if (!model) {
      console.log(`[${requestId}] ERROR: model is required`);
      return res.status(400).json({ error: 'model is required' });
    }

    if (!messages || !Array.isArray(messages) || messages.length === 0) {
      console.log(`[${requestId}] ERROR: messages is required`);
      return res.status(400).json({ error: 'messages is required and must be non-empty' });
    }

    // Check model support for streaming
    const supportsStreaming = model.includes('llama-roleplay');
    console.log(`[${requestId}] Model supports streaming: ${supportsStreaming}`);

    if (stream && !supportsStreaming) {
      console.log(`[${requestId}] WARNING: Model doesn't support streaming, using non-stream`);
    }

    const actualStream = stream && supportsStreaming;

    if (actualStream) {
      console.log(`[${requestId}] ===== STARTING STREAM =====`);
      res.setHeader('Content-Type', 'text/event-stream');
      res.setHeader('Cache-Control', 'no-cache');
      res.setHeader('Connection', 'keep-alive');
      res.setHeader('X-Accel-Buffering', 'no');

      let chunkCount = 0;
      let totalContent = '';

      await provider.chatComplete(messages, {
        model,
        stream: true,
        temperature,
        max_tokens,
        ...options,
        onChunk: (chunk) => {
          chunkCount++;
          const content = chunk.choices[0]?.delta?.content || '';
          totalContent += content;
          
          console.log(`[${requestId}] Stream chunk #${chunkCount}: "${content.substring(0, 30)}..."`);
          
          const data = `data: ${JSON.stringify({
            id: chunk.id || `geningai-${requestId}`,
            object: 'chat.completion.chunk',
            created: Math.floor(Date.now() / 1000),
            model: model,
            choices: [{
              index: 0,
              delta: chunk.choices[0].delta,
              finish_reason: null
            }]
          })}\n\n`;
          
          res.write(data);
        }
      });

      console.log(`[${requestId}] ===== STREAM COMPLETE =====`);
      console.log(`[${requestId}] Total chunks: ${chunkCount}`);
      console.log(`[${requestId}] Total content length: ${totalContent.length}`);
      console.log(`[${requestId}] Content preview: "${totalContent.substring(0, 100)}..."`);

      res.write('data: [DONE]\n\n');
      console.log(`[${requestId}] ===== REQUEST COMPLETE =====`);
      return res.end();
    } else {
      console.log(`[${requestId}] ===== NON-STREAM REQUEST =====`);
      
      const result = await provider.chatComplete(messages, {
        model,
        stream: false,
        temperature,
        max_tokens,
        ...options
      });

      console.log(`[${requestId}] Response:`, JSON.stringify(result).substring(0, 200));
      console.log(`[${requestId}] Content: "${result.choices[0].message.content.substring(0, 100)}..."`);
      console.log(`[${requestId}] ===== REQUEST COMPLETE =====`);

      return res.status(200).json(result);
    }

  } catch (error) {
    console.error(`[${requestId}] ERROR:`, error.message);
    console.error(`[${requestId}] Stack:`, error.stack);
    return res.status(500).json({
      error: {
        message: error.message || 'Internal server error',
        type: 'internal_error'
      }
    });
  }
};