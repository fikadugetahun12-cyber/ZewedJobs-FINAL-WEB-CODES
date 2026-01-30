import MediaRoom from './js/media-room.js';
import AIIntegration from './js/ai-integration.js';
import ChatSystem from './js/chat.js';

class UnifiedCommunicationSystem {
    constructor() {
        this.mediaRoom = null;
        this.aiIntegration = null;
        this.chatSystem = null;
        this.user = null;
    }

    async initialize(userConfig = {}) {
        try {
            // Initialize user
            this.user = {
                id: userConfig.id || localStorage.getItem('userId') || this.generateUserId(),
                name: userConfig.name || localStorage.getItem('userName') || 'Anonymous',
                email: userConfig.email || '',
                avatar: userConfig.avatar || null
            };

            // Save user info
            localStorage.setItem('userId', this.user.id);
            localStorage.setItem('userName', this.user.name);

            // Initialize AI Integration
            this.aiIntegration = new AIIntegration({
                openaiApiKey: userConfig.openaiApiKey,
                speechRecognitionLang: userConfig.language || 'en-US'
            });
            await this.aiIntegration.initialize();

            // Initialize Chat System
            this.chatSystem = new ChatSystem({
                websocketUrl: 'wss://your-chat-server.com'
            });
            await this.chatSystem.initialize(this.user.id, this.user.name);

            // Initialize Media Room (on-demand)
            // We'll initialize this when needed to avoid requesting media permissions immediately

            // Setup global event handlers
            this.setupGlobalEvents();

            // Setup UI
            this.setupUnifiedUI();

            Notifications.success('Communication system initialized');

            return {
                success: true,
                user: this.user,
                features: {
                    ai: true,
                    chat: true,
                    media: true
                }
            };

        } catch (error) {
            console.error('Failed to initialize communication system:', error);
            Notifications.error('Failed to initialize communication features');
            throw error;
        }
    }

    setupGlobalEvents() {
        // Voice command to start meeting
        this.aiIntegration.on('speech-result', (data) => {
            const transcript = data.transcript.toLowerCase();
            
            if (transcript.includes('start meeting') || transcript.includes('start video call')) {
                this.startVideoCall();
            } else if (transcript.includes('send message')) {
                this.handleVoiceMessage(transcript);
            }
        });

        // Chat message to AI
        this.chatSystem.on('message', (message) => {
            if (message.text.includes('@ai') || message.text.includes('@assistant')) {
                this.handleAIChatMessage(message);
            }
        });

        // Connection status updates
        window.addEventListener('online', () => {
            this.reconnectAll();
        });
    }

    setupUnifiedUI() {
        // Create unified communication interface
        const container = document.createElement('div');
        container.id = 'communication-container';
        container.innerHTML = this.getUnifiedUI();
        document.body.appendChild(container);

        // Add event listeners
        this.setupUIEvents();
    }

    getUnifiedUI() {
        return `
            <div class="communication-widget">
                <div class="com-tabs">
                    <button class="com-tab active" data-tab="chat">💬 Chat</button>
                    <button class="com-tab" data-tab="meet">🎥 Meet</button>
                    <button class="com-tab" data-tab="ai">🤖 AI</button>
                </div>
                
                <div class="com-content">
                    <!-- Chat tab content -->
                    <div class="com-tab-content active" id="chat-tab">
                        <div class="chat-interface">
                            <!-- Chat interface will be loaded here -->
                        </div>
                    </div>
                    
                    <!-- Meet tab content -->
                    <div class="com-tab-content" id="meet-tab">
                        <div class="meet-interface">
                            <div class="meet-controls">
                                <button class="btn-new-meeting">New Meeting</button>
                                <button class="btn-join-meeting">Join Meeting</button>
                                <button class="btn-schedule">Schedule</button>
                            </div>
                            <div class="meet-preview" id="meet-preview"></div>
                        </div>
                    </div>
                    
                    <!-- AI tab content -->
                    <div class="com-tab-content" id="ai-tab">
                        <div class="ai-interface">
                            <div class="ai-controls">
                                <button class="btn-voice-ai">🎤 Voice Assistant</button>
                                <button class="btn-translate">🌐 Translate</button>
                                <button class="btn-summarize">📝 Summarize</button>
                            </div>
                            <div class="ai-chat" id="ai-chat"></div>
                        </div>
                    </div>
                </div>
                
                <div class="com-status">
                    <div class="status-item" id="ai-status">
                        <span class="status-icon">🤖</span>
                        <span class="status-text">AI Ready</span>
                    </div>
                    <div class="status-item" id="chat-status">
                        <span class="status-icon">💬</span>
                        <span class="status-text">Connected</span>
                    </div>
                </div>
            </div>
        `;
    }

