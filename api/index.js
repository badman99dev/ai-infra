const provider = require('../providers/geningai');

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  try {
    const { messages, model, stream = false, ...options } = req.body;

    if (!model) {
      return res.status(400).json({ error: 'model is required' });
    }

    if (!messages || !Array.isArray(messages) || messages.length === 0) {
      return res.status(400).json({ error: 'messages is required and must be non-empty' });
    }

    console.log(`[API] Request: model=${model}, stream=${stream}, messages=${messages.length}`);

    if (stream) {
      res.setHeader('Content-Type', 'text/event-stream');
      res.setHeader('Cache-Control', 'no-cache');
      res.setHeader('Connection', 'keep-alive');

      await provider.chatComplete(messages, {
        model,
        stream: true,
        onChunk: (chunk) => {
          const data = `data: ${JSON.stringify({
            id: chunk.id,
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

      res.write('data: [DONE]\n\n');
      return res.end();
    } else {
      const result = await provider.chatComplete(messages, {
        model,
        stream: false
      });

      return res.status(200).json(result);
    }

  } catch (error) {
    console.error('[API] Error:', error.message);
    return res.status(500).json({
      error: {
        message: error.message || 'Internal server error',
        type: 'internal_error'
      }
    });
  }
};