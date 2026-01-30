/**
 * Chat System
 * Features:
 * - Real-time messaging
 * - Group chats & private messages
 * - File sharing
 * - Typing indicators
 * - Message reactions
 * - Message search
 * - Chat rooms
 */

class ChatSystem {
    constructor(config = {}) {
        this.config = {
            websocketUrl: config.websocketUrl || 'wss://chat.example.com',
            reconnectAttempts: config.reconnectAttempts || 5,
            reconnectDelay: config.reconnectDelay || 3000,
            messageLimit: config.messageLimit || 1000,
            ...config
        };

        this.ws = null;
        this.connected = false;
        this.reconnectCount = 0;
        this.userId = null;
        this.userName = null;
        this.currentRoom = null;
        this.rooms = new Map();
        this.messages = new Map();
        this.typingUsers = new Map();
        this.unreadCounts = new Map();
        
        // File transfer
        this.fileTransfers = new Map();
        this.maxFileSize = 10 * 1024 * 1024; // 10MB
        
        // Message queue for when offline
        this.messageQueue = [];
        this.isOnline = navigator.onLine;
    }

    async initialize(userId, userName) {
        try {
            this.userId = userId || this.generateUserId();
            this.userName = userName || 'Anonymous';
            
            // Load saved data
            await this.loadSavedData();
            
            // Connect to WebSocket
            await this.connect();
            
            // Setup event listeners
            this.setupEventListeners();
            
            // Setup UI
            this.setupChatUI();
            
            Notifications.success('Chat system initialized');
            
            return {
                success: true,
                userId: this.userId,
                userName: this.userName
            };

        } catch (error) {
            console.error('Chat system initialization failed:', error);
            Notifications.error('Failed to initialize chat');
            throw error;
        }
    }

    async connect() {
        return new Promise((resolve, reject) => {
            this.ws = new WebSocket(this.config.websocketUrl);
            
            this.ws.onopen = () => {
                this.connected = true;
                this.reconnectCount = 0;
                
                // Send authentication
                this.send({
                    type: 'auth',
                    userId: this.userId,
                    userName: this.userName
                });
                
                // Process queued messages
                this.processMessageQueue();
                
                Notifications.success('Connected to chat server');
                resolve();
            };
            
            this.ws.onerror = (error) => {
                console.error('WebSocket error:', error);
                reject(error);
            };
            
            this.ws.onclose = () => {
                this.connected = false;
                this.handleDisconnection();
            };
            
            this.ws.onmessage = (event) => {
                this.handleMessage(event);
            };
        });
    }

    handleDisconnection() {
        Notifications.warning('Disconnected from chat server');
        
        // Attempt reconnection
        if (this.reconnectCount < this.config.reconnectAttempts) {
            this.reconnectCount++;
            const delay = this.config.reconnectDelay * this.reconnectCount;
            
            Notifications.info(`Reconnecting in ${delay / 1000} seconds...`);
            
            setTimeout(() => {
                this.connect().catch(() => {
                    // Reconnection will be attempted again by onclose
                });
            }, delay);
        } else {
            Notifications.error('Failed to reconnect. Please refresh the page.');
        }
    }

    async loadSavedData() {
        try {
            // Load rooms
            const savedRooms = localStorage.getItem('chat_rooms');
            if (savedRooms) {
                const rooms = JSON.parse(savedRooms);
                rooms.forEach(room => this.rooms.set(room.id, room));
            }
            
            // Load messages for each room
            this.rooms.forEach(room => {
                const savedMessages = localStorage.getItem(`chat_messages_${room.id}`);
                if (savedMessages) {
                    const messages = JSON.parse(savedMessages);
                    this.messages.set(room.id, messages);
                }
            });
            
        } catch (error) {
            console.warn('Failed to load saved chat data:', error);
        }
    }

    saveData() {
        try {
            // Save rooms
            const rooms = Array.from(this.rooms.values());
            localStorage.setItem('chat_rooms', JSON.stringify(rooms));
            
            // Save messages for each room
            this.messages.forEach((messages, roomId) => {
                localStorage.setItem(`chat_messages_${roomId}`, JSON.stringify(messages));
            });
            
        } catch (error) {
            console.warn('Failed to save chat data:', error);
        }
    }

