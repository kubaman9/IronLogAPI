const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const userSchema = new Schema({
    email: { type: String, required: true },
    password: { type: String, required: true },
    createdLifts: [{
        type: Schema.Types.ObjectId,
        ref: 'Lift'
    }],
    // Account-backed so they follow the user across devices.
    bodyweight: [{
        date: { type: Number },   // epoch ms, normalized to start-of-day
        weight: { type: Number }, // lbs (canonical)
    }],
    bodyweightGoal: { type: Number, default: null },
    workouts: [{
        date: { type: Number },
        mode: { type: String },
        deload: { type: Boolean },
        pushIt: { type: Boolean },
        durationSec: { type: Number },
        doneSets: { type: Number },
        totalSets: { type: Number },
        volume: { type: Number },
        lifts: [{ name: String, type: { type: String } }],
        prs: [String],
    }],
});

module.exports = mongoose.model('User', userSchema);
