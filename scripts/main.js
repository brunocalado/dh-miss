import { MODULE_ID, ROLL_OUTCOMES, AI_RULES, AI_PERSONAS, AI_STANCES, STAT_THRESHOLDS, TRAIT_LEVEL_DESCRIPTIONS, logDebug, ROLL_OUTCOME_DESCRIPTIONS, AI_LENGTH_DIRECTIVES } from "./constants.js";
import { registerSettings } from "./settings.js";
import { generateRollComment } from "./ai-assistant.js";

//////////////////////////////////////    HOOKS    //////////////////////////////////////

/**
 * Registers module settings.
 * Hook: init
 */
Hooks.once("init", () => {
    registerSettings();
});

/**
 * Pending AI comments waiting for Dice So Nice animation to complete.
 * Keys are the original roll message IDs.
 * Values are either the AI content string (AI resolved first) or true (DSN completed first).
 * @type {Map<string, string|true>}
 */
const _pendingDsnComments = new Map();

/**
 * Releases a held AI comment after Dice So Nice animation finishes.
 * If the AI response already arrived, creates the chat message immediately.
 * If not, marks the message as DSN-complete so postSarcasticComment can post on resolve.
 * Hook: diceSoNiceRollComplete
 * @param {string} messageId - The ID of the completed roll message.
 */
Hooks.on("diceSoNiceRollComplete", (messageId) => {
    if (!_pendingDsnComments.has(messageId)) return;

    const pending = _pendingDsnComments.get(messageId);

    if (typeof pending === "string") {
        // AI already resolved — post now
        _pendingDsnComments.delete(messageId);
        logDebug("DSN complete — posting held AI comment for", messageId);
        _createAiChatMessage(pending);
    } else {
        // AI hasn't resolved yet — mark DSN as done so it posts on arrival
        _pendingDsnComments.set(messageId, true);
        logDebug("DSN complete — AI still pending for", messageId);
    }
});

/**
 * Listens for new chat messages to detect Daggerheart rolls.
 * Logs payload on the roller's console and the GM's console.
 * Only the GM client posts the chat card to avoid duplicates.
 * Hook: createChatMessage
 * @param {ChatMessage} chatMessage - The newly created ChatMessage document.
 */
Hooks.on("createChatMessage", (chatMessage) => {
    if (game.system.id !== "daggerheart") return;

    const system = chatMessage.system;
    if (!system?.roll || typeof system.roll !== "object" || Object.keys(system.roll).length === 0) return;

    // Ignore rolls explicitly labeled as "undefined Check"
    if (system.title === "undefined Check") return;

    // Use system.isGM strictly — avoids treating GM-rolled player chars as adversary rolls
    const isGM = system.isGM === true;
    const rollOutcome = isGM ? detectGMRoll(system) : detectPlayerRoll(system);
    if (!rollOutcome) return;

    const payload = buildPayload(chatMessage, rollOutcome, isGM);

    // Show debug on the roller's console AND the GM's console
    const isRoller = chatMessage.author.id === game.user.id;
    if (isRoller || game.user.isGM) {
        logDebug(
            "%c━━━ DH-MISS Roll Detected ━━━",
            "color: #C9A060; font-weight: bold; font-size: 13px;"
        );
        logDebug("Roll Outcome:", rollOutcome);
        logDebug("Actor:", payload.actor);
        logDebug("Action Context:", payload.actionContext);
        logDebug("Rules:", payload.rules);
        logDebug("Persona:", payload.persona?.label ?? "custom");
    }

    // Only GM posts the chat card to avoid duplicates
    if (!game.user.isGM) return;

    // Skip AI if the roll outcome's group is disabled in settings
    const groupKey = getGroupSettingKey(rollOutcome);
    if (groupKey && !game.settings.get(MODULE_ID, groupKey)) return;

    // Skip AI based on activation chance probability
    const chance = parseInt(game.settings.get(MODULE_ID, "aiActivationChance") || "100", 10);
    if (chance < 100 && Math.random() * 100 >= chance) return;

    postSarcasticComment(payload, chatMessage.id);
});

/**
 * Intercepts rendered chat messages to style the AI reply.
 * Replaces the avatar and sender name for messages flagged as AI replies.
 * Hook: renderChatMessageHTML
 */
