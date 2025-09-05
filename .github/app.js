// Complete SecureWallet Application with Firebase Integration
class SecureWallet {
    constructor() {
        this.currentScreen = 'email-screen';
        this.generatedOTP = null;
        this.otpExpiry = null;
        this.resendCooldown = false;
        this.userData = {
            email: '',
            passwordHash: '',
            seedPhrase: [],
            walletAddress: '',
            balances: {
                BTC: { amount: 0.15647832, usd_value: 4234.56 },
                ETH: { amount: 3.24567891, usd_value: 5678.90 },
                USDT: { amount: 1234.56, usd_value: 1234.56 }
            },
            transactions: []
        };
        
        this.walletAddresses = {
            BTC: 'bc1qxy2kgdygjrsqtzq2n0yrf2493p83kkfjhx0wlh',
            ETH: '0x742d35Cc6634C0532925a3b8D7A7C0CfF7E0A5b8',
            USDT: 'TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t'
        };
        
        this.currentTab = 'overview';
        this.paymentRequestId = 0;
        this.init();
    }

    init() {
        console.log('SecureWallet initializing...');
        this.setupEventListeners();
        this.generateSeedPhrase();
        this.loadSampleTransactions();
        console.log('SecureWallet ready!');
    }

    // 🔥 FIREBASE METHODS
    async saveUserToFirebase(userData) {
        if (!window.firebaseDB) {
            console.log('Firebase not available, using localStorage fallback');
            this.saveToLocalStorage(userData);
            return;
        }

        try {
            await window.firebaseDB.collection('users').doc(userData.email).set({
                email: userData.email,
                passwordHash: userData.passwordHash,
                seedPhrase: userData.seedPhrase,
                walletAddress: userData.walletAddress,
                balances: userData.balances,
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString()
            });
            console.log('✅ User saved to Firebase:', userData.email);
        } catch (error) {
            console.error('❌ Firebase save failed:', error);
            this.saveToLocalStorage(userData);
        }
    }

    async loadUserFromFirebase(email) {
        if (!window.firebaseDB) {
            return this.loadFromLocalStorage(email);
        }

        try {
            const doc = await window.firebaseDB.collection('users').doc(email).get();
            if (doc.exists) {
                const userData = doc.data();
                this.userData = { ...this.userData, ...userData };
                console.log('✅ User loaded from Firebase:', email);
                return true;
            }
            return false;
        } catch (error) {
            console.error('❌ Firebase load failed:', error);
            return this.loadFromLocalStorage(email);
        }
    }

    async saveTransactionToFirebase(transaction) {
        if (!window.firebaseDB) {
            return;
        }

        try {
            await window.firebaseDB.collection('transactions').doc(transaction.id).set({
                ...transaction,
                userEmail: this.userData.email,
                createdAt: new Date().toISOString()
            });
            console.log('✅ Transaction saved to Firebase:', transaction.id);
        } catch (error) {
            console.error('❌ Transaction save failed:', error);
        }
    }

    async loadTransactionsFromFirebase() {
        if (!window.firebaseDB) {
            return [];
        }

        try {
            const snapshot = await window.firebaseDB.collection('transactions')
                .where('userEmail', '==', this.userData.email)
                .orderBy('createdAt', 'desc')
                .get();
            
            const transactions = [];
            snapshot.forEach(doc => {
                transactions.push(doc.data());
            });
            
            if (transactions.length > 0) {
                this.userData.transactions = transactions;
                console.log(`✅ Loaded ${transactions.length} transactions from Firebase`);
            }
            
            return transactions;
        } catch (error) {
            console.error('❌ Transaction load failed:', error);
            return [];
        }
    }

    // LocalStorage fallback methods
    saveToLocalStorage(userData) {
        try {
            localStorage.setItem('secureWallet_' + userData.email, JSON.stringify(userData));
            console.log('✅ Data saved to localStorage (fallback)');
        } catch (error) {
            console.error('localStorage save failed:', error);
        }
    }

    loadFromLocalStorage(email) {
        try {
            const data = localStorage.getItem('secureWallet_' + email);
            if (data) {
                const parsed = JSON.parse(data);
                this.userData = { ...this.userData, ...parsed };
                console.log('✅ Data loaded from localStorage (fallback)');
                return true;
            }
            return false;
        } catch (error) {
            console.error('localStorage load failed:', error);
            return false;
        }
    }

