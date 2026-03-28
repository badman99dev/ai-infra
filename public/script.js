const API_URL = window.location.origin + '/v1/chat/completions';

let messages = [];
let isStreaming = false;
let systemPrompt = '';

const modelIcons = {
    'geningai/gpt3': '🤖',
    'geningai/llama-roleplay': '🦙'
};

const modelNames = {
    'geningai/gpt3': 'GPT-3',
    'geningai/llama-roleplay': 'LLaMA'
};

// Initialize
document.addEventListener('DOMContentLoaded', () => {
    updateModelDisplay();
    autoResize(document.getElementById('messageInput'));
});

// Toggle sidebar on mobile
function toggleSidebar() {
    document.getElementById('sidebar').classList.toggle('open');
}

// Auto resize textarea
function autoResize(textarea) {
    textarea.style.height = 'auto';
    textarea.style.height = Math.min(textarea.scrollHeight, 200) + 'px';
}

// Handle Enter key
function handleKeyDown(event) {
    if (event.key === 'Enter' && !event.shiftKey) {
        event.preventDefault();
        sendMessage();
    }
}

// Send message
async function sendMessage() {
    const input = document.getElementById('messageInput');
    const content = input.value.trim();
    
    if (!content || isStreaming) return;
    
    // Add user message
    addMessage('user', content);
    input.value = '';
    autoResize(input);
    
    // Clear welcome if first message
    const welcome = document.querySelector('.welcome-message');
    if (welcome) welcome.remove();
    
    // Show typing indicator
    showTypingIndicator();
    
    try {
        isStreaming = true;
        updateSendButton(true);
        
        const response = await fetch(API_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                model: document.getElementById('modelSelect').value,
                messages: buildMessages(),
                stream: true
            })
        });
        
        if (!response.ok) {
            throw new Error('API request failed');
        }
        
        removeTypingIndicator();

        const contentType = response.headers.get('content-type') || '';
        let aiResponse = '';
        let messageDiv = null;

        if (contentType.includes('text/event-stream')) {
            // --- STREAMING (SSE) MODE --- e.g. llama-roleplay
            const reader = response.body.getReader();
            const decoder = new TextDecoder();
            // rAF-based streaming: accumulate chars, paint only on screen refresh
            let rafScheduled = false;
            const scheduleRender = () => {
                if (rafScheduled) return;
                rafScheduled = true;
                requestAnimationFrame(() => {
                    if (!messageDiv) {
                        messageDiv = createAIMessage(aiResponse);
                    } else {
                        updateAIMessage(messageDiv, aiResponse);
                    }
                    rafScheduled = false;
                });
            };

            while (true) {
                const { done, value } = await reader.read();
                if (done) break;

                const chunk = decoder.decode(value);
                const lines = chunk.split('\n');

                for (const line of lines) {
                    if (line.startsWith('data: ')) {
                        const data = line.slice(6).trim();
                        if (data === '[DONE]') continue;

                        try {
                            const json = JSON.parse(data);
                            const content = json.choices[0]?.delta?.content;
                            if (content) {
                                aiResponse += content;
                                scheduleRender();
                            }
                        } catch (e) {}
                    }
                }
            }
            // Final paint to make sure last chars show
            if (!messageDiv) {
                messageDiv = createAIMessage(aiResponse);
            } else {
                updateAIMessage(messageDiv, aiResponse);
            }
        } else {
            // --- NON-STREAMING (JSON) MODE --- e.g. gpt3
            const json = await response.json();
            aiResponse = json.choices[0]?.message?.content || '';
            if (aiResponse) {
                messageDiv = createAIMessage(aiResponse);
            }
        }

        // Add to messages array
        messages.push({ role: 'assistant', content: aiResponse });
        
    } catch (error) {
        console.error('Error:', error);
        removeTypingIndicator();
        addMessage('ai', 'Sorry, an error occurred. Please try again.');
    } finally {
        isStreaming = false;
        updateSendButton(false);
    }
}

// Build messages with system prompt
function buildMessages() {
    const msgs = [];
    
    if (systemPrompt) {
        msgs.push({ role: 'system', content: systemPrompt });
    }
    
    // Keep last 20 messages to prevent context overflow
    const recentMessages = messages.slice(-20);
    msgs.push(...recentMessages);
    
    return msgs;
}

// Quick prompt
function sendQuickPrompt(prompt) {
    const input = document.getElementById('messageInput');
    input.value = prompt;
    sendMessage();
}