Hooks.on("renderChatMessageHTML", (message, html) => {
    if (!message.getFlag(MODULE_ID, "isAiReply")) return;

    const portrait = game.settings.get(MODULE_ID, "aiAvatarImage");

    const img = html.querySelector(".message-header img");
    if (img) img.src = portrait;
});

/**
 * Maps a ROLL_OUTCOMES value to its group enable/disable setting key.
 * Used to gate AI responses per outcome group in the createChatMessage hook.
 * @param {string} rollOutcome - The detected roll outcome label from ROLL_OUTCOMES.
 * @returns {string|null} The setting key for the group, or null if unrecognized.
 */
function getGroupSettingKey(rollOutcome) {
    if (!rollOutcome) return null;
    if (rollOutcome.startsWith("Player Action"))   return "aiEnablePlayerActions";
    if (rollOutcome.startsWith("Player Attack"))   return "aiEnablePlayerAttacks";
    if (rollOutcome.startsWith("Player Reaction")) return "aiEnablePlayerReactions";
    if (rollOutcome.startsWith("GM Attack"))        return "aiEnableGMAttacks";
    if (rollOutcome.startsWith("GM Reaction"))      return "aiEnableGMReactions";
    return null;
}

//////////////////////////////////////    ROLL DETECTION    //////////////////////////////////////

/**
 * Detects GM-specific roll outcomes from adversary rolls.
 * Triggered by the createChatMessage hook when system.isGM is true.
 * @param {object} system - The chatMessage.system data from a Daggerheart ChatMessage.
 * @returns {string|null} A ROLL_OUTCOMES value or null if no relevant roll detected.
 */
function detectGMRoll(system) {
    const roll = system.roll;
    const target = system.targetShort;

    const isCrit        = roll.isCritical === true || roll.result?.isCritical === true;
    const isReaction    = roll.type === "reaction";
    const hasTarget     = system.targets?.length > 0;
    const hitVal        = (hasTarget && target) ? parseInt(target.hit)  || 0 : 0;
    const missVal       = (hasTarget && target) ? parseInt(target.miss) || 0 : 0;
    const hasDifficulty = roll.difficulty != null;

    // Reaction rolls — requires difficulty to determine success/failure
    if (isReaction) {
        if (isCrit) return ROLL_OUTCOMES.GM_REACTION_CRITICAL;
        if (!hasDifficulty) return null;
        return roll.success === true
            ? ROLL_OUTCOMES.GM_REACTION_SUCCESS
            : ROLL_OUTCOMES.GM_REACTION_FAILURE;
    }

    if (isCrit) return ROLL_OUTCOMES.GM_ATTACK_CRITICAL;

    // Fumble (first die = 1) → worst attack failure
    if (roll.dice?.length > 0 && roll.dice[0].total === 1) {
        return ROLL_OUTCOMES.GM_ATTACK_FAILURE;
    }

    // Attack with targets
    if (hasTarget && (hitVal >= 1 || missVal >= 1)) {
        if (hitVal  >= 1) return ROLL_OUTCOMES.GM_ATTACK_SUCCESS;
        if (missVal >= 1) return ROLL_OUTCOMES.GM_ATTACK_FAILURE;
    }

    // Difficulty-based
    if (hasDifficulty) {
        return roll.success === true
            ? ROLL_OUTCOMES.GM_ATTACK_SUCCESS
            : ROLL_OUTCOMES.GM_ATTACK_FAILURE;
    }

    // No comparison value — can't determine outcome, skip
    return null;
}

/**
 * Detects player-specific roll outcomes from duality and action rolls.
 * Triggered by the createChatMessage hook when system.isGM is not true.
 * @param {object} system - The chatMessage.system data from a Daggerheart ChatMessage.
 * @returns {string|null} A ROLL_OUTCOMES value or null if no relevant roll detected.
 */