    setupEventListeners() {
        // Online/offline detection
        window.addEventListener('online', () => {
            this.isOnline = true;
            Notifications.success('You are back online');
            this.processMessageQueue();
        });
        
        window.addEventListener('offline', () => {
            this.isOnline = false;
            Notifications.warning('You are offline. Messages will be queued.');
        });
        
        // Before page unload
        window.addEventListener('beforeunload', () => {
            this.leaveAllRooms();
            this.saveData();
        });
    }

    setupChatUI() {
        // Create chat container if it doesn't exist
        if (!document.getElementById('chat-container')) {
            const chatContainer = document.createElement('div');
            chatContainer.id = 'chat-container';
            chatContainer.innerHTML = this.getChatHTML();
            document.body.appendChild(chatContainer);
            
            // Add event listeners to UI elements
            this.setupChatUIEvents();
        }
    }

    getChatHTML() {
        return `
            <div class="chat-widget">
                <div class="chat-header">
                    <div class="chat-title">Chat</div>
                    <div class="chat-actions">
                        <button class="btn-new-chat" title="New Chat">+</button>
                        <button class="btn-chat-settings" title="Settings">⚙️</button>
                        <button class="btn-minimize" title="Minimize">−</button>
                        <button class="btn-close" title="Close">×</button>
                    </div>
                </div>
                
                <div class="chat-body">
                    <div class="sidebar">
                        <div class="search-box">
                            <input type="text" placeholder="Search chats..." id="chat-search">
                        </div>
                        <div class="rooms-list" id="rooms-list"></div>
                    </div>
                    
                    <div class="main-chat">
                        <div class="chat-room-header" id="chat-room-header">
                            <div class="room-info">
                                <div class="room-name">Select a chat</div>
                                <div class="room-status" id="room-status"></div>
                            </div>
                            <div class="room-actions">
                                <button class="btn-room-info" title="Room Info">ℹ️</button>
                                <button class="btn-call" title="Start Call">📞</button>
                            </div>
                        </div>
                        
                        <div class="messages-container" id="messages-container">
                            <div class="messages" id="messages"></div>
                            <div class="typing-indicator" id="typing-indicator"></div>
                        </div>
                        
                        <div class="message-input-area">
                            <div class="input-tools">
                                <button class="btn-emoji" title="Emoji">😊</button>
                                <button class="btn-attach" title="Attach File">📎</button>
                                <button class="btn-format" title="Format">A</button>
                            </div>
                            <div class="message-input-wrapper">
                                <textarea 
                                    id="message-input" 
                                    placeholder="Type a message..."
                                    rows="1"
                                ></textarea>
                                <button class="btn-send" id="send-message">Send</button>
                            </div>
                        </div>
                    </div>
                </div>
                
                <div class="chat-footer">
                    <div class="connection-status" id="connection-status">
                        <span class="status-indicator online"></span>
                        <span class="status-text">Connected</span>
                    </div>
                </div>
            </div>
        `;
    }

    setupChatUIEvents() {
        // Message input
        const messageInput = document.getElementById('message-input');
        const sendButton = document.getElementById('send-message');
        
        const sendMessage = () => {
            const text = messageInput.value.trim();
            if (!text) return;
            
            this.sendMessage(text);
            messageInput.value = '';
            this.adjustTextareaHeight(messageInput);
        };
        
        messageInput.addEventListener('input', () => {
            this.adjustTextareaHeight(messageInput);
            this.sendTypingIndicator();
        });
        
        messageInput.addEventListener('keydown', (event) => {
            if (event.key === 'Enter' && !event.shiftKey) {
                event.preventDefault();
                sendMessage();
            }
        });
        
        sendButton.addEventListener('click', sendMessage);
        
        // Emoji picker
        document.querySelector('.btn-emoji').addEventListener('click', () => {
            this.showEmojiPicker();
        });
        
        // File attachment
        document.querySelector('.btn-attach').addEventListener('click', () => {
            this.openFilePicker();
        });
        
        // Room list interactions
        document.querySelector('.btn-new-chat').addEventListener('click', () => {
            this.showNewChatDialog();
        });
        
        // Search
        document.getElementById('chat-search').addEventListener('input', (event) => {
            this.filterRooms(event.target.value);
        });
        
        // Update connection status
        this.updateConnectionStatus();
    }

