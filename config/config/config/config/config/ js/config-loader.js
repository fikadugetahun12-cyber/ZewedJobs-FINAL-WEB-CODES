/**
 * Configuration Loader
 * Handles loading and merging configuration from multiple sources
 */

class ConfigLoader {
    constructor() {
        this.config = {};
        this.environment = this.detectEnvironment();
        this.overrides = {};
        this.loaded = false;
        this.listeners = new Set();
    }

    async initialize() {
        try {
            // Load base configuration
            const baseConfig = await this.loadConfigFile('settings.json');
            
            // Load environment-specific configuration
            const envConfig = await this.loadConfigFile(`${this.environment}.json`);
            
            // Load local overrides if available
            const localOverrides = await this.loadLocalOverrides();
            
            // Merge configurations with priority: local > env > base
            this.config = this.deepMerge({}, baseConfig, envConfig, localOverrides);
            
            // Set environment
            this.config.environment = this.environment;
            
            // Apply runtime overrides
            this.config = this.deepMerge(this.config, this.overrides);
            
            // Validate configuration
            await this.validateConfig();
            
            // Load environment variables
            this.loadEnvironmentVariables();
            
            this.loaded = true;
            
            // Notify listeners
            this.notifyListeners();
            
            console.log(`Configuration loaded for ${this.environment} environment`);
            
            return this.config;
            
        } catch (error) {
            console.error('Failed to load configuration:', error);
            
            // Fallback to default configuration
            this.config = this.getDefaultConfig();
            this.loaded = true;
            
            throw error;
        }
    }

    detectEnvironment() {
        // Check URL parameters first
        const urlParams = new URLSearchParams(window.location.search);
        const envParam = urlParams.get('env');
        
        if (envParam && ['development', 'staging', 'production'].includes(envParam)) {
            return envParam;
        }
        
        // Check hostname
        const hostname = window.location.hostname;
        
        if (hostname === 'localhost' || hostname === '127.0.0.1') {
            return 'development';
        } else if (hostname.includes('staging') || hostname.includes('test')) {
            return 'staging';
        } else {
            return 'production';
        }
    }

    async loadConfigFile(filename) {
        try {
            const response = await fetch(`/config/${filename}`, {
                headers: {
                    'Accept': 'application/json',
                    'Cache-Control': 'no-cache'
                }
            });
            
            if (!response.ok) {
                throw new Error(`Failed to load ${filename}: ${response.status}`);
            }
            
            const config = await response.json();
            
            // Validate file structure
            if (!this.validateConfigStructure(config, filename)) {
                throw new Error(`Invalid configuration structure in ${filename}`);
            }
            
            return config;
            
        } catch (error) {
            console.warn(`Could not load ${filename}:`, error.message);
            
            // Return empty object for non-critical config files
            if (filename === 'settings.json') {
                throw error; // Critical file, re-throw
            }
            
            return {};
        }
    }

    async loadLocalOverrides() {
        try {
            // Check localStorage for user overrides
            const stored = localStorage.getItem('app_config_overrides');
            if (stored) {
                return JSON.parse(stored);
            }
            
            return {};
            
        } catch (error) {
            console.warn('Failed to load local overrides:', error);
            return {};
        }
    }

    validateConfigStructure(config, filename) {
        // Basic validation
        if (typeof config !== 'object' || config === null) {
            console.error(`${filename}: Configuration must be an object`);
            return false;
        }
        
        // Environment-specific validation
        if (filename.includes('development') || filename.includes('staging') || filename.includes('production')) {
            if (!config.environment) {
                console.error(`${filename}: Missing environment field`);
                return false;
            }
        }
        
        return true;
    }

    async validateConfig() {
        try {
            // Load schema for validation
            const schema = await this.loadConfigFile('config-schema.json');
            
            // Simple validation (in production, use a proper JSON schema validator)
            this.performBasicValidation();
            
            return true;
            
        } catch (error) {
            console.warn('Configuration validation skipped:', error);
            return true; // Don't fail on validation errors
        }
    }

    performBasicValidation() {
        const requiredFields = ['application', 'api'];
        
        for (const field of requiredFields) {
            if (!this.config[field]) {
                throw new Error(`Missing required configuration field: ${field}`);
            }
        }
        
        // Validate API configuration
        if (!this.config.api.baseURL) {
            throw new Error('API baseURL is required');
        }
        
        // Validate application configuration
        if (!this.config.application.name || !this.config.application.version) {
            throw new Error('Application name and version are required');
        }
    }

