import Config from './config-loader.js';
import API from './api.js';
import Translator from './translator.js';
import Notifications from './notifications.js';

class Application {
    constructor() {
        this.config = Config;
        this.initialized = false;
    }

    async initialize() {
        try {
            // Wait for configuration to load
            if (!this.config.loaded) {
                await this.config.initialize();
            }
            
            console.log(`Initializing ${this.config.getAppName()} v${this.config.getAppVersion()}`);
            
            // Initialize modules with configuration
            await this.initializeModules();
            
            // Setup event listeners
            this.setupEventListeners();
            
            // Setup UI
            await this.setupUI();
            
            // Check for updates
            await this.checkForUpdates();
            
            this.initialized = true;
            
            Notifications.success(
                Translator.translate('app_welcome', { 
                    appName: this.config.getAppName() 
                })
            );
            
            // Dispatch app ready event
            document.dispatchEvent(new CustomEvent('appReady', {
                detail: { config: this.config.config }
            }));
            
        } catch (error) {
            console.error('Application initialization failed:', error);
            Notifications.error('Failed to initialize application');
            throw error;
        }
    }

    async initializeModules() {
        // Configure API
        API.configure({
            baseURL: this.config.getApiBaseUrl(),
            timeout: this.config.getApiTimeout(),
            headers: this.config.get('api.headers', {})
        });
        
        // Configure Translator
        const defaultLang = this.config.getLanguage();
        const supportedLangs = this.config.getSupportedLanguages();
        
        await Translator.initialize({
            defaultLanguage: defaultLang,
            supportedLanguages: supportedLangs
        });
        
        // Configure Notifications
        Notifications.setup({
            position: this.config.get('notifications.position', 'top-right'),
            duration: this.config.get('notifications.duration', 5000),
            maxVisible: this.config.get('notifications.maxVisible', 3)
        });
        
        // Load feature modules based on configuration
        await this.loadFeatureModules();
    }

    async loadFeatureModules() {
        const features = this.config.get('features.enabled', {});
        
        // Load AI module if enabled
        if (features.aiAssistance) {
            try {
                const { default: AIIntegration } = await import('./ai-integration.js');
                this.ai = new AIIntegration({
                    openaiApiKey: this.config.get('integrations.openai.apiKey')
                });
                await this.ai.initialize();
                console.log('AI module loaded');
            } catch (error) {
                console.warn('Failed to load AI module:', error);
            }
        }
        
        // Load Chat module if enabled
        if (features.chat) {
            try {
                const { default: ChatSystem } = await import('./chat.js');
                this.chat = new ChatSystem({
                    websocketUrl: this.config.get('integrations.websocket.url')
                });
                await this.chat.initialize();
                console.log('Chat module loaded');
            } catch (error) {
                console.warn('Failed to load Chat module:', error);
            }
        }
        
        // Load Media Room if enabled
        if (features.videoCalls) {
            try {
                const { default: MediaRoom } = await import('./media-room.js');
                this.mediaRoom = new MediaRoom();
                console.log('Media Room module available');
            } catch (error) {
                console.warn('Failed to load Media Room module:', error);
            }
        }
    }

    setupEventListeners() {
        // Theme change
        document.addEventListener('themeChanged', (event) => {
            this.onThemeChanged(event.detail.theme);
        });
        
        // Language change
        document.addEventListener('languageChanged', (event) => {
            this.onLanguageChanged(event.detail.language);
        });
        
        // Configuration change
        this.config.subscribe((newConfig) => {
            this.onConfigChanged(newConfig);
        });
        
        // Online/offline
        window.addEventListener('online', () => {
            this.onConnectionRestored();
        });
        
        window.addEventListener('offline', () => {
            this.onConnectionLost();
        });
        
        // Session timeout
        this.setupSessionTimeout();
    }

