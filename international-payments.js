/**
 * International Payment System
 * Supports:
 * - Stripe
 * - PayPal
 * - Square
 * - 2Checkout
 * - Braintree
 */

import PaymentSystem from './payment.js';

class InternationalPayment extends PaymentSystem {
    constructor(config = {}) {
        super({
            name: 'International Payment System',
            currency: 'USD',
            supportedCurrencies: ['USD', 'EUR', 'GBP', 'CAD', 'AUD'],
            ...config
        });

        this.providers = config.providers || {
            stripe: {
                name: 'Stripe',
                apiKey: config.stripeApiKey,
                publishableKey: config.stripePublishableKey,
                requiresCard: true,
                supports3DSecure: true
            },
            paypal: {
                name: 'PayPal',
                clientId: config.paypalClientId,
                sandbox: config.paypalSandbox || false,
                requiresRedirect: true
            },
            square: {
                name: 'Square',
                applicationId: config.squareAppId,
                locationId: config.squareLocationId
            }
        };

        this.activeProvider = config.defaultProvider || 'stripe';
        this.paymentMethods = Object.values(this.providers);
        
        // Initialize provider SDKs
        this.initializeProviders();
    }

    async initializeProviders() {
        // Initialize Stripe if available
        if (this.providers.stripe && this.providers.stripe.publishableKey) {
            await this.loadStripeSDK();
        }
        
        // Initialize PayPal if available
        if (this.providers.paypal && this.providers.paypal.clientId) {
            await this.loadPayPalSDK();
        }
    }

    async loadStripeSDK() {
        return new Promise((resolve, reject) => {
            if (window.Stripe) {
                this.stripe = window.Stripe(this.providers.stripe.publishableKey);
                resolve();
            } else {
                const script = document.createElement('script');
                script.src = 'https://js.stripe.com/v3/';
                script.onload = () => {
                    this.stripe = window.Stripe(this.providers.stripe.publishableKey);
                    resolve();
                };
                script.onerror = reject;
                document.head.appendChild(script);
            }
        });
    }

    async loadPayPalSDK() {
        return new Promise((resolve, reject) => {
            if (window.paypal) {
                resolve();
            } else {
                const script = document.createElement('script');
                const clientId = this.providers.paypal.clientId;
                const env = this.providers.paypal.sandbox ? 'sandbox' : 'production';
                script.src = `https://www.paypal.com/sdk/js?client-id=${clientId}&currency=USD`;
                script.onload = resolve;
                script.onerror = reject;
                document.head.appendChild(script);
            }
        });
    }

    async createPaymentIntent(paymentData) {
        const provider = this.providers[this.activeProvider];
        
        try {
            switch (this.activeProvider) {
                case 'stripe':
                    return await this.createStripePaymentIntent(paymentData);
                case 'paypal':
                    return await this.createPayPalOrder(paymentData);
                case 'square':
                    return await this.createSquarePaymentIntent(paymentData);
                default:
                    throw new Error(`Unsupported provider: ${this.activeProvider}`);
            }
        } catch (error) {
            console.error('Failed to create payment intent:', error);
            throw error;
        }
    }

    async executePayment(paymentMethodData) {
        const provider = this.providers[this.activeProvider];
        
        try {
            switch (this.activeProvider) {
                case 'stripe':
                    return await this.confirmStripePayment(paymentMethodData);
                case 'paypal':
                    return await this.confirmPayPalPayment(paymentMethodData);
                case 'square':
                    return await this.confirmSquarePayment(paymentMethodData);
                default:
                    throw new Error(`Unsupported provider: ${this.activeProvider}`);
            }
        } catch (error) {
            console.error('Payment execution failed:', error);
            throw error;
        }
    }

    async executeCancellation(paymentId) {
        // Call cancellation API for the active provider
        const response = await API.post(`/payments/international/${this.activeProvider}/cancel`, {
            paymentId: paymentId
        });

        return response;
    }

