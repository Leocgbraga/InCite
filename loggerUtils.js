const winston = require('winston');

const logger = winston.createLogger({
    level: 'info',
    format: winston.format.json(),
    defaultMeta: { service: 'academic-fetcher' },
    transports: [
        new winston.transports.File({ filename: 'error.log', level: 'error' }),
        new winston.transports.File({ filename: 'combined.log' }),
    ],
});

if (process.env.NODE_ENV !== 'production') {
    logger.add(new winston.transports.Console({
        format: winston.format.simple(),
    }));
}

module.exports = {
    logInfo: function(message) {
        logger.info(message);
    },
    logError: function(message, error) {
        logger.error(`${message}: ${error}`);
    },
    logWarn: function(message) {  // Add this function
        logger.warn(message);
    }
};
