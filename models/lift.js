const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const liftSchema = new Schema({
        name: { type: String, required: true },
        weight: { type: Number },
        sets: { type: Number, required: true },
        reps: { type: Number, required: true  },
        type: { type: String, required: true  },
        creator: { type: Schema.Types.ObjectId, ref: 'User' },
        pastWeights: [{ type: Number }]
});

module.exports = mongoose.model('Lift', liftSchema);