    updateConnectionStatus() {
        const statusElement = document.getElementById('connection-status');
        if (!statusElement) return;
        
        const indicator = statusElement.querySelector('.status-indicator');
        const text = statusElement.querySelector('.status-text');
        
        if (this.connected) {
            indicator.className = 'status-indicator online';
            text.textContent = 'Connected';
        } else {
            indicator.className = 'status-indicator offline';
            text.textContent = 'Disconnected';
        }
    }

    async sendMessage(text, roomId = null) {
        const targetRoom = roomId || this.currentRoom;
        if (!targetRoom) {
            Notifications.warning('Please select a chat room first');
            return;
        }
        
        const message = {
            id: this.generateMessageId(),
            roomId: targetRoom,
            userId: this.userId,
            userName: this.userName,
            text: text,
            timestamp: Date.now(),
            status: 'sending'
        };
        
        // Add to local messages
        this.addMessageToRoom(targetRoom, message);
        
        // Send via WebSocket
        if (this.connected) {
            this.send({
                type: 'message',
                message: message
            });
        } else {
            // Queue for later
            this.messageQueue.push(message);
            Notifications.info('Message queued (offline)');
        }
    }

    async sendFile(file, roomId = null) {
        const targetRoom = roomId || this.currentRoom;
        if (!targetRoom) {
            Notifications.warning('Please select a chat room first');
            return;
        }
        
        // Check file size
        if (file.size > this.maxFileSize) {
            Notifications.error(`File too large. Maximum size is ${this.formatFileSize(this.maxFileSize)}`);
            return;
        }
        
        // Create file transfer record
        const transferId = this.generateTransferId();
        const fileMessage = {
            id: this.generateMessageId(),
            roomId: targetRoom,
            userId: this.userId,
            userName: this.userName,
            type: 'file',
            fileName: file.name,
            fileSize: file.size,
            fileType: file.type,
            transferId: transferId,
            timestamp: Date.now(),
            status: 'uploading'
        };
        
        // Add to local messages
        this.addMessageToRoom(targetRoom, fileMessage);
        
        // Create FormData for upload
        const formData = new FormData();
        formData.append('file', file);
        formData.append('transferId', transferId);
        formData.append('roomId', targetRoom);
        formData.append('userId', this.userId);
        
        try {
            // Upload file
            const response = await fetch('/api/chat/upload-file', {
                method: 'POST',
                body: formData
            });
            
            if (response.ok) {
                const result = await response.json();
                
                // Update message with file URL
                fileMessage.status = 'sent';
                fileMessage.fileUrl = result.fileUrl;
                fileMessage.thumbnailUrl = result.thumbnailUrl;
                
                // Update in UI
                this.updateMessage(fileMessage);
                
                // Send via WebSocket
                this.send({
                    type: 'file',
                    message: fileMessage
                });
                
            } else {
                throw new Error('Upload failed');
            }
            
        } catch (error) {
            console.error('File upload failed:', error);
            fileMessage.status = 'failed';
            this.updateMessage(fileMessage);
            Notifications.error('Failed to upload file');
        }
    }

    async joinRoom(roomId, roomName = null) {
        if (this.currentRoom === roomId) return;
        
        // Leave current room if any
        if (this.currentRoom) {
            this.leaveRoom(this.currentRoom);
        }
        
        // Join new room
        this.currentRoom = roomId;
        
        // Send join request
        this.send({
            type: 'join',
            roomId: roomId,
            userName: this.userName
        });
        
        // Update UI
        this.updateRoomUI(roomId, roomName);
        
        // Load messages for this room
        await this.loadRoomMessages(roomId);
        
        // Mark as read
        this.markRoomAsRead(roomId);
        
        Notifications.success(`Joined room: ${roomName || roomId}`);
    }

    async createRoom(roomName, isPrivate = false, participants = []) {
        const roomId = this.generateRoomId();
        
        const room = {
            id: roomId,
            name: roomName,
            type: isPrivate ? 'private' : 'group',
            createdBy: this.userId,
            createdAt: Date.now(),
            participants: [this.userId, ...participants],
            unreadCount: 0
        };
        
        // Add to local rooms
        this.rooms.set(roomId, room);
        
        // Join the room
        await this.joinRoom(roomId, roomName);
        
        // Send room creation to server
        this.send({
            type: 'create_room',
            room: room
        });
        
        return room;
    }

