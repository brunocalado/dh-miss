import { MODULE_ID, logDebug } from "./constants.js";
const GEMINI_BASE = "https://generativelanguage.googleapis.com/v1beta/models";

/** Cooldown duration in milliseconds before a rate-limited model is deprioritized. */
const COOLDOWN_MS = 5 * 60 * 1000;

let _srdCache = null;

// ── Model Smart Routing ─────────────────────────────────────────────

/**
 * Read the reputation setting and strip keys not in the user-configured model lists.
 * @returns {Record<string, number>} Clean reputation map.
 */
function _getReputation() {
    const raw = game.settings.get(MODULE_ID, "modelReputation") ?? {};
    const gemini = JSON.parse(game.settings.get(MODULE_ID, "geminiModels") || "[]");
    const openRouter = JSON.parse(game.settings.get(MODULE_ID, "openRouterModels") || "[]");
    const configured = new Set([...gemini, ...openRouter]);
    const clean = {};
    for (const key of configured) {
        if (key in raw) clean[key] = raw[key];
    }
    return clean;
}

/**
 * Increment or decrement a model's reputation score and persist it.
 * @param {string} model - The model key.
 * @param {number} delta - Value to add (+1 success, -1 failure).
 */
async function _updateReputation(model, delta) {
    try {
        const rep = _getReputation();
        rep[model] = (rep[model] ?? 0) + delta;
        await game.settings.set(MODULE_ID, "modelReputation", rep);
    } catch (err) {
        console.warn("DH Miss | Failed to update model reputation:", err.message);
    }
}

/**
 * Mark a model as rate-limited with the current timestamp.
 * @param {string} model - The model key that hit a rate limit.
 */
async function _setCooldown(model) {
    try {
        const cooldowns = game.settings.get(MODULE_ID, "modelCooldowns") ?? {};
        cooldowns[model] = Date.now();
        await game.settings.set(MODULE_ID, "modelCooldowns", cooldowns);
    } catch (err) {
        console.warn("DH Miss | Failed to set model cooldown:", err.message);
    }
}

/**
 * Check if a model is currently within its cooldown window.
 * @param {string} model - The model key.
 * @param {Record<string, number>} cooldowns - Cooldown timestamps map.
 * @returns {boolean}
 */
function _isOnCooldown(model, cooldowns) {
    const ts = cooldowns[model];
    return ts != null && (Date.now() - ts) < COOLDOWN_MS;
}

/**
 * Build a prioritised model queue using reputation and cooldown data.
 * Models on cooldown are not removed — they are pushed to the end so
 * they serve as a last resort if every non-cooldown model also fails.
 * Reads the user-configured model lists from settings instead of the MODELS constant.
 * @param {{ geminiKey?: string, openRouterKey?: string }} keys - Available API keys.
 * @returns {string[]} Ordered model keys to try.
 */
function _buildModelQueue(keys = {}) {
    const reputation = _getReputation();
    const cooldowns = game.settings.get(MODULE_ID, "modelCooldowns") ?? {};

    const geminiModels = keys.geminiKey
        ? JSON.parse(game.settings.get(MODULE_ID, "geminiModels") || "[]")
        : [];
    const openRouterModels = keys.openRouterKey
        ? JSON.parse(game.settings.get(MODULE_ID, "openRouterModels") || "[]")
        : [];
    const allModels = [...geminiModels, ...openRouterModels];

    const available = [];
    const cooledDown = [];

    for (const model of allModels) {
        if (_isOnCooldown(model, cooldowns)) {
            cooledDown.push(model);
        } else {
            available.push(model);
        }
    }

    /** Sort by reputation descending; ties broken by user-configured order. */
    const sortByReputation = (a, b) => {
        const diff = (reputation[b] ?? 0) - (reputation[a] ?? 0);
        if (diff !== 0) return diff;
        return allModels.indexOf(a) - allModels.indexOf(b);
    };

    available.sort(sortByReputation);

    // Cooldown models: least-recently-failed first (best chance rate limit cleared).
    cooledDown.sort((a, b) => (cooldowns[a] ?? 0) - (cooldowns[b] ?? 0));

    return [...available, ...cooledDown];
}

/**
 * Extract the HTTP status code from an error thrown by _callGemini / _callOpenRouter.
 * @param {Error} err
 * @returns {number} The status code, or 0 if not parseable.
 */
