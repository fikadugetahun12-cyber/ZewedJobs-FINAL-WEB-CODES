/**
 * Media Room System
 * Features:
 * - WebRTC video/audio calls
 * - Screen sharing
 * - Recording functionality
 * - Media device management
 * - Conference room controls
 */

class MediaRoom {
    constructor(config = {}) {
        this.config = {
            iceServers: [
                { urls: 'stun:stun.l.google.com:19302' },
                { urls: 'stun:global.stun.twilio.com:3478' }
            ],
            mediaConstraints: {
                audio: true,
                video: {
                    width: { ideal: 1280 },
                    height: { ideal: 720 },
                    frameRate: { ideal: 30 }
                }
            },
            ...config
        };

        this.peerConnections = new Map();
        this.localStream = null;
        this.screenStream = null;
        this.mediaRecorder = null;
        this.recordedChunks = [];
        this.isCallActive = false;
        this.isScreenSharing = false;
        this.roomId = null;
        this.participants = new Map();
        
        // WebSocket connection for signaling
        this.signaling = null;
    }

    async initialize(roomId = null) {
        try {
            // Generate or use provided room ID
            this.roomId = roomId || this.generateRoomId();
            
            // Request media permissions
            await this.requestMediaPermissions();
            
            // Initialize signaling connection
            await this.initializeSignaling();
            
            // Setup event handlers
            this.setupEventHandlers();
            
            // Start local video preview
            await this.startLocalPreview();
            
            Notifications.success(`Media room ${this.roomId} initialized`);
            
            return {
                success: true,
                roomId: this.roomId,
                localStream: this.localStream
            };

        } catch (error) {
            console.error('Media room initialization failed:', error);
            Notifications.error('Failed to initialize media room');
            throw error;
        }
    }

    async requestMediaPermissions() {
        try {
            // Check for media device availability
            const devices = await navigator.mediaDevices.enumerateDevices();
            const hasVideo = devices.some(device => device.kind === 'videoinput');
            const hasAudio = devices.some(device => device.kind === 'audioinput');

            if (!hasVideo && !hasAudio) {
                throw new Error('No media devices found');
            }

            // Request permissions
            const stream = await navigator.mediaDevices.getUserMedia({
                audio: hasAudio,
                video: hasVideo
            });

            this.localStream = stream;
            return stream;

        } catch (error) {
            console.error('Media permission error:', error);
            
            // Provide fallback options
            if (error.name === 'NotAllowedError') {
                throw new Error('Please allow camera and microphone access');
            } else if (error.name === 'NotFoundError') {
                throw new Error('No camera or microphone found');
            }
            
            throw error;
        }
    }

    async startLocalPreview() {
        if (!this.localStream) {
            throw new Error('No local stream available');
        }

        // Create video element for local preview
        const previewContainer = document.getElementById('local-video-container');
        if (!previewContainer) return;

        // Clear existing preview
        previewContainer.innerHTML = '';

        const videoElement = document.createElement('video');
        videoElement.id = 'local-video';
        videoElement.autoplay = true;
        videoElement.muted = true;
        videoElement.playsInline = true;
        videoElement.srcObject = this.localStream;

        // Add controls
        const controls = this.createMediaControls();
        previewContainer.appendChild(videoElement);
        previewContainer.appendChild(controls);

        return videoElement;
    }

    createMediaControls() {
        const controls = document.createElement('div');
        controls.className = 'media-controls';
        controls.innerHTML = `
            <button class="btn-mute-audio" title="Mute Audio">
                <i class="icon-mic"></i>
            </button>
            <button class="btn-mute-video" title="Mute Video">
                <i class="icon-camera"></i>
            </button>
            <button class="btn-screen-share" title="Share Screen">
                <i class="icon-screen-share"></i>
            </button>
            <button class="btn-record" title="Start Recording">
                <i class="icon-record"></i>
            </button>
            <button class="btn-settings" title="Settings">
                <i class="icon-settings"></i>
            </button>
        `;

        // Add event listeners
        controls.querySelector('.btn-mute-audio').addEventListener('click', () => this.toggleAudio());
        controls.querySelector('.btn-mute-video').addEventListener('click', () => this.toggleVideo());
        controls.querySelector('.btn-screen-share').addEventListener('click', () => this.toggleScreenShare());
        controls.querySelector('.btn-record').addEventListener('click', () => this.toggleRecording());
        controls.querySelector('.btn-settings').addEventListener('click', () => this.showSettings());

        return controls;
    }

