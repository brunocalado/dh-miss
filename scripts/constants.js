export const MODULE_ID = "dh-miss";

/**
 * Roll outcome labels for all detectable Daggerheart roll outcomes.
 * Used as keys for roll detection and displayed in chat cards.
 */
export const ROLL_OUTCOMES = {
    // Player action outcomes
    PLAYER_ACTION_SUCCESS_HOPE:  "Player Action Success with Hope",
    PLAYER_ACTION_SUCCESS_FEAR:  "Player Action Success with Fear",
    PLAYER_ACTION_FAILURE_HOPE:  "Player Action Failure with Hope",
    PLAYER_ACTION_FAILURE_FEAR:  "Player Action Failure with Fear",
    PLAYER_ACTION_CRITICAL:      "Player Action Critical",
    // Player attack outcomes
    PLAYER_ATTACK_HIT_HOPE:      "Player Attack Hit with Hope",
    PLAYER_ATTACK_HIT_FEAR:      "Player Attack Hit with Fear",
    PLAYER_ATTACK_MISS_HOPE:     "Player Attack Miss with Hope",
    PLAYER_ATTACK_MISS_FEAR:     "Player Attack Miss with Fear",
    PLAYER_ATTACK_CRITICAL:      "Player Attack Critical",
    // Player reaction outcomes
    PLAYER_REACTION_SUCCESS:     "Player Reaction Success",
    PLAYER_REACTION_FAILURE:     "Player Reaction Failure",
    PLAYER_REACTION_CRITICAL:    "Player Reaction Critical",
    // GM attack outcomes
    GM_ATTACK_SUCCESS:           "GM Attack Success",
    GM_ATTACK_FAILURE:           "GM Attack Failure",
    GM_ATTACK_CRITICAL:          "GM Attack Critical",
    // GM reaction outcomes
    GM_REACTION_SUCCESS:         "GM Reaction Success",
    GM_REACTION_FAILURE:         "GM Reaction Failure",
    GM_REACTION_CRITICAL:        "GM Reaction Critical",
};

/**
 * Narrative descriptions for each roll outcome.
 * Sent alongside the outcome label to give the AI richer context.
 */
export const ROLL_OUTCOME_DESCRIPTIONS = {
    "Player Action Success with Hope": "The actor successfully completed their action with full control, staying ahead of the opposition.",
    "Player Action Success with Fear": "The actor completed the action, but their effort inadvertently created a new danger, giving the opposition a chance to react.",
    "Player Action Failure with Hope": "The actor failed the action, but remains composed enough to face what comes next.",
    "Player Action Failure with Fear": "The actor's attempt failed catastrophically, leaving the actor fully exposed as the opposition seizes control.",
    "Player Action Critical": "The actor achieved an overwhelming success that reshapes the scene entirely in the actor's favor.",
    "Player Attack Hit with Hope": "The actor's attack struck the target with precision. The actor remains in a dominant position over the target.",
    "Player Attack Hit with Fear": "The actor's attack hit the target, but the strike left the actor exposed, giving the target an opening to counter-attack.",
    "Player Attack Miss with Hope": "The actor's attack missed the target entirely. The target evaded the actor's blow, but the actor recovers composure quickly.",
    "Player Attack Miss with Fear": "The actor's attack missed the target completely. The failed strike left the actor wide open, and the target now has full control of the engagement.",
    "Player Attack Critical": "The actor delivered a devastating strike to the target, shattering the target's defenses and asserting total dominance.",
    "Player Reaction Success": "The actor successfully defended against the incoming attack, neutralizing the threat before it could cause harm.",
    "Player Reaction Failure": "The actor failed to defend and took the full brunt of the adversary's attack.",
    "Player Reaction Critical": "The actor's defense was masterful, not only blocking the attack but leaving the attacker completely vulnerable.",
    "GM Attack Success": "The adversary's attack struck the target with precision, asserting their lethality in combat.",
    "GM Attack Failure": "The adversary's attack missed the target. The clumsy strike stalled the adversary's momentum.",
    "GM Attack Critical": "The adversary delivered a terrifyingly perfect assault that devastated the target.",
    "GM Reaction Success": "The adversary successfully defended, shrugging off the actor's attack and remaining a dangerous presence.",
    "GM Reaction Failure": "The adversary failed to defend against the actor's maneuver, losing their defensive edge.",
    "GM Reaction Critical": "The adversary countered the actor's attempt with overwhelming force, pushing the actor into a desperate position.",
};

