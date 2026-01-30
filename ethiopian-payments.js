/**
 * Ethiopian Payment System
 * Supports:
 * - CBE Birr
 * - Dashen Bank
 * - Awash Bank
 * - Telebirr
 * - HelloCash
 * - Amole
 */

import PaymentSystem from './payment.js';

class EthiopianPayment extends PaymentSystem {
    constructor(config = {}) {
        super({
            name: 'Ethiopian Payment System',
            currency: 'ETB',
            supportedCurrencies: ['ETB', 'USD'],
            ...config
        });

        this.bankOptions = config.bankOptions || {
            cbe: {
                name: 'Commercial Bank of Ethiopia',
                code: 'CBE',
                logo: 'cbe-logo.png',
                requiresAccount: true
            },
            dashen: {
                name: 'Dashen Bank',
                code: 'DASHEN',
                logo: 'dashen-logo.png',
                requiresAccount: true
            },
            awash: {
                name: 'Awash Bank',
                code: 'AWASH',
                logo: 'awash-logo.png',
                requiresAccount: true
            }
        };

        this.mobileMoneyOptions = config.mobileMoneyOptions || {
            telebirr: {
                name: 'Telebirr',
                provider: 'Ethio Telecom',
                logo: 'telebirr-logo.png',
                requiresPhone: true
            },
            hellocash: {
                name: 'HelloCash',
                provider: 'Hedareseb',
                logo: 'hellocash-logo.png',
                requiresPhone: true
            },
            amole: {
                name: 'Amole',
                provider: 'Safaricom',
                logo: 'amole-logo.png',
                requiresPhone: true
            }
        };

        this.paymentMethods = [
            ...Object.values(this.bankOptions),
            ...Object.values(this.mobileMoneyOptions)
        ];
    }

    async createPaymentIntent(paymentData) {
        try {
            // Generate payment reference
            const reference = this.generateReferenceNumber();
            
            // For Ethiopian payments, we need additional validation
            await this.validateEthiopianRequirements(paymentData);
            
            return {
                paymentIntentId: `et_intent_${reference}`,
                reference: reference,
                amount: paymentData.amount,
                currency: paymentData.currency,
                paymentInstructions: this.getPaymentInstructions(paymentData.method),
                expiresAt: new Date(Date.now() + 30 * 60000).toISOString() // 30 minutes
            };

        } catch (error) {
            console.error('Failed to create payment intent:', error);
            throw error;
        }
    }

    async executePayment(paymentMethodData) {
        const method = paymentMethodData.method;
        
        try {
            // Route to appropriate payment method
            if (this.bankOptions[method]) {
                return await this.processBankPayment(paymentMethodData);
            } else if (this.mobileMoneyOptions[method]) {
                return await this.processMobileMoneyPayment(paymentMethodData);
            } else {
                throw new Error(`Unsupported payment method: ${method}`);
            }

        } catch (error) {
            console.error('Payment execution failed:', error);
            throw error;
        }
    }

    async processBankPayment(paymentData) {
        const bank = this.bankOptions[paymentData.method];
        
        try {
            // Validate bank account details
            this.validateBankDetails(paymentData.bankDetails);
            
            // Simulate bank API call
            const response = await this.callBankAPI({
                bank: bank.code,
                accountNumber: paymentData.bankDetails.accountNumber,
                amount: paymentData.amount,
                currency: paymentData.currency,
                reference: paymentData.reference
            });

            if (response.success) {
                return {
                    success: true,
                    transactionId: response.transactionId,
                    receipt: {
                        bank: bank.name,
                        accountNumber: this.maskAccountNumber(paymentData.bankDetails.accountNumber),
                        amount: paymentData.amount,
                        currency: paymentData.currency,
                        transactionId: response.transactionId,
                        timestamp: new Date().toISOString(),
                        reference: paymentData.reference
                    }
                };
            } else {
                throw new Error(response.error || 'Bank payment failed');
            }

        } catch (error) {
            throw error;
        }
    }