    async toggleScreenShare() {
        try {
            if (this.isScreenSharing) {
                await this.stopScreenShare();
            } else {
                await this.startScreenShare();
            }
        } catch (error) {
            console.error('Screen share toggle failed:', error);
            Notifications.error('Failed to toggle screen sharing');
        }
    }

    async startScreenShare() {
        try {
            // Request screen capture
            this.screenStream = await navigator.mediaDevices.getDisplayMedia({
                video: {
                    cursor: 'always',
                    displaySurface: 'monitor'
                },
                audio: true
            });

            // Replace video track in peer connections
            const screenTrack = this.screenStream.getVideoTracks()[0];
            
            this.peerConnections.forEach(pc => {
                const sender = pc.getSenders().find(s => s.track?.kind === 'video');
                if (sender) {
                    sender.replaceTrack(screenTrack);
                }
            });

            // Update local preview
            const localVideo = document.getElementById('local-video');
            if (localVideo) {
                const stream = new MediaStream([screenTrack, ...this.localStream.getAudioTracks()]);
                localVideo.srcObject = stream;
            }

            this.isScreenSharing = true;
            Notifications.success('Screen sharing started');

            // Handle screen share stop
            screenTrack.onended = () => {
                this.stopScreenShare();
            };

        } catch (error) {
            if (error.name !== 'NotAllowedError') {
                console.error('Screen share failed:', error);
                Notifications.error('Failed to start screen sharing');
            }
            throw error;
        }
    }

    async stopScreenShare() {
        if (!this.screenStream) return;

        // Stop screen tracks
        this.screenStream.getTracks().forEach(track => track.stop());
        
        // Revert to camera video track
        const videoTrack = this.localStream?.getVideoTracks()[0];
        if (videoTrack) {
            this.peerConnections.forEach(pc => {
                const sender = pc.getSenders().find(s => s.track?.kind === 'video');
                if (sender) {
                    sender.replaceTrack(videoTrack);
                }
            });

            // Update local preview
            const localVideo = document.getElementById('local-video');
            if (localVideo && this.localStream) {
                localVideo.srcObject = this.localStream;
            }
        }

        this.screenStream = null;
        this.isScreenSharing = false;
        Notifications.success('Screen sharing stopped');
    }

    async toggleRecording() {
        if (this.mediaRecorder && this.mediaRecorder.state === 'recording') {
            await this.stopRecording();
        } else {
            await this.startRecording();
        }
    }

    async startRecording() {
        try {
            // Combine streams for recording
            const streams = [this.localStream];
            this.peerConnections.forEach(pc => {
                const remoteStream = pc.getRemoteStreams()[0];
                if (remoteStream) streams.push(remoteStream);
            });

            // Create mixed stream (simplified - in production use MediaStream API properly)
            const mixedStream = streams[0]; // Simplified
            
            this.mediaRecorder = new MediaRecorder(mixedStream, {
                mimeType: 'video/webm;codecs=vp9,opus'
            });

            this.recordedChunks = [];
            
            this.mediaRecorder.ondataavailable = (event) => {
                if (event.data.size > 0) {
                    this.recordedChunks.push(event.data);
                }
            };

            this.mediaRecorder.onstop = () => {
                this.saveRecording();
            };

            this.mediaRecorder.start(1000); // Collect data every second
            Notifications.success('Recording started');

        } catch (error) {
            console.error('Recording failed:', error);
            Notifications.error('Failed to start recording');
        }
    }

    async stopRecording() {
        if (this.mediaRecorder && this.mediaRecorder.state === 'recording') {
            this.mediaRecorder.stop();
            Notifications.success('Recording stopped');
        }
    }