/**
 * Persistent rules sent alongside every AI payload to provide game-context.
 * Rules in `always` are included in every payload.
 * Rules in `adversaryType` are included only when the adversary matches that type.
 * Rules in `adversaryTier` are included only when the adversary matches that tier.
 * Add new entries as plain English sentences the AI can interpret.
 * @type {object}
 */
export const AI_RULES = {
    always: [
        "Comment on RPG dice rolls using the provided 'persona' and 'stance'. The dice result is the primary event: your very first sentence must react directly to the success, failure, or complication. Only then, integrate exactly one actor aspect to explain how their state influenced the outcome. The roll is the action; the actor's status is the modifier.",
        "Output only plain text. Do not use HTML tags, Markdown, or any other formatting.",
        "CRITICAL DIRECTIVE: Always distinguish between the 'actor' (who performs the action) and the 'targets' (who receives it). The 'eventSummary' field is the definitive source of truth for what happened: it explicitly states who attacked whom and whether the attack HIT or MISSED. If 'eventSummary' says the actor attacked and MISSED, the actor's attack failed to connect — do NOT describe the actor dodging or being attacked. If the actor attacked and HIT, the actor struck the target — do NOT describe the actor taking damage. NEVER imply they took damage from their own successful attack. Any mention of the actor's critical HP or Stress must be framed as their pre-existing condition, not as a result of the current roll.",
        "CRITICAL DIRECTIVE - FOCUS VARIETY: You MUST select EXACTLY ONE aspect from the actor to contextualize the roll."
    ],
    characterInstructions: [
        "ASPECTS - CHARACTER: The actor is a Player Character. Select an aspect to comment from Ancestry, Class, Subclass, Experiences, Stress, Community, HP,  Armor, equippedItems, Traits, Actor Name, or Hope."
    ],
    adversaryInstructions: [
        "ASPECTS - ADVERSARY: The actor is an Adversary. Select an aspect to comment from Actor Name, Description, Adversary Type, Tier, Size, hitPoints, Attack Name, Stress, Damage Type or Experiences."
    ],
    adversaryType: {
        bruiser: "A hulking juggernaut that dominates close combat with raw power and resilience, shrugging off blows while crushing anything in reach.",
        horde: "A swarming mass of creatures that moves and attacks as a single overwhelming wave, dangerous in their sheer numbers.",
        leader: "A commanding presence that directs the flow of battle, rallying allies and calling in reinforcements to turn the tide.",
        minion: "Individually weak but dangerous in numbers, these lesser foes swarm to overwhelm opponents or sacrifice themselves for their masters.",
        ranged: "A distant threat that rains down destruction from afar, using terrain and distance to avoid retaliation while picking off targets.",
        skulk: "A shadow in the corner of the eye, striking from darkness or ambush before vanishing again, prioritizing vulnerable targets.",
        social: "A figure whose power lies in influence, secrets, and words, challenging the heroes through wits and diplomacy rather than force.",
        solo: "A legendary threat capable of taking on an entire group single-handedly, moving with terrifying speed and power that demands total focus to survive.",
        standard: "The reliable backbone of their faction, representing the disciplined rank-and-file soldiers who hold the line.",
        support: "A tactical specialist who stays behind the front lines to empower allies or cripple enemies with debilitating effects."
    },
    attackContext: [],
    adversaryTier: {
        1: "Localized threats and opportunistic predators that challenge the resolve of those newly sworn to their cause.",
        2: "Formidable regional dangers and organized forces capable of destabilizing territories and overpowering seasoned defenders.",
        3: "Legendary adversaries and masters of devastation whose presence threatens the safety of entire nations and realms.",
        4: "Mythic, world-ending entities and cosmic horrors with the power to unravel reality and challenge the gods themselves."
    },
    adversarySize: {
        TINY: "Creatures of this size are no larger than a common house cat or a small bird. They are often overlooked until they are right upon you, moving through spaces too small for a person to follow.",
        SMALL: "An adversary of this size is comparable to a halfling or a large dog. They are compact and often agile, capable of using human-sized furniture as cover or scurrying underfoot in a crowded melee.",
        MEDIUM: "This is the standard size for most humanoids, such as humans, elves, or typical bandits. They occupy a space similar to your own and interact with the world at a scale that feels familiar and balanced.",
        LARGE: "Creatures of this size tower over the average person, comparable to a warhorse or a sturdy ogre. They have a reaching presence that commands the immediate area around them, often requiring you to look up just to meet their eyes.",
        HUGE: "An adversary of this size is truly massive, like a giant or a young dragon, occupying a space as large as a small cottage. Their footsteps can be felt through the ground, and their shadows can easily engulf an entire party of adventurers.",
        GARGANTUAN: "These are the titans of the world, such as ancient krakens or the titular Colossi, which are as large as massive buildings or small hills. Fighting one is less like a duel and more like navigating a living, hostile environment where a single limb is the size of a street."
    },
    /** List of valid Daggerheart trait names for trait detection from roll titles. */
    traitNames: ["agility", "strength", "finesse", "instinct", "presence", "knowledge"],
    domains: {
        arcana: "Innate and instinctual magic tapping into raw forces to manipulate energy and the elements.",
        blade: "Weapon mastery focused on steel and skill to achieve inexorable power over death.",
        bone: "Tactics and physical movement, allowing for the control of bodies and prediction of combat behaviors.",
        codex: "Intensive magical study using recorded equations to command a versatile understanding of power.",
        grace: "Charisma and performance that bends perception through magnetism and mastery over language.",
        midnight: "Shadows and secrecy, utilizing the art of obscurity to uncover or create enigmas.",
        sage: "The natural world, tapping into the vitality of the earth and the ferocity of predators to unleash magic.",
        splendor: "The power of life and healing, sustaining vitality and controlling the threshold of death.",
        valor: "Protection and strength, channeling power to raise shields and safeguard allies in battle."
    },
    characterTier: {
        1: "Emerging heroes establishing their reputation by protecting local communities from immediate regional dangers.",
        2: "Renowned champions of the realm whose actions decide the fate of nations against specialized and potent threats.",
        3: "World-class legends standing as the primary defense against ancient, global forces that threaten the natural order.",
        4: "Mythic paragons engaged in ultimate struggles against cosmic horrors and existential threats to reality itself."
    },
};

