/**
 * AI Integration System
 * Features:
 * - ChatGPT/OpenAI integration
 * - Speech recognition (STT)
 * - Text-to-speech (TTS)
 * - Sentiment analysis
 * - Content generation
 * - Translation assistance
 */

class AIIntegration {
    constructor(config = {}) {
        this.config = {
            openaiApiKey: config.openaiApiKey || '',
            openaiBaseUrl: config.openaiBaseUrl || 'https://api.openai.com/v1',
            speechRecognitionLang: config.speechRecognitionLang || 'en-US',
            ttsVoice: config.ttsVoice || 'en-US-JennyNeural',
            ...config
        };

        this.conversationHistory = [];
        this.isListening = false;
        this.isSpeaking = false;
        this.speechRecognition = null;
        this.speechSynthesis = null;
        this.voice = null;
        
        // Rate limiting
        this.lastRequestTime = 0;
        this.requestQueue = [];
        this.maxHistoryLength = 50;
    }

    async initialize() {
        try {
            // Initialize speech recognition
            await this.initializeSpeechRecognition();
            
            // Initialize text-to-speech
            await this.initializeTextToSpeech();
            
            // Load AI models
            await this.loadAIModels();
            
            // Setup event listeners
            this.setupEventListeners();
            
            Notifications.success('AI Integration initialized');
            
            return {
                success: true,
                features: {
                    speechRecognition: !!this.speechRecognition,
                    textToSpeech: !!this.speechSynthesis,
                    openai: !!this.config.openaiApiKey
                }
            };

        } catch (error) {
            console.error('AI Integration initialization failed:', error);
            Notifications.error('AI features may be limited');
            return { success: false, error: error.message };
        }
    }

    async initializeSpeechRecognition() {
        // Check browser support
        if (!('webkitSpeechRecognition' in window || 'SpeechRecognition' in window)) {
            console.warn('Speech recognition not supported');
            return;
        }

        const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
        this.speechRecognition = new SpeechRecognition();
        
        this.speechRecognition.continuous = true;
        this.speechRecognition.interimResults = true;
        this.speechRecognition.lang = this.config.speechRecognitionLang;
        this.speechRecognition.maxAlternatives = 1;

        // Setup event handlers
        this.speechRecognition.onresult = (event) => {
            let finalTranscript = '';
            let interimTranscript = '';

            for (let i = event.resultIndex; i < event.results.length; i++) {
                const transcript = event.results[i][0].transcript;
                if (event.results[i].isFinal) {
                    finalTranscript += transcript;
                } else {
                    interimTranscript += transcript;
                }
            }

            // Emit events
            if (interimTranscript) {
                this.emit('speech-interim', { transcript: interimTranscript });
            }
            if (finalTranscript) {
                this.emit('speech-result', { transcript: finalTranscript });
                this.processSpeechInput(finalTranscript);
            }
        };

        this.speechRecognition.onerror = (event) => {
            console.error('Speech recognition error:', event.error);
            this.emit('speech-error', { error: event.error });
            
            if (event.error === 'not-allowed') {
                Notifications.error('Microphone access denied for speech recognition');
            }
        };

        this.speechRecognition.onend = () => {
            if (this.isListening) {
                // Restart if still listening
                this.startListening();
            }
        };
    }

    async initializeTextToSpeech() {
        // Check browser support
        if (!('speechSynthesis' in window)) {
            console.warn('Text-to-speech not supported');
            return;
        }

        this.speechSynthesis = window.speechSynthesis;
        
        // Load available voices
        await this.loadVoices();
        
        // Select preferred voice
        this.selectVoice(this.config.ttsVoice);
    }

    async loadVoices() {
        return new Promise((resolve) => {
            const voices = speechSynthesis.getVoices();
            if (voices.length > 0) {
                this.availableVoices = voices;
                resolve(voices);
            } else {
                speechSynthesis.onvoiceschanged = () => {
                    this.availableVoices = speechSynthesis.getVoices();
                    resolve(this.availableVoices);
                };
            }
        });
    }

    selectVoice(voiceName) {
        if (!this.availableVoices || this.availableVoices.length === 0) {
            console.warn('No voices available');
            return;
        }

        const voice = this.availableVoices.find(v => 
            v.name.includes(voiceName) || v.lang.includes(voiceName)
        );

        this.voice = voice || this.availableVoices[0];
        return this.voice;
    }