    setupSessionTimeout() {
        const timeout = this.config.getSessionTimeout();
        
        if (timeout > 0) {
            let timeoutId;
            
            const resetTimer = () => {
                clearTimeout(timeoutId);
                timeoutId = setTimeout(() => {
                    this.onSessionTimeout();
                }, timeout);
            };
            
            // Reset timer on user activity
            ['click', 'mousemove', 'keypress', 'scroll'].forEach(event => {
                document.addEventListener(event, resetTimer, { passive: true });
            });
            
            resetTimer();
        }
    }

    onSessionTimeout() {
        if (this.config.isFeatureEnabled('autoLogout')) {
            Notifications.warning(Translator.translate('session_timeout_warning'));
            
            // Logout after warning
            setTimeout(() => {
                this.logout();
            }, 30000);
        }
    }

    async setupUI() {
        // Create main application UI
        const appContainer = document.getElementById('app-container');
        
        if (!appContainer) {
            console.error('App container not found');
            return;
        }
        
        appContainer.innerHTML = this.getMainUI();
        
        // Initialize UI components
        await this.initializeUIComponents();
        
        // Load user preferences
        await this.loadUserPreferences();
    }

    getMainUI() {
        const appName = this.config.getAppName();
        const features = this.config.get('features.enabled', {});
        
        return `
            <div class="app-layout">
                <header class="app-header">
                    <div class="header-left">
                        <h1 class="app-title">${appName}</h1>
                        <span class="app-version">v${this.config.getAppVersion()}</span>
                        ${this.config.isDevelopment() ? '<span class="env-badge dev">DEV</span>' : ''}
                        ${this.config.isStaging() ? '<span class="env-badge staging">STAGING</span>' : ''}
                    </div>
                    
                    <div class="header-center">
                        <nav class="main-nav">
                            <a href="#dashboard" class="nav-item active">Dashboard</a>
                            <a href="#reports" class="nav-item">Reports</a>
                            <a href="#analytics" class="nav-item">Analytics</a>
                            ${features.chat ? '<a href="#chat" class="nav-item">Chat</a>' : ''}
                            ${features.videoCalls ? '<a href="#meet" class="nav-item">Meet</a>' : ''}
                        </nav>
                    </div>
                    
                    <div class="header-right">
                        <div class="user-controls">
                            <button class="btn-theme-toggle" title="Toggle Theme">
                                <span class="theme-icon">🌙</span>
                            </button>
                            <button class="btn-language" title="Change Language">
                                <span class="language-icon">🌐</span>
                            </button>
                            <button class="btn-settings" title="Settings">
                                <span class="settings-icon">⚙️</span>
                            </button>
                            <div class="user-menu">
                                <img src="/assets/user-avatar.png" class="user-avatar" alt="User">
                            </div>
                        </div>
                    </div>
                </header>
                
                <main class="app-main">
                    <div class="sidebar">
                        <div class="sidebar-content">
                            <div class="sidebar-section">
                                <h3>Quick Actions</h3>
                                <button class="sidebar-action" data-action="new-report">
                                    <span class="action-icon">📊</span>
                                    <span class="action-text">New Report</span>
                                </button>
                                <button class="sidebar-action" data-action="export-data">
                                    <span class="action-icon">📥</span>
                                    <span class="action-text">Export Data</span>
                                </button>
                                ${features.aiAssistance ? `
                                <button class="sidebar-action" data-action="ask-ai">
                                    <span class="action-icon">🤖</span>
                                    <span class="action-text">Ask AI</span>
                                </button>
                                ` : ''}
                            </div>
                            
                            <div class="sidebar-section">
                                <h3>Recent</h3>
                                <div id="recent-items"></div>
                            </div>
                        </div>
                    </div>
                    
                    <div class="content-area">
                        <div class="content-header">
                            <h2 id="content-title">Dashboard</h2>
                            <div class="content-actions">
                                <button class="btn-refresh" title="Refresh">
                                    <span class="refresh-icon">🔄</span>
                                </button>
                                <button class="btn-fullscreen" title="Fullscreen">
                                    <span class="fullscreen-icon">⛶</span>
                                </button>
                            </div>
                        </div>
                        
                        <div class="content-body" id="content-body">
                            <!-- Dynamic content will be loaded here -->
                            <div class="welcome-message">
                                <h3>Welcome to ${appName}</h3>
                                <p>Select an option from the menu to get started.</p>
                            </div>
                        </div>
                    </div>
                </main>
                
                <footer class="app-footer">
                    <div class="footer-left">
                        <span class="copyright">${this.config.get('application.copyright', '')}</span>
                        <span class="support">
                            <a href="mailto:${this.config.get('application.supportEmail', '')}">
                                Support
                            </a>
                        </span>
                    </div>
                    
                    <div class="footer-center">
                        <div class="connection-status" id="connection-status">
                            <span class="status-indicator online"></span>
                            <span class="status-text">Connected</span>
                        </div>
                    </div>
                    
                    <div class="footer-right">
                        <span class="server-time" id="server-time"></span>
                        <span class="memory-usage" id="memory-usage"></span>
                    </div>
                </footer>
            </div>
        `;
    }