    setupEventListeners() {
        // Email verification
        const sendOtpBtn = document.getElementById('send-otp-btn');
        const verifyOtpBtn = document.getElementById('verify-otp-btn');
        
        if (sendOtpBtn) {
            sendOtpBtn.addEventListener('click', () => this.sendOTP());
        }
        
        if (verifyOtpBtn) {
            verifyOtpBtn.addEventListener('click', () => this.verifyOTP());
        }

        // OTP input handling
        const otpInputs = document.querySelectorAll('.otp-input');
        otpInputs.forEach((input, index) => {
            input.addEventListener('input', (e) => this.handleOTPInput(e, index));
            input.addEventListener('keydown', (e) => this.handleOTPKeydown(e, index));
        });

        // Password creation
        const passwordInput = document.getElementById('password');
        const confirmPasswordInput = document.getElementById('confirm-password');
        const continuePasswordBtn = document.getElementById('continue-password-btn');
        const passwordToggle = document.getElementById('password-toggle');
        const confirmPasswordToggle = document.getElementById('confirm-password-toggle');

        if (passwordInput) {
            passwordInput.addEventListener('input', () => this.validatePassword());
        }
        
        if (confirmPasswordInput) {
            confirmPasswordInput.addEventListener('input', () => this.validatePassword());
        }
        
        if (continuePasswordBtn) {
            continuePasswordBtn.addEventListener('click', () => this.createPassword());
        }
        
        if (passwordToggle) {
            passwordToggle.addEventListener('click', () => this.togglePasswordVisibility('password'));
        }
        
        if (confirmPasswordToggle) {
            confirmPasswordToggle.addEventListener('click', () => this.togglePasswordVisibility('confirm-password'));
        }

        // Seed phrase
        const regenerateSeedBtn = document.getElementById('regenerate-seed-btn');
        const downloadSeedBtn = document.getElementById('download-seed-btn');
        const seedSavedCheckbox = document.getElementById('seed-saved-checkbox');
        const seedConfirmation = document.getElementById('seed-confirmation');
        const accessWalletBtn = document.getElementById('access-wallet-btn');

        if (regenerateSeedBtn) {
            regenerateSeedBtn.addEventListener('click', () => this.generateSeedPhrase());
        }
        
        if (downloadSeedBtn) {
            downloadSeedBtn.addEventListener('click', () => this.downloadSeedPhrase());
        }
        
        if (seedSavedCheckbox) {
            seedSavedCheckbox.addEventListener('change', () => this.validateSeedPhrase());
        }
        
        if (seedConfirmation) {
            seedConfirmation.addEventListener('input', () => this.validateSeedPhrase());
        }
        
        if (accessWalletBtn) {
            accessWalletBtn.addEventListener('click', () => this.accessWallet());
        }

        // Settings button
        const settingsBtn = document.getElementById('settings-btn');
        if (settingsBtn) {
            settingsBtn.addEventListener('click', () => this.showSettings());
        }

        // Dashboard functionality
        this.setupDashboardEventListeners();

        console.log('Event listeners setup complete');
    }

    setupDashboardEventListeners() {
        // Dashboard navigation
        document.querySelectorAll('.tab-btn').forEach(btn => {
            btn.addEventListener('click', (e) => this.switchTab(e.target.dataset.tab));
        });

        // Send functionality
        const sendPaymentBtn = document.getElementById('send-payment-btn');
        if (sendPaymentBtn) {
            sendPaymentBtn.addEventListener('click', () => this.sendPayment());
        }

        // Receive functionality
        const generatePaymentQRBtn = document.getElementById('generate-payment-qr-btn');
        const downloadQRBtn = document.getElementById('download-qr-btn');
        const copyReceiveAddressBtn = document.getElementById('copy-receive-address-btn');
        const requestCurrency = document.getElementById('request-currency');

        if (generatePaymentQRBtn) {
            generatePaymentQRBtn.addEventListener('click', () => this.generatePaymentQR());
        }

        if (downloadQRBtn) {
            downloadQRBtn.addEventListener('click', () => this.downloadQRCode());
        }

        if (copyReceiveAddressBtn) {
            copyReceiveAddressBtn.addEventListener('click', () => this.copyReceiveAddress());
        }

        if (requestCurrency) {
            requestCurrency.addEventListener('change', () => this.updateReceiveAddress());
        }

        // Transfer functionality
        const confirmTransferBtn = document.getElementById('confirm-transfer-btn');
        if (confirmTransferBtn) {
            confirmTransferBtn.addEventListener('click', () => this.confirmTransfer());
        }

        // History search and filter
        const historyFilter = document.getElementById('history-filter');
        const historySearch = document.getElementById('history-search');

        if (historyFilter) {
            historyFilter.addEventListener('change', () => this.updateTransactionHistory());
        }

        if (historySearch) {
            historySearch.addEventListener('input', () => this.updateTransactionHistory());
        }

        // Quick actions
        document.querySelectorAll('[data-action]').forEach(btn => {
            btn.addEventListener('click', (e) => this.handleQuickAction(e.target.dataset.action));
        });

        // Logout
        const logoutBtn = document.getElementById('logout-btn');
        if (logoutBtn) {
            logoutBtn.addEventListener('click', () => this.logout());
        }

        // Copy wallet address
        const copyAddressBtn = document.getElementById('copy-address-btn');
        if (copyAddressBtn) {
            copyAddressBtn.addEventListener('click', () => this.copyWalletAddress());
        }

        // Setup send form calculations after dashboard loads
        setTimeout(() => this.setupSendFormCalculations(), 1000);
    }

    // Email Verification Methods
    async sendOTP() {
        console.log('sendOTP started');
        
        const emailInput = document.getElementById('email');
        const email = emailInput.value.trim();
        const sendBtn = document.getElementById('send-otp-btn');

        console.log('Email entered:', email);

        if (!this.validateEmail(email)) {
            this.showError('email-error', 'Please enter a valid email address');
            return;
        }

        if (this.resendCooldown) {
            console.log('Resend cooldown active');
            return;
        }

        this.generatedOTP = this.generateOTP();
        this.otpExpiry = Date.now() + (10 * 60 * 1000);
        this.userData.email = email;

        console.log('Generated OTP:', this.generatedOTP);

        sendBtn.disabled = true;
        sendBtn.textContent = 'Sending...';

        try {
            console.log('Sending email via EmailJS...');
            
            // REPLACE WITH YOUR ACTUAL EMAILJS CREDENTIALS
            await emailjs.send(
                 "service_rt7b701",
                "template_qvf00iu",    // Replace with your Template ID
                {
                    to_email: email,
                    user_name: email.split('@')[0],
                    otp_code: this.generatedOTP
                },
                "Jpc-PtSR0ue1Ap8xg"      // Replace with your Public Key
            );

            console.log('Email sent successfully');
            this.showOTPSection();
            this.startResendCooldown();
            this.showToast('OTP sent to your email successfully!', 'success');
            this.hideError('email-error');
            
        } catch (error) {
            console.error('Email sending failed:', error);
            this.showError('email-error', 'Failed to send OTP. Please try again.');
            
            // Fallback for testing - remove in production
            alert(`Development mode - Your OTP: ${this.generatedOTP}`);
            this.showOTPSection();
            
        } finally {
            sendBtn.disabled = false;
            sendBtn.textContent = 'Send OTP';
        }
    }

