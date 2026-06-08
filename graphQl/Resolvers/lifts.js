const Lift = require('../../models/lift');
const User = require('../../models/user');
const { user } = require('./helpers');

// Shared output mapper so every resolver returns the same Lift shape (incl. sessions).
const mapLift = (lift) => ({
    _id: lift._doc._id.toString(),
    name: lift._doc.name,
    weight: lift._doc.weight,
    sets: lift._doc.sets,
    reps: lift._doc.reps,
    type: lift._doc.type,
    pastWeights: lift._doc.pastWeights,
    sessions: (lift._doc.sessions || []).map(s => ({
        weight: s.weight,
        date: String(s.date),     // epoch ms as string (GraphQL Int can't hold it)
        seconds: s.seconds || 0
    })),
    creator: user.bind(this, lift._doc.creator)
});

module.exports = {
    lifts: () => {
        return Lift.find().populate('creator').then(lifts => {
            return lifts.map(lift => ({
                _id: lift._doc._id.toString(),
                name: lift._doc.name,
                weight: lift._doc.weight,
                sets: lift._doc.sets,
                reps: lift._doc.reps,
                type: lift._doc.type,
                pastWeights: lift._doc.pastWeights,
                sessions: (lift._doc.sessions || []).map(s => ({
                    weight: s.weight, date: String(s.date), seconds: s.seconds || 0
                })),
                creator: {
                    _id: lift._doc.creator._id.toString(),
                    email: lift._doc.creator.email,
                    createdLifts: []
                }
            }));
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
            return lifts.map(mapLift);
        }).catch(err => {
            console.log(err);
            throw err;
        });
    },

    createLift: (args, req) => {
        if (!req.isAuth) {
            throw new Error('Not authenticated!');
        }
        const w = args.liftInput.weight;
        const lift = new Lift({
            name: args.liftInput.name,
            weight: w,
            sets: args.liftInput.sets,
            reps: args.liftInput.reps,
            type: args.liftInput.type,
            creator: req.userId,
            pastWeights: [w],
            sessions: [{ weight: w, date: Date.now(), seconds: 0 }]
        });
        let createdLift;
        return lift.save().then(result => {
            createdLift = mapLift(result);
            return User.findById(req.userId).then(user => {
                if (!user) {
                    throw new Error('User not found.');
                }
                user.createdLifts.push(lift);
                return user.save();
            })
            .then(() => createdLift)
            .catch(err => {
                console.log(err);
                throw err;
            });
        });
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
            // Keep pastWeights and sessions aligned when the weight changes
            if (args.liftInput.weight && args.liftInput.weight !== oldWeight) {
                lift.pastWeights.push(args.liftInput.weight);
                lift.sessions.push({ weight: args.liftInput.weight, date: Date.now(), seconds: 0 });
            }
            return lift.save();
        }).then(mapLift).catch(err => {
            console.log(err);
            throw err;
        });
    },

    // Log a completed workout session: always records a new entry (even if the
    // weight equals the current max) with the date and how long it took.
    logSession: (args, req) => {
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
            const w = args.weight;
            lift.pastWeights.push(w);
            lift.sessions.push({ weight: w, date: Date.now(), seconds: args.seconds || 0 });
            if (w > lift.weight) lift.weight = w; // a new PR raises the working max
            return lift.save();
        }).then(mapLift).catch(err => {
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
