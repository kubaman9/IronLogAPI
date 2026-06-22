const Anthropic = require('@anthropic-ai/sdk');

// Categories the app understands — the model must map every lift to one of these.
const MUSCLE_TYPES = ['Chest', 'Tricept', 'Bicept', 'Shoulders', 'Back', 'Abbs', 'Legs', 'Forearms'];

const LIFT_SCHEMA = {
    type: 'object',
    properties: {
        lifts: {
            type: 'array',
            items: {
                type: 'object',
                properties: {
                    name: { type: 'string' },
                    type: { type: 'string', enum: MUSCLE_TYPES },
                    weight: { type: 'integer' },
                    sets: { type: 'integer' },
                    reps: { type: 'integer' }
                },
                required: ['name', 'type', 'weight', 'sets', 'reps'],
                additionalProperties: false
            }
        }
    },
    required: ['lifts'],
    additionalProperties: false
};

const SYSTEM = `You convert a lifter's free-form workout notes into structured lifts for a fitness app.
Rules:
- One entry per distinct exercise. Merge obvious duplicates.
- name: clean, title-cased exercise name (e.g. "Incline Dumbbell Press"). No set/rep/weight info in the name.
- type: the muscle group it primarily trains, from the allowed list only.
- weight: the working weight in POUNDS as an integer. Convert kg to lb (1 kg = 2.2 lb, round). If none is given, use 0.
- sets / reps: integers. If a range like "3x8-10" is given, take the higher rep. If unknown, default sets=3, reps=8.
- Ignore cardio, stretches, and non-resistance notes.
- If the text contains no recognizable lifts, return an empty list.`;

module.exports = {
    // Sends the user's pasted notes to Claude and returns a JSON string of parsed
    // lifts. Auth-gated so only signed-in users can spend API budget. Returns a
    // JSON string (the client parses it) to avoid widening the GraphQL schema.
    parseWorkoutNotes: async (args, req) => {
        if (!req.isAuth) {
            throw new Error('Unauthenticated.');
        }
        const text = (args.text || '').trim();
        if (!text) return JSON.stringify({ lifts: [] });
        if (text.length > 6000) {
            throw new Error('That note is too long — paste up to ~6000 characters.');
        }
        if (!process.env.ANTHROPIC_API_KEY) {
            throw new Error('Import is not configured on the server yet.');
        }

        const client = new Anthropic();
        let response;
        try {
            response = await client.messages.create({
                model: 'claude-opus-4-8',
                max_tokens: 4000,
                system: SYSTEM,
                output_config: { format: { type: 'json_schema', schema: LIFT_SCHEMA } },
                messages: [{ role: 'user', content: text }]
            });
        } catch (err) {
            console.error('parseWorkoutNotes:', err.message);
            throw new Error('Could not read those notes. Try again.');
        }

        if (response.stop_reason === 'refusal') {
            throw new Error('Could not read those notes. Try again.');
        }
        const block = (response.content || []).find(b => b.type === 'text');
        // output_config guarantees the text block is schema-valid JSON; pass it through.
        return block ? block.text : JSON.stringify({ lifts: [] });
    }
};