    saveRecording() {
        const blob = new Blob(this.recordedChunks, {
            type: 'video/webm'
        });

        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `recording-${this.roomId}-${Date.now()}.webm`;
        a.click();

        URL.revokeObjectURL(url);
    }

    async joinRoom(roomId) {
        try {
            this.roomId = roomId;
            
            // Connect to signaling server
            await this.connectToSignaling();
            
            // Request to join room
            this.signaling.send(JSON.stringify({
                type: 'join',
                roomId: this.roomId,
                user: this.getUserInfo()
            }));

            Notifications.success(`Joining room: ${roomId}`);

        } catch (error) {
            console.error('Failed to join room:', error);
            Notifications.error('Failed to join room');
            throw error;
        }
    }

    async createRoom() {
        try {
            this.roomId = this.generateRoomId();
            
            // Connect to signaling server
            await this.connectToSignaling();
            
            // Request to create room
            this.signaling.send(JSON.stringify({
                type: 'create',
                roomId: this.roomId,
                user: this.getUserInfo()
            }));

            Notifications.success(`Room created: ${this.roomId}`);
            return this.roomId;

        } catch (error) {
            console.error('Failed to create room:', error);
            Notifications.error('Failed to create room');
            throw error;
        }
    }

    async leaveRoom() {
        // Notify peers
        this.peerConnections.forEach(pc => {
            pc.close();
        });
        this.peerConnections.clear();

        // Notify signaling server
        if (this.signaling) {
            this.signaling.send(JSON.stringify({
                type: 'leave',
                roomId: this.roomId
            }));
        }

        // Stop local media
        if (this.localStream) {
            this.localStream.getTracks().forEach(track => track.stop());
        }

        if (this.screenStream) {
            this.screenStream.getTracks().forEach(track => track.stop());
        }

        this.isCallActive = false;
        this.roomId = null;
        this.participants.clear();

        Notifications.success('Left the room');
    }

    async initializeSignaling() {
        // WebSocket signaling implementation
        const wsUrl = `wss://${window.location.host}/signaling`;
        this.signaling = new WebSocket(wsUrl);

        return new Promise((resolve, reject) => {
            this.signaling.onopen = () => {
                console.log('Signaling connection established');
                resolve();
            };

            this.signaling.onerror = (error) => {
                console.error('Signaling error:', error);
                reject(error);
            };
        });
    }

    setupEventHandlers() {
        // WebRTC event handlers
        this.signaling.onmessage = async (event) => {
            const message = JSON.parse(event.data);
            
            switch (message.type) {
                case 'offer':
                    await this.handleOffer(message);
                    break;
                case 'answer':
                    await this.handleAnswer(message);
                    break;
                case 'candidate':
                    await this.handleCandidate(message);
                    break;
                case 'join':
                    this.handleParticipantJoin(message);
                    break;
                case 'leave':
                    this.handleParticipantLeave(message);
                    break;
                case 'error':
                    Notifications.error(message.error);
                    break;
            }
        };

        // Window event handlers
        window.addEventListener('beforeunload', () => {
            this.leaveRoom();
        });
    }

    async handleOffer(message) {
        const pc = this.createPeerConnection(message.userId);
        
        await pc.setRemoteDescription(new RTCSessionDescription(message.offer));
        
        const answer = await pc.createAnswer();
        await pc.setLocalDescription(answer);
        
        this.signaling.send(JSON.stringify({
            type: 'answer',
            roomId: this.roomId,
            to: message.from,
            answer: answer
        }));
    }

    async handleAnswer(message) {
        const pc = this.peerConnections.get(message.from);
        if (pc) {
            await pc.setRemoteDescription(new RTCSessionDescription(message.answer));
        }
    }

    async handleCandidate(message) {
        const pc = this.peerConnections.get(message.from);
        if (pc) {
            await pc.addIceCandidate(new RTCIceCandidate(message.candidate));
        }
    }

    handleParticipantJoin(participant) {
        this.participants.set(participant.userId, participant);
        this.updateParticipantsUI();
        
        // Create peer connection for new participant
        this.createPeerConnection(participant.userId);
        
        Notifications.info(`${participant.name} joined the room`);
    }

