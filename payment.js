/**
 * Base Payment System
 * Responsibilities:
 * - Define common payment interface
 * - Handle payment validation
 * - Manage payment states
 * - Provide base error handling
 * - Handle currency conversions
 */

class PaymentSystem {
    constructor(config = {}) {
        this.name = config.name || 'Generic Payment';
        this.currency = config.currency || 'USD';
        this.enabled = config.enabled || true;
        this.supportedCurrencies = config.supportedCurrencies || ['USD'];
        this.paymentMethods = [];
        this.currentPayment = null;
        this.callbacks = {
            onSuccess: null,
            onFailure: null,
            onPending: null
        };
    }

    // Validation methods
    validatePayment(amount, currency, customerData) {
        const errors = [];
        
        if (amount <= 0) {
            errors.push('Amount must be greater than zero');
        }
        
        if (!this.supportedCurrencies.includes(currency)) {
            errors.push(`Currency ${currency} not supported`);
        }
        
        if (!customerData.email || !this.validateEmail(customerData.email)) {
            errors.push('Valid email is required');
        }
        
        return {
            isValid: errors.length === 0,
            errors
        };
    }

    validateEmail(email) {
        const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        return re.test(email);
    }

    // Payment flow methods
    async initiatePayment(paymentData) {
        try {
            this.currentPayment = {
                id: this.generatePaymentId(),
                amount: paymentData.amount,
                currency: paymentData.currency,
                customer: paymentData.customer,
                status: 'initiated',
                timestamp: new Date().toISOString(),
                metadata: paymentData.metadata || {}
            };

            // Validate payment
            const validation = this.validatePayment(
                paymentData.amount,
                paymentData.currency,
                paymentData.customer
            );

            if (!validation.isValid) {
                throw new Error(`Payment validation failed: ${validation.errors.join(', ')}`);
            }

            // Create payment intent
            const paymentIntent = await this.createPaymentIntent(paymentData);
            
            this.currentPayment = {
                ...this.currentPayment,
                ...paymentIntent,
                status: 'created'
            };

            return {
                success: true,
                paymentId: this.currentPayment.id,
                paymentIntent,
                nextStep: this.getNextStep()
            };

        } catch (error) {
            console.error('Payment initiation failed:', error);
            this.handlePaymentError(error);
            return {
                success: false,
                error: error.message
            };
        }
    }

    async processPayment(paymentMethodData) {
        try {
            if (!this.currentPayment) {
                throw new Error('No active payment session');
            }

            // Update payment with method details
            this.currentPayment.paymentMethod = paymentMethodData.method;
            this.currentPayment.status = 'processing';

            // Process the payment
            const result = await this.executePayment(paymentMethodData);
            
            if (result.success) {
                this.currentPayment.status = 'completed';
                this.currentPayment.completedAt = new Date().toISOString();
                this.currentPayment.transactionId = result.transactionId;
                
                // Trigger success callback
                if (this.callbacks.onSuccess) {
                    this.callbacks.onSuccess(this.currentPayment);
                }

                return {
                    success: true,
                    payment: this.currentPayment,
                    receipt: result.receipt
                };
            } else {
                throw new Error(result.error || 'Payment processing failed');
            }

        } catch (error) {
            console.error('Payment processing failed:', error);
            this.currentPayment.status = 'failed';
            this.currentPayment.error = error.message;
            
            // Trigger failure callback
            if (this.callbacks.onFailure) {
                this.callbacks.onFailure(this.currentPayment, error);
            }

            return {
                success: false,
                error: error.message
            };
        }
    }

    async cancelPayment(paymentId) {
        try {
            // Find and update payment status
            if (this.currentPayment && this.currentPayment.id === paymentId) {
                this.currentPayment.status = 'cancelled';
                this.currentPayment.cancelledAt = new Date().toISOString();
                
                // Perform cancellation logic
                await this.executeCancellation(paymentId);
                
                return {
                    success: true,
                    message: 'Payment cancelled successfully'
                };
            }
            
            throw new Error('Payment not found');

        } catch (error) {
            console.error('Payment cancellation failed:', error);
            return {
                success: false,
                error: error.message
            };
        }
    }

    async getPaymentStatus(paymentId) {
        try {
            // In a real implementation, this would query the payment provider
            if (this.currentPayment && this.currentPayment.id === paymentId) {
                return {
                    success: true,
                    status: this.currentPayment.status,
                    payment: this.currentPayment
                };
            }
            
            throw new Error('Payment not found');

        } catch (error) {
            return {
                success: false,
                error: error.message
            };
        }
    }

    // Abstract methods to be implemented by child classes
    async createPaymentIntent(paymentData) {
        throw new Error('createPaymentIntent must be implemented by child class');
    }

    async executePayment(paymentMethodData) {
        throw new Error('executePayment must be implemented by child class');
    }

    async executeCancellation(paymentId) {
        throw new Error('executeCancellation must be implemented by child class');
    }

    // Utility methods
    generatePaymentId() {
        const timestamp = Date.now().toString(36);
        const random = Math.random().toString(36).substr(2, 9);
        return `pay_${timestamp}_${random}`;
    }

    formatCurrency(amount, currency) {
        return new Intl.NumberFormat('en-US', {
            style: 'currency',
            currency: currency
        }).format(amount);
    }

    convertCurrency(amount, fromCurrency, toCurrency) {
        // This is a simplified version
        // In production, use a currency conversion API
        const rates = {
            USD: 1,
            ETB: 54.5,
            EUR: 0.85,
            GBP: 0.73
        };

        const fromRate = rates[fromCurrency] || 1;
        const toRate = rates[toCurrency] || 1;
        
        return (amount / fromRate) * toRate;
    }

    // Callback registration
    on(event, callback) {
        if (this.callbacks[`on${event.charAt(0).toUpperCase() + event.slice(1)}`]) {
            this.callbacks[`on${event.charAt(0).toUpperCase() + event.slice(1)}`] = callback;
        }
    }

    // Error handling
    handlePaymentError(error) {
        const errorMap = {
            'insufficient_funds': 'Insufficient funds in your account',
            'card_declined': 'Your card was declined',
            'expired_card': 'Your card has expired',
            'network_error': 'Network error, please try again',
            'timeout': 'Payment timeout, please try again'
        };

        const userMessage = errorMap[error.code] || error.message || 'Payment failed';
        Notifications.error(userMessage);
    }

    getNextStep() {
        return {
            instructions: 'Please proceed with payment method selection',
            availableMethods: this.paymentMethods
        };
    }
}

export default PaymentSystem;
