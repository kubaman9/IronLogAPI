const Lift = require('../../models/lift');
const User = require('../../models/user');

const lifts = async liftIds => {
    try {
        const lifts = await Lift.find({ _id: { $in: liftIds } });
        return lifts.map(lift => {
            return { ...lift._doc, _id: lift._doc._id.toString(), creator: user.bind(this, lift._doc.creator) };
        });
    } catch (err) {
        throw err;
    }
}

const user = userId => {
    return User.findById(userId).then(user => {
        if (!user) {
            throw new Error('User not found.');
        }
        return { ...user._doc, _id: user._doc._id.toString(), password: "null", createdLifts: lifts.bind(this, user._doc.createdLifts) };
    }).catch(err => {
        throw err;
    });
}

module.exports = { lifts, user };
