// backend/src/config/redis.js

const redis = require('redis');
const { promisify } = require('util');
const logger = require('./logger');

// Create Redis client
const client = redis.createClient({
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

// Promisify Redis commands
const getAsync = promisify(client.get).bind(client);
const setAsync = promisify(client.set).bind(client);
const delAsync = promisify(client.del).bind(client);

// Redis event listeners
client.on('connect', () => {
  logger.info('Redis client connected');
});

client.on('error', (error) => {
  logger.error(`Redis error: ${error}`);
});

// Helper function to set cache with expiry
const setCache = async (key, value, expiry = 3600) => {
  try {
    await setAsync(key, JSON.stringify(value), 'EX', expiry);
  } catch (error) {
    logger.error(`Error setting cache: ${error}`);
  }
};

// Helper function to get cache
const getCache = async (key) => {
  try {
    const data = await getAsync(key);
    return data ? JSON.parse(data) : null;
  } catch (error) {
    logger.error(`Error getting cache: ${error}`);
    return null;
  }
};

// Helper function to delete cache
const deleteCache = async (key) => {
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