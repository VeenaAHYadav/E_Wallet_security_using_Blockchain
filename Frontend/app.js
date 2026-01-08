class SecureWallet {
    constructor() {
        this.resendTimer = null;
        this.resendCountdown = 60;
        this.connectedWallet = null;
        this.currentScreen = 'email-screen';
        this.generatedOTP = null;
        this.otpExpiry = null;
        this.resendCooldown = false;
        this.sendCode = null;
        this.sendCodeExpiry = null; 
        // timestamp

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

        // initialize
        this.init();
    }

    init() {
        console.log('SecureWallet initializing...');
        this.setupEventListeners();
        this.generateSeedPhrase();
        this.loadSampleTransactions();
        console.log('SecureWallet ready!');
    }

    /* -------------------- MetaMask Methods -------------------- */
    async connectMetaMask() {
        try {
            if (typeof window.ethereum !== 'undefined') {
                const accounts = await window.ethereum.request({ method: 'eth_requestAccounts' });
                if (accounts && accounts.length > 0) {
                    this.connectedWallet = accounts[0];
                    this.updateMetaMaskUI(true);
                    this.showToast('MetaMask connected successfully!', 'success');

                    const walletAddressDisplay = document.getElementById('walletAddress');
                    if (walletAddressDisplay) walletAddressDisplay.textContent = this.connectedWallet;
                } else {
                    this.showToast('No MetaMask accounts available', 'error');
                }
            } else {
                this.showToast('MetaMask is not installed. Please install MetaMask extension.', 'error');
            }
        } catch (error) {
            console.error('MetaMask connection failed:', error);
            this.showToast('Failed to connect to MetaMask', 'error');
        }
    }

    async disconnectMetaMask() {
        try {
            this.connectedWallet = null;
            this.updateMetaMaskUI(false);

            const walletAddressDisplay = document.getElementById('walletAddress');
            if (walletAddressDisplay) walletAddressDisplay.textContent = 'Not Connected';

            const contractBalanceDisplay = document.getElementById('contractBalance');
            if (contractBalanceDisplay) contractBalanceDisplay.textContent = 'No Balance';

            this.showToast('MetaMask disconnected successfully!', 'success');
        } catch (error) {
            console.error('MetaMask disconnection failed:', error);
            this.showToast('Failed to disconnect MetaMask', 'error');
        }
    }

    async deleteMetaMaskAccount() {
       
        if (!this.userData.email) {
            this.showToast('No user logged in to delete', 'error');
            return;
        }

        if (!confirm('Are you sure you want to delete your account locally? This action cannot be undone.')) return;

        // Remove localStorage
        try {
            localStorage.removeItem('secureWallet_' + this.userData.email);
            this.userData = {
                email: '',
                passwordHash: '',
                seedPhrase: [],
                walletAddress: '',
                balances: { BTC: { amount: 0, usd_value: 0 }, ETH: { amount: 0, usd_value: 0 }, USDT: { amount: 0, usd_value: 0 } },
                transactions: []
            };
            this.showToast('Account deleted locally', 'success');
            location.reload();
        } catch (error) {
            console.error('Failed to delete account:', error);
            this.showToast('Failed to delete account', 'error');
        }
    }

    updateMetaMaskUI(isConnected) {
        const connectBtn = document.getElementById('connectWalletBtn');
        const disconnectBtn = document.getElementById('disconnectWalletBtn');

        if (disconnectBtn) {
            
            disconnectBtn.removeEventListener('click', this.disconnectMetaMask);
            disconnectBtn.addEventListener('click', this.disconnectMetaMask.bind(this));
        }

        if (connectBtn && disconnectBtn) {
            if (isConnected) {
                connectBtn.style.display = 'none';
                disconnectBtn.style.display = 'inline-block';
            } else {
                connectBtn.style.display = 'inline-block';
                disconnectBtn.style.display = 'none';
            }
        }
    }

    /* -------------------- Firebase (optional) & LocalStorage -------------------- */
    getFirebaseDB() {
        if (window.firebaseDB) return window.firebaseDB;
        if (typeof firebase !== 'undefined' && firebase.firestore) return firebase.firestore();
        return null;
    }

    async saveUserToFirebase(userData) {
        const db = this.getFirebaseDB();
        if (!db) {
            console.log('Firebase not available, using localStorage fallback');
            this.saveToLocalStorage(userData);
            return;
        }

        try {
            await db.collection('users').doc(userData.email).set({
                email: userData.email,
                passwordHash: userData.passwordHash,
                seedPhrase: userData.seedPhrase,
                walletAddress: userData.walletAddress,
                balances: userData.balances,
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString()
            });
            console.log('✓ User saved to Firebase:', userData.email);
        } catch (error) {
            console.error('✗ Firebase save failed:', error);
            this.saveToLocalStorage(userData);
        }
    }

    async loadUserFromFirebase(email) {
        const db = this.getFirebaseDB();
        if (!db) {
            return this.loadFromLocalStorage(email);
        }

        try {
            const doc = await db.collection('users').doc(email).get();
            if (doc.exists) {
                const userData = doc.data();
                this.userData = { ...this.userData, ...userData };
                console.log('✓ User loaded from Firebase:', email);
                return true;
            }
            return false;
        } catch (error) {
            console.error('✗ Firebase load failed:', error);
            return this.loadFromLocalStorage(email);
        }
    }

    async saveTransactionToFirebase(transaction) {
        const db = this.getFirebaseDB();
        if (!db) return;

        try {
            await db.collection('transactions').doc(transaction.id).set({
                ...transaction,
                userEmail: this.userData.email,
                createdAt: new Date().toISOString()
            });
            console.log('✓ Transaction saved to Firebase:', transaction.id);
        } catch (error) {
            console.error('✗ Transaction save failed:', error);
        }
    }

    async loadTransactionsFromFirebase() {
        const db = this.getFirebaseDB();
        if (!db) return [];

        try {
            const snapshot = await db.collection('transactions')
                .where('userEmail', '==', this.userData.email)
                .orderBy('createdAt', 'desc')
                .get();

            const transactions = [];
            snapshot.forEach(doc => transactions.push(doc.data()));
            if (transactions.length > 0) {
                this.userData.transactions = transactions;
                console.log(`✓ Loaded ${transactions.length} transactions from Firebase`);
            }
            return transactions;
        } catch (error) {
            console.error('✗ Transaction load failed:', error);
            return [];
        }
    }

    saveToLocalStorage(userData) {
        try {
            localStorage.setItem('secureWallet_' + userData.email, JSON.stringify(userData));
            console.log('✓ Data saved to localStorage (fallback)');
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
                console.log('✓ Data loaded from localStorage (fallback)');
                return true;
            }
            return false;
        } catch (error) {
            console.error('localStorage load failed:', error);
            return false;
        }
    }

    /* -------------------- Event Listeners & UI Wiring -------------------- */
    setupEventListeners() {
    console.log("Setting up verify OTP button listener");
   

        // OTP / Email flow buttons
        const sendOtpBtn = document.getElementById('send-otp-btn');
        const verifyOtpBtn = document.getElementById('verify-otp-btn');
        const resendOtpBtn = document.getElementById('resend-otp-btn');

        if (sendOtpBtn) sendOtpBtn.addEventListener('click', this.sendOTP.bind(this));
        if (verifyOtpBtn) verifyOtpBtn.addEventListener('click', this.verifyOTP.bind(this));
        if (resendOtpBtn) resendOtpBtn.addEventListener('click', this.resendOTP.bind(this));

        // OTP inputs (6 fields)
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

        if (passwordInput) passwordInput.addEventListener('input', () => this.validatePassword());
        if (confirmPasswordInput) confirmPasswordInput.addEventListener('input', () => this.validatePassword());
        if (continuePasswordBtn) continuePasswordBtn.addEventListener('click', this.createPassword.bind(this));
        if (passwordToggle) passwordToggle.addEventListener('click', () => this.togglePasswordVisibility('password'));
        if (confirmPasswordToggle) confirmPasswordToggle.addEventListener('click', () => this.togglePasswordVisibility('confirm-password'));

        // Seed phrase actions
        const regenerateSeedBtn = document.getElementById('regenerate-seed-btn');
        const downloadSeedBtn = document.getElementById('download-seed-btn');
        const seedSavedCheckbox = document.getElementById('seed-saved-checkbox');
        const seedConfirmation = document.getElementById('seed-confirmation');
        const accessWalletBtn = document.getElementById('access-wallet-btn');

        if (regenerateSeedBtn) regenerateSeedBtn.addEventListener('click', this.generateSeedPhrase.bind(this));
        if (downloadSeedBtn) downloadSeedBtn.addEventListener('click', this.downloadSeedPhrase.bind(this));
        if (seedSavedCheckbox) seedSavedCheckbox.addEventListener('change', this.validateSeedPhrase.bind(this));
        if (seedConfirmation) seedConfirmation.addEventListener('input', this.validateSeedPhrase.bind(this));
        if (accessWalletBtn) accessWalletBtn.addEventListener('click', this.accessWallet.bind(this));

        // Settings
        const settingsBtn = document.getElementById('settings-btn');
        if (settingsBtn) settingsBtn.addEventListener('click', this.showSettings.bind(this));

        // Dashboard / MetaMask connection
        this.setupDashboardEventListeners();

        console.log('Event listeners setup complete');
    }

    setupDashboardEventListeners() {
        const connectWalletBtn = document.getElementById('connectWalletBtn');
        const disconnectWalletBtn = document.getElementById('disconnectWalletBtn');
        const deleteAccountBtn = document.getElementById('delete-account-btn');

        if (connectWalletBtn) connectWalletBtn.addEventListener('click', this.connectMetaMask.bind(this));
        if (disconnectWalletBtn) disconnectWalletBtn.addEventListener('click', this.disconnectMetaMask.bind(this));
        if (deleteAccountBtn) deleteAccountBtn.addEventListener('click', this.deleteMetaMaskAccount.bind(this));

        // Tabs
        document.querySelectorAll('.tab-btn').forEach(btn => {
            btn.addEventListener('click', (e) => this.switchTab(e.currentTarget.dataset.tab));
        });
        
        const sendPaymentBtn = document.getElementById('send-payment-btn');
  if (sendPaymentBtn) sendPaymentBtn.addEventListener('click', this.sendPayment.bind(this));

  const sendCodeBtn = document.getElementById('send-code-btn');
  if (sendCodeBtn) sendCodeBtn.addEventListener('click', this.sendSendCode.bind(this));
    
        // Send
        

        // Receive
        const generatePaymentQRBtn = document.getElementById('generate-payment-qr-btn');
        const downloadQRBtn = document.getElementById('download-qr-btn');
        const requestCurrency = document.getElementById('request-currency');

        if (generatePaymentQRBtn) generatePaymentQRBtn.addEventListener('click', this.generatePaymentQR.bind(this));
        if (downloadQRBtn) downloadQRBtn.addEventListener('click', this.downloadQRCode.bind(this));
        if (requestCurrency) requestCurrency.addEventListener('change', this.updateReceiveAddress.bind(this));

        // Transfer
        const confirmTransferBtn = document.getElementById('confirm-transfer-btn');
        if (confirmTransferBtn) confirmTransferBtn.addEventListener('click', this.confirmTransfer.bind(this));

        // History filter/search
        const historyFilter = document.getElementById('history-filter');
        const historySearch = document.getElementById('history-search');
        if (historyFilter) historyFilter.addEventListener('change', this.updateTransactionHistory.bind(this));
        if (historySearch) historySearch.addEventListener('input', this.updateTransactionHistory.bind(this));

        // Quick actions (data-action)
        document.querySelectorAll('[data-action]').forEach(btn => {
            btn.addEventListener('click', (e) => this.handleQuickAction(e.currentTarget.dataset.action));
        });

        // Logout and copy address
        const logoutBtn = document.getElementById('logout-btn');
        if (logoutBtn) logoutBtn.addEventListener('click', this.logout.bind(this));
        const copyAddressBtn = document.getElementById('copy-address-btn');
        if (copyAddressBtn) copyAddressBtn.addEventListener('click', this.copyWalletAddress.bind(this));

        // Setup send form calculations after dashboard loads
        setTimeout(() => this.setupSendFormCalculations(), 1000);
    }

    /* -------------------- Email / OTP Methods -------------------- */
  // Attempt restrictor
  async checkEmailAttempts(email) {
  const ref = firebase.firestore().collection('emailverification').doc(email);
  const doc = await ref.get();
  const now = Date.now();

  if (doc.exists) {
    const data = doc.data();
    if (data.emailLockout && now < data.emailLockout) {
      throw new Error("Too many attempts. Try after a few hours.");
    }
    if ((data.emailAttempts || 0) >= 3) {
      // Lockout for 2 hours
      await ref.set({ emailLockout: now + 2*60*60*1000 }, { merge: true });
      throw new Error("Too many attempts. Try after a few hours.");
    }
    // Only increment attempts when actually submitting/validating OTP (not now)
  } else {
    await ref.set({ emailAttempts: 0, emailLockout: null }); // initialize but don't increment yet!
  }
  // Only allow to proceed if not locked out and attempts < 3
}


  generateSendCode() {
  const letters = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
  let code = "";
  for (let i = 0; i < 4; i++) {
    code += letters.charAt(Math.floor(Math.random() * letters.length));
  }
  return code;
}