    handleParticipantLeave(participant) {
        const pc = this.peerConnections.get(participant.userId);
        if (pc) {
            pc.close();
            this.peerConnections.delete(participant.userId);
        }
        
        this.participants.delete(participant.userId);
        this.updateParticipantsUI();
        
        Notifications.info(`${participant.name} left the room`);
    }

    createPeerConnection(userId) {
        const pc = new RTCPeerConnection({ iceServers: this.config.iceServers });
        
        // Add local stream tracks
        if (this.localStream) {
            this.localStream.getTracks().forEach(track => {
                pc.addTrack(track, this.localStream);
            });
        }

        // ICE candidate handler
        pc.onicecandidate = (event) => {
            if (event.candidate) {
                this.signaling.send(JSON.stringify({
                    type: 'candidate',
                    roomId: this.roomId,
                    to: userId,
                    candidate: event.candidate
                }));
            }
        };

        // Remote stream handler
        pc.ontrack = (event) => {
            this.addRemoteStream(userId, event.streams[0]);
        };

        // Connection state handlers
        pc.onconnectionstatechange = () => {
            console.log(`Connection state with ${userId}: ${pc.connectionState}`);
            
            if (pc.connectionState === 'connected') {
                Notifications.success(`Connected with ${userId}`);
            } else if (pc.connectionState === 'disconnected' || 
                       pc.connectionState === 'failed') {
                Notifications.warning(`Disconnected from ${userId}`);
            }
        };

        this.peerConnections.set(userId, pc);
        return pc;
    }

    addRemoteStream(userId, stream) {
        const remoteContainer = document.getElementById('remote-videos-container');
        if (!remoteContainer) return;

        // Check if video element already exists
        let videoElement = document.getElementById(`remote-video-${userId}`);
        if (!videoElement) {
            videoElement = document.createElement('video');
            videoElement.id = `remote-video-${userId}`;
            videoElement.autoplay = true;
            videoElement.playsInline = true;
            videoElement.className = 'remote-video';
            remoteContainer.appendChild(videoElement);
        }

        videoElement.srcObject = stream;
    }

    updateParticipantsUI() {
        const participantsList = document.getElementById('participants-list');
        if (!participantsList) return;

        participantsList.innerHTML = '';
        
        this.participants.forEach(participant => {
            const participantElement = document.createElement('div');
            participantElement.className = 'participant';
            participantElement.innerHTML = `
                <div class="participant-avatar">${participant.name.charAt(0)}</div>
                <div class="participant-info">
                    <div class="participant-name">${participant.name}</div>
                    <div class="participant-status">${participant.status || 'Online'}</div>
                </div>
            `;
            participantsList.appendChild(participantElement);
        });
    }

    toggleAudio() {
        if (!this.localStream) return;
        
        const audioTrack = this.localStream.getAudioTracks()[0];
        if (audioTrack) {
            audioTrack.enabled = !audioTrack.enabled;
            const btn = document.querySelector('.btn-mute-audio');
            btn.classList.toggle('muted', !audioTrack.enabled);
            btn.title = audioTrack.enabled ? 'Mute Audio' : 'Unmute Audio';
            
            Notifications.info(audioTrack.enabled ? 'Audio unmuted' : 'Audio muted');
        }
    }

    toggleVideo() {
        if (!this.localStream) return;
        
        const videoTrack = this.localStream.getVideoTracks()[0];
        if (videoTrack) {
            videoTrack.enabled = !videoTrack.enabled;
            const btn = document.querySelector('.btn-mute-video');
            btn.classList.toggle('muted', !videoTrack.enabled);
            btn.title = videoTrack.enabled ? 'Mute Video' : 'Unmute Video';
            
            Notifications.info(videoTrack.enabled ? 'Video unmuted' : 'Video muted');
        }
    }

