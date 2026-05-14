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

let isConnected = false;

const connectDB = async () => {
    if (isConnected && mongoose.connection.readyState === 1) return;
    await mongoose.connect(`mongodb+srv://${process.env.MONGO_USER}:${process.env.MONGO_PASSWORD}@cluster0.ylktlsc.mongodb.net/${process.env.MONGO_DB}?appName=Cluster0`);
    isConnected = true;
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
    await connectDB();
    next();
});

app.use(isAuth);

app.use(bodyParser.json());

app.use('/graphql', graphqlHTTP({
    schema: graphQlSchema,
    rootValue: graphQlResolvers,
    graphiql: true
}));

if (require.main === module) {
    connectDB().then(() => app.listen(3000));
}

module.exports = app;

