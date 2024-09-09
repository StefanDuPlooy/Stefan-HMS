// src/config/redis.js

const redis = require('redis');
const { promisify } = require('util');
const logger = require('./logger');

let client;

if (process.env.REDIS_URL) {
  client = redis.createClient({
    url: process.env.REDIS_URL,
    retry_strategy: function(options) {
      if (options.error && options.error.code === 'ECONNREFUSED') {
        // End reconnecting on a specific error and flush all commands with
        // a individual error
        return new Error('The server refused the connection');
      }
      if (options.total_retry_time > 1000 * 60 * 60) {
        // End reconnecting after a specific timeout and flush all commands
        // with a individual error
        return new Error('Retry time exhausted');
      }
      if (options.attempt > 10) {
        // End reconnecting with built in error
        return undefined;
      }
      // reconnect after
      return Math.min(options.attempt * 100, 3000);
    }
  });

  client.on('connect', () => {
    logger.info('Redis client connected');
  });

  client.on('error', (error) => {
    logger.error(`Redis error: ${error}`);
  });
} else {
  logger.warn('REDIS_URL not found in environment variables. Redis functionality will be disabled.');
}

// Promisify Redis commands if client exists
const getAsync = client ? promisify(client.get).bind(client) : null;
const setAsync = client ? promisify(client.set).bind(client) : null;
const delAsync = client ? promisify(client.del).bind(client) : null;

// Helper functions
const setCache = async (key, value, expiry = 3600) => {
  if (!setAsync) return;
  try {
    await setAsync(key, JSON.stringify(value), 'EX', expiry);
  } catch (error) {
    logger.error(`Error setting cache: ${error}`);
  }
};

const getCache = async (key) => {
  if (!getAsync) return null;
  try {
    const data = await getAsync(key);
    return data ? JSON.parse(data) : null;
  } catch (error) {
    logger.error(`Error getting cache: ${error}`);
    return null;
  }
};

const deleteCache = async (key) => {
  if (!delAsync) return;
  try {
    await delAsync(key);
  } catch (error) {
    logger.error(`Error deleting cache: ${error}`);
  }
};

module.exports = {
  client,
  getCache,
  setCache,
  deleteCache
};