const liftResolvers = require('./lifts');
const authResolvers = require('./auth');
const noteResolvers = require('./notes');

module.exports = {
    ...liftResolvers,
    ...authResolvers,
    ...noteResolvers
};