    setupUIEvents() {
        // Tab switching
        document.querySelectorAll('.com-tab').forEach(tab => {
            tab.addEventListener('click', () => {
                const tabName = tab.dataset.tab;
                this.switchTab(tabName);
            });
        });

        // New meeting button
        document.querySelector('.btn-new-meeting').addEventListener('click', () => {
            this.startVideoCall();
        });

        // Join meeting button
        document.querySelector('.btn-join-meeting').addEventListener('click', () => {
            this.joinVideoCall();
        });

        // AI controls
        document.querySelector('.btn-voice-ai').addEventListener('click', () => {
            this.aiIntegration.toggleListening();
        });

        document.querySelector('.btn-translate').addEventListener('click', () => {
            this.showTranslationTool();
        });

        document.querySelector('.btn-summarize').addEventListener('click', () => {
            this.showSummarizationTool();
        });
    }

    async startVideoCall() {
        try {
            // Initialize media room if not already
            if (!this.mediaRoom) {
                this.mediaRoom = new MediaRoom();
                await this.mediaRoom.initialize();
            }

            // Create new meeting
            const roomId = await this.mediaRoom.createRoom();
            
            // Share meeting link
            const meetingLink = `${window.location.origin}/meet/${roomId}`;
            await navigator.clipboard.writeText(meetingLink);
            
            Notifications.success('Meeting created. Link copied to clipboard!');
            
            // Switch to meet tab
            this.switchTab('meet');
            
            // Update UI with meeting preview
            this.updateMeetingPreview(roomId);

        } catch (error) {
            console.error('Failed to start video call:', error);
            Notifications.error('Failed to start meeting');
        }
    }

    async joinVideoCall() {
        const roomId = prompt('Enter meeting ID or link:');
        if (!roomId) return;

        try {
            // Initialize media room if not already
            if (!this.mediaRoom) {
                this.mediaRoom = new MediaRoom();
                await this.mediaRoom.initialize();
            }

            // Join the meeting
            await this.mediaRoom.joinRoom(roomId);
            
            // Switch to meet tab
            this.switchTab('meet');

        } catch (error) {
            console.error('Failed to join video call:', error);
            Notifications.error('Failed to join meeting');
        }
    }

    async handleVoiceMessage(transcript) {
        const message = transcript.replace('send message', '').trim();
        if (message && this.chatSystem.currentRoom) {
            await this.chatSystem.sendMessage(message);
            Notifications.success('Message sent by voice command');
        }
    }

    async handleAIChatMessage(message) {
        const query = message.text.replace(/@ai|@assistant/g, '').trim();
        
        if (query) {
            try {
                const response = await this.aiIntegration.generateResponse(query);
                
                // Send AI response back to chat
                await this.chatSystem.sendMessage(`🤖 ${response}`);
                
            } catch (error) {
                console.error('AI chat response failed:', error);
                await this.chatSystem.sendMessage('Sorry, I encountered an error processing your request.');
            }
        }
    }

    async showTranslationTool() {
        const text = prompt('Enter text to translate:');
        if (!text) return;

        const targetLang = prompt('Enter target language (e.g., Spanish, French):');
        if (!targetLang) return;

        try {
            const translated = await this.aiIntegration.translateText(text, targetLang);
            
            const resultHtml = `
                <div class="translation-result">
                    <div class="original">
                        <strong>Original:</strong>
                        <p>${text}</p>
                    </div>
                    <div class="translated">
                        <strong>Translated (${targetLang}):</strong>
                        <p>${translated}</p>
                    </div>
                    <button class="btn-copy-translation">Copy Translation</button>
                </div>
            `;

            this.showModal('Translation Result', resultHtml, {
                onCopy: () => {
                    navigator.clipboard.writeText(translated);
                    Notifications.success('Translation copied to clipboard');
                }
            });

        } catch (error) {
            console.error('Translation failed:', error);
            Notifications.error('Translation failed');
        }
    }