    leaveRoom(roomId) {
        if (!roomId) return;
        
        // Send leave request
        this.send({
            type: 'leave',
            roomId: roomId
        });
        
        // Update UI
        const roomElement = document.querySelector(`[data-room-id="${roomId}"]`);
        if (roomElement) {
            roomElement.remove();
        }
        
        // Clear current room if leaving active room
        if (this.currentRoom === roomId) {
            this.currentRoom = null;
            this.clearMessagesUI();
        }
        
        // Remove from local rooms if it's a temporary room
        const room = this.rooms.get(roomId);
        if (room && room.type === 'temporary') {
            this.rooms.delete(roomId);
            this.messages.delete(roomId);
        }
    }

    leaveAllRooms() {
        this.rooms.forEach((room, roomId) => {
            if (room.participants.includes(this.userId)) {
                this.send({
                    type: 'leave',
                    roomId: roomId
                });
            }
        });
        
        this.currentRoom = null;
        this.rooms.clear();
        this.messages.clear();
    }

    handleMessage(event) {
        try {
            const data = JSON.parse(event.data);
            
            switch (data.type) {
                case 'message':
                    this.handleIncomingMessage(data.message);
                    break;
                    
                case 'file':
                    this.handleIncomingFile(data.message);
                    break;
                    
                case 'typing':
                    this.handleTypingIndicator(data);
                    break;
                    
                case 'room_update':
                    this.handleRoomUpdate(data.room);
                    break;
                    
                case 'user_joined':
                    this.handleUserJoined(data);
                    break;
                    
                case 'user_left':
                    this.handleUserLeft(data);
                    break;
                    
                case 'message_read':
                    this.handleMessageRead(data);
                    break;
                    
                case 'error':
                    Notifications.error(data.message);
                    break;
                    
                case 'ping':
                    this.send({ type: 'pong' });
                    break;
            }
            
        } catch (error) {
            console.error('Failed to parse message:', error);
        }
    }

    handleIncomingMessage(message) {
        // Ignore own messages (they're already displayed)
        if (message.userId === this.userId) {
            // Update status to delivered
            this.updateMessageStatus(message.id, 'delivered');
            return;
        }
        
        // Add to room messages
        this.addMessageToRoom(message.roomId, message);
        
        // Update UI if this is the current room
        if (this.currentRoom === message.roomId) {
            this.displayMessage(message);
            this.markMessageAsRead(message.id);
        } else {
            // Increment unread count
            this.incrementUnreadCount(message.roomId);
            Notifications.info(`New message from ${message.userName} in ${this.getRoomName(message.roomId)}`);
        }
    }

    handleIncomingFile(fileMessage) {
        // Similar to incoming message but with file
        this.handleIncomingMessage(fileMessage);
    }

    handleTypingIndicator(data) {
        const { roomId, userId, userName, isTyping } = data;
        
        if (roomId !== this.currentRoom) return;
        
        if (isTyping) {
            this.typingUsers.set(userId, { userName, timeout: null });
        } else {
            this.typingUsers.delete(userId);
        }
        
        this.updateTypingIndicator();
    }

    sendTypingIndicator() {
        if (!this.currentRoom || !this.connected) return;
        
        // Send typing start
        this.send({
            type: 'typing',
            roomId: this.currentRoom,
            isTyping: true
        });
        
        // Clear previous timeout
        if (this.typingTimeout) {
            clearTimeout(this.typingTimeout);
        }
        
        // Set timeout to send typing stop
        this.typingTimeout = setTimeout(() => {
            this.send({
                type: 'typing',
                roomId: this.currentRoom,
                isTyping: false
            });
        }, 2000);
    }

    updateTypingIndicator() {
        const indicator = document.getElementById('typing-indicator');
        if (!indicator) return;
        
        if (this.typingUsers.size === 0) {
            indicator.style.display = 'none';
            return;
        }
        
        const typingUsers = Array.from(this.typingUsers.values());
        let text = '';
        
        if (typingUsers.length === 1) {
            text = `${typingUsers[0].userName} is typing...`;
        } else if (typingUsers.length === 2) {
            text = `${typingUsers[0].userName} and ${typingUsers[1].userName} are typing...`;
        } else {
            text = `${typingUsers.length} people are typing...`;
        }
        
        indicator.innerHTML = `
            <div class="typing-dots">
                <span></span><span></span><span></span>
            </div>
            <div class="typing-text">${text}</div>
        `;
        indicator.style.display = 'block';
    }

