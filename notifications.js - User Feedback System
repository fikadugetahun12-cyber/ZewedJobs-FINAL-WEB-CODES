/**
 * Notification System
 * Responsibilities:
 * - Display toast notifications
 * - Manage notification queue
 * - Handle different notification types
 * - Provide accessibility support
 */

class NotificationSystem {
    constructor() {
        this.container = null;
        this.notifications = [];
        this.maxVisible = 3;
        this.setupStyles();
    }

    setup() {
        this.createContainer();
        this.setupEventListeners();
    }

    createContainer() {
        if (this.container) return;
        
        this.container = document.createElement('div');
        this.container.className = 'notification-container';
        this.container.setAttribute('aria-live', 'polite');
        this.container.setAttribute('role', 'region');
        this.container.setAttribute('aria-label', 'Notifications');
        
        document.body.appendChild(this.container);
    }

    setupEventListeners() {
        // Auto-remove notifications on click
        document.addEventListener('click', (e) => {
            if (e.target.closest('.notification')) {
                const notification = e.target.closest('.notification');
                this.removeNotification(notification.id);
            }
        });
    }

    show(message, options = {}) {
        const config = {
            type: 'info',
            duration: 5000,
            dismissible: true,
            position: 'top-right',
            ...options
        };

        const id = `notification-${Date.now()}`;
        const notification = this.createNotificationElement(id, message, config);
        
        // Add to container
        this.container.appendChild(notification);
        this.notifications.push({ id, element: notification, config });
        
        // Trigger animation
        requestAnimationFrame(() => {
            notification.classList.add('show');
        });
        
        // Set up auto-dismiss
        if (config.duration > 0) {
            setTimeout(() => {
                this.removeNotification(id);
            }, config.duration);
        }
        
        // Handle max visible notifications
        if (this.notifications.length > this.maxVisible) {
            const oldest = this.notifications[0];
            this.removeNotification(oldest.id);
        }
        
        return id;
    }

    createNotificationElement(id, message, config) {
        const notification = document.createElement('div');
        notification.id = id;
        notification.className = `notification notification-${config.type}`;
        notification.setAttribute('role', 'alert');
        
        // Create content structure
        notification.innerHTML = `
            <div class="notification-icon"></div>
            <div class="notification-content">
                <div class="notification-message">${message}</div>
            </div>
            ${config.dismissible ? 
                '<button class="notification-close" aria-label="Close notification">×</button>' : 
                ''
            }
        `;
        
        return notification;
    }

    removeNotification(id) {
        const index = this.notifications.findIndex(n => n.id === id);
        if (index === -1) return;
        
        const { element } = this.notifications[index];
        
        // Trigger exit animation
        element.classList.remove('show');
        element.classList.add('hiding');
        
        // Remove from DOM after animation
        setTimeout(() => {
            if (element.parentNode) {
                element.parentNode.removeChild(element);
            }
            this.notifications.splice(index, 1);
        }, 300);
    }

    clearAll() {
        this.notifications.forEach(notification => {
            this.removeNotification(notification.id);
        });
    }

    // Convenience methods
    success(message, options = {}) {
        return this.show(message, { type: 'success', ...options });
    }

    error(message, options = {}) {
        return this.show(message, { type: 'error', ...options });
    }

    warning(message, options = {}) {
        return this.show(message, { type: 'warning', ...options });
    }

    info(message, options = {}) {
        return this.show(message, { type: 'info', ...options });
    }

    setupStyles() {
        if (document.querySelector('#notification-styles')) return;
        
        const styles = document.createElement('style');
        styles.id = 'notification-styles';
        styles.textContent = `
            .notification-container {
                position: fixed;
                z-index: 9999;
                top: 20px;
                right: 20px;
                width: 350px;
                max-width: 90vw;
                display: flex;
                flex-direction: column;
                gap: 10px;
            }
            
            .notification {
                background: white;
                border-radius: 8px;
                padding: 16px;
                box-shadow: 0 4px 12px rgba(0,0,0,0.15);
                border-left: 4px solid #3498db;
                transform: translateX(100%);
                opacity: 0;
                transition: transform 0.3s ease, opacity 0.3s ease;
                display: flex;
                align-items: flex-start;
                gap: 12px;
            }
            
            .notification.show {
                transform: translateX(0);
                opacity: 1;
            }
            
            .notification.hiding {
                transform: translateX(100%);
                opacity: 0;
            }
            
            .notification-success { border-color: #2ecc71; }
            .notification-error { border-color: #e74c3c; }
            .notification-warning { border-color: #f39c12; }
            .notification-info { border-color: #3498db; }
            
            .notification-icon {
                width: 24px;
                height: 24px;
                flex-shrink: 0;
            }
            
            .notification-content {
                flex: 1;
            }
            
            .notification-message {
                color: #333;
                line-height: 1.5;
            }
            
            .notification-close {
                background: none;
                border: none;
                font-size: 20px;
                color: #999;
                cursor: pointer;
                padding: 0;
                width: 24px;
                height: 24px;
                display: flex;
                align-items: center;
                justify-content: center;
            }
            
            .notification-close:hover {
                color: #333;
            }
        `;
        
        document.head.appendChild(styles);
    }
}

// Singleton instance
const Notifications = new NotificationSystem();
export default Notifications;