/**
 * Threshold tables for converting raw stat fractions into plain-English assessments.
 * HP, Stress, and Armor use remaining percentage ((max - current) / max * 100) — 0 % = fully consumed, 100 % = untouched.
 * Hope uses direct percentage (current / max * 100) — 0 % = empty, 100 % = full.
 * Each array must be sorted ascending by `min`. The lookup returns the last entry whose `min` ≤ the computed percentage.
 * @type {Object<string, Array<{min: number, label: string}>>}
 */
export const STAT_THRESHOLDS = {
    hitPoints: [
        { min: 0,   label: "dying" },
        { min: 10,  label: "slightly injured" },
        { min: 25,  label: "more than slightly injured" },
        { min: 50,  label: "injured" },
        { min: 75,  label: "heavily injured or near death" },
        { min: 100, label: "no injuries" },
    ],
    stress: [
        { min: 0,   label: "completely overwhelmed, paralyzed by panic and unable to think clearly" },
        { min: 10,  label: "on the verge of breaking, mind racing with fear and doubt" },
        { min: 25,  label: "exhausted and erratic, struggling to maintain focus" },
        { min: 50,  label: "rattled and hesitant, the pressure beginning to cloud judgment" },
        { min: 75,  label: "feeling the strain, nerves tight but still in control" },
        { min: 100, label: "calm, focused, and operating with absolute clarity" },
    ],
    armor: [
        { min: 0,   label: "completely unprotected" },
        { min: 25,  label: "barely protected" },
        { min: 50,  label: "partially protected" },
        { min: 75,  label: "mostly protected" },
        { min: 100, label: "fully protected" },
    ],
    hope: [
        { min: 0,   label: "no hope" },
        { min: 20,  label: "very little hope" },
        { min: 40,  label: "some hope" },
        { min: 60,  label: "hopeful" },
        { min: 80,  label: "high hope" },
        { min: 100, label: "brimming with hope" },
    ],
};