    addMessageToRoom(roomId, message) {
        if (!this.messages.has(roomId)) {
            this.messages.set(roomId, []);
        }
        
        const roomMessages = this.messages.get(roomId);
        roomMessages.push(message);
        
        // Limit messages per room
        if (roomMessages.length > this.config.messageLimit) {
            roomMessages.splice(0, roomMessages.length - this.config.messageLimit);
        }
        
        // Save to localStorage
        this.saveData();
    }

    async loadRoomMessages(roomId) {
        // Clear current messages UI
        this.clearMessagesUI();
        
        // Get messages for this room
        const messages = this.messages.get(roomId) || [];
        
        // Display messages
        messages.forEach(message => {
            this.displayMessage(message);
        });
        
        // Scroll to bottom
        this.scrollToBottom();
    }

    displayMessage(message) {
        const messagesContainer = document.getElementById('messages');
        if (!messagesContainer) return;
        
        const messageElement = this.createMessageElement(message);
        messagesContainer.appendChild(messageElement);
        
        // Scroll to bottom if this is the latest message
        if (message.id === this.getLatestMessageId(message.roomId)) {
            this.scrollToBottom();
        }
    }

    createMessageElement(message) {
        const isOwn = message.userId === this.userId;
        const element = document.createElement('div');
        element.className = `message ${isOwn ? 'own' : 'other'}`;
        element.dataset.messageId = message.id;
        
        let content = '';
        
        if (message.type === 'file') {
            content = this.createFileMessageContent(message);
        } else {
            content = this.createTextMessageContent(message);
        }
        
        element.innerHTML = `
            <div class="message-header">
                <span class="message-sender">${message.userName}</span>
                <span class="message-time">${this.formatTime(message.timestamp)}</span>
                ${isOwn ? `<span class="message-status ${message.status}"></span>` : ''}
            </div>
            <div class="message-content">
                ${content}
            </div>
            <div class="message-footer">
                <button class="btn-react" title="React">😊</button>
                <button class="btn-reply" title="Reply">↩️</button>
                <button class="btn-more" title="More">⋯</button>
            </div>
        `;
        
        // Add event listeners
        this.addMessageEventListeners(element, message);
        
        return element;
    }

    createTextMessageContent(message) {
        // Format text (emojis, links, etc.)
        let text = this.formatMessageText(message.text);
        
        // Add reactions if any
        if (message.reactions && message.reactions.length > 0) {
            const reactions = message.reactions.map(r => `${r.emoji} ${r.count}`).join(' ');
            text += `<div class="message-reactions">${reactions}</div>`;
        }
        
        return `<div class="message-text">${text}</div>`;
    }

    createFileMessageContent(message) {
        const fileSize = this.formatFileSize(message.fileSize);
        
        let preview = '';
        if (message.thumbnailUrl) {
            preview = `<img src="${message.thumbnailUrl}" class="file-thumbnail">`;
        } else if (message.fileType.startsWith('image/')) {
            preview = `<div class="file-icon">🖼️</div>`;
        } else if (message.fileType.startsWith('video/')) {
            preview = `<div class="file-icon">🎬</div>`;
        } else if (message.fileType.includes('pdf')) {
            preview = `<div class="file-icon">📄</div>`;
        } else {
            preview = `<div class="file-icon">📎</div>`;
        }
        
        return `
            <div class="file-message">
                ${preview}
                <div class="file-info">
                    <div class="file-name">${message.fileName}</div>
                    <div class="file-size">${fileSize}</div>
                </div>
                <a href="${message.fileUrl}" download="${message.fileName}" class="btn-download">Download</a>
            </div>
        `;
    }

    formatMessageText(text) {
        // Convert URLs to links
        text = text.replace(
            /(https?:\/\/[^\s]+)/g,
            '<a href="$1" target="_blank">$1</a>'
        );
        
        // Convert newlines to <br>
        text = text.replace(/\n/g, '<br>');
        
        // Simple markdown-like formatting
        text = text.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
        text = text.replace(/\*(.*?)\*/g, '<em>$1</em>');
        text = text.replace(/`(.*?)`/g, '<code>$1</code>');
        
        return text;
    }

