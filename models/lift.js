const mongoose = require('mongoose');
const Schema = mongoose.Schema;

// One logged session: the weight used, when, and how long it took (seconds).
const sessionSchema = new Schema({
        weight: { type: Number },
        date: { type: Number, default: Date.now },   // epoch ms
        seconds: { type: Number, default: 0 }
}, { _id: false });

const liftSchema = new Schema({
        name: { type: String, required: true },
        weight: { type: Number },
        sets: { type: Number, required: true },
        reps: { type: Number, required: true  },
        type: { type: String, required: true  },
        creator: { type: Schema.Types.ObjectId, ref: 'User' },
        pastWeights: [{ type: Number }],
        sessions: [sessionSchema]
});

module.exports = mongoose.model('Lift', liftSchema);