    async loadAIModels() {
        // Load any required AI models
        // This could include sentiment analysis models, translation models, etc.
        
        // For now, we'll just check OpenAI availability
        if (this.config.openaiApiKey) {
            try {
                const response = await fetch(`${this.config.openaiBaseUrl}/models`, {
                    headers: {
                        'Authorization': `Bearer ${this.config.openaiApiKey}`,
                        'Content-Type': 'application/json'
                    }
                });
                
                if (response.ok) {
                    const data = await response.json();
                    this.availableModels = data.data;
                    console.log('OpenAI models loaded:', this.availableModels.length);
                }
            } catch (error) {
                console.warn('Failed to load OpenAI models:', error);
            }
        }
    }

    setupEventListeners() {
        // Global keyboard shortcuts
        document.addEventListener('keydown', (event) => {
            // Ctrl/Cmd + . to toggle speech recognition
            if ((event.ctrlKey || event.metaKey) && event.key === '.') {
                event.preventDefault();
                this.toggleListening();
            }
            
            // Ctrl/Cmd + / to trigger AI assistant
            if ((event.ctrlKey || event.metaKey) && event.key === '/') {
                event.preventDefault();
                this.triggerAssistant();
            }
        });
    }

    async processSpeechInput(transcript) {
        // Clean and process the transcript
        const cleanedTranscript = transcript.trim().toLowerCase();
        
        // Add to conversation history
        this.addToHistory({
            role: 'user',
            content: cleanedTranscript,
            type: 'speech'
        });

        // Process based on content
        if (cleanedTranscript.includes('assistant') || cleanedTranscript.includes('ai')) {
            await this.handleAssistantQuery(cleanedTranscript);
        } else if (cleanedTranscript.includes('translate')) {
            await this.handleTranslationRequest(cleanedTranscript);
        } else if (cleanedTranscript.includes('summarize')) {
            await this.handleSummarization(cleanedTranscript);
        } else {
            // Default: just echo back or process with AI
            await this.generateResponse(cleanedTranscript);
        }
    }

    async generateResponse(prompt, options = {}) {
        try {
            // Check rate limiting
            await this.checkRateLimit();
            
            // Prepare the request
            const requestOptions = {
                model: options.model || 'gpt-3.5-turbo',
                messages: this.prepareConversationContext(prompt),
                max_tokens: options.max_tokens || 500,
                temperature: options.temperature || 0.7,
                ...options
            };

            // Use OpenAI if available, otherwise use fallback
            if (this.config.openaiApiKey) {
                return await this.callOpenAI(requestOptions);
            } else {
                return await this.callLocalAI(prompt, options);
            }

        } catch (error) {
            console.error('AI response generation failed:', error);
            throw error;
        }
    }

    async callOpenAI(options) {
        const response = await fetch(`${this.config.openaiBaseUrl}/chat/completions`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${this.config.openaiApiKey}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(options)
        });

        if (!response.ok) {
            const error = await response.json();
            throw new Error(`OpenAI API error: ${error.error?.message || response.statusText}`);
        }

        const data = await response.json();
        const aiResponse = data.choices[0].message.content;

        // Add to conversation history
        this.addToHistory({
            role: 'assistant',
            content: aiResponse,
            type: 'text'
        });

        // Speak the response if requested
        if (options.speakResponse) {
            await this.speak(aiResponse);
        }

        // Emit event
        this.emit('ai-response', {
            prompt: options.messages[options.messages.length - 1].content,
            response: aiResponse,
            model: options.model,
            tokens: data.usage?.total_tokens
        });

