import('./src/server.js').catch((error) => {
  console.error('Failed to start AthleNet server:', error);
  process.exit(1);
});