/**
 * Narrative descriptions for trait values.
 * Used to convert numerical trait scores into descriptive text for the AI.
 * Values < -2 use the -2 description; values > 7 use the 7 description.
 */
export const TRAIT_LEVEL_DESCRIPTIONS = {
    agility: {
        "-2": "Struggles to sprint even short distances; leaps are clumsy and short; maneuvers are slow and lack coordination.",
        "-1": "Prone to stumbling while trying to sprint or leap; maneuvers through difficult terrain are awkward and sluggish.",
        "0": "Average ability to sprint to cover, leap over obstacles, and maneuver during a confrontation.",
        "1": "Can sprint with confidence, leap across modest gaps, and maneuver through basic obstacles effectively.",
        "2": "Fast on your feet; can sprint quickly to cover, leap between rooftops, and maneuver nimbly in danger.",
        "3": "A natural athlete; capable of sustained sprints, impressive leaps, and fluid maneuvers in complex environments.",
        "4": "Heroic speed; can sprint past foes, leap over large hazards, and maneuver with high-speed precision.",
        "5": "Legendary swiftness; your sprints are a blur, your leaps cover immense distances, and your maneuvers are flawless.",
        "6": "Mythic agility; sprints at incredible speeds, leaps with effortless grace, and maneuvers through chaos without slowing down.",
        "7": "The pinnacle of movement; executes perfect sprints and massive leaps while maneuvering with unrivaled fluidity."
    },
    strength: {
        "-2": "Nearly unable to lift heavy objects; smashes lack any real force; easily overpowered in a grapple.",
        "-1": "Weak physical prowess; struggles to lift moderate weight, smash through doors, or hold ground in a grapple.",
        "0": "Average strength; can lift, smash, and grapple as well as any typical person of your size.",
        "1": "Sturdy build; capable of lifting heavy loads, smashing wooden barriers, and holding your own in a grapple.",
        "2": "Powerful physique; excels at lifting massive objects, smashing through obstacles, and winning grapples.",
        "3": "Great stamina; can lift incredible weights, smash through stone, and hold ground against charging foes.",
        "4": "Heroic brawn; lifts heavy machinery with ease, smashes through reinforced doors, and dominates in a grapple.",
        "5": "Legendary might; your ability to lift, smash, and grapple exceeds the capabilities of almost any champion.",
        "6": "Mythic power; can lift the heaviest burdens, smash through fortifications, and grapple the largest enemies.",
        "7": "Transcendent strength; can lift impossible weights and smash any barrier, holding ground against any force."
    },
    finesse: {
        "-2": "Lacks the control for fine tasks; unable to hide effectively; strikes and tinkering are clumsy and imprecise.",
        "-1": "Unsteady hands; struggles with the control needed to hide, tinker with gadgets, or strike with accuracy.",
        "0": "Average dexterity; can control fine tools, hide in basic cover, and strike with standard precision.",
        "1": "Deft hands; skilled at maintaining control of tools, hiding from notice, and striking targets accurately.",
        "2": "High precision; expert at using fine tools to tinker, hiding in shadows, and striking with great control.",
        "3": "Exceptional coordination; masterfully controls delicate tools, hides in plain sight, and strikes with pinpoint accuracy.",
        "4": "Heroic finesse; can tinker with complex mechanisms, hide in minimal cover, and strike with surgical control.",
        "5": "Legendary skill; demonstrates perfect control while tinkering, hiding, and striking with unrivaled precision.",
        "6": "Mythic dexterity; can tinker with the most intricate devices and hide with such control they are never noticed.",
        "7": "The peak of precision; achieves absolute control over every movement while tinkering, hiding, or striking."
    },
    instinct: {
        "-2": "Fails to perceive obvious details; cannot sense danger; unable to navigate even simple paths.",
        "-1": "Often misses what others perceive; struggles to sense motives or navigate through the wilderness.",
        "0": "Average intuition; can perceive surroundings, sense danger, and navigate familiar areas normally.",
        "1": "Keen awareness; good at perceiving hidden details, sensing trouble, and navigating difficult terrain.",
        "2": "Sharp senses; excels at perceiving the environment, sensing elusive foes, and navigating by intuition.",
        "3": "Exceptional perception; can perceive the smallest details, sense subtle shifts in danger, and navigate anywhere.",
        "4": "Heroic intuition; notices things others overlook, senses danger before it strikes, and navigates with total certainty.",
        "5": "Legendary awareness; your ability to perceive, sense, and navigate the world is renowned and unerring.",
        "6": "Mythic instinct; perceives everything in your vicinity, senses every threat, and navigates the most complex trials.",
        "7": "The ultimate sense; possesses a perfect ability to perceive, sense, and navigate the world is renowned and unerring."
    },
    presence: {
        "-2": "Cannot charm or plead a case; performances are awkward; deceptions are immediately transparent.",
        "-1": "Weak social facility; struggles to charm others, perform for a crowd, or deceive even the gullible.",
        "0": "Average presence; can charm acquaintances, perform basic tasks, and deceive with standard effectiveness.",
        "1": "Engaging personality; capable of charming others, performing with confidence, and deceiving when necessary.",
        "2": "Strong charisma; excels at pleading a case to charm others, performing for crowds, and clever deception.",
        "3": "Commanding presence; masterfully charms individuals, performs with great impact, and deceptions are very convincing.",
        "4": "Heroic influence; can charm the most hostile, perform with world-class skill, and deceive with total confidence.",
        "5": "Legendary gravitas; your ability to charm, perform, and deceive can alter the course of entire social circles.",
        "6": "Mythic personality; charms everyone you meet, performs with historical brilliance, and deceptions are flawless.",
        "7": "The peak of influence; an overwhelming presence that can charm, perform, or deceive with absolute authority."
    },
    knowledge: {
        "-2": "Unable to recall basic facts; fails to analyze information; cannot comprehend simple patterns.",
        "-1": "Struggles to recall info; slow to analyze new data or comprehend the connections between things.",
        "0": "Average intellect; can recall common lore, analyze basic facts, and comprehend standard patterns.",
        "1": "Well-informed; capable of recalling specific facts, analyzing data, and comprehending complex patterns.",
        "2": "Scholarly mind; excels at recalling obscure info, analyzing evidence, and comprehending deep patterns.",
        "3": "Brilliant intellect; masterfully recalls vast lore, analyzes complicated facts, and comprehends hidden patterns.",
        "4": "Heroic deduction; can recall any learned information, analyze any mystery, and comprehend ancient patterns.",
        "5": "Legendary wisdom; your ability to recall, analyze, and comprehend info is unmatched by standard scholars.",
        "6": "Mythic comprehension; recalls the history of the world, analyzes reality's laws, and comprehends every pattern.",
        "7": "The absolute peak of mind; possesses a perfect ability to recall all knowledge, analyze any fact, and comprehend all."
    }
};

