const User = require('../../models/user');

const MAX_WORKOUTS = 60;
const dayStart = (ms) => { const d = new Date(ms); d.setHours(0, 0, 0, 0); return d.getTime(); };

// Output mappers (date stored as Number, returned as String to dodge GraphQL Int limits).
const mapBody = (user) => ({
    entries: (user.bodyweight || [])
        .slice()
        .sort((a, b) => a.date - b.date)
        .map(e => ({ date: String(e.date), weight: e.weight })),
    goal: user.bodyweightGoal ?? null,
});

const mapWorkouts = (user) =>
    (user.workouts || [])
        .slice()
        .sort((a, b) => b.date - a.date) // newest first
        .map(w => ({
            date: String(w.date),
            mode: w.mode,
            deload: !!w.deload,
            pushIt: !!w.pushIt,
            durationSec: w.durationSec || 0,
            doneSets: w.doneSets || 0,
            totalSets: w.totalSets || 0,
            volume: w.volume || 0,
            lifts: (w.lifts || []).map(l => ({ name: l.name, type: l.type })),
            prs: w.prs || [],
        }));

const requireUser = async (req) => {
    if (!req.isAuth) throw new Error('Unauthenticated.');
    const user = await User.findById(req.userId);
    if (!user) throw new Error('User not found.');
    return user;
};

module.exports = {
    userBody: async (args, req) => {
        const user = await requireUser(req);
        return mapBody(user);
    },

    workoutHistory: async (args, req) => {
        const user = await requireUser(req);
        return mapWorkouts(user);
    },

    // Upsert one body-weight entry per calendar day (re-logging today overwrites).
    logBodyweight: async (args, req) => {
        const user = await requireUser(req);
        const weight = Math.round((args.weight || 0) * 10) / 10;
        if (!(weight > 0)) throw new Error('Weight must be positive.');
        const key = dayStart(args.date ? parseInt(args.date, 10) : Date.now());
        user.bodyweight = (user.bodyweight || []).filter(e => dayStart(e.date) !== key);
        user.bodyweight.push({ date: key, weight });
        await user.save();
        return mapBody(user);
    },

    removeBodyweight: async (args, req) => {
        const user = await requireUser(req);
        const key = dayStart(parseInt(args.date, 10));
        user.bodyweight = (user.bodyweight || []).filter(e => dayStart(e.date) !== key);
        await user.save();
        return mapBody(user);
    },

    setBodyweightGoal: async (args, req) => {
        const user = await requireUser(req);
        user.bodyweightGoal = (args.goal && args.goal > 0) ? args.goal : null;
        await user.save();
        return mapBody(user);
    },

    // Prepend a workout summary, cap the stored history.
    logWorkout: async (args, req) => {
        const user = await requireUser(req);
        const w = args.workout;
        user.workouts = [{
            date: w.date ? parseInt(w.date, 10) : Date.now(),
            mode: w.mode,
            deload: !!w.deload,
            pushIt: !!w.pushIt,
            durationSec: w.durationSec || 0,
            doneSets: w.doneSets || 0,
            totalSets: w.totalSets || 0,
            volume: w.volume || 0,
            lifts: (w.lifts || []).map(l => ({ name: l.name, type: l.type })),
            prs: w.prs || [],
        }, ...(user.workouts || [])].slice(0, MAX_WORKOUTS);
        await user.save();
        return mapWorkouts(user);
    },
};