    async initializeUIComponents() {
        // Theme toggle
        document.querySelector('.btn-theme-toggle').addEventListener('click', () => {
            this.toggleTheme();
        });
        
        // Language selector
        document.querySelector('.btn-language').addEventListener('click', () => {
            this.showLanguageSelector();
        });
        
        // Settings
        document.querySelector('.btn-settings').addEventListener('click', () => {
            this.showSettings();
        });
        
        // Navigation
        document.querySelectorAll('.nav-item').forEach(item => {
            item.addEventListener('click', (event) => {
                event.preventDefault();
                this.navigateTo(item.getAttribute('href').substring(1));
            });
        });
        
        // Sidebar actions
        document.querySelectorAll('.sidebar-action').forEach(action => {
            action.addEventListener('click', () => {
                const actionType = action.dataset.action;
                this.handleSidebarAction(actionType);
            });
        });
        
        // Initialize charts if Chart.js is available
        if (typeof Chart !== 'undefined') {
            this.initializeCharts();
        }
    }

    async loadUserPreferences() {
        try {
            const prefs = localStorage.getItem('user_preferences');
            if (prefs) {
                const preferences = JSON.parse(prefs);
                
                // Apply preferences
                if (preferences.theme) {
                    this.config.setTheme(preferences.theme);
                }
                
                if (preferences.language) {
                    this.config.setLanguage(preferences.language);
                }
            }
        } catch (error) {
            console.warn('Failed to load user preferences:', error);
        }
    }

    toggleTheme() {
        const currentTheme = this.config.getCurrentTheme();
        const newTheme = currentTheme === 'light' ? 'dark' : 'light';
        
        this.config.setTheme(newTheme);
    }

    showLanguageSelector() {
        const languages = this.config.getSupportedLanguages();
        
        const selectorHtml = `
            <div class="language-selector">
                <h3>Select Language</h3>
                <div class="language-list">
                    ${languages.map(lang => `
                        <button class="language-option ${this.config.getLanguage() === lang.code ? 'selected' : ''}" 
                                data-lang="${lang.code}">
                            <span class="language-flag">${lang.flag}</span>
                            <span class="language-name">${lang.nativeName}</span>
                            <span class="language-english">(${lang.name})</span>
                        </button>
                    `).join('')}
                </div>
            </div>
        `;
        
        Notifications.showModal('Language', selectorHtml, {
            onSelect: (langCode) => {
                this.config.setLanguage(langCode);
                Notifications.hideModal();
            }
        });
        
        // Add event listeners
        document.querySelectorAll('.language-option').forEach(option => {
            option.addEventListener('click', () => {
                const langCode = option.dataset.lang;
                document.dispatchEvent(new CustomEvent('languageSelected', {
                    detail: { language: langCode }
                }));
            });
        });
    }

