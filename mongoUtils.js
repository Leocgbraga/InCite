const { MongoClient } = require('mongodb');

// MongoDB Configuration
const MONGO_URL = 'mongodb://localhost:27017';
const DB_NAME = 'academic_sources';
const client = new MongoClient(MONGO_URL, { useNewUrlParser: true, useUnifiedTopology: true });


const db = client.db(DB_NAME);
db.collection('articles_collection').dropIndex("uniqueID_1");



module.exports = {
    /**
     * Connect to MongoDB.
     * @returns {Promise} Resolves with the database instance.
     */
    connect: async function() {
        await client.connect();
        return client.db(DB_NAME);
    },

    /**
     * Close the MongoDB connection.
     */
    close: function() {
        return client.close();
    },

    /**
     * Insert documents into a specified collection.
     * @param {Array} docs - The documents to insert.
     * @param {string} collectionName - The name of the collection.
     * @returns {Promise} Resolves with the result of the insertion.
     */
    insertMany: async function(docs, collectionName) {
        const db = client.db(DB_NAME);
        return await db.collection(collectionName).insertMany(docs);
    }
};