// Start new chat
function startNewChat() {
    messages = [];
    systemPrompt = '';
    document.getElementById('systemPrompt').value = '';
    document.getElementById('messageInput').value = '';
    
    const container = document.getElementById('messagesContainer');
    container.innerHTML = `
        <div class="welcome-message">
            <div class="welcome-icon">✨</div>
            <h2>Welcome to AI Chat</h2>
            <p>Select a model and start chatting</p>
            <div class="quick-prompts">
                <button onclick="sendQuickPrompt('Hello! How are you?')">Say Hello</button>
                <button onclick="sendQuickPrompt('Write a Python function')">Write Code</button>
                <button onclick="sendQuickPrompt('Tell me a joke')">Tell a Joke</button>
            </div>
        </div>
    `;
}

// Apply system prompt
function applySystemPrompt() {
    systemPrompt = document.getElementById('systemPrompt').value;
    alert('System prompt applied!');
}

// Model change handler
document.getElementById('modelSelect').addEventListener('change', updateModelDisplay);

function updateModelDisplay() {
    const model = document.getElementById('modelSelect').value;
    document.querySelector('.model-icon').textContent = modelIcons[model] || '🤖';
    document.querySelector('.model-name').textContent = modelNames[model] || model;
}

// UI Helpers
function addMessage(role, content) {
    const container = document.getElementById('messagesContainer');
    
    const messageDiv = document.createElement('div');
    messageDiv.className = `message ${role}`;
    messageDiv.innerHTML = `
        <div class="message-avatar">${role === 'user' ? '👤' : '🤖'}</div>
        <div class="message-content">${formatContent(content)}</div>
    `;
    
    container.appendChild(messageDiv);
    scrollToBottom();
    
    // Add to messages array
    messages.push({ role, content });
}

function createAIMessage(content) {
    const container = document.getElementById('messagesContainer');
    
    const messageDiv = document.createElement('div');
    messageDiv.className = 'message ai';
    messageDiv.innerHTML = `
        <div class="message-avatar">🤖</div>
        <div class="message-content">${formatContent(content)}</div>
    `;
    
    container.appendChild(messageDiv);
    scrollToBottom();
    
    return messageDiv;
}

function updateAIMessage(messageDiv, content) {
    messageDiv.querySelector('.message-content').innerHTML = formatContent(content);
    scrollToBottom();
}

function showTypingIndicator() {
    const container = document.getElementById('messagesContainer');
    const indicator = document.createElement('div');
    indicator.className = 'typing-indicator';
    indicator.id = 'typingIndicator';
    indicator.innerHTML = `
        <div class="typing-dot"></div>
        <div class="typing-dot"></div>
        <div class="typing-dot"></div>
    `;
    container.appendChild(indicator);
    scrollToBottom();
}

function removeTypingIndicator() {
    const indicator = document.getElementById('typingIndicator');
    if (indicator) indicator.remove();
}

function updateSendButton(loading) {
    const btn = document.getElementById('sendBtn');
    if (loading) {
        btn.classList.add('loading');
        btn.innerHTML = '<span>⏳</span>';
    } else {
        btn.classList.remove('loading');
        btn.innerHTML = '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 2L11 13M22 2l-7 20-4-9-9-4 20-7z"/></svg>';
    }
    btn.disabled = loading;
}

function scrollToBottom() {
    const container = document.getElementById('messagesContainer');
    container.scrollTop = container.scrollHeight;
}

// Format content (simple markdown-like)
function formatContent(content) {
    // Escape HTML
    let formatted = content
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;');
    
    // Code blocks
    formatted = formatted.replace(/```([\s\S]*?)```/g, '<pre><code>$1</code></pre>');
    
    // Inline code
    formatted = formatted.replace(/`([^`]+)`/g, '<code>$1</code>');
    
    // Bold
    formatted = formatted.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
    
    // Line breaks
    formatted = formatted.replace(/\n/g, '<br>');
    
    return formatted;
}

// Close sidebar when clicking outside on mobile
document.addEventListener('click', (e) => {
    const sidebar = document.getElementById('sidebar');
    const toggle = document.querySelector('.sidebar-toggle');
    
    if (window.innerWidth <= 768 && 
        !sidebar.contains(e.target) && 
        !toggle.contains(e.target) &&
        sidebar.classList.contains('open')) {
        sidebar.classList.remove('open');
    }
});