    showSettings() {
        const settingsHtml = `
            <div class="settings-dialog">
                <div class="settings-tabs">
                    <button class="settings-tab active" data-tab="general">General</button>
                    <button class="settings-tab" data-tab="appearance">Appearance</button>
                    <button class="settings-tab" data-tab="notifications">Notifications</button>
                    <button class="settings-tab" data-tab="privacy">Privacy</button>
                    <button class="settings-tab" data-tab="advanced">Advanced</button>
                </div>
                
                <div class="settings-content">
                    <div class="settings-tab-content active" id="general-tab">
                        <h3>General Settings</h3>
                        <div class="setting-item">
                            <label>Items per page:</label>
                            <input type="number" id="items-per-page" 
                                   value="${this.config.getItemsPerPage()}" 
                                   min="10" max="100">
                        </div>
                        <div class="setting-item">
                            <label>Auto-save interval (ms):</label>
                            <input type="number" id="auto-save-interval" 
                                   value="${this.config.get('application.autoSaveInterval', 30000)}" 
                                   min="5000" max="300000">
                        </div>
                    </div>
                    
                    <div class="settings-tab-content" id="appearance-tab">
                        <h3>Appearance</h3>
                        <div class="setting-item">
                            <label>Theme:</label>
                            <select id="theme-select">
                                ${this.config.get('theme.availableThemes', []).map(theme => `
                                    <option value="${theme}" ${this.config.getCurrentTheme() === theme ? 'selected' : ''}>
                                        ${theme.charAt(0).toUpperCase() + theme.slice(1)}
                                    </option>
                                `).join('')}
                            </select>
                        </div>
                    </div>
                    
                    <div class="settings-tab-content" id="notifications-tab">
                        <h3>Notifications</h3>
                        <div class="setting-item">
                            <label>
                                <input type="checkbox" id="enable-notifications" 
                                       ${this.config.isFeatureEnabled('pushNotifications') ? 'checked' : ''}>
                                Enable push notifications
                            </label>
                        </div>
                        <div class="setting-item">
                            <label>Notification position:</label>
                            <select id="notification-position">
                                <option value="top-right" ${this.config.get('notifications.position') === 'top-right' ? 'selected' : ''}>Top Right</option>
                                <option value="top-left" ${this.config.get('notifications.position') === 'top-left' ? 'selected' : ''}>Top Left</option>
                                <option value="bottom-right" ${this.config.get('notifications.position') === 'bottom-right' ? 'selected' : ''}>Bottom Right</option>
                                <option value="bottom-left" ${this.config.get('notifications.position') === 'bottom-left' ? 'selected' : ''}>Bottom Left</option>
                            </select>
                        </div>
                    </div>
                </div>
                
                <div class="settings-buttons">
                    <button class="btn-save-settings">Save</button>
                    <button class="btn-cancel-settings">Cancel</button>
                    <button class="btn-reset-settings">Reset to Default</button>
                </div>
            </div>
        `;
        
        Notifications.showModal('Settings', settingsHtml, {
            onSave: () => this.saveSettings(),
            onCancel: () => Notifications.hideModal(),
            onReset: () => this.resetSettings()
        });
        
        // Tab switching
        document.querySelectorAll('.settings-tab').forEach(tab => {
            tab.addEventListener('click', () => {
                const tabName = tab.dataset.tab;
                
                // Update active tab
                document.querySelectorAll('.settings-tab').forEach(t => t.classList.remove('active'));
                tab.classList.add('active');
                
                // Update active content
                document.querySelectorAll('.settings-tab-content').forEach(content => {
                    content.classList.remove('active');
                });
                document.getElementById(`${tabName}-tab`).classList.add('active');
            });
        });
    }

    saveSettings() {
        // Save theme
        const themeSelect = document.getElementById('theme-select');
        if (themeSelect) {
            this.config.setTheme(themeSelect.value);
        }
        
        // Save items per page
        const itemsPerPage = document.getElementById('items-per-page');
        if (itemsPerPage) {
            this.config.set('application.itemsPerPage', parseInt(itemsPerPage.value));
        }
        
        // Save notification settings
        const notificationPosition = document.getElementById('notification-position');
        if (notificationPosition) {
            this.config.set('notifications.position', notificationPosition.value);
            Notifications.setup({
                position: notificationPosition.value
            });
        }
        
        // Save user preferences
        const preferences = {
            theme: this.config.getCurrentTheme(),
            language: this.config.getLanguage(),
            itemsPerPage: this.config.getItemsPerPage()
        };
        
        localStorage.setItem('user_preferences', JSON.stringify(preferences));
        
        Notifications.success('Settings saved');
        Notifications.hideModal();
    }