    showSettings() {
        // Show media settings dialog
        const settings = this.getMediaDevices();
        
        const settingsHtml = `
            <div class="settings-dialog">
                <h3>Media Settings</h3>
                <div class="device-selection">
                    <label>Camera:</label>
                    <select id="camera-select">
                        ${settings.videoDevices.map(device => 
                            `<option value="${device.deviceId}">${device.label}</option>`
                        ).join('')}
                    </select>
                </div>
                <div class="device-selection">
                    <label>Microphone:</label>
                    <select id="microphone-select">
                        ${settings.audioDevices.map(device => 
                            `<option value="${device.deviceId}">${device.label}</option>`
                        ).join('')}
                    </select>
                </div>
                <div class="settings-buttons">
                    <button class="btn-apply">Apply</button>
                    <button class="btn-cancel">Cancel</button>
                </div>
            </div>
        `;

        // Show modal with settings
        this.showModal('Media Settings', settingsHtml, {
            onApply: () => this.applySettings(),
            onCancel: () => this.hideModal()
        });
    }

    async getMediaDevices() {
        const devices = await navigator.mediaDevices.enumerateDevices();
        
        return {
            videoDevices: devices.filter(d => d.kind === 'videoinput'),
            audioDevices: devices.filter(d => d.kind === 'audioinput')
        };
    }

    async applySettings() {
        const cameraSelect = document.getElementById('camera-select');
        const microphoneSelect = document.getElementById('microphone-select');

        try {
            const newStream = await navigator.mediaDevices.getUserMedia({
                video: {
                    deviceId: cameraSelect.value ? { exact: cameraSelect.value } : undefined
                },
                audio: {
                    deviceId: microphoneSelect.value ? { exact: microphoneSelect.value } : undefined
                }
            });

            // Replace tracks in existing stream
            const newVideoTrack = newStream.getVideoTracks()[0];
            const newAudioTrack = newStream.getAudioTracks()[0];

            if (this.localStream) {
                const oldVideoTrack = this.localStream.getVideoTracks()[0];
                const oldAudioTrack = this.localStream.getAudioTracks()[0];

                if (oldVideoTrack) oldVideoTrack.stop();
                if (oldAudioTrack) oldAudioTrack.stop();

                if (newVideoTrack) this.localStream.addTrack(newVideoTrack);
                if (newAudioTrack) this.localStream.addTrack(newAudioTrack);
            }

            // Update peer connections
            this.peerConnections.forEach(pc => {
                const videoSender = pc.getSenders().find(s => s.track?.kind === 'video');
                const audioSender = pc.getSenders().find(s => s.track?.kind === 'audio');

                if (videoSender && newVideoTrack) videoSender.replaceTrack(newVideoTrack);
                if (audioSender && newAudioTrack) audioSender.replaceTrack(newAudioTrack);
            });

            // Update local preview
            const localVideo = document.getElementById('local-video');
            if (localVideo && this.localStream) {
                localVideo.srcObject = this.localStream;
            }

            Notifications.success('Settings applied successfully');
            this.hideModal();

        } catch (error) {
            console.error('Failed to apply settings:', error);
            Notifications.error('Failed to apply settings');
        }
    }

    generateRoomId() {
        const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
        let result = '';
        for (let i = 0; i < 8; i++) {
            result += chars.charAt(Math.floor(Math.random() * chars.length));
        }
        return result;
    }

    getUserInfo() {
        return {
            userId: localStorage.getItem('userId') || `user_${Date.now()}`,
            name: localStorage.getItem('userName') || 'Anonymous',
            avatar: localStorage.getItem('userAvatar') || null
        };
    }

    showModal(title, content, callbacks = {}) {
        // Implementation for showing modal
        const modal = document.createElement('div');
        modal.className = 'media-modal';
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

        // Add event listeners
        modal.querySelector('.close-modal').addEventListener('click', () => {
            document.body.removeChild(modal);
            if (callbacks.onCancel) callbacks.onCancel();
        });

        const applyBtn = modal.querySelector('.btn-apply');
        if (applyBtn) {
            applyBtn.addEventListener('click', () => {
                if (callbacks.onApply) callbacks.onApply();
            });
        }
    }

    hideModal() {
        const modal = document.querySelector('.media-modal');
        if (modal) {
            document.body.removeChild(modal);
        }
    }
}

// Singleton instance
const MediaRoom = new MediaRoom();
export default MediaRoom;