    // Stripe integration
    async createStripePaymentIntent(paymentData) {
        try {
            // Create payment intent on your server
            const response = await API.post('/payments/stripe/create-intent', {
                amount: Math.round(paymentData.amount * 100), // Convert to cents
                currency: paymentData.currency,
                description: paymentData.description || 'Payment',
                metadata: {
                    customer_email: paymentData.customer.email,
                    ...paymentData.metadata
                }
            });

            return {
                paymentIntentId: response.clientSecret,
                clientSecret: response.clientSecret,
                publishableKey: this.providers.stripe.publishableKey,
                amount: paymentData.amount,
                currency: paymentData.currency
            };

        } catch (error) {
            throw new Error(`Stripe payment intent creation failed: ${error.message}`);
        }
    }

    async confirmStripePayment(paymentMethodData) {
        try {
            const { paymentIntent, error } = await this.stripe.confirmCardPayment(
                paymentMethodData.clientSecret,
                {
                    payment_method: {
                        card: paymentMethodData.cardElement,
                        billing_details: {
                            name: paymentMethodData.cardholderName,
                            email: paymentMethodData.email
                        }
                    }
                }
            );

            if (error) {
                throw error;
            }

            if (paymentIntent.status === 'succeeded') {
                return {
                    success: true,
                    transactionId: paymentIntent.id,
                    receipt: {
                        provider: 'Stripe',
                        amount: paymentIntent.amount / 100,
                        currency: paymentIntent.currency,
                        transactionId: paymentIntent.id,
                        status: paymentIntent.status,
                        timestamp: new Date(paymentIntent.created * 1000).toISOString()
                    }
                };
            } else {
                throw new Error(`Payment status: ${paymentIntent.status}`);
            }

        } catch (error) {
            throw error;
        }
    }

    // PayPal integration
    async createPayPalOrder(paymentData) {
        try {
            // Create order on your server
            const response = await API.post('/payments/paypal/create-order', {
                amount: paymentData.amount,
                currency: paymentData.currency,
                items: paymentData.items || [],
                shipping: paymentData.shipping || null
            });

            return {
                orderId: response.id,
                approveUrl: response.links.find(link => link.rel === 'approve').href,
                amount: paymentData.amount,
                currency: paymentData.currency
            };

        } catch (error) {
            throw new Error(`PayPal order creation failed: ${error.message}`);
        }
    }

    async confirmPayPalPayment(paymentMethodData) {
        try {
            // Capture the order on your server
            const response = await API.post('/payments/paypal/capture-order', {
                orderId: paymentMethodData.orderId
            });

            if (response.status === 'COMPLETED') {
                return {
                    success: true,
                    transactionId: response.id,
                    receipt: {
                        provider: 'PayPal',
                        amount: response.amount.value,
                        currency: response.amount.currency_code,
                        transactionId: response.id,
                        status: response.status,
                        timestamp: response.create_time
                    }
                };
            } else {
                throw new Error(`Payment status: ${response.status}`);
            }

        } catch (error) {
            throw error;
        }
    }

    // Square integration
    async createSquarePaymentIntent(paymentData) {
        try {
            // Create payment intent on your server
            const response = await API.post('/payments/square/create-intent', {
                amount: Math.round(paymentData.amount * 100),
                currency: paymentData.currency,
                locationId: this.providers.square.locationId
            });

            return {
                paymentIntentId: response.id,
                clientSecret: response.client_secret,
                locationId: this.providers.square.locationId,
                amount: paymentData.amount,
                currency: paymentData.currency
            };

        } catch (error) {
            throw new Error(`Square payment intent creation failed: ${error.message}`);
        }
    }

