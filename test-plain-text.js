// test-plain-text.js
const BASE_URL = 'http://localhost:12345';
const SECRET = '7f5e1b20a3b8c6e9d4a5f7c3b2e1d0f8';

async function testPlainText() {
    console.log('--- Testing Plain Text Webhook ---');
    try {
        const res = await fetch(`${BASE_URL}/api/webhook/${SECRET}`, {
            method: 'POST',
            headers: { 'Content-Type': 'text/plain' },
            body: 'Hello from plain text simulation!'
        });
        
        console.log('Status:', res.status);
        const data = await res.json();
        console.log('Response:', JSON.stringify(data, null, 2));
        
        if (res.ok && (data.status === 'spoken' || data.status === 'silenced')) {
            console.log('\nSUCCESS: Plain text webhook accepted and processed (Status: ' + data.status + ').');
        } else {
            console.log('\nFAILED: Plain text webhook rejected or failed.');
            process.exit(1);
        }
    } catch (err) {
        console.error('Error:', err.message);
        process.exit(1);
    }
}

testPlainText();
