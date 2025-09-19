// blockchain.js - Working MetaMask Connection
// Add testnet switching function
async function switchToSepolia() {
    try {
        await window.ethereum.request({
            method: 'wallet_switchEthereumChain',
            params: [{ chainId: '0xaa36a7' }], // Sepolia testnet
        });
        alert("✅ Switched to Sepolia testnet!");
        location.reload(); // Refresh to update balance
    } catch (error) {
        if (error.code === 4902) {
            try {
                await window.ethereum.request({
                    method: 'wallet_addEthereumChain',
                    params: [{
                        chainId: '0xaa36a7',
                        chainName: 'Sepolia Test Network',
                        nativeCurrency: {
                            name: 'ETH',
                            symbol: 'ETH',
                            decimals: 18
                        },
                        rpcUrls: ['https://sepolia.infura.io/v3/'],
                        blockExplorerUrls: ['https://sepolia.etherscan.io/']
                    }]
                });
                alert("✅ Sepolia testnet added and switched!");
                location.reload();
            } catch (addError) {
                alert("❌ Failed to add testnet: " + addError.message);
            }
        } else {
            alert("❌ Failed to switch network: " + error.message);
        }
    }
}

// Add the testnet button when page loads
window.addEventListener('DOMContentLoaded', () => {
    // Your existing code...
    
    // Add testnet switch button
    const blockchainSection = document.querySelector('.blockchain-connection-test') || document.body;
    const testnetBtn = document.createElement('button');
    testnetBtn.innerHTML = '🧪 Switch to Testnet (Free ETH)';
    testnetBtn.onclick = switchToSepolia;
    testnetBtn.style.cssText = 'padding: 10px; margin: 5px; background: #FF9800; color: white; border: none; border-radius: 5px; font-weight: bold;';
    
    blockchainSection.appendChild(testnetBtn);
});

console.log("Blockchain.js loading...");

async function connectWallet() {
    try {
        console.log("Connect button clicked!");
        
        if (!window.ethereum) {
            alert("Please install MetaMask!");
            return;
        }
        
        console.log("Connecting to MetaMask...");
        
        // Request account access
        const accounts = await window.ethereum.request({
            method: 'eth_requestAccounts'
        });
        
        console.log("Connected accounts:", accounts);
        
        // Update display
        document.getElementById("walletAddress").innerText = `Connected: ${accounts[0]}`;
        
        // Get balance
        const balance = await window.ethereum.request({
            method: 'eth_getBalance',
            params: [accounts[0], 'latest']
        });
        
        const balanceInEth = parseInt(balance, 16) / Math.pow(10, 18);
        document.getElementById("contractBalance").innerText = `${balanceInEth.toFixed(4)} ETH`;
        
        alert("🎉 MetaMask Connected Successfully!");
        
    } catch (error) {
        console.error("Connection failed:", error);
        alert("Connection failed: " + error.message);
    }
}

async function sendEth() {
    const recipient = document.getElementById("recipient").value;
    const amount = document.getElementById("amount").value;
    
    if (!recipient || !amount) {
        alert("Enter recipient and amount!");
        return;
    }
    
    try {
        const accounts = await window.ethereum.request({
            method: 'eth_requestAccounts'
        });
        
        const tx = await window.ethereum.request({
            method: 'eth_sendTransaction',
            params: [{
                from: accounts[0],
                to: recipient,
                value: '0x' + (parseFloat(amount) * Math.pow(10, 18)).toString(16)
            }]
        });
        
        alert("Transaction sent! Hash: " + tx);
        
    } catch (error) {
        console.error("Transaction failed:", error);
        alert("Transaction failed: " + error.message);
    }
}

// Hook up buttons when page loads
window.addEventListener('DOMContentLoaded', () => {
    console.log("Setting up button listeners...");
    
    const connectBtn = document.getElementById("connectWalletBtn");
    const sendBtn = document.getElementById("sendTxBtn");
    
    if (connectBtn) {
        connectBtn.onclick = connectWallet;
        console.log("Connect button listener added!");
    } else {
        console.error("connectWalletBtn not found!");
    }
    
    if (sendBtn) {
        sendBtn.onclick = sendEth;
        console.log("Send button listener added!");
    }
});

console.log("Blockchain.js loaded successfully!");