function detectPlayerRoll(system) {
    const roll = system.roll;
    const target = system.targetShort;
    const label = roll.result?.label ?? "";

    // Ignore Tag Team combined results
    if (label === "Tag Team Roll") return null;

    const isCrit        = roll.isCritical === true || roll.result?.isCritical === true
                       || label.toLowerCase().includes("critical");
    const isReaction    = roll.type === "reaction";
    const isHope        = label.toLowerCase() === "hope";
    const isFear        = label.toLowerCase() === "fear";
    const hasTarget     = system.targets?.length > 0;
    const hitVal        = (hasTarget && target) ? parseInt(target.hit)  || 0 : 0;
    const missVal       = (hasTarget && target) ? parseInt(target.miss) || 0 : 0;
    const hasDifficulty = roll.difficulty != null;

    // Reaction rolls — requires difficulty to determine success/failure
    if (isReaction) {
        if (isCrit) return ROLL_OUTCOMES.PLAYER_REACTION_CRITICAL;
        if (!hasDifficulty) return null;
        return roll.success === true
            ? ROLL_OUTCOMES.PLAYER_REACTION_SUCCESS
            : ROLL_OUTCOMES.PLAYER_REACTION_FAILURE;
    }

    // Critical — categorize by context (target = attack, difficulty = action)
    if (isCrit) {
        if (hasTarget) return ROLL_OUTCOMES.PLAYER_ATTACK_CRITICAL;
        if (hasDifficulty) return ROLL_OUTCOMES.PLAYER_ACTION_CRITICAL;
        return null;
    }

    // Attack roll — requires targets with hit/miss
    if (hasTarget && (hitVal >= 1 || missVal >= 1)) {
        if (hitVal >= 1) {
            return isHope ? ROLL_OUTCOMES.PLAYER_ATTACK_HIT_HOPE
                 : isFear ? ROLL_OUTCOMES.PLAYER_ATTACK_HIT_FEAR
                 : ROLL_OUTCOMES.PLAYER_ATTACK_HIT_HOPE;
        }
        return isHope ? ROLL_OUTCOMES.PLAYER_ATTACK_MISS_HOPE
             : isFear ? ROLL_OUTCOMES.PLAYER_ATTACK_MISS_FEAR
             : ROLL_OUTCOMES.PLAYER_ATTACK_MISS_FEAR;
    }

    // Action roll — requires difficulty to determine success/failure
    if (hasDifficulty) {
        if (roll.success === true) {
            return isHope ? ROLL_OUTCOMES.PLAYER_ACTION_SUCCESS_HOPE
                 : isFear ? ROLL_OUTCOMES.PLAYER_ACTION_SUCCESS_FEAR
                 : ROLL_OUTCOMES.PLAYER_ACTION_SUCCESS_HOPE;
        } else {
            return isHope ? ROLL_OUTCOMES.PLAYER_ACTION_FAILURE_HOPE
                 : isFear ? ROLL_OUTCOMES.PLAYER_ACTION_FAILURE_FEAR
                 : ROLL_OUTCOMES.PLAYER_ACTION_FAILURE_FEAR;
        }
    }

    // No comparison value — can't determine outcome, skip
    return null;
}

//////////////////////////////////////    PAYLOAD BUILDER    //////////////////////////////////////

/**
 * Detects which Daggerheart trait was used for a roll.
 * First checks the roll title (e.g. "Instinct Check"), then falls back to
 * the attack roll data at rolls[0].data.attack.roll.trait for attack rolls.
 * Triggered by buildPayload to populate the traitUsed field.
 * @param {ChatMessage} chatMessage - The Foundry ChatMessage document.
 * @returns {string|null} The lowercase trait name if found, or null.
 */
function detectTraitUsed(chatMessage) {
    const title = chatMessage.system?.title;
    if (title) {
        const lower = title.toLowerCase();
        const fromTitle = AI_RULES.traitNames.find(t => lower.includes(t));
        if (fromTitle) return fromTitle;
    }

    // Fallback: attack rolls store the trait in the roll data
    const attackTrait = chatMessage.rolls?.[0]?.data?.attack?.roll?.trait;
    if (attackTrait && typeof attackTrait === "string") {
        const lower = attackTrait.toLowerCase();
        const fromAttack = AI_RULES.traitNames.find(t => t === lower);
        if (fromAttack) return fromAttack;
    }

    return null;
}

