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

const SYSTEM = `Convert messy free-form workout notes (any format/delimiters) into structured lifts. Extract every distinct resistance exercise.
- name: clean title-cased name, no numbers. Expand abbreviations (DB=Dumbbell, BB=Barbell, Mch=Machine, OHP=Overhead Press, RDL=Romanian Deadlift, ext=Extension).
- type: primary muscle group (allowed values only).
- weight: integer pounds. Convert kg→lb (×2.2, round). Bodyweight or none = 0. If several weights are listed for one exercise, use the highest.
- sets/reps: integers. Rep range → higher. Unknown → sets 3, reps 8.
- Ignore non-lifts: dates, day labels, RPE, tempo, rest, cardio, stretches, personal notes.
- duplicate: if an exercise already exists in the provided library (match by meaning, ignoring spelling/abbreviation/word-order), reuse that library name VERBATIM and set true; else false. Empty/absent library → always false.
Return an empty list if there are no lifts.`;

// Free via Google AI Studio (aistudio.google.com/app/apikey). Each model has its
// OWN free-tier quota bucket, so on a 429 we instantly try the next one (no
// waiting — stays within the serverless time budget). Override with GEMINI_MODEL.
const MODELS = process.env.GEMINI_MODEL
    ? [process.env.GEMINI_MODEL]
    : ['gemini-2.5-flash', 'gemini-2.5-flash-lite', 'gemini-2.0-flash-lite', 'gemini-1.5-flash', 'gemini-1.5-flash-8b'];

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
