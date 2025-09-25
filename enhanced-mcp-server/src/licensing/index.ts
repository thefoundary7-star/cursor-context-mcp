#!/usr/bin/env node

/**
 * FileBridge License API Server
 *
 * Standalone license validation server that integrates with:
 * - PostgreSQL database for license storage
 * - Dodo Payments for subscription management
 * - Enhanced MCP server for license validation
 */

import { LicenseAPIServer } from './api-server.js';
import chalk from 'chalk';
import { program } from 'commander';

const VERSION = '1.0.0';

async function main(): Promise<void> {
  program
    .name('filebridge-license-server')
    .description('FileBridge License API Server - Manages license validation and billing integration')
    .version(VERSION)
    .option('-p, --port <number>', 'Server port', '3001')
    .option('--db-host <host>', 'Database host', 'localhost')
    .option('--db-port <port>', 'Database port', '5432')
    .option('--db-name <name>', 'Database name', 'filebridge_licenses')
    .option('--db-user <user>', 'Database user', 'postgres')
    .option('--db-password <password>', 'Database password')
    .option('--init-db', 'Initialize database tables')
    .parse();

  const options = program.opts();

  try {
    console.log(chalk.blue('🚀 Starting FileBridge License API Server...'));

    // Set environment variables from CLI options
    if (options.dbHost) process.env.DB_HOST = options.dbHost;
    if (options.dbPort) process.env.DB_PORT = options.dbPort;
    if (options.dbName) process.env.DB_NAME = options.dbName;
    if (options.dbUser) process.env.DB_USER = options.dbUser;
    if (options.dbPassword) process.env.DB_PASSWORD = options.dbPassword;

    const server = new LicenseAPIServer(parseInt(options.port));

    if (options.initDb) {
      console.log(chalk.yellow('🔧 Initializing database...'));
      // Database initialization is handled in server.start()
    }

    await server.start();

    console.log(chalk.green(`✅ License API Server started successfully on port ${options.port}`));
    console.log(chalk.cyan('📋 Available endpoints:'));
    console.log(`   🏥 Health check: http://localhost:${options.port}/api/health`);
    console.log(`   🔍 Validate license: POST http://localhost:${options.port}/api/validate-license`);
    console.log(`   🔑 Generate license: POST http://localhost:${options.port}/api/generate-license`);
    console.log(`   🚫 Revoke license: POST http://localhost:${options.port}/api/revoke-license`);
    console.log(`   🔔 Dodo webhook: POST http://localhost:${options.port}/api/webhooks/dodo-payments`);

    // Graceful shutdown
    process.on('SIGINT', async () => {
      console.log(chalk.yellow('\n🛑 Shutting down gracefully...'));
      await server.stop();
      process.exit(0);
    });

    process.on('SIGTERM', async () => {
      console.log(chalk.yellow('\n🛑 Received SIGTERM, shutting down...'));
      await server.stop();
      process.exit(0);
    });

  } catch (error) {
    console.error(chalk.red('❌ Failed to start license server:'), error);
    process.exit(1);
  }
}

// Start server if this is the main module
if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((error) => {
    console.error(chalk.red('💥 Fatal error:'), error);
    process.exit(1);
  });
}

export { main };