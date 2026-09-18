const net = require('node:net');
const fs = require('node:fs');
const path = require('node:path');
const dotenv = require('dotenv');

// Match ConfigModule precedence: backend .env, root .env, then shell overrides.
const root = path.resolve(__dirname, '..');
let config = {};
for (const file of [path.join(root, '../.env'), path.join(root, '.env')]) {
  if (fs.existsSync(file)) config = { ...config, ...dotenv.parse(fs.readFileSync(file)) };
}
const port = Number(process.env.PORT || config.PORT || 5004);
if (!Number.isInteger(port) || port < 1 || port > 65535) {
  console.error('PORT must be an integer between 1 and 65535.');
  process.exit(1);
}
const probe = net.createServer();
probe.once('error', (error) => {
  console.error(error.code === 'EADDRINUSE'
    ? `Port ${port} is already in use. Stop the existing backend with Ctrl+C in its terminal before running npm run start:dev again. A second watcher was not started.`
    : `Cannot check backend port ${port}: ${error.message}`);
  process.exitCode = 1;
});
probe.listen(port, () => probe.close());