    addMessageEventListeners(element, message) {
        // Reaction button
        element.querySelector('.btn-react').addEventListener('click', () => {
            this.showReactionPicker(message.id);
        });
        
        // Reply button
        element.querySelector('.btn-reply').addEventListener('click', () => {
            this.replyToMessage(message);
        });
        
        // More options button
        element.querySelector('.btn-more').addEventListener('click', (event) => {
            this.showMessageOptions(event, message);
        });
        
        // Click on message to select
        element.addEventListener('click', (event) => {
            if (!event.target.closest('button')) {
                this.selectMessage(message.id);
            }
        });
    }

    showReactionPicker(messageId) {
        const reactions = ['👍', '❤️', '😂', '😮', '😢', '😡'];
        const picker = document.createElement('div');
        picker.className = 'reaction-picker';
        picker.innerHTML = reactions.map(emoji => 
            `<button class="reaction-emoji" data-emoji="${emoji}">${emoji}</button>`
        ).join('');
        
        // Position near the reaction button
        // Add to DOM and show
        
        // Add event listeners
        picker.querySelectorAll('.reaction-emoji').forEach(button => {
            button.addEventListener('click', () => {
                this.addReaction(messageId, button.dataset.emoji);
                picker.remove();
            });
        });
        
        // Close on click outside
        setTimeout(() => {
            document.addEventListener('click', function closePicker(event) {
                if (!picker.contains(event.target)) {
                    picker.remove();
                    document.removeEventListener('click', closePicker);
                }
            });
        });
    }

    async addReaction(messageId, emoji) {
        this.send({
            type: 'reaction',
            messageId: messageId,
            emoji: emoji,
            roomId: this.currentRoom
        });
    }

    replyToMessage(message) {
        const input = document.getElementById('message-input');
        input.value = `> ${message.userName}: ${message.text}\n\n`;
        input.focus();
        this.adjustTextareaHeight(input);
    }

    showMessageOptions(event, message) {
        // Show context menu with options
        const menu = document.createElement('div');
        menu.className = 'message-context-menu';
        menu.innerHTML = `
            <button class="menu-item" data-action="edit">Edit</button>
            <button class="menu-item" data-action="delete">Delete</button>
            <button class="menu-item" data-action="copy">Copy Text</button>
            <button class="menu-item" data-action="forward">Forward</button>
            <button class="menu-item" data-action="report">Report</button>
        `;
        
        // Position near the button
        menu.style.top = `${event.clientY}px`;
        menu.style.left = `${event.clientX}px`;
        document.body.appendChild(menu);
        
        // Add event listeners
        menu.querySelectorAll('.menu-item').forEach(button => {
            button.addEventListener('click', () => {
                this.handleMessageAction(message.id, button.dataset.action);
                menu.remove();
            });
        });
        
        // Close on click outside
        setTimeout(() => {
            document.addEventListener('click', function closeMenu(event) {
                if (!menu.contains(event.target)) {
                    menu.remove();
                    document.removeEventListener('click', closeMenu);
                }
            });
        });
    }

    handleMessageAction(messageId, action) {
        switch (action) {
            case 'edit':
                this.editMessage(messageId);
                break;
            case 'delete':
                this.deleteMessage(messageId);
                break;
            case 'copy':
                this.copyMessageText(messageId);
                break;
            case 'forward':
                this.forwardMessage(messageId);
                break;
            case 'report':
                this.reportMessage(messageId);
                break;
        }
    }

    async editMessage(messageId) {
        const message = this.findMessage(messageId);
        if (!message || message.userId !== this.userId) return;
        
        const messageElement = document.querySelector(`[data-message-id="${messageId}"]`);
        if (!messageElement) return;
        
        // Replace message content with input
        const contentDiv = messageElement.querySelector('.message-content');
        const originalContent = contentDiv.innerHTML;
        
        contentDiv.innerHTML = `
            <textarea class="edit-input">${message.text}</textarea>
            <div class="edit-buttons">
                <button class="btn-save-edit">Save</button>
                <button class="btn-cancel-edit">Cancel</button>
            </div>
        `;
        
        const textarea = contentDiv.querySelector('.edit-input');
        textarea.focus();
        textarea.select();
        
        contentDiv.querySelector('.btn-save-edit').addEventListener('click', () => {
            const newText = textarea.value.trim();
            if (newText && newText !== message.text) {
                this.updateMessageText(messageId, newText);
            }
            contentDiv.innerHTML = originalContent;
        });
        
        contentDiv.querySelector('.btn-cancel-edit').addEventListener('click', () => {
            contentDiv.innerHTML = originalContent;
        });
    }

