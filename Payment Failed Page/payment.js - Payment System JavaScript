// Payment System JavaScript
class PaymentSystem {
    constructor() {
        this.currentMethod = 'telebirr';
        this.paymentData = {};
        this.init();
    }

    init() {
        this.setupPaymentMethods();
        this.setupFileUpload();
        this.setupCopyButtons();
        this.setupFormValidation();
        this.loadSavedData();
        this.setupAutoSave();
    }

    setupPaymentMethods() {
        const methodCards = document.querySelectorAll('.payment-method-card');
        methodCards.forEach(card => {
            card.addEventListener('click', () => {
                this.selectPaymentMethod(card.dataset.method);
            });
        });

        // Set default method
        this.selectPaymentMethod('telebirr');
    }

    selectPaymentMethod(method) {
        this.currentMethod = method;
        
        // Update UI
        document.querySelectorAll('.payment-method-card').forEach(card => {
            const icon = card.querySelector('.method-select i');
            if (card.dataset.method === method) {
                card.classList.add('active');
                icon.className = 'fas fa-check-circle';
            } else {
                card.classList.remove('active');
                icon.className = 'far fa-circle';
            }
        });

        // Show relevant form
        document.querySelectorAll('.payment-form').forEach(form => {
            form.classList.remove('active');
        });

        switch(method) {
            case 'telebirr':
            case 'hellocash':
            case 'amole':
                document.getElementById('telebirrForm').classList.add('active');
                break;
            case 'cbe':
            case 'awash':
                document.getElementById('bankForm').classList.add('active');
                break;
            case 'visa':
            case 'mastercard':
                document.getElementById('cardForm').classList.add('active');
                break;
        }

        // Update payment instructions based on method
        this.updatePaymentInstructions(method);
    }

    updatePaymentInstructions(method) {
        const accountDetails = {
            'telebirr': {
                phone: '+251 92 485 8244',
                name: 'ZewedJobs PLC',
                instructions: 'Send payment via Telebirr app and upload screenshot'
            },
            'hellocash': {
                phone: '+251 93 837 1557',
                name: 'ZewedJobs PLC',
                instructions: 'Send payment via HelloCash app and upload screenshot'
            },
            'amole': {
                phone: '+251 92 485 8244',
                name: 'ZewedJobs PLC',
                instructions: 'Send payment via Amole app and upload screenshot'
            }
        };

        const details = accountDetails[method];
        if (details) {
            document.querySelector('.account-item .value').textContent = details.phone;
            document.querySelectorAll('.account-item .value')[1].textContent = details.name;
        }
    }

    setupFileUpload() {
        const uploadArea = document.getElementById('uploadArea');
        const fileInput = document.getElementById('receiptUpload');
        const uploadedFile = document.getElementById('uploadedFile');
        const fileName = document.getElementById('fileName');
        const removeBtn = uploadedFile.querySelector('.remove-btn');

        if (uploadArea && fileInput) {
            // Click on upload area
            uploadArea.addEventListener('click', () => {
                fileInput.click();
            });

            // Drag and drop
            uploadArea.addEventListener('dragover', (e) => {
                e.preventDefault();
                uploadArea.style.borderColor = 'var(--primary)';
                uploadArea.style.backgroundColor = 'var(--primary-light)';
            });

            uploadArea.addEventListener('dragleave', () => {
                uploadArea.style.borderColor = '';
                uploadArea.style.backgroundColor = '';
            });

            uploadArea.addEventListener('drop', (e) => {
                e.preventDefault();
                uploadArea.style.borderColor = '';
                uploadArea.style.backgroundColor = '';
                
                const files = e.dataTransfer.files;
                if (files.length > 0) {
                    this.handleFileUpload(files[0]);
                }
            });

            // File input change
            fileInput.addEventListener('change', (e) => {
                if (e.target.files.length > 0) {
                    this.handleFileUpload(e.target.files[0]);
                }
            });

            // Remove file
            removeBtn.addEventListener('click', () => {
                uploadedFile.style.display = 'none';
                fileInput.value = '';
                uploadArea.style.display = 'flex';
            });
        }

        // Bank receipt upload
        const bankUploadArea = document.getElementById('bankUploadArea');
        const bankReceipt = document.getElementById('bankReceipt');

        if (bankUploadArea && bankReceipt) {
            bankUploadArea.addEventListener('click', () => {
                bankReceipt.click();
            });

            bankReceipt.addEventListener('change', (e) => {
                if (e.target.files.length > 0) {
                    this.handleFileUpload(e.target.files[0], true);
                }
            });
        }
    }

    handleFileUpload(file, isBank = false) {
        // Validate file
        const validTypes = ['image/jpeg', 'image/png', 'image/jpg', 'application/pdf'];
        const maxSize = 5 * 1024 * 1024; // 5MB

        if (!validTypes.includes(file.type)) {
            this.showNotification('Please upload only JPG, PNG, or PDF files', 'error');
            return;
        }

        if (file.size > maxSize) {
            this.showNotification('File size should be less than 5MB', 'error');
            return;
        }

        // Update UI
        if (isBank) {
            const uploadArea = document.getElementById('bankUploadArea');
            uploadArea.innerHTML = `
                <i class="fas fa-file-upload"></i>
                <p>${file.name}</p>
                <span>${(file.size / 1024 / 1024).toFixed(2)} MB</span>
            `;
        } else {
            const uploadArea = document.getElementById('uploadArea');
            const uploadedFile = document.getElementById('uploadedFile');
            const fileName = document.getElementById('fileName');

            uploadArea.style.display = 'none';
            uploadedFile.style.display = 'flex';
            fileName.textContent = file.name;
        }

        // Store file reference
        this.paymentData.receiptFile = file;
        this.saveData();
    }

