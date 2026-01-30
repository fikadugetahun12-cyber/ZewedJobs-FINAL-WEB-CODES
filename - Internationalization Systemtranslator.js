/**
 * Translation Service
 * Responsibilities:
 * - Manage language files
 * - Handle dynamic translations
 * - Format dates/numbers based on locale
 * - Support language switching
 */

class Translator {
    constructor() {
        this.currentLanguage = 'en';
        this.fallbackLanguage = 'en';
        this.translations = {};
        this.initialized = false;
    }

    async init() {
        try {
            // Load preferred language from storage
            const savedLanguage = localStorage.getItem('preferredLanguage');
            const browserLanguage = navigator.language.split('-')[0];
            
            this.currentLanguage = savedLanguage || 
                                  (['en', 'es', 'fr'].includes(browserLanguage) ? browserLanguage : 'en');
            
            // Load translation files
            await this.loadTranslations(this.currentLanguage);
            
            // Set up language change listeners
            this.setupLanguageSwitch();
            
            this.initialized = true;
            console.log(`Translator initialized with language: ${this.currentLanguage}`);
            
        } catch (error) {
            console.error('Failed to initialize translator:', error);
            await this.loadFallbackTranslations();
        }
    }

    async loadTranslations(languageCode) {
        try {
            const response = await fetch(`/locales/${languageCode}.json`);
            if (!response.ok) throw new Error('Translation file not found');
            
            this.translations[languageCode] = await response.json();
            
        } catch (error) {
            console.warn(`Failed to load ${languageCode} translations, using fallback`);
            await this.loadFallbackTranslations();
        }
    }

    async loadFallbackTranslations() {
        const response = await fetch(`/locales/${this.fallbackLanguage}.json`);
        this.translations[this.fallbackLanguage] = await response.json();
        this.currentLanguage = this.fallbackLanguage;
    }

    translate(key, variables = {}) {
        if (!this.initialized) {
            console.warn('Translator not initialized');
            return key;
        }

        let translation = this.translations[this.currentLanguage]?.[key] ||
                         this.translations[this.fallbackLanguage]?.[key] ||
                         key;

        // Replace variables in translation string
        Object.entries(variables).forEach(([varKey, value]) => {
            translation = translation.replace(`{{${varKey}}}`, value);
        });

        return translation;
    }

    setLanguage(languageCode) {
        if (this.currentLanguage === languageCode) return;
        
        this.currentLanguage = languageCode;
        localStorage.setItem('preferredLanguage', languageCode);
        
        // Reload translations for new language
        this.loadTranslations(languageCode)
            .then(() => {
                // Update all translated elements
                this.updatePageTranslations();
                
                // Dispatch language change event
                document.dispatchEvent(new CustomEvent('languageChanged', {
                    detail: { language: languageCode }
                }));
                
                Notifications.success(this.translate('language_changed'));
            })
            .catch(error => {
                console.error('Failed to change language:', error);
                Notifications.error(this.translate('language_change_failed'));
            });
    }

    updatePageTranslations() {
        // Find all elements with data-i18n attribute
        document.querySelectorAll('[data-i18n]').forEach(element => {
            const key = element.getAttribute('data-i18n');
            const variables = JSON.parse(element.getAttribute('data-i18n-vars') || '{}');
            element.textContent = this.translate(key, variables);
        });

        // Update title and meta tags
        document.title = this.translate('page_title');
    }

    formatDate(date, options = {}) {
        const locale = this.currentLanguage;
        const defaultOptions = {
            year: 'numeric',
            month: 'long',
            day: 'numeric'
        };
        
        return new Date(date).toLocaleDateString(locale, { ...defaultOptions, ...options });
    }

    formatNumber(number, options = {}) {
        const locale = this.currentLanguage;
        return new Intl.NumberFormat(locale, options).format(number);
    }

    setupLanguageSwitch() {
        // Listen for language switch events
        document.addEventListener('click', (e) => {
            if (e.target.matches('[data-set-language]')) {
                const language = e.target.getAttribute('data-set-language');
                this.setLanguage(language);
            }
        });
    }
}

// Singleton instance
const Translator = new Translator();
export default Translator;