function _extractStatus(err) {
    const match = err.message?.match(/Error (\d{3})/);
    return match ? Number(match[1]) : 0;
}

/**
 * Load and cache the SRD JSON content for AI context.
 */
async function loadSRD() {
    if (_srdCache) return _srdCache;
    const response = await fetch(`modules/${MODULE_ID}/data/srd.json`);
    if (!response.ok) throw new Error("Failed to load SRD data.");
    const data = await response.json();
    _srdCache = JSON.stringify(data);
    return _srdCache;
}

/**
 * Parse a Gemini API error into a user-friendly message.
 */
function parseGeminiError(status, responseText) {
    try {
        const json = JSON.parse(responseText);
        const msg = json.error?.message || "";

        if (status === 429) {
            const retryInfo = json.error?.details?.find(d => d["@type"]?.includes("RetryInfo"));
            const delay = retryInfo?.retryDelay || "";
            return `Rate limit exceeded. ${delay ? `Try again in ${delay}.` : "Wait a moment and try again."}`;
        }
        if (status === 403) return "API key doesn't have access. Check your key at aistudio.google.com.";
        if (status === 400) return `Bad request: ${msg}`;
        return msg || `API error (${status})`;
    } catch {
        return `API error (${status})`;
    }
}

/**
 * Check if an API error status is retryable with a different model.
 */
function isRetryableError(status) {
    return status === 429 || status === 503;
}

/**
 * Call the Gemini API with a single model. Returns { ok, text, status, errText }.
 */
async function callGeminiModel(apiKey, model, question, srdContent) {
    const url = `${GEMINI_BASE}/${model}:generateContent`;

    const body = {
        system_instruction: {
            parts: [{
                text: `You are a Daggerheart TTRPG rules assistant. Answer ONLY based on the rules data provided below. Be concise and helpful. If the answer is not in the data, say you don't have that information. Always answer in the same language the user asked the question.\n\nRules data:\n${srdContent}`
            }]
        },
        contents: [{
            parts: [{ text: question }]
        }]
    };

    const response = await fetch(url, {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            "x-goog-api-key": apiKey
        },
        body: JSON.stringify(body)
    });

    if (!response.ok) {
        const errText = await response.text();
        return { ok: false, status: response.status, errText };
    }

    const result = await response.json();
    const text = result.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!text) return { ok: false, status: 0, errText: "No response from Gemini API." };
    return { ok: true, text };
}

/**
 * Call the Gemini API with automatic fallback to other models on rate limit/overload.
 * Only uses Google Direct models from the user-configured geminiModels list.
 * @param {string} apiKey - The Gemini API key.
 * @param {string} question - The user question.
 * @param {string} srdContent - The cached SRD JSON string.
 * @returns {Promise<string>} The API response text.
 */
async function callGeminiAPI(apiKey, question, srdContent) {
    // SRD Q&A only supports Google Direct models — filter with geminiKey only.
    const modelsToTry = _buildModelQueue({ geminiKey: apiKey });
    logDebug("SRD Model queue:", modelsToTry);

    let lastError = null;
    for (const model of modelsToTry) {
        // Skip OpenRouter models — SRD window uses Gemini directly.
        if (model.includes("/")) continue;

        logDebug(`SRD trying model: ${model}`);
        const result = await callGeminiModel(apiKey, model, question, srdContent);

        if (result.ok) {
            await _updateReputation(model, 1);
            return result.text;
        }

        logDebug(`SRD model ${model} failed (${result.status})`);
        lastError = result;

        if (isRetryableError(result.status)) {
            await _setCooldown(model);
        } else {
            await _updateReputation(model, -1);
            break;
        }
    }

    if (lastError?.errText) {
        throw new Error(parseGeminiError(lastError.status, lastError.errText));
    }
    throw new Error(lastError?.errText || "All models failed.");
}

/**
 * Generate a roll commentary using the AI, based on the payload from a detected roll.
 * Builds the prompt from the payload's persona and sends roll context as user content.
 * @param {object} payload - The roll payload built by buildPayload.
 * @param {object} config - { geminiKey, openRouterKey, preferredModel }
 * @returns {Promise<string>} The AI-generated commentary text.
 */