    async deleteMessage(messageId) {
        if (!confirm('Delete this message?')) return;
        
        this.send({
            type: 'delete',
            messageId: messageId,
            roomId: this.currentRoom
        });
        
        // Remove from UI immediately
        const messageElement = document.querySelector(`[data-message-id="${messageId}"]`);
        if (messageElement) {
            messageElement.remove();
        }
    }

    copyMessageText(messageId) {
        const message = this.findMessage(messageId);
        if (message) {
            navigator.clipboard.writeText(message.text)
                .then(() => Notifications.success('Copied to clipboard'))
                .catch(() => Notifications.error('Failed to copy'));
        }
    }

    forwardMessage(messageId) {
        const message = this.findMessage(messageId);
        if (!message) return;
        
        // Show room selection dialog
        this.showForwardDialog(message);
    }

    reportMessage(messageId) {
        const message = this.findMessage(messageId);
        if (!message) return;
        
        const reason = prompt('Please enter the reason for reporting this message:');
        if (reason) {
            this.send({
                type: 'report',
                messageId: messageId,
                reason: reason,
                roomId: this.currentRoom
            });
            Notifications.success('Message reported');
        }
    }

    findMessage(messageId) {
        for (const [roomId, messages] of this.messages) {
            const message = messages.find(m => m.id === messageId);
            if (message) return message;
        }
        return null;
    }

    updateMessageText(messageId, newText) {
        this.send({
            type: 'edit',
            messageId: messageId,
            text: newText,
            roomId: this.currentRoom
        });
        
        // Update locally
        const message = this.findMessage(messageId);
        if (message) {
            message.text = newText;
            message.edited = true;
            message.editTimestamp = Date.now();
            
            // Update UI
            this.updateMessageElement(message);
        }
    }

    updateMessageElement(message) {
        const element = document.querySelector(`[data-message-id="${message.id}"]`);
        if (element) {
            const newElement = this.createMessageElement(message);
            element.replaceWith(newElement);
        }
    }

    updateMessageStatus(messageId, status) {
        const element = document.querySelector(`[data-message-id="${messageId}"] .message-status`);
        if (element) {
            element.className = `message-status ${status}`;
        }
        
        // Update in local storage
        const message = this.findMessage(messageId);
        if (message) {
            message.status = status;
            this.saveData();
        }
    }

    markMessageAsRead(messageId) {
        this.send({
            type: 'read',
            messageId: messageId,
            roomId: this.currentRoom
        });
    }

    markRoomAsRead(roomId) {
        this.unreadCounts.set(roomId, 0);
        this.updateRoomUnreadCount(roomId, 0);
    }

    incrementUnreadCount(roomId) {
        const current = this.unreadCounts.get(roomId) || 0;
        this.unreadCounts.set(roomId, current + 1);
        this.updateRoomUnreadCount(roomId, current + 1);
    }

    updateRoomUnreadCount(roomId, count) {
        const roomElement = document.querySelector(`[data-room-id="${roomId}"] .unread-count`);
        if (roomElement) {
            if (count > 0) {
                roomElement.textContent = count;
                roomElement.style.display = 'inline';
            } else {
                roomElement.style.display = 'none';
            }
        }
    }

    processMessageQueue() {
        if (!this.connected || this.messageQueue.length === 0) return;
        
        while (this.messageQueue.length > 0) {
            const message = this.messageQueue.shift();
            this.send({
                type: 'message',
                message: message
            });
        }
        
        Notifications.success('Queued messages sent');
    }

    adjustTextareaHeight(textarea) {
        textarea.style.height = 'auto';
        textarea.style.height = Math.min(textarea.scrollHeight, 120) + 'px';
    }

    scrollToBottom() {
        const messagesContainer = document.getElementById('messages-container');
        if (messagesContainer) {
            messagesContainer.scrollTop = messagesContainer.scrollHeight;
        }
    }

    clearMessagesUI() {
        const messagesContainer = document.getElementById('messages');
        if (messagesContainer) {
            messagesContainer.innerHTML = '';
        }
    }

    updateRoomUI(roomId, roomName) {
        const roomHeader = document.getElementById('chat-room-header');
        if (roomHeader) {
            roomHeader.querySelector('.room-name').textContent = roomName || roomId;
        }
    }

