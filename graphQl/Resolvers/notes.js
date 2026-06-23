// Categories the app understands — the model must map every lift to one of these.
const MUSCLE_TYPES = ['Chest', 'Tricept', 'Bicept', 'Shoulders', 'Back', 'Abbs', 'Legs', 'Forearms'];

// Gemini uses an OpenAPI-subset schema with UPPERCASE type names.
const LIFT_SCHEMA = {
    type: 'OBJECT',
    properties: {
        lifts: {
            type: 'ARRAY',
            items: {
                type: 'OBJECT',
                properties: {
                    name: { type: 'STRING' },
                    type: { type: 'STRING', enum: MUSCLE_TYPES },
                    weight: { type: 'INTEGER' },
                    sets: { type: 'INTEGER' },
                    reps: { type: 'INTEGER' },
                    duplicate: { type: 'BOOLEAN' }
                },
                required: ['name', 'type', 'weight', 'sets', 'reps', 'duplicate']
            }
        }
    },
    required: ['lifts']
};

const SYSTEM = `You read a lifter's free-form workout notes — copied from any notes app, in ANY format — and convert them into clean, structured lifts for a fitness app. The notes may be messy, inconsistent, abbreviated, or richly detailed. Extract every distinct resistance exercise you can find.

ROBUST PARSING — handle all of these:
- Any delimiter or layout: one per line, bullets (-, *, •), numbered lists, commas, semicolons, slashes, tables, or several exercises on one line.
- Any weight/sets/reps notation and order: "Bench 185x5", "5x185", "3x8 @135", "135lb 3 sets of 8", "3 sets 8-10 reps 60kg", "100 4,4,3", "bw+25", "2 plates", "DB 70s 4x12". Figure out which number is weight vs sets vs reps from context and units.
- Mixed units: convert kg to pounds (1 kg = 2.2 lb, round to nearest integer). Numbers with "lb"/"lbs"/"#" are already pounds.
- Bodyweight moves (pull-ups, dips, push-ups, plank, "BW"): weight = 0 unless added weight is noted (then use the added weight).
- Abbreviations and shorthand: expand to clean names ("OHP" -> "Overhead Press", "RDL" -> "Romanian Deadlift", "DB" -> "Dumbbell", "BB" -> "Barbell", "incl" -> "Incline", "ext" -> "Extension").

ABUNDANCE OF INFO — ignore noise that is not a lift: dates, day labels ("Push Day", "Leg Day", "Monday"), RPE, tempo, rest times, "warmup"/"working set" labels, supersets/dropset annotations, bodyweight log, cardio, stretches, and personal notes. Keep only the resistance exercises.

ABSENCE OF INFO — fill sensible defaults: if sets unknown use 3; if reps unknown use 8; if a rep range is given use the higher number; if weight is unknown or not applicable use 0. If multiple sets list different reps (e.g. "8,8,6"), use the typical/first rep count and the number of sets listed.

DEDUPE AGAINST THE EXISTING LIBRARY:
- A list of the exercises already in the user's library may be provided.
- If an imported exercise is the SAME movement as one already in the library — judged by meaning, ignoring case, spelling, abbreviations, plural/singular, word order, or equipment shorthand (e.g. "OHP" = "Overhead Press", "DB press" = "Dumbbell Bench Press", "curls" = "Bicep Curl") — then reuse that EXISTING library name VERBATIM and set "duplicate": true.
- Otherwise use your own clean name and set "duplicate": false.
- If no library is provided, set "duplicate": false for every lift.

OUTPUT:
- One entry per distinct exercise. Merge obvious duplicates of the same movement.
- name: clean, title-cased exercise name (or the existing library name for duplicates). No weight/sets/reps text inside the name.
- type: the muscle group it primarily trains, from the allowed list ONLY.
- weight, sets, reps: integers per the rules above.
- duplicate: boolean per the dedupe rules above.
- If the text contains no recognizable lifts at all, return an empty list.`;

// Free via Google AI Studio (aistudio.google.com/app/apikey). Each model has its
// own free-tier quota bucket, so we try a chain until one has capacity. Override
// with a single model via GEMINI_MODEL.
const MODELS = process.env.GEMINI_MODEL
    ? [process.env.GEMINI_MODEL]
    : ['gemini-2.5-flash', 'gemini-1.5-flash'];

module.exports = {
    // Sends the user's pasted notes to Gemini and returns a JSON string of parsed
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
        const key = process.env.GEMINI_API_KEY;
        if (!key) {
            throw new Error('Import is not configured on the server yet.');
        }

        // Existing library names — appended to the user turn so the model can
        // dedupe semantically and reuse the user's own naming for matches.
        const library = Array.isArray(args.library) ? args.library.filter(Boolean) : [];
        const libBlock = library.length
            ? `\n\n--- EXISTING LIBRARY (already saved; reuse these names verbatim for duplicates) ---\n${library.map(n => '- ' + n).join('\n')}`
            : '\n\n--- EXISTING LIBRARY is empty; set duplicate=false for every lift. ---';

        const userText = text + libBlock;

        let lastDetail = 'unknown';
        for (const model of MODELS) {
            // Per-model config: give plenty of output room, and on Gemini 2.5
            // disable the thinking budget so it can't starve the JSON output on a
            // long note (2.5 spends output tokens "thinking" by default).
            const generationConfig = {
                temperature: 0,
                maxOutputTokens: 8192,
                responseMimeType: 'application/json',
                responseSchema: LIFT_SCHEMA
            };
            if (model.startsWith('gemini-2.5')) {
                generationConfig.thinkingConfig = { thinkingBudget: 0 };
            }
            const body = JSON.stringify({
                systemInstruction: { parts: [{ text: SYSTEM }] },
                contents: [{ role: 'user', parts: [{ text: userText }] }],
                generationConfig
            });

            const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${key}`;
            let res;
            try {
                res = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body });
            } catch (err) {
                lastDetail = 'fetch ' + err.message;
                console.error('parseWorkoutNotes fetch:', model, err.message);
                continue; // network blip — try the next model
            }

            const data = await res.json().catch(() => null);
            if (!res.ok) {
                lastDetail = (res.status) + ' ' + (data && data.error && data.error.message || '');
                console.error('parseWorkoutNotes Gemini:', model, lastDetail);
                // 404 = model unavailable for this key, 429 = quota exhausted — try the next model.
                if (res.status === 404 || res.status === 429) continue;
                break; // 400/403 etc. won't be fixed by another model
            }

            const cand = data && data.candidates && data.candidates[0];
            const out = cand && cand.content && cand.content.parts && cand.content.parts[0] && cand.content.parts[0].text;
            if (out) return out;
            // 200 but no text — truncated (MAX_TOKENS) or safety block. Record and try next model.
            lastDetail = '200 finishReason=' + (cand && cand.finishReason || (data && data.promptFeedback && data.promptFeedback.blockReason) || 'empty');
            console.error('parseWorkoutNotes empty:', model, lastDetail);
        }

        console.error('parseWorkoutNotes exhausted models:', lastDetail);
        throw new Error('Could not read those notes. Try again in a moment.');
    }
};
