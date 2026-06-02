#!/usr/bin/env node

/**
 * GitHub Webhook Auto-Deployment Handler
 * Automatically pulls latest code and restarts PM2 when push to main branch
 */

const express = require('express');
const { exec } = require('child_process');
const crypto = require('crypto');
const path = require('path');

const app = express();
const PORT = process.env.WEBHOOK_PORT || 9000;
const WEBHOOK_SECRET = process.env.WEBHOOK_SECRET || 'your_webhook_secret_change_this';
const PROJECT_PATH = process.env.PROJECT_PATH || '/www/wwwroot/obe';
const PM2_APP_NAME = process.env.PM2_APP_NAME || 'obe';

app.use(express.json());

// Verify GitHub webhook signature
function verifySignature(req) {
    const signature = req.headers['x-hub-signature-256'];
    if (!signature) {
        return false;
    }

    const hmac = crypto.createHmac('sha256', WEBHOOK_SECRET);
    const digest = 'sha256=' + hmac.update(JSON.stringify(req.body)).digest('hex');
    
    return crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(digest));
}

// Execute shell command
function executeCommand(command) {
    return new Promise((resolve, reject) => {
        exec(command, { cwd: PROJECT_PATH }, (error, stdout, stderr) => {
            if (error) {
                reject({ error, stderr });
                return;
            }
            resolve(stdout);
        });
    });
}

// Deployment handler
app.post('/webhook/deploy', async (req, res) => {
    try {
        const timestamp = new Date().toISOString();
        console.log(`\n${'='.repeat(60)}`);
        console.log(`[${timestamp}] 📥 Webhook received`);

        // Verify signature (optional - comment out if not using secret)
        // if (!verifySignature(req)) {
        //     console.log('❌ Invalid signature');
        //     return res.status(401).json({ error: 'Invalid signature' });
        // }

        const payload = req.body;
        const branch = payload.ref?.split('/').pop();
        const pusher = payload.pusher?.name || 'unknown';
        const commits = payload.commits?.length || 0;

        console.log(`📊 Branch: ${branch}`);
        console.log(`👤 Pusher: ${pusher}`);
        console.log(`📝 Commits: ${commits}`);

        // Only deploy on push to main branch
        if (branch !== 'main') {
            console.log(`⏭️  Skipping deployment - not main branch`);
            return res.json({ 
                message: 'Deployment skipped - not main branch',
                branch 
            });
        }

        console.log(`🚀 Starting deployment...`);

        // Step 1: Git pull
        console.log(`\n📥 Pulling latest code...`);
        const pullOutput = await executeCommand('git pull origin main');
        console.log(pullOutput);

        // Step 2: Install dependencies (if package.json changed)
        console.log(`\n📦 Installing dependencies...`);
        const npmOutput = await executeCommand('npm install --production');
        console.log(npmOutput);

        // Step 3: Restart PM2
        console.log(`\n🔄 Restarting PM2 app...`);
        const pm2Output = await executeCommand(`pm2 restart ${PM2_APP_NAME}`);
        console.log(pm2Output);

        console.log(`\n✅ Deployment completed successfully!`);
        console.log(`${'='.repeat(60)}\n`);

        res.json({ 
            message: 'Deployment successful',
            timestamp,
            branch,
            commits,
            pusher
        });

    } catch (error) {
        const timestamp = new Date().toISOString();
        console.error(`\n❌ Deployment failed at ${timestamp}`);
        console.error(error);
        console.log(`${'='.repeat(60)}\n`);

        res.status(500).json({ 
            error: 'Deployment failed',
            message: error.message,
            stderr: error.stderr
        });
    }
});

// Health check
app.get('/webhook/health', (req, res) => {
    res.json({ 
        status: 'OK',
        service: 'GitHub Webhook Handler',
        projectPath: PROJECT_PATH,
        pm2App: PM2_APP_NAME,
        timestamp: new Date().toISOString()
    });
});

// Start webhook server
app.listen(PORT, '0.0.0.0', () => {
    console.log('\n╔══════════════════════════════════════════════════════════╗');
    console.log('║  🔄 GitHub Webhook Auto-Deployment Server               ║');
    console.log('╚══════════════════════════════════════════════════════════╝');
    console.log(`\n📡 Webhook URL: http://YOUR_SERVER_IP:${PORT}/webhook/deploy`);
    console.log(`📁 Project Path: ${PROJECT_PATH}`);
    console.log(`🔧 PM2 App: ${PM2_APP_NAME}`);
    console.log(`\n✅ Server is listening on port ${PORT}...`);
    console.log(`💡 Add this webhook URL to your GitHub repository\n`);
});

// Graceful shutdown
process.on('SIGINT', () => {
    console.log('\n\n🛑 Webhook server shutting down...');
    process.exit(0);
});

process.on('SIGTERM', () => {
    console.log('\n\n🛑 Webhook server shutting down...');
    process.exit(0);
});