/**
 * Builds the data payload that will eventually be sent to the AI.
 * Gathers user info and actor sheet data depending on GM vs player context.
 * Assembles contextual rules from AI_RULES based on roll context.
 * For attack rolls, includes information about targets hit or missed.
 * Triggered after a valid roll type is detected in the createChatMessage hook.
 * @param {ChatMessage} chatMessage - The Foundry ChatMessage document.
 * @param {string} rollOutcome - The detected roll outcome label from ROLL_OUTCOMES.
 * @param {boolean} isGM - Whether the roll was an adversary (GM) roll.
 * @returns {object} Payload with rollOutcome, user info, actor data, rules, and targets info.
 */
function buildPayload(chatMessage, rollOutcome, isGM) {
    const userId = chatMessage.system?.user ?? chatMessage.author.id;
    const user = game.users.get(userId);

    let actorData = null;
    if (!isGM) {
        actorData = buildCharacterPayload(chatMessage.speaker.actor);
    } else {
        actorData = buildAdversaryPayload(chatMessage.speaker.token);
    }

    const personaKey = game.settings.get(MODULE_ID, "aiPersona");
    let persona;

    const noPersonaFlag = actorData?.noPersona;
    const actorDirective = actorData?.importantContext ?? null;
    if (actorData) {
        delete actorData.noPersona;
        delete actorData.importantContext;
    }

    if (noPersonaFlag) {
        persona = null;
    } else if (personaKey === "custom") {
        const customPrompt = game.settings.get(MODULE_ID, "aiCustomPersona");
        persona = {
            label: "Custom",
            prompt: customPrompt || "",
        };
    } else {
        persona = AI_PERSONAS[personaKey];
    }

    const stanceKey = game.settings.get(MODULE_ID, "aiStance");
    let stance;
    if (stanceKey === "custom") {
        const customPrompt = game.settings.get(MODULE_ID, "aiCustomStance");
        stance = { label: "Custom", prompt: customPrompt || "" };
    } else {
        stance = AI_STANCES[stanceKey] ?? AI_STANCES.impartial;
    }

    const traitUsed = detectTraitUsed(chatMessage);

    const payload = {
        rollOutcome,
        rollOutcomeDescription: ROLL_OUTCOME_DESCRIPTIONS[rollOutcome] ?? "",
        user: user?.name ?? "Unknown",
        isGM,
        persona,
        stance,
        actor: actorData,
        actorDirective,
        traitUsed,
        rules: buildRules(isGM, actorData, rollOutcome, userId),
        actionContext: buildActionContext(rollOutcome, actorData, chatMessage.system?.targets ?? [])
    };

    return payload;
}

/**
 * Checks if a roll outcome corresponds to an attack roll.
 * Attack rolls have special handling to include target information.
 * @param {string} rollOutcome - The detected roll outcome label.
 * @returns {boolean} True if the roll is an attack outcome.
 */
function isAttackRoll(rollOutcome) {
    return rollOutcome?.toLowerCase().includes("attack");
}

/**
 * Builds a structured action context object for the AI payload.
 * Provides explicit context about who acted, what type of action, the outcome, and targets.
 * Triggered by buildPayload for every roll.
 * @param {string} rollOutcome - The detected roll outcome label.
 * @param {object|null} actorData - The actor payload (character or adversary).
 * @param {Array<object>} [targets=[]] - Array of target objects from chatMessage.system.targets.
 * @returns {object} Structured action context object.
 */
