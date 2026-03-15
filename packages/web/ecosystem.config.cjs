module.exports = {
  apps: [{
    name: 'tendon-web',
    script: 'server.js',
    cwd: '/home/ubuntu/apps/alashed-web/packages/web',
    env: {
      NODE_ENV: 'production',
      PORT: 3030,
      HOSTNAME: '0.0.0.0',
    },
  }],
};
