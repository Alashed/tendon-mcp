module.exports = {
  apps: [{
    name: 'tendon-web',
    script: 'node',
    args: 'server.js',
    cwd: '/home/ubuntu/apps/alashed-tracker/packages/web/.next/standalone',
    env: {
      NODE_ENV: 'production',
      PORT: 3000,
      NEXT_PUBLIC_API_URL: 'https://api.tendon.alashed.kz',
      HOSTNAME: '0.0.0.0',
    },
  }],
};