function buildActionContext(rollOutcome, actorData, targets = []) {
    const actionType = rollOutcome?.split(" ").slice(0, 2).join(" ") ?? "Unknown";

    const actorName = actorData?.name ?? "Unknown";

    const context = {
        actor: actorName,
        actionType,
        outcomeLabel: rollOutcome ?? "Unknown",
        narrativeContext: ROLL_OUTCOME_DESCRIPTIONS[rollOutcome] ?? ""
    };

    if (isAttackRoll(rollOutcome) && Array.isArray(targets)) {
        const hitTargets = [];
        const missedTargets = [];
        for (const target of targets) {
            if (!target?.name) continue;
            if (target.hit === true) hitTargets.push(target.name);
            else if (target.hit === false) missedTargets.push(target.name);
        }
        context.targetsHit = hitTargets;
        context.targetsMissed = missedTargets;

        const allTargetNames = [...hitTargets, ...missedTargets];
        const targetLabel = allTargetNames.length > 0 ? allTargetNames.join(", ") : "the target";
        const outcomeLower = rollOutcome?.toLowerCase() ?? "";
        const isHit = outcomeLower.includes("hit") || outcomeLower.includes("success") || outcomeLower.includes("critical");
        const result = isHit ? "HIT" : "MISSED";
        context.eventSummary = `${actorName} (attacker) attacked ${targetLabel} (defender). The attack ${result}.`;
    } else if (rollOutcome?.toLowerCase().includes("reaction")) {
        const isSuccess = rollOutcome?.toLowerCase().includes("success") || rollOutcome?.toLowerCase().includes("critical");
        const result = isSuccess ? "SUCCEEDED" : "FAILED";
        context.eventSummary = `${actorName} attempted to defend against an incoming attack. The defense ${result}.`;
    } else {
        const isSuccess = !rollOutcome?.toLowerCase().includes("failure");
        const result = isSuccess ? "SUCCEEDED" : "FAILED";
        context.eventSummary = `${actorName} attempted an action. The action ${result}.`;
    }

    return context;
}

/**
 * Assembles the contextual rules array from AI_RULES.
 * Always includes global rules. Adds type/tier rules for adversaries.
 * @param {boolean} isGM - Whether this is an adversary roll.
 * @param {object|null} actorData - The actor payload (adversary or character).
 * @param {string} [rollOutcome] - The detected roll outcome label.
 * @param {string} [userId] - The user ID for filtering custom rules.
 * @returns {string[]} Array of rule strings for the AI.
 */
function buildRules(isGM, actorData, rollOutcome, userId) {
    const rules = [...AI_RULES.always];

    // Add the LENGTH directive based on the current setting
    const lengthLevel = game.settings.get(MODULE_ID, 'aiLengthLevel') || 'medium';
    const lengthDirective = AI_LENGTH_DIRECTIVES[lengthLevel]?.directive;
    if (lengthDirective) {
        rules.push(lengthDirective);
    }

    if (isGM) {
        rules.push(...AI_RULES.adversaryInstructions);
    } else {
        rules.push(...AI_RULES.characterInstructions);
    }

    if (isAttackRoll(rollOutcome)) {
        rules.push(...AI_RULES.attackContext);
    }

    // Append user-defined custom rules from AI settings
    const parseRules = (key, filterUserId) => {
        try {
            return JSON.parse(game.settings.get(MODULE_ID, key) || '[]')
                .filter(r => r.text?.trim())
                .filter(r => !filterUserId || !r.userId || r.userId === "all" || r.userId === filterUserId)
                .map(r => r.text.trim());
        } catch { return []; }
    };

    rules.push(...parseRules('aiCommonRules'));
    rules.push(...parseRules(isGM ? 'aiAdversaryRules' : 'aiCharacterRules', userId));

    return rules;
}

/**
 * Reads character sheet data from a player actor for the AI payload.
 * Extracts HP, stress, traits, experiences, background, and equipped item names.
 * Triggered by buildPayload for non-GM rolls.
 * @param {string} actorId - The actor ID from chatMessage.speaker.actor.
 * @returns {object|null} Character data object or null if actor not found.
 */
