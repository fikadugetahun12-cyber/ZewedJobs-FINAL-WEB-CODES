import PaymentSystem from './js/payment.js';
import EthiopianPayment from './js/ethiopian-payments.js';
import InternationalPayment from './js/international-payments.js';

class PaymentManager {
    constructor() {
        this.paymentSystems = {
            ethiopian: null,
            international: null
        };
        this.activeSystem = null;
    }

    async initialize() {
        try {
            // Initialize Ethiopian payment system
            this.paymentSystems.ethiopian = new EthiopianPayment({
                bankOptions: {
                    cbe: { name: 'CBE', code: 'CBE' },
                    dashen: { name: 'Dashen Bank', code: 'DASHEN' },
                    awash: { name: 'Awash Bank', code: 'AWASH' }
                }
            });

            // Initialize international payment system
            this.paymentSystems.international = new InternationalPayment({
                stripeApiKey: 'pk_test_...',
                stripePublishableKey: 'pk_test_...',
                paypalClientId: '...',
                defaultProvider: 'stripe'
            });

            // Set up event handlers
            this.setupPaymentEventListeners();

            // Set default payment system based on user location
            this.detectUserLocation();

            Notifications.success('Payment system initialized');

        } catch (error) {
            console.error('Failed to initialize payment system:', error);
            Notifications.error('Payment system initialization failed');
        }
    }

    detectUserLocation() {
        // Determine user location based on IP or browser settings
        const userLanguage = navigator.language || 'en-US';
        const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
        
        // Check if user is in Ethiopia
        if (timezone.includes('Addis_Ababa') || userLanguage.includes('am-ET')) {
            this.setActivePaymentSystem('ethiopian');
        } else {
            this.setActivePaymentSystem('international');
        }
    }

    setActivePaymentSystem(systemName) {
        if (this.paymentSystems[systemName]) {
            this.activeSystem = this.paymentSystems[systemName];
            
            // Update UI to reflect active system
            this.updatePaymentUI();
            
            return true;
        }
        
        return false;
    }

    async processPayment(amount, currency, customerData, paymentMethod) {
        if (!this.activeSystem) {
            throw new Error('No active payment system');
        }

        try {
            // Initiate payment
            const initiation = await this.activeSystem.initiatePayment({
                amount: amount,
                currency: currency,
                customer: customerData,
                method: paymentMethod
            });

            if (!initiation.success) {
                throw new Error(initiation.error);
            }

            // Show payment UI based on payment method
            this.showPaymentInterface(initiation.paymentIntent);

            return initiation;

        } catch (error) {
            Notifications.error(`Payment initiation failed: ${error.message}`);
            throw error;
        }
    }

    showPaymentInterface(paymentIntent) {
        // Create and show payment modal
        const modal = this.createPaymentModal(paymentIntent);
        document.body.appendChild(modal);
    }

    createPaymentModal(paymentIntent) {
        const modal = document.createElement('div');
        modal.className = 'payment-modal';
        
        modal.innerHTML = `
            <div class="payment-modal-content">
                <div class="payment-modal-header">
                    <h3>Complete Payment</h3>
                    <button class="close-modal">&times;</button>
                </div>
                <div class="payment-modal-body">
                    <div class="payment-details">
                        <p>Amount: ${paymentIntent.amount} ${paymentIntent.currency}</p>
                        <p>Reference: ${paymentIntent.reference || 'N/A'}</p>
                    </div>
                    <div class="payment-method-selection">
                        ${this.getPaymentMethodOptions()}
                    </div>
                    <div class="payment-form">
                        <!-- Dynamic form based on selected method -->
                    </div>
                </div>
                <div class="payment-modal-footer">
                    <button class="cancel-payment">Cancel</button>
                    <button class="submit-payment">Pay Now</button>
                </div>
            </div>
        `;

        return modal;
    }

    getPaymentMethodOptions() {
        if (!this.activeSystem) return '';
        
        return this.activeSystem.paymentMethods
            .map(method => `
                <div class="payment-method-option" data-method="${method.code || method.name}">
                    <img src="${method.logo || 'default.png'}" alt="${method.name}">
                    <span>${method.name}</span>
                </div>
            `).join('');
    }

    setupPaymentEventListeners() {
        // Payment success handler
        this.paymentSystems.ethiopian?.on('success', (payment) => {
            Notifications.success(`Payment of ${payment.amount} ETB completed successfully`);
            this.redirectToSuccessPage(payment);
        });

        this.paymentSystems.international?.on('success', (payment) => {
            Notifications.success(`Payment of ${payment.amount} ${payment.currency} completed`);
            this.redirectToSuccessPage(payment);
        });

        // Payment failure handler
        this.paymentSystems.ethiopian?.on('failure', (payment, error) => {
            Notifications.error(`Payment failed: ${error.message}`);
            this.showRetryOption(payment);
        });

        this.paymentSystems.international?.on('failure', (payment, error) => {
            Notifications.error(`Payment failed: ${error.message}`);
            this.showRetryOption(payment);
        });
    }

    redirectToSuccessPage(payment) {
        // Store payment data for success page
        localStorage.setItem('lastPayment', JSON.stringify(payment));
        window.location.href = '/payment-success.html';
    }

    showRetryOption(payment) {
        const retry = confirm('Payment failed. Would you like to try again?');
        if (retry) {
            this.processPayment(
                payment.amount,
                payment.currency,
                payment.customer,
                payment.paymentMethod
            );
        }
    }

    updatePaymentUI() {
        // Update UI elements based on active payment system
        const paymentContainer = document.getElementById('payment-container');
        if (paymentContainer) {
            paymentContainer.innerHTML = this.getPaymentUI();
        }
    }

    getPaymentUI() {
        if (!this.activeSystem) return '<p>Payment system loading...</p>';
        
        const system = this.activeSystem;
        return `
            <div class="payment-system">
                <h4>${system.name}</h4>
                <p>Currency: ${system.currency}</p>
                <div class="available-methods">
                    ${system.paymentMethods.map(method => `
                        <div class="payment-method">
                            <span>${method.name}</span>
                        </div>
                    `).join('')}
                </div>
            </div>
        `;
    }
}

// Initialize in main application
document.addEventListener('DOMContentLoaded', () => {
    window.paymentManager = new PaymentManager();
    window.paymentManager.initialize();
});