    setupCopyButtons() {
        document.querySelectorAll('.copy-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const text = e.target.dataset.text || e.target.parentElement.dataset.text;
                this.copyToClipboard(text);
            });
        });
    }

    copyToClipboard(text) {
        navigator.clipboard.writeText(text).then(() => {
            this.showNotification('Copied to clipboard!', 'success');
        }).catch(err => {
            console.error('Failed to copy:', err);
            // Fallback for older browsers
            const textarea = document.createElement('textarea');
            textarea.value = text;
            document.body.appendChild(textarea);
            textarea.select();
            document.execCommand('copy');
            document.body.removeChild(textarea);
            this.showNotification('Copied to clipboard!', 'success');
        });
    }

    setupFormValidation() {
        const forms = document.querySelectorAll('.payment-form');
        forms.forEach(form => {
            const inputs = form.querySelectorAll('input[required], select[required]');
            inputs.forEach(input => {
                input.addEventListener('blur', () => {
                    this.validateInput(input);
                });
            });
        });

        // Real-time validation for card inputs
        const cardInputs = ['cardNumber', 'cardExpiry', 'cardCVC'];
        cardInputs.forEach(id => {
            const input = document.getElementById(id);
            if (input) {
                input.addEventListener('input', (e) => {
                    this.formatCardInput(e.target);
                });
            }
        });
    }

    validateInput(input) {
        const value = input.value.trim();
        const parent = input.parentElement;
        
        parent.classList.remove('error', 'success');

        if (!value && input.required) {
            parent.classList.add('error');
            return false;
        }

        switch(input.type) {
            case 'email':
                const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
                if (!emailRegex.test(value)) {
                    parent.classList.add('error');
                    return false;
                }
                break;
            case 'tel':
                const phoneRegex = /^\+?[\d\s-]{10,}$/;
                if (!phoneRegex.test(value)) {
                    parent.classList.add('error');
                    return false;
                }
                break;
        }

        parent.classList.add('success');
        return true;
    }

    formatCardInput(input) {
        let value = input.value.replace(/\D/g, '');

        switch(input.id) {
            case 'cardNumber':
                if (value.length > 16) value = value.substring(0, 16);
                value = value.replace(/(\d{4})/g, '$1 ').trim();
                break;
            case 'cardExpiry':
                if (value.length > 4) value = value.substring(0, 4);
                if (value.length >= 2) {
                    value = value.replace(/(\d{2})(\d{0,2})/, '$1/$2');
                }
                break;
            case 'cardCVC':
                if (value.length > 4) value = value.substring(0, 4);
                break;
        }

        input.value = value;
    }

    loadSavedData() {
        const saved = localStorage.getItem('zewedjobs_payment_data');
        if (saved) {
            this.paymentData = JSON.parse(saved);
            this.populateFormData();
        }
    }

    populateFormData() {
        // Populate form fields from saved data
        const fields = ['fullName', 'email', 'phone', 'company', 'transactionId'];
        fields.forEach(field => {
            const element = document.getElementById(field);
            if (element && this.paymentData[field]) {
                element.value = this.paymentData[field];
            }
        });

        // Select saved payment method
        if (this.paymentData.paymentMethod) {
            this.selectPaymentMethod(this.paymentData.paymentMethod);
        }
    }

    setupAutoSave() {
        const autoSaveFields = document.querySelectorAll('#fullName, #email, #phone, #company, #transactionId');
        autoSaveFields.forEach(field => {
            field.addEventListener('input', () => {
                this.paymentData[field.id] = field.value;
                this.saveData();
            });
        });

        // Save payment method when selected
        document.querySelectorAll('.payment-method-card').forEach(card => {
            card.addEventListener('click', () => {
                this.paymentData.paymentMethod = card.dataset.method;
                this.saveData();
            });
        });
    }

    saveData() {
        localStorage.setItem('zewedjobs_payment_data', JSON.stringify(this.paymentData));
    }

    validatePaymentForm() {
        let isValid = true;

        // Validate required fields based on payment method
        switch(this.currentMethod) {
            case 'telebirr':
            case 'hellocash':
            case 'amole':
                if (!document.getElementById('transactionId').value) {
                    this.showNotification('Please enter transaction ID', 'error');
                    isValid = false;
                }
                if (!this.paymentData.receiptFile) {
                    this.showNotification('Please upload payment receipt', 'error');
                    isValid = false;
                }
                break;
            case 'cbe':
            case 'awash':
                if (!document.getElementById('senderName').value) {
                    this.showNotification('Please enter sender name', 'error');
                    isValid = false;
                }
                if (!this.paymentData.receiptFile) {
                    this.showNotification('Please upload bank slip', 'error');
                    isValid = false;
                }
                break;
            case 'visa':
            case 'mastercard':
                const cardFields = ['cardNumber', 'cardExpiry', 'cardCVC', 'cardName', 'cardEmail'];
                cardFields.forEach(field => {
                    const element = document.getElementById(field);
                    if (element && !element.value) {
                        this.showNotification(`Please fill in ${field.replace('card', '').toLowerCase()}`, 'error');
                        isValid = false;
                    }
                });
                break;
        }

        // Validate contact information
        const contactFields = ['fullName', 'email', 'phone'];
        contactFields.forEach(field => {
            const element = document.getElementById(field);
            if (element && !element.value) {
                this.showNotification(`Please fill in ${field}`, 'error');
                isValid = false;
            }
        });

        // Validate terms agreement
        if (!document.getElementById('termsAgreement').checked) {
            this.showNotification('Please agree to terms and conditions', 'error');
            isValid = false;
        }

        return isValid;
    }

    submitPayment()
