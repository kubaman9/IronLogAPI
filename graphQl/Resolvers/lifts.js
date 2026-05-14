const Lift = require('../../models/lift');
const User = require('../../models/user');
const { user } = require('./helpers');

module.exports = {
    lifts: () => {
        return Lift.find().populate('creator').then(lifts => {
            return lifts.map(lift => {
                return { 
                    _id: lift._doc._id.toString(), 
                    name: lift._doc.name,
                    weight: lift._doc.weight,
                    sets: lift._doc.sets,
                    reps: lift._doc.reps,
                    type: lift._doc.type,
                    pastWeights: lift._doc.pastWeights,
                    creator: {
                        _id: lift._doc.creator._id.toString(),
                        email: lift._doc.creator.email,
                        createdLifts: []
                    }
                };
            });
        }).catch(err => {
            console.log(err);
            throw err;
        });
    },

    userLifts: (args, req) => {
        if (!req.isAuth) {
            throw new Error('Not authenticated!');
        }
        return Lift.find({ creator: req.userId }).then(lifts => {
            return lifts.map(lift => {
                return {
                    _id: lift._doc._id.toString(),
                    name: lift._doc.name,
                    weight: lift._doc.weight,
                    sets: lift._doc.sets,
                    reps: lift._doc.reps,
                    type: lift._doc.type,
                    pastWeights: lift._doc.pastWeights,
                    creator: user.bind(this, lift._doc.creator)
                };
            });
        }).catch(err => {
            console.log(err);
            throw err;
        });
    },

    createLift: (args, req) => {
        if (!req.isAuth) {
            throw new Error('Not authenticated!');
        }
        const lift = new Lift({
            name: args.liftInput.name,
            weight: args.liftInput.weight,
            sets: args.liftInput.sets,
            reps: args.liftInput.reps,
            type: args.liftInput.type,
            creator: req.userId,
            pastWeights: [args.liftInput.weight]
        });
        let createdLift;
        return lift.save().then(result => {
            createdLift = { 
                _id: result._doc._id.toString(), 
                name: result._doc.name,
                weight: result._doc.weight,
                sets: result._doc.sets,
                reps: result._doc.reps,
                type: result._doc.type,
                pastWeights: result._doc.pastWeights,
                creator: user.bind(this, result._doc.creator) 
            };
            return User.findById(req.userId).then(user => {
                if (!user) {
                    throw new Error('User not found.');
                }   
                user.createdLifts.push(lift);
                return user.save();
            })
            .then(result => {
                console.log(result);
                return createdLift;
            })
            .catch(err => {                
                console.log(err);
                throw err;
            });
        })
    },

    editLift: (args, req) => {
        if (!req.isAuth) {
            throw new Error('Not authenticated!');
        }
        return Lift.findById(args.liftId).then(lift => {
            if (!lift) {
                throw new Error('Lift not found.');
            }
            if (lift.creator.toString() !== req.userId) {
                throw new Error('Not authorized to edit this lift.');
            }
            const oldWeight = lift.weight;
            lift.name = args.liftInput.name || lift.name;
            lift.weight = args.liftInput.weight || lift.weight;
            lift.sets = args.liftInput.sets || lift.sets;
            lift.reps = args.liftInput.reps || lift.reps;
            lift.type = args.liftInput.type || lift.type;
            // Add new weight to pastWeights if weight changed
            if (args.liftInput.weight && args.liftInput.weight !== oldWeight) {
                lift.pastWeights.push(args.liftInput.weight);
            }
            return lift.save();
        }).then(result => {
            return {
                _id: result._doc._id.toString(),
                name: result._doc.name,
                weight: result._doc.weight,
                sets: result._doc.sets,
                reps: result._doc.reps,
                type: result._doc.type,
                pastWeights: result._doc.pastWeights,
                creator: user.bind(this, result._doc.creator)
            };
        }).catch(err => {
            console.log(err);
            throw err;
        });
    },

    deleteLift: (args, req) => {
        if (!req.isAuth) {
            throw new Error('Not authenticated!');
        }
        let liftToDelete;
        return Lift.findById(args.liftId).then(found => {
            if (!found) {
                throw new Error('Lift not found.');
            }
            if (found.creator.toString() !== req.userId) {
                throw new Error('Not authorized to delete this lift.');
            }
            liftToDelete = found;
            return User.findById(found.creator);
        }).then(user => {
            if (!user) {
                throw new Error('User not found.');
            }
            user.createdLifts = user.createdLifts.filter(id => id.toString() !== args.liftId);
            return user.save();
        }).then(() => {
            return Lift.findByIdAndDelete(args.liftId);
        }).then(result => {
            if (!result) {
                throw new Error('Failed to delete lift.');
            }
            return { ...result._doc, _id: result._doc._id.toString() };
        }).catch(err => {
            console.log(err);
            throw err;
        });
    }
};