/**
 * Length directive options for AI response length control.
 * Selectable via the AI Settings menu to control response verbosity.
 */
export const AI_LENGTH_DIRECTIVES = {
    short: {
        label: "Short",
        directive: "CRITICAL DIRECTIVE - LENGTH: Your response MUST NOT exceed 2 sentences and a maximum of 40 words. Be explosive, direct, and visceral. Do not ramble."
    },
    medium: {
        label: "Medium",
        directive: "CRITICAL DIRECTIVE - LENGTH: Your response MUST NOT exceed 3 sentences and a maximum of 60 words. Be explosive, direct, and visceral. Do not ramble."
    },
    long: {
        label: "Long",
        directive: "CRITICAL DIRECTIVE - LENGTH: Your response MUST NOT exceed 4 sentences and a maximum of 100 words. Be explosive, direct, and visceral. Do not ramble."
    },
    none: {
        label: "None",
        directive: ""
    }
};

/**
 * AI Personas available for selection in module settings.
 * Each persona defines the tone and instructions for the AI response.
 */
export const AI_PERSONAS = {
    cynical: {
        label: "Cynical/Sarcastic",
        prompt: "You are a cynical and sarcastic persona with a sharp, biting tone. Incorporate their physical or mental state using dry humor and stay in character as a critic forced to watch a mediocre performance."
    },
    motivational: {
        label: "Positive/Motivational",
        prompt: "You are a relentlessly positive and motivational persona. Show unbridled enthusiasm, celebrate their traits, and stay in character as a devoted fan."
    },
    doom: {
        label: "The Doom Prophet",
        prompt: "You are a dramatic and fatalistic persona with a grim, hopeless tone. Use ominous metaphors and stay in character as a seer of tragedy."
    },
    mama: {
        label: "Mama",
        prompt: "You are an overprotective and doting motherly persona. Show extreme affection or worry, using terms like 'sweetie' or 'my baby'."
    },
    uncle: {
        label: "The Gossipy BBQ Uncle",
        prompt: "You are a nosy and talkative 'BBQ Uncle' persona. Use a casual, joking tone and terms like 'champ', 'nephew', or 'kid'."
    }
};