        return aiResponse;
    }

    async callLocalAI(prompt, options) {
        // Fallback local AI processing
        // This could be a local model or simpler rule-based responses
        
        // Simple echo with some intelligence
        const responses = [
            `I understand you said: "${prompt}".`,
            `Processing: ${prompt}`,
            `That's interesting! "${prompt}"`,
            `Let me think about "${prompt}"...`
        ];
        
        const aiResponse = responses[Math.floor(Math.random() * responses.length)];
        
        // Add to conversation history
        this.addToHistory({
            role: 'assistant',
            content: aiResponse,
            type: 'text'
        });

        return aiResponse;
    }

    prepareConversationContext(prompt) {
        // Prepare conversation context from history
        const messages = [
            {
                role: 'system',
                content: 'You are a helpful AI assistant integrated into a web application. Be concise, helpful, and friendly.'
            }
        ];

        // Add recent conversation history
        const recentHistory = this.conversationHistory.slice(-10); // Last 10 messages
        messages.push(...recentHistory);

        // Add current prompt
        messages.push({
            role: 'user',
            content: prompt
        });

        return messages;
    }

    async translateText(text, targetLang, sourceLang = 'auto') {
        try {
            // Use AI for translation if available
            if (this.config.openaiApiKey) {
                const response = await this.generateResponse(
                    `Translate the following text to ${targetLang}: "${text}"`,
                    {
                        model: 'gpt-3.5-turbo',
                        max_tokens: 100,
                        temperature: 0.3
                    }
                );
                return response;
            } else {
                // Fallback to simple translation service
                const response = await fetch(`https://api.mymemory.translated.net/get?q=${encodeURIComponent(text)}&langpair=${sourceLang}|${targetLang}`);
                const data = await response.json();
                return data.responseData.translatedText;
            }
        } catch (error) {
            console.error('Translation failed:', error);
            throw error;
        }
    }

    async summarizeText(text, maxLength = 200) {
        try {
            const response = await this.generateResponse(
                `Summarize the following text in under ${maxLength} characters: "${text}"`,
                {
                    model: 'gpt-3.5-turbo',
                    max_tokens: 100,
                    temperature: 0.5
                }
            );
            return response;
        } catch (error) {
            console.error('Summarization failed:', error);
            throw error;
        }
    }

    async analyzeSentiment(text) {
        try {
            const response = await this.generateResponse(
                `Analyze the sentiment of this text and respond with only one word: Positive, Negative, or Neutral. Text: "${text}"`,
                {
                    model: 'gpt-3.5-turbo',
                    max_tokens: 10,
                    temperature: 0.1
                }
            );

            // Clean up response
            const sentiment = response.trim().toLowerCase();
            
            if (sentiment.includes('positive')) return 'positive';
            if (sentiment.includes('negative')) return 'negative';
            return 'neutral';

        } catch (error) {
            console.error('Sentiment analysis failed:', error);
            return 'neutral';
        }
    }

    async generateContent(prompt, contentType = 'text', options = {}) {
        const contentPrompts = {
            text: `Write a detailed piece about: ${prompt}`,
            email: `Write a professional email about: ${prompt}`,
            code: `Write code for: ${prompt}`,
            list: `Create a list about: ${prompt}`,
            summary: `Summarize: ${prompt}`
        };

        const systemPrompt = contentPrompts[contentType] || contentPrompts.text;
        
        return await this.generateResponse(systemPrompt, {
            model: options.model || 'gpt-3.5-turbo',
            max_tokens: options.max_tokens || 1000,
            temperature: options.temperature || 0.7,
            ...options
        });
    }

    async speak(text, options = {}) {
        if (!this.speechSynthesis || !this.voice) {
            console.warn('Text-to-speech not available');
            return;
        }

        // Cancel any ongoing speech
        this.stopSpeaking();

        return new Promise((resolve) => {
            const utterance = new SpeechSynthesisUtterance(text);
            
            // Configure utterance
            utterance.voice = this.voice;
            utterance.rate = options.rate || 1;
            utterance.pitch = options.pitch || 1;
            utterance.volume = options.volume || 1;
            utterance.lang = this.voice.lang;

            utterance.onstart = () => {
                this.isSpeaking = true;
                this.emit('speech-start', { text });
            };

            utterance.onend = () => {
                this.isSpeaking = false;
                this.emit('speech-end', { text });
                resolve();
            };

            utterance.onerror = (event) => {
                console.error('Speech synthesis error:', event);
                this.isSpeaking = false;
                this.emit('speech-error', { error: event.error });
                resolve();
            };

            this.speechSynthesis.speak(utterance);
        });
    }

    stopSpeaking() {
        if (this.speechSynthesis && this.isSpeaking) {
            this.speechSynthesis.cancel();
            this.isSpeaking = false;
        }
    }

    startListening() {
        if (!this.speechRecognition) {
            Notifications.error('Speech recognition not available');
            return;
        }

        try {
            this.speechRecognition.start();
            this.isListening = true;
            this.emit('listening-start');
            Notifications.info('Listening...');
        } catch (error) {
            console.error('Failed to start listening:', error);
            Notifications.error('Failed to start speech recognition');
        }
    }

    stopListening() {
        if (this.speechRecognition && this.isListening) {
            this.speechRecognition.stop();
            this.isListening = false;
            this.emit('listening-stop');
            Notifications.info('Stopped listening');
        }
    }

    toggleListening() {
        if (this.isListening) {
            this.stopListening();
        } else {
            this.startListening();
        }
    }

    triggerAssistant() {
        // Show AI assistant interface
        this.showAssistantInterface();
    }

    showAssistantInterface() {
        const assistantHtml = `
            <div class="ai-assistant">
                <div class="assistant-header">
                    <h3>AI Assistant</h3>
                    <button class="close-assistant">&times;</button>
                </div>
                <div class="assistant-body">
                    <div class="chat-history" id="ai-chat-history"></div>
                    <div class="input-area">
                        <div class="input-controls">
                            <button class="btn-voice" title="Voice Input">
                                <i class="icon-mic"></i>
                            </button>
                            <button class="btn-attach" title="Attach File">
                                <i class="icon-attach"></i>
                            </button>
                        </div>
                        <textarea 
                            id="ai-input" 
                            placeholder="Ask me anything... (Press Ctrl+Enter to send)"
                            rows="3"
                        ></textarea>
                        <button class="btn-send">Send</button>
                    </div>
                    <div class="assistant-features">
                        <button class="feature-btn" data-feature="translate">Translate</button>
                        <button class="feature-btn" data-feature="summarize">Summarize</button>
                        <button class="feature-btn" data-feature="code">Write Code</button>
                        <button class="feature-btn" data-feature="email">Write Email</button>
                    </div>
                </div>
            </div>
        `;

        // Show assistant modal
        this.showModal('AI Assistant', assistantHtml, {
            onClose: () => this.hideAssistant()
        });

        // Add event listeners
        this.setupAssistantEvents();
    }

    setupAssistantEvents() {
        const input = document.getElementById('ai-input');
        const sendBtn = document.querySelector('.btn-send');
        const voiceBtn = document.querySelector('.btn-voice');
        const featureBtns = document.querySelectorAll('.feature-btn');

        // Send message
        const sendMessage = async () => {
            const message = input.value.trim();
            if (!message) return;

            // Add user message to chat
            this.addChatMessage('user', message);
            input.value = '';

            // Show typing indicator
            this.showTypingIndicator();

            // Get AI response
            try {
                const response = await this.generateResponse(message, {
                    speakResponse: false
                });
                
                // Add AI response to chat
                this.addChatMessage('assistant', response);
                
                // Speak response
                this.speak(response);
                
            } catch (error) {
                this.addChatMessage('assistant', 'Sorry, I encountered an error. Please try again.');
            }

            // Hide typing indicator
            this.hideTypingIndicator();
        };

        // Keyboard shortcuts
        input.addEventListener('keydown', (event) => {
            if (event.ctrlKey && event.key === 'Enter') {
                event.preventDefault();
                sendMessage();
            }
        });

        sendBtn.addEventListener('click', sendMessage);

        // Voice input
        voiceBtn.addEventListener('click', () => {
            this.toggleListening();
            
            // Update button state
            voiceBtn.classList.toggle('listening', this.isListening);
            voiceBtn.title = this.isListening ? 'Stop Listening' : 'Start Listening';
        });

        // Feature buttons
        featureBtns.forEach(btn => {
            btn.addEventListener('click', () => {
                const feature = btn.dataset.feature;
                this.handleFeatureRequest(feature);
            });
        });

        // Listen for speech results
        this.on('speech-result', (data) => {
            input.value = data.transcript;
            sendMessage();
        });
    }

    addChatMessage(role, content) {
        const chatHistory = document.getElementById('ai-chat-history');
        if (!chatHistory) return;

        const messageDiv = document.createElement('div');
        messageDiv.className = `chat-message ${role}`;
        messageDiv.innerHTML = `
            <div class="message-avatar">${role === 'user' ? '👤' : '🤖'}</div>
            <div class="message-content">${this.formatMessageContent(content)}</div>
        `;

        chatHistory.appendChild(messageDiv);
        chatHistory.scrollTop = chatHistory.scrollHeight;
    }

    formatMessageContent(content) {
        // Format markdown-like content
        let formatted = content
            .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
            .replace(/\*(.*?)\*/g, '<em>$1</em>')
            .replace(/`(.*?)`/g, '<code>$1</code>')
            .replace(/\n/g, '<br>');
        
        // Detect and format URLs
        formatted = formatted.replace(
            /(https?:\/\/[^\s]+)/g,
            '<a href="$1" target="_blank">$1</a>'
        );
        
        return formatted;
    }

    showTypingIndicator() {
        const chatHistory = document.getElementById('ai-chat-history');
        if (!chatHistory) return;

        const typingDiv = document.createElement('div');
        typingDiv.id = 'typing-indicator';
        typingDiv.className = 'chat-message assistant typing';
        typingDiv.innerHTML = `
            <div class="message-avatar">🤖</div>
            <div class="message-content">
                <div class="typing-dots">
                    <span></span><span></span><span></span>
                </div>
            </div>
        `;

        chatHistory.appendChild(typingDiv);
        chatHistory.scrollTop = chatHistory.scrollHeight;
    }

    hideTypingIndicator() {
        const typingDiv = document.getElementById('typing-indicator');
        if (typingDiv) {
            typingDiv.remove();
        }
    }

    async handleFeatureRequest(feature) {
        const input = document.getElementById('ai-input');
        const text = input.value.trim();
        
        if (!text) {
            Notifications.warning('Please enter some text first');
            return;
        }

        let response;
        switch (feature) {
            case 'translate':
                response = await this.translateText(text, 'Spanish');
                break;
            case 'summarize':
                response = await this.summarizeText(text);
                break;
            case 'code':
                response = await this.generateContent(text, 'code');
                break;
            case 'email':
                response = await this.generateContent(text, 'email');
                break;
            default:
                response = await this.generateResponse(text);
        }

        this.addChatMessage('assistant', response);
        input.value = '';
    }

    addToHistory(message) {
        this.conversationHistory.push({
            ...message,
            timestamp: new Date().toISOString()
        });

        // Limit history length
        if (this.conversationHistory.length > this.maxHistoryLength) {
            this.conversationHistory = this.conversationHistory.slice(-this.maxHistoryLength);
        }

        // Save to localStorage
        this.saveHistory();
    }

    saveHistory() {
        try {
            localStorage.setItem('ai_conversation_history', JSON.stringify(this.conversationHistory));
        } catch (error) {
            console.warn('Failed to save conversation history:', error);
        }
    }

    loadHistory() {
        try {
            const saved = localStorage.getItem('ai_conversation_history');
            if (saved) {
                this.conversationHistory = JSON.parse(saved);
            }
        } catch (error) {
            console.warn('Failed to load conversation history:', error);
        }
    }

    clearHistory() {
        this.conversationHistory = [];
        localStorage.removeItem('ai_conversation_history');
        Notifications.success('Conversation history cleared');
    }

    async checkRateLimit() {
        const now = Date.now();
        const timeSinceLastRequest = now - this.lastRequestTime;
        
        // Rate limit: max 3 requests per second
        if (timeSinceLastRequest < 333) { // 1000ms / 3
            await new Promise(resolve => 
                setTimeout(resolve, 333 - timeSinceLastRequest)
            );
        }
        
        this.lastRequestTime = Date.now();
    }

    // Event emitter pattern
    listeners = {};
    
    on(event, callback) {
        if (!this.listeners[event]) {
            this.listeners[event] = [];
        }
        this.listeners[event].push(callback);
    }
    
    off(event, callback) {
        if (this.listeners[event]) {
            this.listeners[event] = this.listeners[event].filter(cb => cb !== callback);
        }
    }
    
    emit(event, data) {
        if (this.listeners[event]) {
            this.listeners[event].forEach(callback => callback(data));
        }
    }
}

// Singleton instance
const AIIntegration = new AIIntegration();
export default AIIntegration;