    loadEnvironmentVariables() {
        // Load from window._env_ if available (set by build process)
        if (window._env_) {
            Object.keys(window._env_).forEach(key => {
                this.set(key, window._env_[key]);
            });
        }
        
        // Load from data attributes
        const appElement = document.getElementById('app');
        if (appElement && appElement.dataset.config) {
            try {
                const dataConfig = JSON.parse(appElement.dataset.config);
                Object.assign(this.config, dataConfig);
            } catch (error) {
                console.warn('Failed to parse data-config attribute:', error);
            }
        }
    }

    getDefaultConfig() {
        return {
            environment: 'development',
            application: {
                name: 'My Application',
                version: '1.0.0',
                debug: true
            },
            api: {
                baseURL: 'http://localhost:3000/api',
                timeout: 30000
            },
            features: {
                enabled: {}
            }
        };
    }

    get(path, defaultValue = null) {
        if (!this.loaded) {
            console.warn('Configuration not loaded yet. Call initialize() first.');
            return defaultValue;
        }
        
        const keys = path.split('.');
        let value = this.config;
        
        for (const key of keys) {
            if (value && typeof value === 'object' && key in value) {
                value = value[key];
            } else {
                return defaultValue;
            }
        }
        
        return value !== undefined ? value : defaultValue;
    }

    set(path, value) {
        const keys = path.split('.');
        let current = this.config;
        
        for (let i = 0; i < keys.length - 1; i++) {
            const key = keys[i];
            
            if (!(key in current) || typeof current[key] !== 'object') {
                current[key] = {};
            }
            
            current = current[key];
        }
        
        const lastKey = keys[keys.length - 1];
        current[lastKey] = value;
        
        // Store in overrides for persistence
        this.setOverride(path, value);
        
        // Notify listeners
        this.notifyListeners();
    }

    setOverride(path, value) {
        const keys = path.split('.');
        let current = this.overrides;
        
        for (let i = 0; i < keys.length - 1; i++) {
            const key = keys[i];
            
            if (!(key in current)) {
                current[key] = {};
            }
            
            current = current[key];
        }
        
        const lastKey = keys[keys.length - 1];
        current[lastKey] = value;
        
        // Save to localStorage
        this.saveOverrides();
    }

    saveOverrides() {
        try {
            localStorage.setItem('app_config_overrides', JSON.stringify(this.overrides));
        } catch (error) {
            console.warn('Failed to save configuration overrides:', error);
        }
    }

    resetOverrides() {
        this.overrides = {};
        localStorage.removeItem('app_config_overrides');
        
        // Reload configuration
        this.initialize().catch(console.error);
    }

    subscribe(callback) {
        this.listeners.add(callback);
        
        // Return unsubscribe function
        return () => {
            this.listeners.delete(callback);
        };
    }

    notifyListeners() {
        this.listeners.forEach(callback => {
            try {
                callback(this.config);
            } catch (error) {
                console.error('Configuration listener error:', error);
            }
        });
    }

    isFeatureEnabled(featureName) {
        return this.get(`features.enabled.${featureName}`, false);
    }

    getApiEndpoint(endpointPath, params = {}) {
        let endpoint = this.get(`api.endpoints.${endpointPath}`);
        
        if (!endpoint) {
            console.warn(`Endpoint not found: ${endpointPath}`);
            return null;
        }
        
        // Replace path parameters
        endpoint = endpoint.replace(/{(\w+)}/g, (match, paramName) => {
            return params[paramName] || match;
        });
        
        return `${this.get('api.baseURL')}${endpoint}`;
    }

    getCurrentTheme() {
        const savedTheme = localStorage.getItem('app_theme');
        const defaultTheme = this.get('theme.default', 'light');
        const availableThemes = this.get('theme.availableThemes', ['light', 'dark']);
        
        if (savedTheme && availableThemes.includes(savedTheme)) {
            return savedTheme;
        }
        
        if (defaultTheme === 'auto') {
            return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
        }
        
        return defaultTheme;
    }

    setTheme(themeName) {
        const availableThemes = this.get('theme.availableThemes', ['light', 'dark']);
        
        if (!availableThemes.includes(themeName)) {
            console.warn(`Theme ${themeName} is not available`);
            return false;
        }
        
        localStorage.setItem('app_theme', themeName);
        this.applyTheme(themeName);
        
        return true;
    }

    applyTheme(themeName) {
        const theme = this.get(`theme.${themeName}`);
        
        if (!theme) {
            console.warn(`Theme configuration not found: ${themeName}`);
            return;
        }
        
        // Apply CSS variables
        const root = document.documentElement;
        
        Object.entries(theme).forEach(([key, value]) => {
            root.style.setProperty(`--theme-${key}`, value);
        });
        
        // Apply color scheme
        root.style.colorScheme = themeName === 'dark' ? 'dark' : 'light';
        
        // Notify theme change
        document.dispatchEvent(new CustomEvent('themeChanged', {
            detail: { theme: themeName }
        }));
    }

