const liftResolvers = require('./lifts');
const authResolvers = require('./auth');

module.exports = {
    ...liftResolvers,
    ...authResolvers
};