    async verifyOTP() {
        console.log('verifyOTP called');
        
        const otpInputs = document.querySelectorAll('.otp-input');
        const enteredOTP = Array.from(otpInputs).map(input => input.value).join('');
        
        if (enteredOTP.length !== 6) {
            this.showError('otp-error', 'Please enter the complete 6-digit code');
            return;
        }

        if (Date.now() > this.otpExpiry) {
            this.showError('otp-error', 'OTP has expired. Please request a new one.');
            return;
        }

        if (enteredOTP === this.generatedOTP) {
            // 🔥 Try to load existing user from Firebase
            const userExists = await this.loadUserFromFirebase(this.userData.email);
            
            if (userExists) {
                // Existing user - go directly to dashboard
                this.showToast('Welcome back!', 'success');
                this.switchScreen('dashboard-screen');
                this.initializeDashboard();
            } else {
                // New user - continue to password creation
                this.showToast('Email verified successfully!', 'success');
                this.switchScreen('password-screen');
            }
            
            this.hideError('otp-error');
        } else {
            this.showError('otp-error', 'Invalid OTP. Please check and try again.');
            otpInputs.forEach(input => input.value = '');
            otpInputs[0].focus();
        }
    }

    generateOTP() {
        return Math.floor(100000 + Math.random() * 900000).toString();
    }

    showOTPSection() {
        const otpSection = document.getElementById('otp-section');
        if (otpSection) {
            otpSection.classList.remove('hidden');
            const firstInput = document.querySelector('.otp-input');
            if (firstInput) {
                firstInput.focus();
            }
        }
    }

    startResendCooldown() {
        this.resendCooldown = true;
        setTimeout(() => {
            this.resendCooldown = false;
            console.log('Resend cooldown ended');
        }, 60000);
    }

    handleOTPInput(event, index) {
        const input = event.target;
        const value = input.value;
        
        if (value && index < 5) {
            const nextInput = document.querySelectorAll('.otp-input')[index + 1];
            if (nextInput) {
                nextInput.focus();
            }
        }
    }

    handleOTPKeydown(event, index) {
        if (event.key === 'Backspace' && !event.target.value && index > 0) {
            const prevInput = document.querySelectorAll('.otp-input')[index - 1];
            if (prevInput) {
                prevInput.focus();
            }
        }
    }