function buildCharacterPayload(actorId) {
    if (!actorId) return null;

    const actor = game.actors.get(actorId);
    if (!actor || actor.type !== "character") return null;

    const sys = actor.system;

    const level = sys.levelData?.level?.current ?? 1;
    let tierNum = 1;
    if (level >= 9) tierNum = 4;
    else if (level >= 5) tierNum = 3;
    else if (level >= 2) tierNum = 2;
    const tierDescription = AI_RULES.characterTier[tierNum] || `Tier ${tierNum}`;

    const hpVal = sys.resources?.hitPoints?.value ?? 0;
    const hpMax = sys.resources?.hitPoints?.max ?? 0;
    const stressVal = sys.resources?.stress?.value ?? 0;
    const stressMax = sys.resources?.stress?.max ?? 0;
    const armorVal = sys.resources?.armor?.value ?? 0;
    const armorMax = sys.resources?.armor?.max ?? 0;
    const hopeVal = sys.resources?.hope?.value ?? 0;
    const hopeMax = sys.resources?.hope?.max ?? 0;

    const equippedItems = actor.items
        .filter(item => item.system?.equipped === true)
        .map(item => item.name);

    const classItem = actor.items.find(item => item.type === "class");
    const communityItem = actor.items.find(item => item.type === "community");
    const ancestryItem = actor.items.find(item => item.type === "ancestry");
    const subclassItem = actor.items.find(item => item.type === "subclass");

    const backgroundRaw = sys.biography?.background ?? "";
    const noPersona = !!backgroundRaw.match(/\$NOPERSONA/i);
    const bgMatch = backgroundRaw.match(/\{\{\{([\s\S]+?)\}\}\}/);
    let cleanBackground = backgroundRaw;
    let importantContext;
    if (bgMatch) {
        let text = stripHtml(bgMatch[1]);
        if (text.length > 600) text = text.substring(0, 600) + "...";
        importantContext = `IMPORTANT: ${text}`;
        cleanBackground = cleanBackground.replace(bgMatch[0], "");
    }
    if (noPersona) cleanBackground = cleanBackground.replace(/\$NOPERSONA/i, "");

    const experiences = cleanExperiences(sys.experiences);

    const payload = {
        name: actor.name,
        level,
        tier: tierDescription,
        ancestry: ancestryItem ? {
            name: ancestryItem.name,
            description: stripHtml(ancestryItem.system?.description ?? "")
        } : null,
        class: classItem ? {
            name: classItem.name,
            description: stripHtml(classItem.system?.description ?? "")
        } : null,
        domains: (classItem?.system?.domains ?? []).map(d => ({
            name: d,
            description: AI_RULES.domains[d.toLowerCase()] ?? ""
        })),
        subclass: subclassItem ? {
            name: subclassItem.name,
            description: stripHtml(subclassItem.system?.description ?? ""),
            spellcastingTrait: subclassItem.system?.spellcastingTrait || null
        } : null,
        community: communityItem ? {
            name: communityItem.name,
            description: stripHtml(communityItem.system?.description ?? "")
        } : null,
        hitPoints: getStatAssessment(`${hpVal}/${hpMax}`, "hitPoints"),
        stress: getStatAssessment(`${stressVal}/${stressMax}`, "stress"),
        armor: getStatAssessment(`${armorVal}/${armorMax}`, "armor"),
        hope: hopeMax ? getStatAssessment(`${hopeVal}/${hopeMax}`, "hope") : `${hopeVal}`,
        traits: {
            agility: getTraitDescription("agility", sys.traits?.agility?.value ?? 0),
            strength: getTraitDescription("strength", sys.traits?.strength?.value ?? 0),
            finesse: getTraitDescription("finesse", sys.traits?.finesse?.value ?? 0),
            instinct: getTraitDescription("instinct", sys.traits?.instinct?.value ?? 0),
            presence: getTraitDescription("presence", sys.traits?.presence?.value ?? 0),
            knowledge: getTraitDescription("knowledge", sys.traits?.knowledge?.value ?? 0)
        },
        background: stripHtml(cleanBackground),
        equippedItems,
        importantContext,
        noPersona
    };

    if (experiences.length > 0) payload.experiences = experiences;

    return payload;
}

/**
 * Reads adversary data from a token on the canvas for the AI payload.
 * Extracts name, size, tier, type, HP, stress, and experiences.
 * Triggered by buildPayload for GM (adversary) rolls.
 * @param {string} tokenId - The token ID from chatMessage.speaker.token.
 * @returns {object|null} Adversary data object or null if token/actor not found.
 */