    async confirmSquarePayment(paymentMethodData) {
        try {
            // Initialize Square payment form
            const payments = window.Square.payments(
                this.providers.square.applicationId,
                this.providers.square.locationId
            );

            const card = await payments.card();
            await card.attach('#card-container');

            const result = await card.tokenize();
            if (result.status === 'OK') {
                // Process payment on your server
                const response = await API.post('/payments/square/process-payment', {
                    sourceId: result.token,
                    amount: paymentMethodData.amount * 100,
                    idempotencyKey: paymentMethodData.paymentId
                });

                if (response.status === 'COMPLETED') {
                    return {
                        success: true,
                        transactionId: response.id,
                        receipt: {
                            provider: 'Square',
                            amount: paymentMethodData.amount,
                            currency: paymentMethodData.currency,
                            transactionId: response.id,
                            status: response.status,
                            timestamp: response.created_at
                        }
                    };
                } else {
                    throw new Error(`Payment status: ${response.status}`);
                }
            } else {
                throw new Error(result.errors[0].message);
            }

        } catch (error) {
            throw error;
        }
    }

    // Provider management
    setActiveProvider(providerName) {
        if (this.providers[providerName]) {
            this.activeProvider = providerName;
            Notifications.success(`Payment provider changed to ${this.providers[providerName].name}`);
            return true;
        }
        
        Notifications.error(`Provider ${providerName} not available`);
        return false;
    }

    getActiveProvider() {
        return {
            name: this.providers[this.activeProvider].name,
            type: this.activeProvider,
            details: this.providers[this.activeProvider]
        };
    }

    // International payment validation
    async validateInternationalPayment(paymentData) {
        const errors = [];
        
        // Check if amount meets minimum for international transactions
        if (paymentData.amount < 1) { // $1 minimum
            errors.push('Minimum payment amount is $1.00');
        }
        
        // Check for currency conversion
        if (paymentData.currency !== 'USD') {
            const convertedAmount = this.convertCurrency(
                paymentData.amount,
                paymentData.currency,
                'USD'
            );
            
            if (convertedAmount < 1) {
                errors.push('Converted amount must be at least $1.00');
            }
        }
        
        // Validate customer email
        if (!paymentData.customer.email) {
            errors.push('Email is required for international payments');
        }
        
        // Validate customer address for certain providers
        if (['stripe', 'square'].includes(this.activeProvider)) {
            if (!paymentData.customer.address) {
                errors.push('Billing address is required');
            }
        }
        
        if (errors.length > 0) {
            throw new Error(errors.join(', '));
        }
    }

    // Fraud detection
    async checkFraudRisk(paymentData) {
        try {
            const response = await API.post('/payments/fraud-check', {
                amount: paymentData.amount,
                currency: paymentData.currency,
                customer: paymentData.customer,
                ipAddress: await this.getClientIP(),
                userAgent: navigator.userAgent
            });

            return {
                riskLevel: response.riskLevel,
                score: response.score,
                recommendations: response.recommendations
            };

        } catch (error) {
            console.warn('Fraud check failed:', error);
            return {
                riskLevel: 'medium',
                score: 50,
                recommendations: ['Proceed with caution']
            };
        }
    }

    async getClientIP() {
        try {
            const response = await fetch('https://api.ipify.org?format=json');
            const data = await response.json();
            return data.ip;
        } catch (error) {
            return 'unknown';
        }
    }

    // Currency handling
    getSupportedCurrencies() {
        const providerCurrencies = {
            stripe: ['USD', 'EUR', 'GBP', 'CAD', 'AUD', 'JPY'],
            paypal: ['USD', 'EUR', 'GBP', 'CAD', 'AUD', 'JPY'],
            square: ['USD', 'CAD', 'AUD', 'JPY']
        };

        return providerCurrencies[this.activeProvider] || ['USD'];
    }

    // 3D Secure handling
    async handle3DSecure(paymentMethodData) {
        if (this.activeProvider === 'stripe' && this.providers.stripe.supports3DSecure) {
            try {
                const { paymentIntent, error } = await this.stripe.handleCardAction(
                    paymentMethodData.clientSecret
                );

                if (error) {
                    throw error;
                }

                return {
                    requiresAction: false,
                    paymentIntent: paymentIntent
                };
            } catch (error) {
                throw error;
            }
        }

        return { requiresAction: false };
    }
}

export default InternationalPayment;