    getLanguage() {
        const savedLang = localStorage.getItem('app_language');
        const defaultLang = this.get('internationalization.defaultLanguage', 'en');
        const supportedLanguages = this.get('internationalization.supportedLanguages', []);
        
        if (savedLang && supportedLanguages.find(lang => lang.code === savedLang)) {
            return savedLang;
        }
        
        // Try to match browser language
        const browserLang = navigator.language.split('-')[0];
        if (supportedLanguages.find(lang => lang.code === browserLang)) {
            return browserLang;
        }
        
        return defaultLang;
    }

    setLanguage(languageCode) {
        const supportedLanguages = this.get('internationalization.supportedLanguages', []);
        
        if (!supportedLanguages.find(lang => lang.code === languageCode)) {
            console.warn(`Language ${languageCode} is not supported`);
            return false;
        }
        
        localStorage.setItem('app_language', languageCode);
        
        // Update HTML lang attribute
        document.documentElement.lang = languageCode;
        
        // Notify language change
        document.dispatchEvent(new CustomEvent('languageChanged', {
            detail: { language: languageCode }
        }));
        
        return true;
    }

    deepMerge(target, ...sources) {
        if (!sources.length) return target;
        
        const source = sources.shift();
        
        if (this.isObject(target) && this.isObject(source)) {
            for (const key in source) {
                if (this.isObject(source[key])) {
                    if (!target[key]) Object.assign(target, { [key]: {} });
                    this.deepMerge(target[key], source[key]);
                } else {
                    Object.assign(target, { [key]: source[key] });
                }
            }
        }
        
        return this.deepMerge(target, ...sources);
    }

    isObject(item) {
        return item && typeof item === 'object' && !Array.isArray(item);
    }

    // Convenience methods for common configuration values
    getAppName() {
        return this.get('application.name', 'My Application');
    }

    getAppVersion() {
        return this.get('application.version', '1.0.0');
    }

    getApiBaseUrl() {
        return this.get('api.baseURL', 'http://localhost:3000/api');
    }

    getApiTimeout() {
        return this.get('api.timeout', 30000);
    }

    getFeatureFlags() {
        return this.get('features.flags', {});
    }

    getSupportedLanguages() {
        return this.get('internationalization.supportedLanguages', []);
    }

    getThemeColors(themeName = null) {
        const theme = themeName || this.getCurrentTheme();
        return this.get(`theme.${theme}`, {});
    }

    isDebugEnabled() {
        return this.get('application.debug', false);
    }

    getLogLevel() {
        return this.get('logging.level', 'info');
    }

    getMaxUploadSize() {
        return this.get('application.maxUploadSize', 10485760);
    }

    getSessionTimeout() {
        return this.get('application.sessionTimeout', 3600000);
    }

    getItemsPerPage() {
        return this.get('application.itemsPerPage', 25);
    }

    getCurrency() {
        return this.get('application.currency', 'USD');
    }

    getDateFormat() {
        const lang = this.getLanguage();
        return this.get(`internationalization.dateFormats.${lang}`, 'YYYY-MM-DD');
    }

    getTimeFormat() {
        const lang = this.getLanguage();
        return this.get(`internationalization.timeFormats.${lang}`, '24h');
    }

    exportConfig() {
        return JSON.stringify(this.config, null, 2);
    }

    importConfig(configString) {
        try {
            const newConfig = JSON.parse(configString);
            this.config = this.deepMerge({}, this.getDefaultConfig(), newConfig);
            this.notifyListeners();
            return true;
        } catch (error) {
            console.error('Failed to import configuration:', error);
            return false;
        }
    }

    // Dynamic configuration reloading
    async reload() {
        this.loaded = false;
        await this.initialize();
        console.log('Configuration reloaded');
    }

    // Environment checks
    isDevelopment() {
        return this.environment === 'development';
    }

    isStaging() {
        return this.environment === 'staging';
    }

    isProduction() {
        return this.environment === 'production';
    }
}

// Singleton instance
const Config = new ConfigLoader();

// Initialize automatically when DOM is ready
document.addEventListener('DOMContentLoaded', async () => {
    try {
        await Config.initialize();
        
        // Apply theme
        const theme = Config.getCurrentTheme();
        Config.applyTheme(theme);
        
        // Set language
        const language = Config.getLanguage();
        Config.setLanguage(language);
        
        console.log('Configuration system ready');
        
    } catch (error) {
        console.error('Failed to initialize configuration:', error);
    }
});

export default Config;
