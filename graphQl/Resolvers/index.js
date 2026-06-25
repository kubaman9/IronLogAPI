const liftResolvers = require('./lifts');
const authResolvers = require('./auth');
const noteResolvers = require('./notes');
const accountResolvers = require('./account');

module.exports = {
    ...liftResolvers,
    ...authResolvers,
    ...noteResolvers,
    ...accountResolvers
};