    resetSettings() {
        if (confirm('Reset all settings to default?')) {
            this.config.resetOverrides();
            localStorage.removeItem('user_preferences');
            Notifications.success('Settings reset to default');
            Notifications.hideModal();
            
            // Reload page to apply changes
            setTimeout(() => location.reload(), 1000);
        }
    }

    navigateTo(page) {
        // Update navigation
        document.querySelectorAll('.nav-item').forEach(item => {
            item.classList.remove('active');
            if (item.getAttribute('href') === `#${page}`) {
                item.classList.add('active');
            }
        });
        
        // Update content title
        const titleMap = {
            dashboard: 'Dashboard',
            reports: 'Reports',
            analytics: 'Analytics',
            chat: 'Chat',
            meet: 'Video Meetings'
        };
        
        document.getElementById('content-title').textContent = titleMap[page] || page;
        
        // Load page content
        this.loadPageContent(page);
    }

    async loadPageContent(page) {
        const contentBody = document.getElementById('content-body');
        
        // Show loading indicator
        contentBody.innerHTML = '<div class="loading">Loading...</div>';
        
        try {
            let content = '';
            
            switch (page) {
                case 'dashboard':
                    content = await this.loadDashboard();
                    break;
                case 'reports':
                    content = await this.loadReports();
                    break;
                case 'analytics':
                    content = await this.loadAnalytics();
                    break;
                case 'chat':
                    content = await this.loadChat();
                    break;
                case 'meet':
                    content = await this.loadMeet();
                    break;
                default:
                    content = '<div class="page-not-found">Page not found</div>';
            }
            
            contentBody.innerHTML = content;
            
            // Initialize page-specific components
            this.initializePageComponents(page);
            
        } catch (error) {
            console.error(`Failed to load page ${page}:`, error);
            contentBody.innerHTML = `
                <div class="error-message">
                    <h3>Error loading page</h3>
                    <p>${error.message}</p>
                    <button class="btn-retry" onclick="app.loadPageContent('${page}')">Retry</button>
                </div>
            `;
        }
    }

    async loadDashboard() {
        // Fetch dashboard data
        const [stats, recentActivity, charts] = await Promise.all([
            API.get('/dashboard/stats'),
            API.get('/dashboard/recent-activity'),
            API.get('/dashboard/charts')
        ]);
        
        return `
            <div class="dashboard">
                <div class="stats-grid">
                    ${stats.map(stat => `
                        <div class="stat-card ${stat.trend > 0 ? 'positive' : 'negative'}">
                            <div class="stat-icon">${stat.icon}</div>
                            <div class="stat-info">
                                <div class="stat-value">${stat.value}</div>
                                <div class="stat-label">${stat.label}</div>
                            </div>
                            <div class="stat-trend">
                                <span class="trend-arrow">${stat.trend > 0 ? '↑' : '↓'}</span>
                                <span class="trend-value">${Math.abs(stat.trend)}%</span>
                            </div>
                        </div>
                    `).join('')}
                </div>
                
                <div class="dashboard-charts">
                    <div class="chart-container">
                        <canvas id="main-chart"></canvas>
                    </div>
                </div>
                
                <div class="recent-activity">
                    <h3>Recent Activity</h3>
                    <div class="activity-list">
                        ${recentActivity.map(activity => `
                            <div class="activity-item">
                                <div class="activity-icon">${activity.icon}</div>
                                <div class="activity-details">
                                    <div class="activity-title">${activity.title}</div>
                                    <div class="activity-time">${this.formatTime(activity.timestamp)}</div>
                                </div>
                            </div>
                        `).join('')}
                    </div>
                </div>
            </div>
        `;
    }