    async showSummarizationTool() {
        const text = prompt('Enter text to summarize:');
        if (!text) return;

        try {
            const summary = await this.aiIntegration.summarizeText(text);
            
            const resultHtml = `
                <div class="summary-result">
                    <div class="original-length">
                        <strong>Original length:</strong> ${text.length} characters
                    </div>
                    <div class="summary">
                        <strong>Summary:</strong>
                        <p>${summary}</p>
                    </div>
                    <div class="summary-length">
                        <strong>Summary length:</strong> ${summary.length} characters
                    </div>
                    <button class="btn-copy-summary">Copy Summary</button>
                </div>
            `;

            this.showModal('Summary Result', resultHtml, {
                onCopy: () => {
                    navigator.clipboard.writeText(summary);
                    Notifications.success('Summary copied to clipboard');
                }
            });

        } catch (error) {
            console.error('Summarization failed:', error);
            Notifications.error('Summarization failed');
        }
    }

    switchTab(tabName) {
        // Update active tab
        document.querySelectorAll('.com-tab').forEach(tab => {
            tab.classList.toggle('active', tab.dataset.tab === tabName);
        });

        // Update active content
        document.querySelectorAll('.com-tab-content').forEach(content => {
            content.classList.toggle('active', content.id === `${tabName}-tab`);
        });

        // Initialize tab content if needed
        switch (tabName) {
            case 'chat':
                this.initializeChatTab();
                break;
            case 'meet':
                this.initializeMeetTab();
                break;
            case 'ai':
                this.initializeAITab();
                break;
        }
    }

    initializeChatTab() {
        // Ensure chat interface is loaded
        const chatInterface = document.querySelector('.chat-interface');
        if (chatInterface && chatInterface.children.length === 0) {
            // Load chat UI
        }
    }

    initializeMeetTab() {
        // Update meeting preview
        if (this.mediaRoom && this.mediaRoom.localStream) {
            this.updateMeetingPreview();
        }
    }

    initializeAITab() {
        // Initialize AI chat interface
        const aiChat = document.getElementById('ai-chat');
        if (aiChat && aiChat.children.length === 0) {
            // Load AI chat interface
        }
    }

    updateMeetingPreview(roomId = null) {
        const preview = document.getElementById('meet-preview');
        if (!preview) return;

        if (roomId) {
            preview.innerHTML = `
                <div class="meeting-active">
                    <div class="meeting-id">Meeting ID: ${roomId}</div>
                    <div class="meeting-link">
                        <input type="text" readonly value="${window.location.origin}/meet/${roomId}">
                        <button class="btn-copy-link">Copy</button>
                    </div>
                    <div class="meeting-controls">
                        <button class="btn-start-meeting">Start Meeting</button>
                        <button class="btn-cancel-meeting">Cancel</button>
                    </div>
                </div>
            `;

            // Add event listeners
            preview.querySelector('.btn-copy-link').addEventListener('click', () => {
                navigator.clipboard.writeText(`${window.location.origin}/meet/${roomId}`);
                Notifications.success('Meeting link copied');
            });

            preview.querySelector('.btn-start-meeting').addEventListener('click', () => {
                this.mediaRoom.startLocalPreview();
            });

            preview.querySelector('.btn-cancel-meeting').addEventListener('click', () => {
                this.mediaRoom.leaveRoom();
                preview.innerHTML = '<p>No active meeting</p>';
            });

        } else {
            preview.innerHTML = '<p>No active meeting</p>';
        }
    }

    async reconnectAll() {
        if (this.chatSystem && !this.chatSystem.connected) {
            await this.chatSystem.connect();
        }
    }

    generateUserId() {
        return `user_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`;
    }

    showModal(title, content, callbacks = {}) {
        // Modal implementation similar to previous examples
        const modal = document.createElement('div');
        modal.className = 'com-modal';
        modal.innerHTML = `
            <div class="modal-content">
                <div class="modal-header">
                    <h2>${title}</h2>
                    <button class="close-modal">&times;</button>
                </div>
                <div class="modal-body">
                    ${content}
                </div>
            </div>
        `;

        document.body.appendChild(modal);

        modal.querySelector('.close-modal').addEventListener('click', () => {
            document.body.removeChild(modal);
        });

        // Add callback buttons
        const copyBtn = modal.querySelector('.btn-copy-translation, .btn-copy-summary');
        if (copyBtn && callbacks.onCopy) {
            copyBtn.addEventListener('click', callbacks.onCopy);
        }
    }
}

// Initialize when page loads
document.addEventListener('DOMContentLoaded', async () => {
    window.communicationSystem = new UnifiedCommunicationSystem();
    
    try {
        await window.communicationSystem.initialize({
            name: localStorage.getItem('userName') || 'User',
            openaiApiKey: localStorage.getItem('openaiApiKey') // Store securely!
        });
        
        console.log('Unified communication system ready');
        
    } catch (error) {
        console.error('Failed to initialize communication system:', error);
    }
});