function buildAdversaryPayload(tokenId) {
    if (!tokenId) return null;

    const token = canvas.tokens?.get(tokenId);
    const actor = token?.actor;
    if (!actor) return null;

    const sys = actor.toObject().system;

    const hpVal = sys.resources?.hitPoints?.value ?? 0;
    const hpMax = sys.resources?.hitPoints?.max ?? 0;
    const stressVal = sys.resources?.stress?.value ?? 0;
    const stressMax = sys.resources?.stress?.max ?? 0;

    const notes = sys.notes ?? "";
    const noPersona = !!notes.match(/\$NOPERSONA/i);
    const notesMatch = notes.match(/\{\{\{([\s\S]+?)\}\}\}/);
    let importantContext;
    if (notesMatch) {
        let text = stripHtml(notesMatch[1]);
        if (text.length > 600) text = text.substring(0, 600);
        importantContext = `IMPORTANT: ${text}`;
    }

    const attackName = sys.attack?.name ?? "";
    const damageParts = sys.attack?.damage?.parts ?? [];
    const damageTypes = [...new Set(damageParts.flatMap(p => p.type ?? []))].filter(t => typeof t === "string");

    const adversaryTypeKey = sys.type ?? "";
    const adversaryTypeDescription = AI_RULES.adversaryType[adversaryTypeKey] || adversaryTypeKey;

    const adversaryTierKey = sys.tier ?? null;
    const adversaryTierDescription = AI_RULES.adversaryTier[adversaryTierKey] || adversaryTierKey;

    const adversarySizeKey = (sys.size ?? "").toUpperCase();
    const adversarySizeDescription = AI_RULES.adversarySize[adversarySizeKey] || sys.size || "";

    const description = stripHtml(sys.description ?? "");
    const experiences = cleanExperiences(sys.experiences);

    const payload = {
        name: actor.name,
        size: adversarySizeDescription,
        tier: adversaryTierDescription,
        type: adversaryTypeDescription,
        hitPoints: getStatAssessment(`${hpVal}/${hpMax}`, "hitPoints"),
        stress: getStatAssessment(`${stressVal}/${stressMax}`, "stress"),
        attackName,
        damageTypes,
        importantContext,
        noPersona
    };

    if (description) payload.description = description;
    if (experiences.length > 0) payload.experiences = experiences;

    return payload;
}

/**
 * Filters experiences to only include name and non-empty description.
 * Removes all other metadata (value, core, ids) to reduce AI token waste.
 * @param {object} experiences - The raw experiences object from actor.system.
 * @returns {Array<object>} Cleaned array with name and optional description.
 */
function cleanExperiences(experiences) {
    if (!experiences || typeof experiences !== "object") return [];

    return Object.values(experiences)
        .filter(exp => exp?.name)
        .map(exp => {
            const cleaned = { name: exp.name };
            if (exp.description && exp.description.trim() !== "") {
                cleaned.description = exp.description;
            }
            return cleaned;
        });
}

/**
 * Strips all HTML tags from a string, returning plain text.
 * Used to clean biography fields before sending to the AI.
 * @param {string} html - Raw HTML string.
 * @returns {string} Plain text without HTML tags.
 */
function stripHtml(html) {
    if (!html) return "";
    const doc = new DOMParser().parseFromString(html, "text/html");
    return doc.body.textContent?.trim() ?? "";
}

/**
 * Converts a raw "current/max" stat string into a plain-English situational assessment.
 * Uses remaining percentage for inverse stats (HP, Stress, Armor) and direct percentage
 * for positive stats (Hope). Falls back to the lowest threshold label if malformed.
 * Triggered by buildCharacterPayload and buildAdversaryPayload.
 * @param {string} rawValue - Stat string in "current/max" format (e.g. "3/8").
 * @param {string} statType - Key into STAT_THRESHOLDS ("hitPoints"|"stress"|"armor"|"hope").
 * @returns {string} A descriptive label from STAT_THRESHOLDS.
 */
function getStatAssessment(rawValue, statType) {
    const thresholds = STAT_THRESHOLDS[statType];
    if (!thresholds) return rawValue;

    const parts = String(rawValue).split("/");
    if (parts.length !== 2) return thresholds[0].label;

    const current = Number(parts[0]);
    const max     = Number(parts[1]);
    if (isNaN(current) || isNaN(max) || max === 0) return thresholds[0].label;

    const pct = statType === "hope"
        ? (current / max) * 100
        : ((max - current) / max) * 100;

    let label = thresholds[0].label;
    for (const threshold of thresholds) {
        if (pct >= threshold.min) label = threshold.label;
        else break;
    }
    return label;
}

