// PM2 (déploiement sur VPS) : pm2 start ecosystem.config.js
module.exports = {
  apps: [{ name: 'xn-kodassy', script: 'backend/server.js', instances: 1, env: { NODE_ENV: 'production' }, max_memory_restart: '400M' }],
};