async function generateRollComment(payload, config) {
    const { geminiKey, openRouterKey } = config;
    const sections = [];
    const personaPrompt = payload.persona?.prompt ?? "You are an AI that comments on RPG dice rolls.";
    sections.push(`## YOUR PERSONA\n${personaPrompt}`);
    if (payload.stance?.prompt) sections.push(`## YOUR STANCE\n${payload.stance.prompt}`);
    if (payload.persona?.["examples-quotes"]?.length) {
        sections.push(`## STYLE EXAMPLES\n${payload.persona["examples-quotes"].join("\n")}`);
    }
    if (payload.actorDirective) sections.push(`## IMPORTANT ACTOR NOTES\n${payload.actorDirective}`);
    const systemPrompt = sections.join("\n\n");

    const rulesBlock = payload.rules?.length ? `Rules context:\n${payload.rules.join("\n")}` : "";

    const eventSummaryBlock = payload.actionContext?.eventSummary
        ? `EVENT (this is what happened, do NOT contradict this): ${payload.actionContext.eventSummary}`
        : null;

    const actionContextBlock = payload.actionContext
        ? `Action context: ${JSON.stringify(payload.actionContext)}`
        : `Roll outcome: ${payload.rollOutcome}`;

    const userMessage = [
        rulesBlock,
        `Player: ${payload.user}`,
        payload.actor ? `Actor: ${JSON.stringify(payload.actor)}` : null,
        eventSummaryBlock,
        actionContextBlock
    ].filter(Boolean).join("\n");

    logDebug(
        "%c━━━ AI Request (what is sent to the model) ━━━",
        "color: #C9A060; font-weight: bold; font-size: 13px;"
    );
    logDebug("System Prompt:", systemPrompt);
    logDebug("User Message:", userMessage);

    const modelsToTry = _buildModelQueue({ geminiKey, openRouterKey });
    logDebug("Model Queue:", modelsToTry);

    let lastError = null;
    for (const model of modelsToTry) {
        const isOpenRouter = model.includes("/");

        logDebug(`Trying model: ${model}`);

        try {
            const text = isOpenRouter
                ? await _callOpenRouter(openRouterKey, model, systemPrompt, userMessage)
                : await _callGemini(geminiKey, model, systemPrompt, userMessage);

            if (text) {
                await _updateReputation(model, 1);
                return text;
            }
        } catch (err) {
            const status = _extractStatus(err);
            logDebug(`Model ${model} failed (${status}):`, err.message);
            lastError = err;

            if (status === 429 || status === 503) {
                await _setCooldown(model);
            } else {
                await _updateReputation(model, -1);
            }
        }
    }

    throw lastError || new Error("All models failed or no keys configured.");
}

async function _callGemini(apiKey, model, systemPrompt, userMessage) {
    const url = `${GEMINI_BASE}/${model}:generateContent`;
    const body = {
        system_instruction: { parts: [{ text: systemPrompt }] },
        contents: [{ parts: [{ text: userMessage }] }]
    };

    const response = await fetch(url, {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            "x-goog-api-key": apiKey
        },
        body: JSON.stringify(body)
    });

    if (!response.ok) {
        const errText = await response.text();
        throw new Error(`Gemini Error ${response.status}: ${errText}`);
    }

    const result = await response.json();
    return result.candidates?.[0]?.content?.parts?.[0]?.text;
}

async function _callOpenRouter(apiKey, model, systemPrompt, userMessage) {
    const url = "https://openrouter.ai/api/v1/chat/completions";
    const body = {
        model: model,
        messages: [
            { role: "system", content: systemPrompt },
            { role: "user", content: userMessage }
        ]
    };

    const response = await fetch(url, {
        method: "POST",
        headers: {
            "Authorization": `Bearer ${apiKey}`,
            "Content-Type": "application/json",
            "HTTP-Referer": window.location.origin, // Optional, identifies the site
            "X-Title": "DH-MISS Foundry Module"     // Optional, identifies the app
        },
        body: JSON.stringify(body)
    });

    if (!response.ok) {
        const errText = await response.text();
        throw new Error(`OpenRouter Error ${response.status}: ${errText}`);
    }

    const result = await response.json();
    return result.choices?.[0]?.message?.content;
}

export { callGeminiAPI, loadSRD, generateRollComment };
