require('dotenv').config();
const express = require('express');
const app = express();
const bodyParser = require('body-parser');
const { graphqlHTTP } = require('express-graphql');
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

app.use((req, res, next) => {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST,GET,OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    if (req.method === 'OPTIONS') {
        return res.sendStatus(200);
    }
    next();
});

app.use(async (req, res, next) => {
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