/**
 * AI Stances define the behavioral allegiance toward Player Characters and Adversaries.
 * Stances are orthogonal to Personas — a Persona defines voice/identity, a Stance defines whose side the AI takes.
 */
export const AI_STANCES = {
    supportive: {
        label: "Supportive (PC-sided)",
        prompt: `You are completely on the side of the Player Characters.
- When a Player Character succeeds: celebrate enthusiastically, hype them up.
- When a Player Character fails or gets hurt: offer comfort, make excuses for them, or express worry.
- When an Adversary succeeds against a Player Character: lament it, frame it as unfair or temporary.
- When an Adversary fails: cheer as if your team just scored.`
    },
    impartial: {
        label: "Impartial (Neutral Narrator)",
        prompt: `You are a neutral narrator with no allegiance to any side.
- Describe outcomes with equal dramatic weight regardless of who benefits.
- Never root for or against Player Characters or Adversaries.
- Let the facts and the drama speak for themselves.`
    },
    adversary_sided: {
        label: "Adversary-Sided",
        prompt: `You secretly root for the Adversaries and obstacles the players face.
- When an Adversary succeeds: relish it, praise the Adversary's power.
- When an Adversary fails: express disappointment or disbelief.
- When a Player Character succeeds: acknowledge it with grudging respect or mock surprise.
- When a Player Character fails: savour it without being cartoonishly evil.`
    }
};

/**
 * Available Gemini Models.
 * Used in settings choices and AI logic fallback.
 */
export const MODELS = {
    // Google Direct
    "gemini-2.5-flash": "Gemini 2.5 Flash (Google)",
    "gemini-flash-latest": "Gemini Flash Latest (Google)",
    "gemini-2.5-flash-lite": "Gemini 2.5 Flash Lite (Google)",
    // OpenRouter
    "google/gemini-2.0-flash-001": "Gemini 2.0 Flash (OpenRouter)",
    "google/gemini-2.0-pro-exp-02-05:free": "Gemini 2.0 Pro Exp (OpenRouter Free)",
    "google/gemini-2.0-flash-thinking-exp:free": "Gemini 2.0 Flash Thinking (OpenRouter Free)",
    "openai/gpt-4o-mini": "GPT-4o Mini (OpenRouter)",
    "deepseek/deepseek-r1:free": "DeepSeek R1 (OpenRouter Free)",
    "google/gemini-3.1-pro-preview": "Gemini 3.1 Pro Preview (OpenRouter)",
    "anthropic/claude-sonnet-4.6": "Claude Sonnet 4.6 (OpenRouter)",
    "minimax/minimax-m2.5": "Minimax M2.5 (OpenRouter)",
    "anthropic/claude-opus-4.6": "Claude Opus 4.6 (OpenRouter)",
    "z-ai/glm-5": "GLM-5 (OpenRouter)",
    "google/gemini-3-flash-preview": "Gemini 3 Flash Preview (OpenRouter)",
    "deepseek/deepseek-v3.2": "DeepSeek V3.2 (OpenRouter)",
    "anthropic/claude-opus-4.5": "Claude Opus 4.5 (OpenRouter)",
    "x-ai/grok-4.1-fast": "Grok 4.1 Fast (OpenRouter)",
    "anthropic/claude-haiku-4.5": "Claude Haiku 4.5 (OpenRouter)"
};

/**
 * Logs messages to the console when debug mode is enabled in module settings.
 * Triggered by any function that needs diagnostic output.
 * @param {...any} args - The messages or objects to log.
 * @returns {void}
 */
export function logDebug(...args) {
    if (!game.settings.get(MODULE_ID, "debugmode")) return;
    if (typeof args[0] === "string" && args[0].includes("%c")) {
        console.log(...args);
    } else {
        console.log("DH-MISS |", ...args);
    }
}