    filterRooms(searchTerm) {
        const roomsList = document.getElementById('rooms-list');
        if (!roomsList) return;
        
        const roomElements = roomsList.querySelectorAll('.room-item');
        roomElements.forEach(element => {
            const roomName = element.querySelector('.room-name').textContent;
            const matches = roomName.toLowerCase().includes(searchTerm.toLowerCase());
            element.style.display = matches ? 'flex' : 'none';
        });
    }

    showNewChatDialog() {
        const dialogHtml = `
            <div class="new-chat-dialog">
                <h3>New Chat</h3>
                <div class="dialog-content">
                    <div class="input-group">
                        <label>Chat Name:</label>
                        <input type="text" id="new-chat-name" placeholder="Enter chat name">
                    </div>
                    <div class="input-group">
                        <label>Chat Type:</label>
                        <select id="new-chat-type">
                            <option value="group">Group Chat</option>
                            <option value="private">Private Chat</option>
                        </select>
                    </div>
                    <div class="input-group" id="participants-section">
                        <label>Add Participants:</label>
                        <input type="text" id="participant-search" placeholder="Search users...">
                        <div class="participants-list" id="available-participants"></div>
                    </div>
                    <div class="dialog-buttons">
                        <button class="btn-create">Create</button>
                        <button class="btn-cancel">Cancel</button>
                    </div>
                </div>
            </div>
        `;
        
        // Show modal
        this.showModal('New Chat', dialogHtml, {
            onCreate: () => this.createNewChat(),
            onCancel: () => this.hideModal()
        });
    }

    async createNewChat() {
        const nameInput = document.getElementById('new-chat-name');
        const typeSelect = document.getElementById('new-chat-type');
        
        const name = nameInput.value.trim();
        if (!name) {
            Notifications.warning('Please enter a chat name');
            return;
        }
        
        await this.createRoom(name, typeSelect.value === 'private');
        this.hideModal();
    }

    showEmojiPicker() {
        // Implementation for emoji picker
        // Could use an emoji library or native picker
        const emojis = ['😀', '😂', '🥰', '😎', '🤔', '😴', '🥳', '😭', '😡', '🤯'];
        
        const picker = document.createElement('div');
        picker.className = 'emoji-picker';
        picker.innerHTML = emojis.map(emoji => 
            `<button class="emoji-btn">${emoji}</button>`
        ).join('');
        
        // Position and show picker
        // Add event listeners
    }

    openFilePicker() {
        const input = document.createElement('input');
        input.type = 'file';
        input.multiple = true;
        input.accept = 'image/*,video/*,audio/*,.pdf,.doc,.docx,.txt';
        
        input.addEventListener('change', (event) => {
            const files = Array.from(event.target.files);
            files.forEach(file => {
                this.sendFile(file);
            });
        });
        
        input.click();
    }

    formatTime(timestamp) {
        const date = new Date(timestamp);
        return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    }

    formatFileSize(bytes) {
        const sizes = ['B', 'KB', 'MB', 'GB'];
        if (bytes === 0) return '0 B';
        const i = Math.floor(Math.log(bytes) / Math.log(1024));
        return Math.round(bytes / Math.pow(1024, i) * 100) / 100 + ' ' + sizes[i];
    }

    generateMessageId() {
        return `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    }

    generateRoomId() {
        return `room_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`;
    }

    generateUserId() {
        return `user_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`;
    }

    generateTransferId() {
        return `transfer_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    }

    getRoomName(roomId) {
        const room = this.rooms.get(roomId);
        return room ? room.name : roomId;
    }

    getLatestMessageId(roomId) {
        const messages = this.messages.get(roomId);
        if (!messages || messages.length === 0) return null;
        return messages[messages.length - 1].id;
    }

    send(data) {
        if (this.connected && this.ws) {
            this.ws.send(JSON.stringify(data));
        }
    }

    showModal(title, content, callbacks = {}) {
        // Similar to previous modal implementation
        const modal = document.createElement('div');
        modal.className = 'chat-modal';
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
            if (callbacks.onCancel) callbacks.onCancel();
        });

        const createBtn = modal.querySelector('.btn-create');
        if (createBtn) {
            createBtn.addEventListener('click', () => {
                if (callbacks.onCreate) callbacks.onCreate();
            });
        }
    }

    hideModal() {
        const modal = document.querySelector('.chat-modal');
        if (modal) {
            document.body.removeChild(modal);
        }
    }
}

// Singleton instance
const ChatSystem = new ChatSystem();
export default ChatSystem;