    async processMobileMoneyPayment(paymentData) {
        const mobileMoney = this.mobileMoneyOptions[paymentData.method];
        
        try {
            // Validate phone number
            this.validatePhoneNumber(paymentData.phoneNumber);
            
            // Send payment request to mobile money provider
            const response = await this.callMobileMoneyAPI({
                provider: mobileMoney.provider,
                phoneNumber: paymentData.phoneNumber,
                amount: paymentData.amount,
                pin: paymentData.pin, // In real app, never handle PIN directly
                reference: paymentData.reference
            });

            if (response.success) {
                return {
                    success: true,
                    transactionId: response.transactionId,
                    receipt: {
                        provider: mobileMoney.name,
                        phoneNumber: this.maskPhoneNumber(paymentData.phoneNumber),
                        amount: paymentData.amount,
                        currency: 'ETB',
                        transactionId: response.transactionId,
                        timestamp: new Date().toISOString(),
                        reference: paymentData.reference
                    }
                };
            } else {
                throw new Error(response.error || 'Mobile money payment failed');
            }

        } catch (error) {
            throw error;
        }
    }

    async executeCancellation(paymentId) {
        // Call Ethiopian payment gateway cancellation endpoint
        const response = await API.post('/payments/ethiopian/cancel', {
            paymentId: paymentId
        });

        return response;
    }

    // Ethiopian-specific validation methods
    async validateEthiopianRequirements(paymentData) {
        const errors = [];
        
        // Check if amount is in ETB for local payments
        if (paymentData.currency !== 'ETB' && paymentData.method in this.bankOptions) {
            errors.push('Bank payments must be in ETB');
        }
        
        // Check minimum amount
        if (paymentData.amount < 10) { // 10 ETB minimum
            errors.push('Minimum payment amount is 10 ETB');
        }
        
        // Check maximum amount (may vary by bank)
        if (paymentData.amount > 100000) { // 100,000 ETB maximum
            errors.push('Maximum payment amount exceeded');
        }
        
        if (errors.length > 0) {
            throw new Error(errors.join(', '));
        }
    }

    validateBankDetails(bankDetails) {
        if (!bankDetails.accountNumber) {
            throw new Error('Account number is required');
        }
        
        if (!bankDetails.accountName) {
            throw new Error('Account name is required');
        }
        
        // Validate Ethiopian bank account number format
        const accountRegex = /^\d{13}$/; // Example: 13-digit account numbers
        if (!accountRegex.test(bankDetails.accountNumber)) {
            throw new Error('Invalid account number format');
        }
    }

    validatePhoneNumber(phoneNumber) {
        // Validate Ethiopian phone number format
        const phoneRegex = /^(?:(?:\+251|251|0)(9\d{8}))$/;
        if (!phoneRegex.test(phoneNumber)) {
            throw new Error('Invalid Ethiopian phone number format');
        }
    }

    // Utility methods
    generateReferenceNumber() {
        const date = new Date();
        const year = date.getFullYear().toString().substr(-2);
        const month = (date.getMonth() + 1).toString().padStart(2, '0');
        const day = date.getDate().toString().padStart(2, '0');
        const random = Math.floor(Math.random() * 10000).toString().padStart(4, '0');
        
        return `ET${year}${month}${day}${random}`;
    }

    maskAccountNumber(accountNumber) {
        if (accountNumber.length <= 4) return accountNumber;
        return '****' + accountNumber.slice(-4);
    }

    maskPhoneNumber(phoneNumber) {
        if (phoneNumber.length <= 4) return phoneNumber;
        const visibleDigits = 3;
        return phoneNumber.slice(0, visibleDigits) + '****' + phoneNumber.slice(-4);
    }

    getPaymentInstructions(method) {
        const instructions = {
            cbe: 'Transfer the amount to account number XXXX-XXXX-XXXX. Use the reference number in the description.',
            dashen: 'Use Dashen iBank or visit any Dashen branch with the reference number.',
            awash: 'Awash Bank customers can use AwashMobile or visit any branch.',
            telebirr: 'Dial *127# and follow the prompts to complete payment.',
            hellocash: 'Open HelloCash app and send money using the reference number.',
            amole: 'Use Amole app or dial *889# to complete payment.'
        };

        return instructions[method] || 'Please complete the payment using your preferred method.';
    }

    // Mock API calls (replace with real API calls)
    async callBankAPI(data) {
        // Simulate API call delay
        await new Promise(resolve => setTimeout(resolve, 1000));
        
        // Mock successful response
        return {
            success: true,
            transactionId: `ETB_TX_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
            message: 'Payment processed successfully'
        };
    }

    async callMobileMoneyAPI(data) {
        // Simulate API call delay
        await new Promise(resolve => setTimeout(resolve, 1500));
        
        // Mock successful response
        return {
            success: true,
            transactionId: `MM_TX_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
            message: 'Mobile money payment successful'
        };
    }
}

export default EthiopianPayment;