    initializeCharts() {
        // Initialize main chart
        const chartConfig = {
            type: 'line',
            data: {
                labels: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun'],
                datasets: [{
                    label: 'Revenue',
                    data: [12, 19, 3, 5, 2, 3],
                    borderColor: this.config.get('theme.colors.primary'),
                    backgroundColor: `${this.config.get('theme.colors.primary')}20`,
                    tension: 0.4
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        position: 'top',
                    }
                }
            }
        };
        
        const chartCanvas = document.getElementById('main-chart');
        if (chartCanvas) {
            new Chart(chartCanvas.getContext('2d'), chartConfig);
        }
    }

    handleSidebarAction(action) {
        switch (action) {
            case 'new-report':
                this.createNewReport();
                break;
            case 'export-data':
                this.exportData();
                break;
            case 'ask-ai':
                this.askAI();
                break;
        }
    }

    async createNewReport() {
        if (!this.config.isFeatureEnabled('exportData')) {
            Notifications.error('Export feature is disabled');
            return;
        }
        
        // Show report creation dialog
        // Implementation depends on your specific requirements
    }

    async exportData() {
        try {
            const response = await API.post('/reports/export', {
                format: 'csv',
                dateRange: 'last30days'
            });
            
            // Create download link
            const blob = new Blob([response.data], { type: 'text/csv' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `export-${new Date().toISOString().split('T')[0]}.csv`;
            a.click();
            URL.revokeObjectURL(url);
            
            Notifications.success('Export completed');
            
        } catch (error) {
            console.error('Export failed:', error);
            Notifications.error('Failed to export data');
        }
    }

    async askAI() {
        if (!this.ai) {
            Notifications.error('AI assistant is not available');
            return;
        }
        
        const question = prompt('What would you like to ask the AI?');
        if (question) {
            try {
                const response = await this.ai.generateResponse(question);
                Notifications.showModal('AI Response', `
                    <div class="ai-response">
                        <div class="ai-question">
                            <strong>Question:</strong>
                            <p>${question}</p>
                        </div>
                        <div class="ai-answer">
                            <strong>Answer:</strong>
                            <p>${response}</p>
                        </div>
                    </div>
                `);
            } catch (error) {
                console.error('AI query failed:', error);
                Notifications.error('Failed to get AI response');
            }
        }
    }

    async checkForUpdates() {
        if (!this.config.isFeatureEnabled('autoUpdate')) {
            return;
        }
        
        try {
            const response = await fetch('/api/version/check', {
                headers: {
                    'X-Application-Version': this.config.getAppVersion()
                }
            });
            
            if (response.ok) {
                const data = await response.json();
                
                if (data.updateAvailable) {
                    this.showUpdateNotification(data);
                }
            }
        } catch (error) {
            console.warn('Failed to check for updates:', error);
        }
    }

    showUpdateNotification(updateInfo) {
        const notificationHtml = `
            <div class="update-notification">
                <h3>Update Available</h3>
                <p>Version ${updateInfo.latestVersion} is available.</p>
                <p>Current version: ${this.config.getAppVersion()}</p>
                <div class="update-actions">
                    <button class="btn-update-now">Update Now</button>
                    <button class="btn-update-later">Later</button>
                </div>
            </div>
        `;
        
        Notifications.showModal('Update Available', notificationHtml, {
            onUpdate: () => {
                this.performUpdate(updateInfo);
                Notifications.hideModal();
            },
            onLater: () => {
                Notifications.hideModal();
            }
        });
    }

    async performUpdate(updateInfo) {
        Notifications.info('Updating application...');
        
        try {
            // Implementation depends on your update mechanism
            // This could be a service worker update, page reload, or module hot reload
            if (updateInfo.requiresReload) {
                setTimeout(() => {
                    location.reload();
                }, 1000);
            }
        } catch (error) {
            console.error('Update failed:', error);
            Notifications.error('Failed to update application');
        }
    }

    onThemeChanged(theme) {
        console.log(`Theme changed to: ${theme}`);
        
        // Update UI elements
        document.documentElement.setAttribute('data-theme', theme);
        
        // Update charts if they exist
        this.updateChartsForTheme(theme);
        
        // Save preference
        const prefs = JSON.parse(localStorage.getItem('user_preferences') || '{}');
        prefs.theme = theme;
        localStorage.setItem('user_preferences', JSON.stringify(prefs));
    }

    onLanguageChanged(language) {
        console.log(`Language changed to: ${language}`);
        
        // Update Translator
        Translator.setLanguage(language);
        
        // Update UI elements that need translation
        this.updateUITranslations();
        
        // Save preference
        const prefs = JSON.parse(localStorage.getItem('user_preferences') || '{}');
        prefs.language = language;
        localStorage.setItem('user_preferences', JSON.stringify(prefs));
    }

    onConfigChanged(newConfig) {
        console.log('Configuration changed');
        
        // Update API configuration if changed
        if (newConfig.api) {
            API.configure({
                baseURL: newConfig.api.baseURL,
                timeout: newConfig.api.timeout
            });
        }
        
        // Update feature flags
        this.updateFeatureAvailability(newConfig.features);
    }

    onConnectionRestored() {
        Notifications.success('Connection restored');
        document.getElementById('connection-status').className = 'connection-status online';
    }

    onConnectionLost() {
        Notifications.warning('Connection lost. Working offline.');
        document.getElementById('connection-status').className = 'connection-status offline';
    }

    updateChartsForTheme(theme) {
        // Re-initialize charts with new theme colors
        if (typeof Chart !== 'undefined') {
            Chart.helpers.each(Chart.instances, (instance) => {
                instance.destroy();
            });
            
            this.initializeCharts();
        }
    }

    updateUITranslations() {
        // Update all translatable elements
        document.querySelectorAll('[data-i18n]').forEach(element => {
            const key = element.getAttribute('data-i18n');
            element.textContent = Translator.translate(key);
        });
    }

    updateFeatureAvailability(features) {
        // Show/hide UI elements based on feature flags
        Object.keys(features.enabled).forEach(feature => {
            const elements = document.querySelectorAll(`[data-feature="${feature}"]`);
            elements.forEach(element => {
                element.style.display = features.enabled[feature] ? '' : 'none';
            });
        });
    }

    formatTime(timestamp) {
        const date = new Date(timestamp);
        const format = this.config.getTimeFormat();
        
        if (format === '12h') {
            return date.toLocaleTimeString('en-US', {
                hour: 'numeric',
                minute: '2-digit',
                hour12: true
            });
        } else {
            return date.toLocaleTimeString('en-US', {
                hour: '2-digit',
                minute: '2-digit',
                hour12: false
            });
        }
    }

    logout() {
        // Clear local data
        localStorage.removeItem('auth_token');
        localStorage.removeItem('user_preferences');
        
        // Redirect to login
        window.location.href = '/login';
    }

    // Performance monitoring
    startPerformanceMonitoring() {
        if (this.config.isFeatureEnabled('performanceMonitoring')) {
            // Monitor memory usage
            if ('memory' in performance) {
                setInterval(() => {
                    const memory = performance.memory;
                    document.getElementById('memory-usage').textContent = 
                        `Memory: ${Math.round(memory.usedJSHeapSize / 1048576)}MB`;
                }, 5000);
            }
            
            // Monitor page load performance
            const timing = performance.timing;
            const loadTime = timing.loadEventEnd - timing.navigationStart;
            console.log(`Page load time: ${loadTime}ms`);
        }
    }
}

// Create and export application instance
const App = new Application();

// Initialize when DOM is ready
document.addEventListener('DOMContentLoaded', async () => {
    try {
        await App.initialize();
        
        // Start performance monitoring
        App.startPerformanceMonitoring();
        
        // Make app available globally
        window.app = App;
        
    } catch (error) {
        console.error('Failed to initialize application:', error);
        
        // Show error page
        document.body.innerHTML = `
            <div class="error-page">
                <h1>Application Error</h1>
                <p>Failed to initialize the application.</p>
                <p>${error.message}</p>
                <button onclick="location.reload()">Reload Page</button>
            </div>
        `;
    }
});

export default App;