    // Password Methods with SHA-256 Encryption
    validatePassword() {
        console.log('validatePassword called');
        
        const passwordInput = document.getElementById('password');
        const confirmPasswordInput = document.getElementById('confirm-password');
        const continueBtn = document.getElementById('continue-password-btn');
        
        if (!passwordInput || !confirmPasswordInput || !continueBtn) {
            console.error('Password elements not found');
            return;
        }

        const password = passwordInput.value;
        const confirmPassword = confirmPasswordInput.value;
        
        const requirements = {
            length: password.length >= 8,
            uppercase: /[A-Z]/.test(password),
            lowercase: /[a-z]/.test(password),
            number: /\d/.test(password),
            special: /[!@#$%^&*(),.?":{}|<>]/.test(password)
        };

        Object.keys(requirements).forEach(req => {
            const element = document.getElementById(`req-${req}`);
            if (element) {
                const icon = element.querySelector('.req-icon');
                
                if (requirements[req]) {
                    element.classList.add('met');
                    if (icon) icon.textContent = '✅';
                } else {
                    element.classList.remove('met');
                    if (icon) icon.textContent = '❌';
                }
            }
        });

        this.updatePasswordStrength(requirements);

        const allMet = Object.values(requirements).every(Boolean);
        const passwordsMatch = password === confirmPassword && confirmPassword.length > 0;
        
        if (confirmPassword && !passwordsMatch) {
            this.showError('password-error', 'Passwords do not match');
        } else {
            this.hideError('password-error');
        }

        continueBtn.disabled = !(allMet && passwordsMatch);
    }

    updatePasswordStrength(requirements) {
        const strengthFill = document.getElementById('strength-fill');
        const strengthText = document.getElementById('strength-text');
        
        if (!strengthFill || !strengthText) return;
        
        const metCount = Object.values(requirements).filter(Boolean).length;
        const strength = metCount / 5;
        
        strengthFill.style.width = `${strength * 100}%`;
        
        if (strength < 0.4) {
            strengthFill.style.background = '#ef4444';
            strengthText.textContent = 'Weak';
            strengthText.style.color = '#ef4444';
        } else if (strength < 0.8) {
            strengthFill.style.background = '#f59e0b';
            strengthText.textContent = 'Medium';
            strengthText.style.color = '#f59e0b';
        } else {
            strengthFill.style.background = '#10b981';
            strengthText.textContent = 'Strong';
            strengthText.style.color = '#10b981';
        }
    }

    togglePasswordVisibility(inputId) {
        const input = document.getElementById(inputId);
        const button = document.getElementById(inputId + '-toggle');
        
        if (!input || !button) return;
        
        const icon = button.querySelector('.eye-icon');
        
        if (input.type === 'password') {
            input.type = 'text';
            if (icon) icon.textContent = '🙈';
        } else {
            input.type = 'password';
            if (icon) icon.textContent = '👁️';
        }
    }

    async createPassword() {
        const password = document.getElementById('password').value;
        
        console.log('Creating password with SHA-256 encryption...');
        
        this.userData.passwordHash = await this.hashPassword(password);
        
        // 🔥 Save user to Firebase
        await this.saveUserToFirebase(this.userData);
        
        this.showToast('Password created and saved securely!', 'success');
        this.switchScreen('seedphrase-screen');
    }

    async hashPassword(password) {
        try {
            const encoder = new TextEncoder();
            const data = encoder.encode(password);
            const hashBuffer = await crypto.subtle.digest('SHA-256', data);
            const hashArray = Array.from(new Uint8Array(hashBuffer));
            return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
        } catch (error) {
            console.warn('Web Crypto API failed, using fallback hash:', error);
            
            // Fallback: Simple hash (for compatibility)
            let hash = 0;
            for (let i = 0; i < password.length; i++) {
                const char = password.charCodeAt(i);
                hash = ((hash << 5) - hash) + char;
                hash = hash & hash;
            }
            return Math.abs(hash).toString(16);
        }
    }

    // Seed Phrase Methods
    generateSeedPhrase() {
        const words = [
            "abandon", "banana", "phone", "bat", "book", "absent", "coin", "abstract", 
            "model", "scooter", "meow", "accident", "computer", "accuse", "roads", "acid", 
            "uncle", "nesico", "tajmahal", "packets", "action", "teeth", "actress", "colour",
            "apple", "orange", "grape", "lemon", "cherry", "berry", "plum", "peach"
        ];
        
        const seedWords = [];
        const usedIndices = new Set();
        
        while (seedWords.length < 12) {
            const randomIndex = Math.floor(Math.random() * words.length);
            if (!usedIndices.has(randomIndex)) {
                usedIndices.add(randomIndex);
                seedWords.push(words[randomIndex]);
            }
        }
        
        this.userData.seedPhrase = seedWords;
        this.displaySeedPhrase(seedWords);
    }

    displaySeedPhrase(words) {
        const container = document.getElementById('seed-words-display');
        if (container) {
            container.innerHTML = words.map((word, index) => `
                <div class="seed-word">
                    <div class="seed-word-number">${index + 1}</div>
                    <div class="seed-word-text">${word}</div>
                </div>
            `).join('');
        }
    }

    downloadSeedPhrase() {
        const seedPhrase = this.userData.seedPhrase.join(' ');
        const content = `SecureWallet Seed Phrase Backup

Date: ${new Date().toLocaleString()}
Email: ${this.userData.email}

IMPORTANT SECURITY WARNING:
- Never share this phrase with anyone
- Store this backup in a secure, offline location
- Do not store digitally (cloud, email, etc.)

Seed Phrase:
${seedPhrase}

Instructions:
1. Write this phrase on paper
2. Store in a safe place
3. Keep multiple copies in separate locations
4. Never type this phrase on any device connected to the internet

SecureWallet Team`;
        
        const blob = new Blob([content], { type: 'text/plain' });
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'securewallet-seed-backup.txt';
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        window.URL.revokeObjectURL(url);
        
        this.showToast('Seed phrase backup downloaded!', 'success');
    }

    validateSeedPhrase() {
        const confirmation = document.getElementById('seed-confirmation').value.trim().toLowerCase();
        const checkbox = document.getElementById('seed-saved-checkbox').checked;
        const accessBtn = document.getElementById('access-wallet-btn');
        
        const originalPhrase = this.userData.seedPhrase.join(' ').toLowerCase();
        const phrasesMatch = confirmation === originalPhrase;
        
        if (confirmation && !phrasesMatch) {
            this.showError('seed-error', 'Seed phrase does not match');
        } else {
            this.hideError('seed-error');
        }
        
        if (accessBtn) {
            accessBtn.disabled = !(phrasesMatch && checkbox);
        }
    }

    async accessWallet() {
        this.userData.walletAddress = 'bc1q' + Math.random().toString(36).substring(2, 15);
        
        // 🔥 Save completed user data to Firebase
        await this.saveUserToFirebase(this.userData);
        
        this.showToast('Welcome to SecureWallet!', 'success');
        this.switchScreen('dashboard-screen');
        this.initializeDashboard();
    }

    // Dashboard Initialization
    async initializeDashboard() {
        // 🔥 Load transactions from Firebase
        await this.loadTransactionsFromFirebase();
        
        this.updateBalanceDisplay();
        this.updateWalletAddressDisplay();
        this.updateTransactionHistory();
        this.generateReceiveQR();
        
        const userEmailDisplay = document.getElementById('user-email-display');
        if (userEmailDisplay) {
            userEmailDisplay.textContent = this.userData.email;
        }
    }

    updateBalanceDisplay() {
        const { BTC, ETH, USDT } = this.userData.balances;
        
        // Update individual crypto displays
        const btcAmount = document.getElementById('btc-amount');
        const btcValue = document.getElementById('btc-value');
        const ethAmount = document.getElementById('eth-amount');
        const ethValue = document.getElementById('eth-value');
        const usdtAmount = document.getElementById('usdt-amount');
        const usdtValue = document.getElementById('usdt-value');
        const totalBalance = document.getElementById('total-balance');

        if (btcAmount) btcAmount.textContent = `${BTC.amount.toFixed(8)} BTC`;
        if (btcValue) btcValue.textContent = `$${BTC.usd_value.toFixed(2)}`;
        
        if (ethAmount) ethAmount.textContent = `${ETH.amount.toFixed(8)} ETH`;
        if (ethValue) ethValue.textContent = `$${ETH.usd_value.toFixed(2)}`;
        
        if (usdtAmount) usdtAmount.textContent = `${USDT.amount.toFixed(2)} USDT`;
        if (usdtValue) usdtValue.textContent = `$${USDT.usd_value.toFixed(2)}`;
        
        // Update total balance
        const totalValue = BTC.usd_value + ETH.usd_value + USDT.usd_value;
        if (totalBalance) totalBalance.textContent = `$${totalValue.toFixed(2)}`;
    }

    updateWalletAddressDisplay() {
        const addressDisplay = document.getElementById('wallet-address-display');
        if (addressDisplay && this.userData.walletAddress) {
            const shortAddress = this.userData.walletAddress.substring(0, 8) + '...' + this.userData.walletAddress.substring(this.userData.walletAddress.length - 8);
            addressDisplay.textContent = shortAddress;
        }
    }

    // Send Payment with Real-time Calculation
    setupSendFormCalculations() {
        const amountInput = document.getElementById('send-amount');
        const currencySelect = document.getElementById('send-currency');
        const summaryDiv = document.getElementById('send-summary');

        if (amountInput && currencySelect) {
            const updateSummary = () => {
                const amount = parseFloat(amountInput.value) || 0;
                const currency = currencySelect.value;
                const fee = this.calculateNetworkFee(currency);
                const total = amount + fee;

                if (summaryDiv && amount > 0) {
                    summaryDiv.innerHTML = `
                        <div class="summary-row">
                            <span>Amount:</span>
                            <span>${amount} ${currency}</span>
                        </div>
                        <div class="summary-row">
                            <span>Network Fee:</span>
                            <span>${fee} ${currency}</span>
                        </div>
                        <div class="summary-row total">
                            <span>Total:</span>
                            <span>${total} ${currency}</span>
                        </div>
                    `;
                    summaryDiv.style.display = 'block';
                } else if (summaryDiv) {
                    summaryDiv.style.display = 'none';
                }
            };

            amountInput.addEventListener('input', updateSummary);
            currencySelect.addEventListener('change', updateSummary);
        }
    }

    async sendPayment() {
        const addressInput = document.getElementById('send-address');
        const amountInput = document.getElementById('send-amount');
        const currencySelect = document.getElementById('send-currency');
        
        if (!addressInput || !amountInput || !currencySelect) {
            this.showToast('Send form elements not found', 'error');
            return;
        }

        const recipient = addressInput.value.trim();
        const amount = parseFloat(amountInput.value);
        const currency = currencySelect.value;

        // Validation
        if (!recipient) {
            this.showToast('Please enter recipient address', 'error');
            return;
        }

        if (!amount || amount <= 0) {
            this.showToast('Please enter a valid amount', 'error');
            return;
        }

        const fee = this.calculateNetworkFee(currency);
        const total = amount + fee;

        console.log('Send Payment Details:', { amount, fee, total, balance: this.userData.balances[currency].amount });

        if (total > this.userData.balances[currency].amount) {
            this.showToast(`Insufficient balance. Need ${total} ${currency} (including ${fee} ${currency} fee)`, 'error');
            return;
        }

        if (confirm(`Send ${amount} ${currency} to ${recipient}?\nNetwork Fee: ${fee} ${currency}\nTotal: ${total} ${currency}`)) {
            // Deduct balance
            this.userData.balances[currency].amount -= total;
            this.userData.balances[currency].usd_value = this.userData.balances[currency].amount * this.getCryptoPrice(currency);

            // Create transaction
            const transaction = {
                id: `tx_${Date.now()}`,
                type: 'sent',
                amount: amount,
                currency: currency,
                from: this.getWalletAddressForCurrency(currency),
                to: recipient,
                date: new Date().toISOString(),
                status: 'confirmed',
                fee: fee
            };

            // 🔥 Save transaction to Firebase
            await this.saveTransactionToFirebase(transaction);
            this.userData.transactions.unshift(transaction);
            
            // 🔥 Save updated balances to Firebase
            await this.saveUserToFirebase(this.userData);

            // Update UI
            this.updateBalanceDisplay();
            this.updateTransactionHistory();
            
            // Clear form
            addressInput.value = '';
            amountInput.value = '';
            const summaryDiv = document.getElementById('send-summary');
            if (summaryDiv) summaryDiv.style.display = 'none';
            
            this.showToast(`${amount} ${currency} sent successfully!`, 'success');
        }
    }

    // QR Code Generation with Multiple Fallbacks
    generateReceiveQR() {
        console.log('generateReceiveQR called');
        
        const canvas = document.getElementById('receive-qr-canvas');
        const errorDiv = document.getElementById('qr-error');
        const currency = document.getElementById('request-currency')?.value || 'BTC';
        
        if (!canvas) {
            console.error('QR canvas not found');
            return;
        }

        const address = this.getWalletAddressForCurrency(currency);
        this.paymentRequestId++;
        const uniqueNonce = `${Date.now()}_${this.paymentRequestId}`;

        // Clear any previous errors
        if (errorDiv) {
            errorDiv.classList.add('hidden');
        }

        this.tryQRGeneration(canvas, address, currency, '', uniqueNonce);
    }

    generatePaymentQR() {
        const amountInput = document.getElementById('request-amount');
        const currencySelect = document.getElementById('request-currency');
        
        if (!amountInput || !currencySelect) return;

        const amount = amountInput.value;
        const currency = currencySelect.value;
        
        if (!amount || parseFloat(amount) <= 0) {
            this.showToast('Please enter a valid amount', 'error');
            return;
        }

        const canvas = document.getElementById('receive-qr-canvas');
        const address = this.getWalletAddressForCurrency(currency);
        this.paymentRequestId++;
        const uniqueNonce = `${Date.now()}_${this.paymentRequestId}`;
        
        this.tryQRGeneration(canvas, address, currency, amount, uniqueNonce);
    }

    tryQRGeneration(canvas, address, currency, amount, nonce) {
        const qrData = this.formatCryptoURI(address, currency, amount, nonce);
        
        // Method 1: Try QRCode library
        if (typeof QRCode !== 'undefined') {
            console.log('Using QRCode library');
            QRCode.toCanvas(canvas, qrData, {
                width: 256,
                height: 256,
                margin: 2,
                color: { dark: '#000000', light: '#FFFFFF' }
            }, (error) => {
                if (error) {
                    console.error('QRCode library failed:', error);
                    this.fallbackQRGeneration(canvas, qrData);
                } else {
                    console.log('✅ QR Code generated successfully with unique ID:', nonce);
                    const receiveAddress = document.getElementById('receive-address');
                    if (receiveAddress) {
                        receiveAddress.value = address;
                    }
                    canvas.style.display = 'block';
                    this.showToast('QR Code generated!', 'success');
                }
            });
        } else {
            console.log('QRCode library not available, using fallback');
            this.fallbackQRGeneration(canvas, qrData);
        }
    }

    fallbackQRGeneration(canvas, qrData) {
        // Fallback: Use online QR service
        canvas.style.display = 'none';
        
        const container = canvas.parentElement;
        let qrImg = container.querySelector('.qr-fallback');
        
        if (!qrImg) {
            qrImg = document.createElement('img');
            qrImg.className = 'qr-fallback';
            qrImg.style.cssText = 'width: 256px; height: 256px; border: 1px solid #ddd; border-radius: 8px;';
            container.appendChild(qrImg);
        }
        
        qrImg.src = `https://api.qrserver.com/v1/create-qr-code/?size=256x256&data=${encodeURIComponent(qrData)}`;
        qrImg.onload = () => {
            console.log('✅ Fallback QR generated');
            this.showToast('QR Code generated!', 'success');
        };
        qrImg.onerror = () => {
            this.showQRError('Failed to generate QR code');
        };
    }

    formatCryptoURI(address, currency, amount = '', nonce = '') {
        let uri = '';
        switch (currency.toUpperCase()) {
            case 'BTC':
                uri = `bitcoin:${address}`;
                break;
            case 'ETH':
                uri = `ethereum:${address}@1`;
                break;
            case 'USDT':
                uri = address;
                break;
            default:
                uri = address;
        }
        
        const params = [];
        if (amount) params.push(`amount=${amount}`);
        if (nonce) params.push(`nonce=${nonce}`);
        
        if (params.length > 0) {
            uri += `?${params.join('&')}`;
        }
        
        return uri;
    }

    getWalletAddressForCurrency(currency) {
        return this.walletAddresses[currency.toUpperCase()] || this.userData.walletAddress;
    }

    updateReceiveAddress() {
        const currency = document.getElementById('request-currency').value;
        const address = this.getWalletAddressForCurrency(currency);
        const receiveAddress = document.getElementById('receive-address');
        if (receiveAddress) {
            receiveAddress.value = address;
        }
        this.generateReceiveQR();
    }

    downloadQRCode() {
        const canvas = document.getElementById('receive-qr-canvas');
        const fallbackImg = document.querySelector('.qr-fallback');
        
        if (canvas && canvas.style.display !== 'none') {
            const link = document.createElement('a');
            link.download = `securewallet-qr-${Date.now()}.png`;
            link.href = canvas.toDataURL();
            link.click();
        } else if (fallbackImg) {
            const link = document.createElement('a');
            link.download = `securewallet-qr-${Date.now()}.png`;
            link.href = fallbackImg.src;
            link.click();
        }
        
        this.showToast('QR code downloaded!', 'success');
    }

    copyReceiveAddress() {
        const address = document.getElementById('receive-address').value;
        navigator.clipboard.writeText(address).then(() => {
            this.showToast('Address copied to clipboard!', 'success');
        });
    }

    // Transfer Functionality
    async confirmTransfer() {
        const fromSelect = document.getElementById('transfer-from');
        const toSelect = document.getElementById('transfer-to');
        const amountInput = document.getElementById('transfer-amount');
        const currencySelect = document.getElementById('transfer-currency');
        const noteInput = document.getElementById('transfer-note');
        
        if (!fromSelect || !toSelect || !amountInput || !currencySelect) {
            this.showToast('Transfer form elements not found', 'error');
            return;
        }

        const fromAccount = fromSelect.value;
        const toAccount = toSelect.value;
        const amount = parseFloat(amountInput.value);
        const currency = currencySelect.value;
        const note = noteInput ? noteInput.value : '';

        // Validation
        if (fromAccount === toAccount) {
            this.showToast('Cannot transfer to the same account', 'error');
            return;
        }

        if (!amount || amount <= 0) {
            this.showToast('Please enter a valid amount', 'error');
            return;
        }

        if (amount > this.userData.balances[currency].amount) {
            this.showToast('Insufficient balance', 'error');
            return;
        }

        // Create transaction
        const transaction = {
            id: `tx_${Date.now()}`,
            type: 'transfer',
            amount: amount,
            currency: currency,
            from: `${fromAccount} Account`,
            to: `${toAccount} Account`,
            date: new Date().toISOString(),
            status: 'confirmed',
            fee: 0,
            note: note
        };

        // 🔥 Save transaction to Firebase
        await this.saveTransactionToFirebase(transaction);
        this.userData.transactions.unshift(transaction);
        this.updateTransactionHistory();

        // Clear form
        amountInput.value = '';
        if (noteInput) noteInput.value = '';

        this.showToast(`${amount} ${currency} transferred successfully!`, 'success');
    }

    // Transaction History
    loadSampleTransactions() {
        const sampleTransactions = [
            {
                id: "tx_001",
                type: "received",
                amount: 0.0234,
                currency: "BTC",
                from: "1A1zP1eP5QGefi2DMPTfTL5SLmv7DivfNa",
                to: "bc1qxy2kgdygjrsqtzq2n0yrf2493p83kkfjhx0wlh",
                date: "2025-09-01T10:30:00Z",
                status: "confirmed",
                fee: 0.00001
            },
            {
                id: "tx_002",
                type: "sent",
                amount: 150.50,
                currency: "USDT",
                from: "TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t",
                to: "TR1J7mdg5rbQyUHENYdx39WVWK7fsLpEoXZy",
                date: "2025-08-30T15:45:00Z",
                status: "confirmed",
                fee: 2.5
            },
            {
                id: "tx_003",
                type: "received",
                amount: 2.45,
                currency: "ETH",
                from: "0x742d35Cc6634C0532925a3b8D7A7C0CfF7E0A5b8",
                to: "0x8ba1f109551bD432803012645Hac136c22C5c6e8",
                date: "2025-08-28T09:15:00Z",
                status: "confirmed",
                fee: 0.002
            }
        ];
        
        // Only load sample data if no transactions exist
        if (this.userData.transactions.length === 0) {
            this.userData.transactions = [...sampleTransactions];
        }
    }

    updateTransactionHistory() {
        const historyContainer = document.getElementById('transaction-history-list');
        const recentContainer = document.getElementById('recent-transactions-list');
        
        if (!historyContainer && !recentContainer) return;

        const filter = document.getElementById('history-filter')?.value || 'all';
        const search = document.getElementById('history-search')?.value.toLowerCase() || '';
        
        let transactions = [...this.userData.transactions];
        
        // Apply filters
        if (filter !== 'all') {
            transactions = transactions.filter(tx => tx.type === filter);
        }
        
        if (search) {
            transactions = transactions.filter(tx => 
                tx.from.toLowerCase().includes(search) ||
                tx.to.toLowerCase().includes(search) ||
                tx.currency.toLowerCase().includes(search) ||
                tx.id.toLowerCase().includes(search)
            );
        }
        
        // Sort by date (newest first)
        transactions.sort((a, b) => new Date(b.date) - new Date(a.date));
        
        // Update full history
        if (historyContainer) {
            historyContainer.innerHTML = transactions.length > 0 ? 
                transactions.map(tx => this.createTransactionItem(tx)).join('') :
                '<div class="no-transactions">No transactions found</div>';
        }
        
        // Update recent transactions (last 5)
        if (recentContainer) {
            const recent = transactions.slice(0, 5);
            recentContainer.innerHTML = recent.length > 0 ? 
                recent.map(tx => this.createTransactionItem(tx, true)).join('') :
                '<div class="no-transactions">No recent transactions</div>';
        }
    }

    createTransactionItem(tx, isRecent = false) {
        const date = new Date(tx.date).toLocaleDateString();
        const time = new Date(tx.date).toLocaleTimeString();
        const shortAddress = tx.type === 'sent' ? 
            tx.to.substring(0, 8) + '...' + tx.to.slice(-6) :
            tx.from.substring(0, 8) + '...' + tx.from.slice(-6);
        
        const icon = tx.type === 'received' ? '📥' : (tx.type === 'sent' ? '📤' : '🔄');
        const iconClass = tx.type === 'received' ? 'received' : (tx.type === 'sent' ? 'sent' : 'transfer');
        const sign = tx.type === 'received' ? '+' : '-';
        
        return `
            <div class="transaction-item" onclick="app.showTransactionDetails('${tx.id}')">
                <div class="transaction-info">
                    <div class="transaction-icon ${iconClass}">${icon}</div>
                    <div class="transaction-details-info">
                        <div class="transaction-type">${tx.type.charAt(0).toUpperCase() + tx.type.slice(1)} ${tx.currency}</div>
                        <div class="transaction-address">${shortAddress}</div>
                        ${!isRecent ? `<div class="transaction-date">${date} ${time}</div>` : ''}
                    </div>
                </div>
                <div class="transaction-amount">
                    <div class="transaction-value">${sign}${tx.amount} ${tx.currency}</div>
                    <div class="transaction-date">${isRecent ? date : tx.status}</div>
                </div>
            </div>
        `;
    }

    showTransactionDetails(txId) {
        const transaction = this.userData.transactions.find(tx => tx.id === txId);
        if (!transaction) return;
        
        alert(`Transaction Details:
ID: ${transaction.id}
Type: ${transaction.type}
Amount: ${transaction.amount} ${transaction.currency}
From: ${transaction.from}
To: ${transaction.to}
Date: ${new Date(transaction.date).toLocaleString()}
Status: ${transaction.status}
Fee: ${transaction.fee} ${transaction.currency}
${transaction.note ? `Note: ${transaction.note}` : ''}`);
    }

    // Settings Functionality
    showSettings() {
        const settingsModal = document.getElementById('settings-modal');
        if (!settingsModal) {
            this.createSettingsModal();
        } else {
            settingsModal.classList.remove('hidden');
        }
    }

    createSettingsModal() {
        const modal = document.createElement('div');
        modal.id = 'settings-modal';
        modal.className = 'settings-modal';
        modal.innerHTML = `
            <div class="settings-content">
                <div class="settings-header">
                    <h3>⚙️ Settings</h3>
                    <button class="close-settings" onclick="app.closeSettings()">&times;</button>
                </div>
                <div class="settings-body">
                    <div class="form-group">
                        <label>Storage Method</label>
                        <select class="form-control">
                            <option ${window.firebaseDB ? 'selected' : ''}>🔥 Firebase Cloud Database</option>
                            <option ${!window.firebaseDB ? 'selected' : ''}>💾 Local Storage (Browser)</option>
                        </select>
                    </div>
                    <div class="form-group">
                        <label>Theme</label>
                        <select id="theme-select" class="form-control">
                            <option value="light">Light Theme</option>
                            <option value="dark">Dark Theme</option>
                        </select>
                    </div>
                    <div class="form-group">
                        <label>Default Currency</label>
                        <select id="default-currency" class="form-control">
                            <option value="BTC">Bitcoin (BTC)</option>
                            <option value="ETH">Ethereum (ETH)</option>
                            <option value="USDT">Tether (USDT)</option>
                        </select>
                    </div>
                    <div class="form-group">
                        <label>Security Level</label>
                        <select class="form-control">
                            <option selected>High (Recommended)</option>
                            <option>Medium</option>
                        </select>
                    </div>
                    <button class="btn btn-primary" onclick="app.saveSettings()">Save Settings</button>
                </div>
            </div>
        `;
        document.body.appendChild(modal);
    }

    closeSettings() {
        const modal = document.getElementById('settings-modal');
        if (modal) {
            modal.remove();
        }
    }

    saveSettings() {
        const theme = document.getElementById('theme-select')?.value || 'light';
        const currency = document.getElementById('default-currency')?.value || 'BTC';
        
        // Apply theme
        document.body.className = theme === 'dark' ? 'dark-theme' : '';
        
        this.showToast('Settings saved successfully!', 'success');
        this.closeSettings();
    }

    // Tab Navigation
    switchTab(tabName) {
        // Update tab buttons
        document.querySelectorAll('.tab-btn').forEach(btn => {
            btn.classList.remove('active');
        });
        const activeTab = document.querySelector(`[data-tab="${tabName}"]`);
        if (activeTab) {
            activeTab.classList.add('active');
        }
        
        // Update tab content
        document.querySelectorAll('.tab-pane').forEach(pane => {
            pane.classList.remove('active');
        });
        const activePane = document.getElementById(`${tabName}-tab`);
        if (activePane) {
            activePane.classList.add('active');
        }
        
        this.currentTab = tabName;
        
        // Initialize tab-specific content
        if (tabName === 'receive') {
            setTimeout(() => this.generateReceiveQR(), 100);
        } else if (tabName === 'history') {
            this.updateTransactionHistory();
        }
    }

    handleQuickAction(action) {
        switch (action) {
            case 'send':
                this.switchTab('send');
                break;
            case 'receive':
                this.switchTab('receive');
                break;
            case 'scan':
                this.showToast('QR Scanner feature coming soon!', 'info');
                break;
        }
    }

    // Utility Methods
    calculateNetworkFee(currency) {
        const fees = {
            'BTC': 0.00001,
            'ETH': 0.002,
            'USDT': 2.5
        };
        return fees[currency] || 0.001;
    }

    getCryptoPrice(currency) {
        const prices = {
            'BTC': 27000,
            'ETH': 1750,
            'USDT': 1
        };
        return prices[currency] || 1;
    }

    copyWalletAddress() {
        if (this.userData.walletAddress) {
            navigator.clipboard.writeText(this.userData.walletAddress).then(() => {
                this.showToast('Wallet address copied!', 'success');
            });
        }
    }

    showQRError(message) {
        const errorDiv = document.getElementById('qr-error');
        const canvas = document.getElementById('receive-qr-canvas');
        
        if (errorDiv) {
            errorDiv.textContent = message;
            errorDiv.classList.remove('hidden');
        }
        if (canvas) {
            canvas.style.display = 'none';
        }
    }

    logout() {
        if (confirm('Are you sure you want to logout? You can log back in with your email.')) {
            location.reload();
        }
    }

    switchScreen(screenId) {
        console.log('Switching to screen:', screenId);
        document.querySelectorAll('.screen').forEach(screen => {
            screen.classList.remove('active');
        });
        const targetScreen = document.getElementById(screenId);
        if (targetScreen) {
            targetScreen.classList.add('active');
        }
        this.currentScreen = screenId;
    }

    showToast(message, type = 'success') {
        console.log('Toast:', message, type);
        // For production, implement proper toast notifications
        alert(message);
    }

    showError(elementId, message) {
        const errorElement = document.getElementById(elementId);
        if (errorElement) {
            errorElement.textContent = message;
            errorElement.classList.remove('hidden');
        }
    }

    hideError(elementId) {
        const errorElement = document.getElementById(elementId);
        if (errorElement) {
            errorElement.textContent = '';
            errorElement.classList.add('hidden');
        }
    }

    validateEmail(email) {
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        return emailRegex.test(email);
    }

    delay(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }
}

// Initialize the application
let app;

document.addEventListener('DOMContentLoaded', function() {
    console.log('DOM loaded, initializing SecureWallet...');
    app = new SecureWallet();
});

