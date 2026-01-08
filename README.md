# 🔐 Secure E-Wallet Using Blockchain Technology

A secure blockchain-based e-wallet system developed as a final-year academic project.  
The project focuses on enhancing digital wallet security using blockchain, cryptography, multi-layer authentication, and honeypot-based attack detection.

---

## 📌 Project Overview

Traditional e-wallets rely on centralized systems that are vulnerable to attacks such as phishing, brute force, and data breaches.  
This project integrates **Ethereum blockchain technology** with **strong authentication and security mechanisms** to provide a safer and more transparent digital wallet system.

---

## 🎯 Objectives

- Enhance e-wallet security using blockchain
- Prevent unauthorized transactions
- Ensure transaction transparency and integrity
- Implement multi-layer authentication
- Detect and log malicious activities using honeypots

---

## 🛠️ Technologies Used

### Frontend
- HTML, CSS, JavaScript
- MetaMask Browser Extension

### Backend
- Firebase Authentication & Firestore
- EmailJS (OTP delivery)

### Blockchain
- Ethereum Sepolia Test Network
- Web3.js
- MetaMask
- Infura / Alchemy RPC

### Security
- AES Encryption
- SHA-256 Hashing
- Seed Phrase based wallet recovery
- Honeypot-based attack detection

---

## 🔐 Security Features Implemented

- OTP-based user registration and transaction confirmation
- Strong password enforcement
- Seed phrase generation and verification
- AES encryption for sensitive data
- SHA-256 hashing for transaction integrity
- Blockchain-based immutability
- Honeypots for:
  - SQL Injection
  - XSS
  - CSRF
  - SSRF
  - Brute Force
  - Admin panel attacks
  - Directory traversal

---

## 🧩 System Architecture (High Level)

User → Frontend → Backend → Blockchain (Ethereum Sepolia)
↓
Honeypot Layer
↓
Firebase Logs

---

## ⛽ Gas Fee Optimization

- Uses simple wallet-to-wallet ETH transfers
- Minimal on-chain computation
- Logs stored off-chain in Firebase
- MetaMask handles dynamic gas pricing

---

## 🧠 Key Management

- Private keys stored securely in MetaMask
- Seed phrase known only to the user
- AES keys used temporarily for encryption
- No private keys stored on the server

---

### Prerequisites
- Node.js (v14+)
- MetaMask Extension
- Sepolia Test ETH
- Firebase Project
- Infura or Alchemy API Key

---

## ⚠️ Limitations

- Depends on internet connectivity
- Blockchain confirmation delay
- Testnet-based implementation
- Requires MetaMask extension

---

## 🔮 Future Enhancements

- Multi-blockchain support
- DeFi integration
- Biometric authentication
- Advanced privacy mechanisms
- Scalability optimization

---

## 👩‍💻 Contributors

Gunavathi.C
Harshitha.N
Veena.AH

---

## 📜 License
This project is developed for academic purposes only.