generateOTP() {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

async sendOTP() {
  const emailInput = document.getElementById('email');
  const email = emailInput.value.trim();
  const sendBtn = document.getElementById('send-otp-btn');

  if (!this.validateEmail(email)) {
    this.showError('email-error', 'Please enter a valid email address');
    return;
  }
  if (this.resendCooldown) return;

  try {
    await this.checkEmailAttempts(email);
  } catch (err) {
    this.showError('email-error', err.message);
    return;
  }

  this.generatedOTP = this.generateOTP();
  this.otpExpiry = Date.now() + (10 * 60 * 1000);
  this.userData.email = email;

  sendBtn.disabled = true;
  sendBtn.textContent = 'Sending...';

  try {
    await emailjs.send(
  "service_g72brkp",
  "template_3anra1g",
  {
    to_email: email,          
    user_name: email.split('@')[0],
    otp_code: this.generatedOTP
  },
  "LjpOg3K4lSBSpmF0p"
);

    this.showOTPSection();
    this.startResendCountdownTimer();
    this.showToast('OTP sent to your email successfully!', 'success');
    this.hideError('email-error');
  } catch (error) {
  console.error('Failed to send OTP', error);
  this.showError('email-error', 'Failed to send OTP. Please try again.');
  // no alert in production
  return;
} finally {

    sendBtn.disabled = false;
    sendBtn.textContent = 'Send OTP';
  }
}

async sendSendCode() {
  if (!this.userData || !this.userData.email) {
    this.showToast("Session expired. Please log in again.", "error");
    this.switchScreen("email-screen");
    return;
  }

  const amountInput = document.getElementById("send-amount");
  const currencySelect = document.getElementById("send-currency");
  if (!amountInput || !currencySelect) {
    this.showToast("Send form elements not found", "error");
    return;
  }

  const amount = parseFloat(amountInput.value);
  const currency = currencySelect.value;
  if (!amount || amount <= 0) {
    this.showToast("Please enter a valid amount before requesting code.", "error");
    return;
  }

  // create and store 4‑letter code
  this.sendCode = this.generateSendCode();
  this.sendCodeExpiry = Date.now() + 10 * 60 * 1000;

  const sendCodeBtn = document.getElementById("send-code-btn");
  if (sendCodeBtn) {
    sendCodeBtn.disabled = true;
    sendCodeBtn.textContent = "Sending...";
  }

  try {
    await emailjs.send(
                          // service ID
                          // template ID
      {
        to_email: this.userData.email,           // SAME keys as sendOTP
        user_name: this.userData.email.split("@")[0],
        otp_code: this.sendCode
      },
                           // public key
    );
    this.showToast("4-letter code sent to your email.", "success");
   } catch (error) {
  console.error("Failed to send send-code email", error);
  this.showToast("Failed to send code email. Please try again.", "error");
  this.sendCode = null;
  this.sendCodeExpiry = null;
  return;
} finally {

    if (sendCodeBtn) {
      sendCodeBtn.disabled = false;
      sendCodeBtn.textContent = "Send Code to Email";
    }
  }
}


  // Add in verifyOTP (reset attempts after success)
  async verifyOTP() {
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

    const db = firebase.firestore();
    const ref = db.collection('emailverification').doc(this.userData.email);
    const doc = await ref.get();
    let attempts = doc.exists && doc.data().emailAttempts ? doc.data().emailAttempts : 0;
    let lockoutUntil = doc.exists && doc.data().emailLockout ? doc.data().emailLockout : null;
    const now = Date.now();

    if (lockoutUntil && now < lockoutUntil) {
        this.showError('otp-error', 'Too many attempts. Try after a few hours.');
        return;
    }

    if (enteredOTP === this.generatedOTP) {
        // reset attempts and lockout on success
        await ref.set({ emailAttempts: 0, emailLockout: null }, { merge: true });
        
        const userLoaded = await this.loadUserFromFirebase(this.userData.email);
        if (userLoaded && this.userData.passwordHash && this.userData.seedPhrase && this.userData.walletAddress) {
            this.showToast("Welcome back!", "success");
            this.switchScreen("dashboard-screen");
            this.initializeDashboard();
        } else {
            this.showToast("Email verified successfully!", "success");
            this.switchScreen("password-screen");
            this.hideError("otp-error");
        }
    } else {
        // increment attempts on each wrong OTP
        attempts += 1;
        let updateData = { emailAttempts: attempts };
        if (attempts >= 3) {
            updateData.emailLockout = now + 2 * 60 * 60 * 1000; // 2 hours
            this.showError('otp-error', 'Too many attempts. Try after a few hours.');
        } else {
            this.showError('otp-error', 'Incorrect OTP. Please try again.');
        }
        await ref.set(updateData, { merge: true });
    }
}


showOTPSection() {
 
  const otpSection = document.getElementById('otp-section');
  if (otpSection) {
    otpSection.classList.remove('hidden');
  }
}


    resendOTP = async () => {
        console.log('Resending OTP...');
       
        const resendSection = document.getElementById('resend-section');
        if (resendSection) resendSection.style.display = 'none';
        if (this.resendTimer) {
            clearInterval(this.resendTimer);
            this.resendTimer = null;
        }
        await this.sendOTP();
    }

    handleOTPInput(event, index) {
        const input = event.target;
        const value = input.value;
        const inputs = document.querySelectorAll('.otp-input');
        if (value && index < inputs.length - 1) {
            const nextInput = inputs[index + 1];
            if (nextInput) nextInput.focus();
        }
    }

    handleOTPKeydown(event, index) {
        const inputs = document.querySelectorAll('.otp-input');
        if (event.key === 'Backspace' && !event.target.value && index > 0) {
            const prevInput = inputs[index - 1];
            if (prevInput) prevInput.focus();
        }
    }

    startResendCountdownTimer() {
        this.resendCooldown = true;
        this.resendCountdown = 60;

        const resendSection = document.getElementById('resend-section');
        const resendBtn = document.getElementById('resend-otp-btn');
        const countdownSpan = document.getElementById('countdown');

        if (resendSection) resendSection.style.display = 'block';
        if (resendBtn) resendBtn.disabled = true;
        if (countdownSpan) countdownSpan.textContent = this.resendCountdown;

        if (this.resendTimer) {
            clearInterval(this.resendTimer);
        }

        this.resendTimer = setInterval(() => {
            this.resendCountdown--;
            if (countdownSpan) countdownSpan.textContent = this.resendCountdown;
            if (this.resendCountdown <= 0) {
                this.resendCooldown = false;
                if (resendBtn) {
                    resendBtn.disabled = false;
                    resendBtn.innerHTML = '<span>Resend OTP</span>';
                }
                clearInterval(this.resendTimer);
                this.resendTimer = null;
            }
        }, 1000);
    }



    /* -------------------- Password Methods -------------------- */
    validatePassword() {
        const passwordInput = document.getElementById('password');
        const confirmPasswordInput = document.getElementById('confirm-password');
        const continueBtn = document.getElementById('continue-password-btn');

        if (!passwordInput || !confirmPasswordInput || !continueBtn) {
            
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
            strengthText.textContent = 'Weak';
            strengthText.style.color = '#ef4444';
        } else if (strength < 0.8) {
            strengthText.textContent = 'Medium';
            strengthText.style.color = '#f59e0b';
        } else {
            strengthText.textContent = 'Strong';
            strengthText.style.color = '#10b981';
        }
    }

    togglePasswordVisibility(inputId) {
        const input = document.getElementById(inputId);
        const button = document.getElementById(inputId + '-toggle');
        if (!input || !button) return;
        if (input.type === 'password') {
            input.type = 'text';
        } else {
            input.type = 'password';
        }
    }

    async createPassword() {
        const passwordEl = document.getElementById('password');
        if (!passwordEl) return;
        const password = passwordEl.value;
        console.log('Creating password with SHA-256');

        this.userData.passwordHash = await this.hashPassword(password);
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
            let hash = 0;
            for (let i = 0; i < password.length; i++) {
                const char = password.charCodeAt(i);
                hash = ((hash << 5) - hash) + char;
                hash = hash & hash;
            }
            return Math.abs(hash).toString(16);
        }
    }

    /* -------------------- Seed Phrase -------------------- */
    generateSeedPhrase() {
        const words = [
            "firewall", "malware", "phishing", "authentication", "hashing", "intrusion", "authorization", "exploit",
            "vulnerability", "patch", "zero day", "sandbox", "computer", "accuse", "trojan", "backdoor",
            "spy", "keylogger", "cryptography", "packets", "action", "penetration", "actress", "white",
            "incident", "protocol", "vpn", "audit", "rainbow", "kernel", "sniffing", "alert"
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
        const confirmationEl = document.getElementById('seed-confirmation');
        const checkbox = document.getElementById('seed-saved-checkbox');
        const accessBtn = document.getElementById('access-wallet-btn');

        if (!confirmationEl || !checkbox || !accessBtn) return;

        const confirmation = confirmationEl.value.trim().toLowerCase();
        const originalPhrase = this.userData.seedPhrase.join(' ').toLowerCase();
        const phrasesMatch = confirmation === originalPhrase;

        if (confirmation && !phrasesMatch) {
            this.showError('seed-error', 'Seed phrase does not match');
        } else {
            this.hideError('seed-error');
        }

        accessBtn.disabled = !(phrasesMatch && checkbox.checked);
    }

    async accessWallet() {
        this.userData.walletAddress = 'bc1q' + Math.random().toString(36).substring(2, 15);
        await this.saveUserToFirebase(this.userData);
        this.showToast('Welcome to SecureWallet!', 'success');
        this.switchScreen('dashboard-screen');
        await this.initializeDashboard();
    }

    /* -------------------- Dashboard Initialization & Helpers -------------------- */
    async initializeDashboard() {
      
        await this.loadTransactionsFromFirebase();
        this.updateBalanceDisplay();
        this.updateWalletAddressDisplay();
        this.updateTransactionHistory();
        this.generateReceiveQR();

        const userEmailDisplay = document.getElementById('user-email-display');
        if (userEmailDisplay) userEmailDisplay.textContent = this.userData.email;

        // Check MetaMask connection
        await this.checkMetaMaskConnection();
    }

    async checkMetaMaskConnection() {
        try {
            if (typeof window.ethereum !== 'undefined') {
                const accounts = await window.ethereum.request({ method: 'eth_accounts' });
                if (accounts && accounts.length > 0) {
                    this.connectedWallet = accounts[0];
                    this.updateMetaMaskUI(true);
                    const walletAddressDisplay = document.getElementById('walletAddress');
                    if (walletAddressDisplay) walletAddressDisplay.textContent = this.connectedWallet;
                }
            }
        } catch (error) {
            console.error('Error checking MetaMask connection:', error);
        }
    }

    updateBalanceDisplay() {
        const { BTC, ETH, USDT } = this.userData.balances;
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

    /* -------------------- Send Payment & Send Form Calculations -------------------- */
    setupSendFormCalculations() {
        const amountInput = document.getElementById('send-amount');
        const currencySelect = document.getElementById('send-currency');
        const summaryDiv = document.getElementById('send-summary');

        if (!amountInput || !currencySelect || !summaryDiv) return;

        const updateSummary = () => {
            const amount = parseFloat(amountInput.value) || 0;
            const currency = currencySelect.value;
            const fee = this.calculateNetworkFee(currency);
            const total = amount + fee;

            if (amount > 0) {
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
            } else {
                summaryDiv.style.display = 'none';
            }
        };

        amountInput.addEventListener('input', updateSummary);
        currencySelect.addEventListener('change', updateSummary);
    }

    async sendPayment() {
        if (!this.userData || !this.userData.email) {
        this.showToast("Session expired. Please log in again.", "error");
        this.switchScreen('email-screen');
        return;
    }
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

        if (!this.userData.balances[currency] || total > this.userData.balances[currency].amount) {
            this.showToast(`Insufficient balance. Need ${total} ${currency}`, 'error');
            return;
        }

        if (!confirm(`Send ${amount} ${currency} to ${recipient}?\nNetwork Fee: ${fee} ${currency}\nTotal: ${total} ${currency}`)) return;
        
        const sendCodeInput = document.getElementById("send-code");
if (!sendCodeInput) {
  this.showToast("Send code input not found.", "error");
  return;
}

const enteredCode = sendCodeInput.value.trim().toUpperCase();

if (!this.sendCode || !this.sendCodeExpiry) {
  this.showToast("Please click 'Send Code to Email' and enter the code before sending.", "error");
  return;
}

if (Date.now() > this.sendCodeExpiry) {
  this.showToast("Your 4-letter code has expired. Please request a new one.", "error");
  this.sendCode = null;
  this.sendCodeExpiry = null;
  return;
}

if (enteredCode !== this.sendCode) {
  this.showToast("Incorrect 4-letter code. Please check your email and try again.", "error");
  return;
}


this.sendCode = null;
this.sendCodeExpiry = null;

        // Deduct balance
        this.userData.balances[currency].amount -= total;
        this.userData.balances[currency].usd_value = this.userData.balances[currency].amount * this.getCryptoPrice(currency);

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

        await this.saveTransactionToFirebase(transaction);
        this.userData.transactions.unshift(transaction);
        await this.saveUserToFirebase(this.userData);

        this.updateBalanceDisplay();
        this.updateTransactionHistory();

        addressInput.value = '';
        amountInput.value = '';
        const summaryDiv = document.getElementById('send-summary');
        if (summaryDiv) summaryDiv.style.display = 'none';

        this.showToast(`${amount} ${currency} sent successfully!`, 'success');
    }

    /* -------------------- QR Code Generation -------------------- */
    
    generateReceiveQR() {
    const canvas = document.getElementById('receive-qr-canvas');
    const currency = document.getElementById('request-currency')?.value || 'BTC';
    if (!canvas) {
        console.error('QR canvas not found');
        return;
    }
    const address = this.getWalletAddressForCurrency(currency);
    this.paymentRequestId++;
    const uniqueNonce = `${Date.now()}_${this.paymentRequestId}`;
    // ---- Enhanced QR Payload ----
    const qrPayload = {
        recipient: {
            name: (this.userData && this.userData.email) ? this.userData.email : "Unknown",
            wallet_address: address,
            merchant_logo_url: ""
        },
        transaction: {
            currency: currency,
            type: "receive",
            order_id: "RCV-" + uniqueNonce,
            description: "Receive request via SecureWallet"
        },
        security: {
            timestamp: new Date().toISOString(),
            token: uniqueNonce,
            expires_in: 600
        },
        callback_url: "https://yourdomain.com/payment/confirm"
    };
    const qrData = JSON.stringify(qrPayload);
    this.tryQRGeneration(canvas, qrData);
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

    // ---- Enhanced Clipboard Payload ----
    const qrPayload = {
        recipient: {
            name: (this.userData && this.userData.email) ? this.userData.email : "Unknown",
            wallet_address: address,
            merchant_logo_url: "" // (optionally add later)
        },
        transaction: {
            amount: amount,
            currency: currency,
            type: "payment_request",
            order_id: "REQ-" + uniqueNonce,
            description: "Payment requested via SecureWallet"
        },
        security: {
            timestamp: new Date().toISOString(),
            token: uniqueNonce,
            expires_in: 300
        },
        callback_url: "https://yourdomain.com/payment/confirm"
    };
    const qrData = JSON.stringify(qrPayload);
    this.tryQRGeneration(canvas, qrData);

    }

    tryQRGeneration(canvas, qrData) {
    if (typeof QRCode !== "undefined" && QRCode.toCanvas) {
        QRCode.toCanvas(canvas, qrData, { width: 256, height: 256, margin: 2 }, function (error) {
            if (error) console.error(error);
            else this.showToast("QR Code generated!", "success");
        }.bind(this));
    } else {
        this.fallbackQRGeneration(canvas, qrData);
    }
}
    


    fallbackQRGeneration(canvas, qrData) {
        canvas.style.display = 'none';
        const container = canvas.parentElement;
        if (!container) return;
        let qrImg = container.querySelector('.qr-fallback');
        if (!qrImg) {
            qrImg = document.createElement('img');
            qrImg.className = 'qr-fallback';
            qrImg.style.cssText = 'width:256px;height:256px;border:1px solid #ddd;border-radius:8px;';
            container.appendChild(qrImg);
        }
        qrImg.src = `https://api.qrserver.com/v1/create-qr-code/?size=256x256&data=${encodeURIComponent(qrData)}`;
        qrImg.onload = () => {
            this.showToast('QR Code generated!', 'success');
        };
        qrImg.onerror = () => {
            this.showQRError('Failed to generate QR code');
        };
    }

    formatCryptoURI(address, currency, amount = '', nonce = '') {
        let uri = '';
        switch (currency.toUpperCase()) {
            case 'BTC': uri = `bitcoin:${address}`; break;
            case 'ETH': uri = `ethereum:${address}`; break;
            case 'USDT': uri = address; break;
            default: uri = address;
        }
        const params = [];
        if (amount) params.push(`amount=${amount}`);
        if (nonce) params.push(`nonce=${nonce}`);
        if (params.length > 0) uri += `?${params.join('&')}`;
        return uri;
    }

    getWalletAddressForCurrency(currency) {
        return this.walletAddresses[currency.toUpperCase()] || this.userData.walletAddress || '';
    }

    updateReceiveAddress() {
        const currency = document.getElementById('request-currency')?.value || 'BTC';
        const address = this.getWalletAddressForCurrency(currency);
        const receiveAddress = document.getElementById('receive-address');
        if (receiveAddress) receiveAddress.value = address;
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
        const receiveAddressEl = document.getElementById('receive-address');
        if (!receiveAddressEl) return;
        const address = receiveAddressEl.value;
        navigator.clipboard.writeText(address).then(() => {
            this.showToast('Address copied to clipboard!', 'success');
        });
    }

    showQRError(message) {
        const errorDiv = document.getElementById('qr-error');
        const canvas = document.getElementById('receive-qr-canvas');
        if (errorDiv) {
            errorDiv.textContent = message;
            errorDiv.classList.remove('hidden');
        }
        if (canvas) canvas.style.display = 'none';
    }
    
    

    /* -------------------- Transfer Functionality -------------------- */
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

        if (fromAccount === toAccount) {
            this.showToast('Cannot transfer to the same account', 'error');
            return;
        }
        if (!amount || amount <= 0) {
            this.showToast('Please enter a valid amount', 'error');
            return;
        }
        if (!this.userData.balances[currency] || amount > this.userData.balances[currency].amount) {
            this.showToast('Insufficient balance', 'error');
            return;
        }

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

        await this.saveTransactionToFirebase(transaction);
        this.userData.transactions.unshift(transaction);
        this.updateTransactionHistory();

        amountInput.value = '';
        if (noteInput) noteInput.value = '';
        this.showToast(`${amount} ${currency} transferred successfully!`, 'success');
    }

    /* -------------------- Transaction History -------------------- */
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

        if (!this.userData.transactions || this.userData.transactions.length === 0) {
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

        if (filter !== 'all') transactions = transactions.filter(tx => tx.type === filter);
        if (search) {
            transactions = transactions.filter(tx =>
                (tx.from || '').toLowerCase().includes(search) ||
                (tx.to || '').toLowerCase().includes(search) ||
                (tx.currency || '').toLowerCase().includes(search) ||
                (tx.id || '').toLowerCase().includes(search)
            );
        }

        transactions.sort((a, b) => new Date(b.date) - new Date(a.date));

        if (historyContainer) {
            historyContainer.innerHTML = transactions.length > 0 ?
                transactions.map(tx => this.createTransactionItem(tx)).join('') :
                '<div class="no-transactions">No transactions found</div>';
        }

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
            (tx.to ? tx.to.substring(0, 8) + '...' + tx.to.slice(-6) : '') :
            (tx.from ? tx.from.substring(0, 8) + '...' + tx.from.slice(-6) : '');

        const icon = tx.type === 'received' ? '⬇️' : (tx.type === 'sent' ? '⬆️' : '🔁');
        const iconClass = tx.type === 'received' ? 'received' : (tx.type === 'sent' ? 'sent' : 'transfer');
        const sign = tx.type === 'received' ? '+' : '-';

        
        return `
            <div class="transaction-item" onclick="app.showTransactionDetails('${tx.id}')">
                <div class="transaction-info">
                    <div class="transaction-icon ${iconClass}">${icon}</div>
                    <div class="transaction-details-info">
                        <div class="transaction-type">${(tx.type || '').charAt(0).toUpperCase() + (tx.type || '').slice(1)} ${tx.currency || ''}</div>
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

    /* -------------------- Settings & UI Utilities -------------------- */
    showSettings() {
        let settingsModal = document.getElementById('settings-modal');
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
                    <button class="close-settings" id="close-settings-btn">&times;</button>
                </div>
                <div class="settings-body">
                    <div class="form-group">
                        <label>Storage Method</label>
                        <select id="storage-method" class="form-control">
                            <option value="firebase">Firebase Cloud Database</option>
                            <option value="local">Local Storage (Browser)</option>
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
                        <select id="security-level" class="form-control">
                            <option value="high">High (Recommended)</option>
                            <option value="medium">Medium</option>
                        </select>
                    </div>
                    <button class="btn btn-primary" id="save-settings-btn">Save Settings</button>
                </div>
            </div>
        `;
        document.body.appendChild(modal);

       
        document.getElementById('close-settings-btn').addEventListener('click', () => this.closeSettings());
        document.getElementById('save-settings-btn').addEventListener('click', () => this.saveSettings());
    }

    closeSettings() {
        const modal = document.getElementById('settings-modal');
        if (modal) modal.remove();
    }

    saveSettings() {
        const theme = document.getElementById('theme-select')?.value || 'light';
        const currency = document.getElementById('default-currency')?.value || 'BTC';

        document.body.className = theme === 'dark' ? 'dark-theme' : '';
        this.showToast('Settings saved successfully!', 'success');
        this.closeSettings();
    }

    switchTab(tabName) {
        document.querySelectorAll('.tab-btn').forEach(btn => btn.classList.remove('active'));
        const activeTab = document.querySelector(`[data-tab="${tabName}"]`);
        if (activeTab) activeTab.classList.add('active');

        document.querySelectorAll('.tab-pane').forEach(pane => pane.classList.remove('active'));
        const activePane = document.getElementById(`${tabName}-tab`);
        if (activePane) activePane.classList.add('active');

        this.currentTab = tabName;
        if (tabName === 'receive') setTimeout(() => this.generateReceiveQR(), 100);
        else if (tabName === 'history') this.updateTransactionHistory();
    }

    handleQuickAction(action) {
        switch (action) {
            case 'send': this.switchTab('send'); break;
            case 'receive': this.switchTab('receive'); break;
            case 'scan': this.showToast('QR Scanner feature coming soon!', 'info'); break;
            default: break;
        }
    }

    calculateNetworkFee(currency) {
        const fees = { 'BTC': 0.00001, 'ETH': 0.002, 'USDT': 2.5 };
        return fees[currency] || 0.001;
    }

    getCryptoPrice(currency) {
        const prices = { 'BTC': 27000, 'ETH': 1750, 'USDT': 1 };
        return prices[currency] || 1;
    }

    copyWalletAddress() {
        if (this.userData.walletAddress) {
            navigator.clipboard.writeText(this.userData.walletAddress).then(() => {
                this.showToast('Wallet address copied!', 'success');
            });
        }
    }

    logout() {
        if (confirm('Are you sure you want to logout? You can log back in with your email.')) {
            location.reload();
        }
    }

    switchScreen(screenId) {
        document.querySelectorAll('.screen').forEach(screen => screen.classList.remove('active'));
        const targetScreen = document.getElementById(screenId);
        if (targetScreen) targetScreen.classList.add('active');
        this.currentScreen = screenId;
    }

    showToast(message, type = 'success') {
        // Minimal toast — replace with your UI library if available
        console.log('Toast:', message, type);
        if (typeof toastr !== 'undefined') {
            if (type === 'success') toastr.success(message);
            else if (type === 'error') toastr.error(message);
            else toastr.info(message);
        } else {
           
            alert(message);
        }
    }

    showError(elementId, message) {
        const errorElement = document.getElementById(elementId);
        if (errorElement) {
            errorElement.textContent = message;
            errorElement.classList.remove('hidden');
        } else {
            console.warn('Error element not found:', elementId, message);
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
document.addEventListener('DOMContentLoaded', function () {
    console.log('DOM loaded, initializing SecureWallet...');
    app = new SecureWallet();
    const lastEmail = localStorage.getItem('lastUsedEmail');
    if (lastEmail) {
        app.loadUserFromFirebase(lastEmail);
    }
});
