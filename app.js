require('dotenv').config();
const express = require('express');
const app = express();
const bodyParser = require('body-parser');
const { graphqlHTTP } = require('express-graphql');
const cors = require('cors');
const mongoose = require('mongoose');
const graphQlSchema = require('./graphQl/Schema/index');
const graphQlResolvers = require('./graphQl/Resolvers/index');
const isAuth = require('./middleware/is-auth');

// Cache the connection (and the in-flight connect promise) across serverless
// invocations. Concurrent cold-start requests await the SAME promise instead of
// each calling mongoose.connect() — which otherwise races and throws a 500.
let cached = global._mongoose;
if (!cached) cached = global._mongoose = { conn: null, promise: null };

const connectDB = async () => {
    if (cached.conn && mongoose.connection.readyState === 1) return cached.conn;
    if (!cached.promise) {
        const uri = `mongodb+srv://${process.env.MONGO_USER}:${process.env.MONGO_PASSWORD}@cluster0.ylktlsc.mongodb.net/${process.env.MONGO_DB}?appName=Cluster0`;
        cached.promise = mongoose.connect(uri, {
            bufferCommands: false,
            serverSelectionTimeoutMS: 10000,
        });
    }
    try {
        cached.conn = await cached.promise;
    } catch (err) {
        cached.promise = null; // failed — let the next request retry
        throw err;
    }
    return cached.conn;
};

const corsOptions = {
    origin: ['https://kubaman9.github.io', 'http://localhost:5173'],
    methods: ['GET', 'POST', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
    optionsSuccessStatus: 200
};

app.options('*', cors(corsOptions));
app.use(cors(corsOptions));

app.use(async (req, res, next) => {
    if (req.method === 'OPTIONS') {
        return next();
    }
    try {
        await connectDB();
        next();
    } catch (err) {
        console.error('DB connection failed:', err.message);
        res.status(503).json({ errors: [{ message: 'Database temporarily unavailable. Please try again.' }] });
    }
});

app.use(isAuth);

app.use(bodyParser.json());

app.use('/graphql', graphqlHTTP((req) => ({
    schema: graphQlSchema,
    rootValue: graphQlResolvers,
    context: req,
    graphiql: true
})));

if (require.main === module) {
    connectDB().then(() => app.listen(3000));
}

module.exports = app;