/**
 * Converts a numerical trait value into a narrative description.
 * Clamps the value to the [-2, 7] range before lookup.
 * Triggered by buildCharacterPayload when assembling traits.
 * @param {string} traitName - Key into TRAIT_LEVEL_DESCRIPTIONS (e.g. "agility").
 * @param {number} value - The raw trait score.
 * @returns {string} Narrative description for the clamped trait level.
 */
function getTraitDescription(traitName, value) {
    const traitTable = TRAIT_LEVEL_DESCRIPTIONS[traitName];
    if (!traitTable) return String(value);

    const clamped = Math.max(-2, Math.min(7, value));
    return traitTable[String(clamped)] ?? String(value);
}

//////////////////////////////////////    CHAT OUTPUT    //////////////////////////////////////

/**
 * Creates the AI chat message with styled content.
 * Extracted so it can be called immediately or deferred after Dice So Nice.
 * @param {string} content - The full HTML content for the chat card.
 */
function _createAiChatMessage(content) {
    ChatMessage.create({
        user: game.user.id,
        speaker: { alias: "M.I.S.S." },
        style: CONST.CHAT_MESSAGE_STYLES.OTHER,
        content,
        flags: { [MODULE_ID]: { isAiReply: true } }
    });
}

/**
 * Posts a styled chat card with the AI-generated commentary.
 * Calls the AI API with the roll payload and displays the response.
 * If Dice So Nice is active, defers message creation until the roll animation completes
 * to avoid spoiling the result before the 3D dice finish rolling.
 * Triggered by the createChatMessage hook (GM client only) after payload is built.
 * @param {object} payload - The built payload containing user and actor data.
 * @param {string} rollMessageId - The ID of the original roll ChatMessage.
 * @returns {Promise<void>}
 */
async function postSarcasticComment(payload, rollMessageId) {
    const apiKey = game.settings.get(MODULE_ID, "geminiApiKey");
    const openRouterKey = game.settings.get(MODULE_ID, "openRouterApiKey");

    if (!apiKey && !openRouterKey) {
        console.warn("DH Miss | No AI API keys configured. Skipping AI comment.");
        return;
    }

    // Reserve a slot in the pending map so the DSN hook knows we're expecting a comment
    const dsnActive = !!game.dice3d;
    if (dsnActive) {
        _pendingDsnComments.set(rollMessageId, false);
        logDebug("DSN active — deferring AI comment for", rollMessageId);
    }

    let aiResponse;
    try {
        aiResponse = await generateRollComment(payload, {
            geminiKey: apiKey,
            openRouterKey: openRouterKey
        });
    } catch (err) {
        console.error("DH Miss | AI comment failed:", err.message);
        _pendingDsnComments.delete(rollMessageId);
        return;
    }

    const title = "M.I.S.S.";

    const content = `
<div class="chat-card" style="border: 2px solid #C9A060; border-radius: 8px; overflow: hidden;">
    <header class="card-header flexrow" style="background: #191919 !important; padding: 8px; border-bottom: 2px solid #C9A060;">
        <h3 class="noborder" style="margin: 0; font-weight: bold; color: #C9A060 !important; font-family: 'Aleo', serif; text-align: center; text-transform: uppercase; letter-spacing: 1px; width: 100%;">
            ${title}
        </h3>
    </header>
    <div class="card-content" style="background: #191919; padding: 20px; text-align: center;">
        <p style="color: #e0e0e0; font-size: 1em; line-height: 1.5; font-family: 'Lato', sans-serif; margin: 0;">
            ${aiResponse}
        </p>
    </div>
</div>`;

    if (!dsnActive) {
        _createAiChatMessage(content);
        return;
    }

    // DSN is active — check if the animation already completed while we waited for the AI
    const pending = _pendingDsnComments.get(rollMessageId);
    if (pending === true) {
        // DSN already fired — post immediately
        _pendingDsnComments.delete(rollMessageId);
        logDebug("AI resolved — DSN already complete, posting for", rollMessageId);
        _createAiChatMessage(content);
    } else {
        // DSN hasn't fired yet — store content for the hook to release
        _pendingDsnComments.set(rollMessageId, content);
        logDebug("AI resolved — waiting for DSN to complete for", rollMessageId);
    }
}
