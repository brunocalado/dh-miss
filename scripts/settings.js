import { MODULE_ID, AI_PERSONAS, AI_STANCES, MODELS } from "./constants.js";

const { ApplicationV2, HandlebarsApplicationMixin } = foundry.applications.api;

/**
 * Menu Application for AI rules and configuration.
 */
class AISettingsApp extends HandlebarsApplicationMixin(ApplicationV2) {
    static DEFAULT_OPTIONS = {
        id: "dh-miss-ai-settings-app",
        tag: "form",
        window: { title: "M.I.S.S. AI Configuration", resizable: true },
        position: { width: 960, height: 600 }
    };

    static PARTS = {
        content: { template: `modules/${MODULE_ID}/templates/ai-settings-menu.hbs` }
    };

    async _prepareContext(_options) {
        const personaChoices = Object.entries(AI_PERSONAS).map(([key, val]) => ({
            value: key,
            label: val.label
        }));

        const stanceChoices = Object.entries(AI_STANCES).map(([key, val]) => ({
            value: key,
            label: val.label
        }));

        this._nonGMUsers = game.users.filter(u => !u.isGM).map(u => ({ id: u.id, name: u.name }));

        return {
            aiEnablePlayerActions: game.settings.get(MODULE_ID, 'aiEnablePlayerActions'),
            aiEnablePlayerAttacks: game.settings.get(MODULE_ID, 'aiEnablePlayerAttacks'),
            aiEnablePlayerReactions: game.settings.get(MODULE_ID, 'aiEnablePlayerReactions'),
            aiEnableGMAttacks: game.settings.get(MODULE_ID, 'aiEnableGMAttacks'),
            aiEnableGMReactions: game.settings.get(MODULE_ID, 'aiEnableGMReactions'),
            aiLengthLevel: game.settings.get(MODULE_ID, 'aiLengthLevel'),
            aiActivationChance: game.settings.get(MODULE_ID, 'aiActivationChance'),
            personaChoices,
            selectedPersona: game.settings.get(MODULE_ID, 'aiPersona'),
            aiCustomPersona: game.settings.get(MODULE_ID, 'aiCustomPersona'),
            stanceChoices,
            selectedStance: game.settings.get(MODULE_ID, 'aiStance'),
            aiCustomStance: game.settings.get(MODULE_ID, 'aiCustomStance'),
            commonRules: JSON.parse(game.settings.get(MODULE_ID, 'aiCommonRules') || '[]'),
            adversaryRules: JSON.parse(game.settings.get(MODULE_ID, 'aiAdversaryRules') || '[]'),
            characterRules: JSON.parse(game.settings.get(MODULE_ID, 'aiCharacterRules') || '[]')
                .map(r => ({ ...r, userId: r.userId ?? "all" })),
            nonGMUsers: this._nonGMUsers
        };
    }

    _onRender(context, options) {
        // --- TAB SWITCHING ---
        const navItems = this.element.querySelectorAll('.tracker-nav .item');
        const tabItems = this.element.querySelectorAll('.tab-content .tab');

        navItems.forEach(nav => {
            nav.addEventListener('click', (e) => {
                e.preventDefault();
                const targetTab = nav.dataset.tab;
                navItems.forEach(n => n.classList.toggle('active', n.dataset.tab === targetTab));
                tabItems.forEach(t => t.classList.toggle('active', t.dataset.tab === targetTab));
            });
        });

        // --- CUSTOM PERSONA TOGGLE ---
        const personaSelect = this.element.querySelector('select[name="aiPersona"]');
        const customPersonaContainers = this.element.querySelectorAll('.custom-persona-container');

        if (personaSelect && customPersonaContainers.length) {
            const updateCustomVisibility = () => {
                const isCustom = personaSelect.value === 'custom';
                customPersonaContainers.forEach(c => c.classList.toggle('visible', isCustom));
            };
            updateCustomVisibility();
            personaSelect.addEventListener('change', updateCustomVisibility);
        }

        // --- CUSTOM STANCE TOGGLE ---
        const stanceSelect = this.element.querySelector('select[name="aiStance"]');
        const customStanceContainers = this.element.querySelectorAll('.custom-stance-container');

        if (stanceSelect && customStanceContainers.length) {
            const updateStanceVisibility = () => {
                const isCustom = stanceSelect.value === 'custom';
                customStanceContainers.forEach(c => c.classList.toggle('visible', isCustom));
            };
            updateStanceVisibility();
            stanceSelect.addEventListener('change', updateStanceVisibility);
        }

        // --- ADD RULE BUTTONS ---
        this.element.querySelectorAll('.rule-add-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                const ruleType = btn.dataset.ruleType;
                const rulesList = this.element.querySelector(`.rules-list[data-rule-type="${ruleType}"]`);
                if (!rulesList) return;

                const userSelect = ruleType === "character"
                    ? `<select class="rule-user" name="ruleUser">
                           <option value="all">All</option>
                           ${this._nonGMUsers.map(u => `<option value="${u.id}">${u.name}</option>`).join('')}
                       </select>`
                    : '';

                const ruleId = foundry.utils.randomID();
                const row = document.createElement('div');
                row.classList.add('rule-row');
                row.dataset.ruleId = ruleId;
                row.innerHTML = `
                    ${userSelect}
                    <input type="text" class="rule-text" name="ruleText" value="" maxlength="1200" placeholder="Describe a rule for the AI...">
                    <button type="button" class="rule-delete" title="Delete Rule"><i class="fas fa-trash"></i></button>
                `;
                rulesList.appendChild(row);
                row.querySelector('.rule-delete').addEventListener('click', () => row.remove());
                row.querySelector('.rule-text').focus();
            });
        });

        // --- DELETE RULE BUTTONS (existing rows) ---
        this.element.querySelectorAll('.rule-delete').forEach(btn => {
            btn.addEventListener('click', () => btn.closest('.rule-row').remove());
        });

        // --- FORM SUBMISSION ---
        this.element.addEventListener('submit', async (e) => {
            e.preventDefault();
            const formData = new FormData(e.target);

            // General — group enable/disable toggles
            await game.settings.set(MODULE_ID, 'aiEnablePlayerActions',   formData.get('aiEnablePlayerActions')   === 'on');
            await game.settings.set(MODULE_ID, 'aiEnablePlayerAttacks',   formData.get('aiEnablePlayerAttacks')   === 'on');
            await game.settings.set(MODULE_ID, 'aiEnablePlayerReactions', formData.get('aiEnablePlayerReactions') === 'on');
            await game.settings.set(MODULE_ID, 'aiEnableGMAttacks',       formData.get('aiEnableGMAttacks')       === 'on');
            await game.settings.set(MODULE_ID, 'aiEnableGMReactions',     formData.get('aiEnableGMReactions')     === 'on');
            await game.settings.set(MODULE_ID, 'aiLengthLevel', formData.get('aiLengthLevel') || 'medium');
            await game.settings.set(MODULE_ID, 'aiActivationChance', formData.get('aiActivationChance') || '100');

            // Persona
            await game.settings.set(MODULE_ID, 'aiPersona', formData.get('aiPersona'));
            await game.settings.set(MODULE_ID, 'aiCustomPersona', formData.get('aiCustomPersona') || '');

            // Stance
            await game.settings.set(MODULE_ID, 'aiStance', formData.get('aiStance'));
            await game.settings.set(MODULE_ID, 'aiCustomStance', formData.get('aiCustomStance') || '');

            // Collect rules from each list, including userId for character rules
            const collectRules = (ruleType) => {
                const rows = this.element.querySelectorAll(`.rules-list[data-rule-type="${ruleType}"] .rule-row`);
                return Array.from(rows).map(row => {
                    const rule = {
                        id: row.dataset.ruleId,
                        text: row.querySelector('.rule-text').value
                    };
                    const userSelect = row.querySelector('.rule-user');
                    if (userSelect) rule.userId = userSelect.value;
                    return rule;
                }).filter(r => r.text.trim() !== '');
            };

            await game.settings.set(MODULE_ID, 'aiCommonRules', JSON.stringify(collectRules('common')));
            await game.settings.set(MODULE_ID, 'aiAdversaryRules', JSON.stringify(collectRules('adversary')));
            await game.settings.set(MODULE_ID, 'aiCharacterRules', JSON.stringify(collectRules('character')));

            this.close();
        });
    }
}

/**
 * Menu Application for AI provider keys and model configuration.
 * Provides two tabs: Gemini (Google Direct) and OpenRouter.
 * Each tab allows configuring the API key and managing the model list.
 */
class AIProvidersApp extends HandlebarsApplicationMixin(ApplicationV2) {
    static DEFAULT_OPTIONS = {
        id: "dh-miss-ai-providers-app",
        tag: "form",
        window: { title: "M.I.S.S. AI Providers", resizable: true },
        position: { width: 700, height: 550 }
    };

    static PARTS = {
        content: { template: `modules/${MODULE_ID}/templates/ai-providers-menu.hbs` }
    };

    /**
     * Prepares the context for the providers template.
     * Reads API keys and model lists from settings and maps model IDs to labels.
     * @param {object} _options - Render options (unused).
     * @returns {Promise<object>} Template context.
     */
    async _prepareContext(_options) {
        return {
            geminiApiKey: game.settings.get(MODULE_ID, 'geminiApiKey'),
            openRouterApiKey: game.settings.get(MODULE_ID, 'openRouterApiKey'),
            geminiModels: JSON.parse(game.settings.get(MODULE_ID, 'geminiModels') || '[]')
                .map(id => ({ id, label: MODELS[id] ?? id })),
            openRouterModels: JSON.parse(game.settings.get(MODULE_ID, 'openRouterModels') || '[]')
                .map(id => ({ id, label: MODELS[id] ?? id }))
        };
    }

    /**
     * Wires tab switching, model add/remove buttons, and form submission.
     * Triggered by the AppV2 render lifecycle.
     */
    _onRender(context, options) {
        // --- TAB SWITCHING ---
        const navItems = this.element.querySelectorAll('.tracker-nav .item');
        const tabItems = this.element.querySelectorAll('.tab-content .tab');

        navItems.forEach(nav => {
            nav.addEventListener('click', (e) => {
                e.preventDefault();
                const targetTab = nav.dataset.tab;
                navItems.forEach(n => n.classList.toggle('active', n.dataset.tab === targetTab));
                tabItems.forEach(t => t.classList.toggle('active', t.dataset.tab === targetTab));
            });
        });

        // --- MODEL LIST: DELETE BUTTONS ---
        this.element.querySelectorAll('.model-delete').forEach(btn => {
            btn.addEventListener('click', () => btn.closest('.model-row').remove());
        });

        // --- MODEL LIST: ADD BUTTONS ---
        this.element.querySelectorAll('.model-add-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                const provider = btn.dataset.provider;
                const input = this.element.querySelector(`.model-add-input[data-provider="${provider}"]`);
                const modelId = input?.value?.trim();
                if (!modelId) return;

                const modelList = this.element.querySelector(`.model-list[data-provider="${provider}"]`);
                if (!modelList) return;

                const existing = modelList.querySelector(`.model-row[data-model-id="${CSS.escape(modelId)}"]`);
                if (existing) {
                    input.value = "";
                    return;
                }

                const label = MODELS[modelId] ?? modelId;
                const row = document.createElement('div');
                row.classList.add('model-row');
                row.dataset.modelId = modelId;
                row.innerHTML = `
                    <span class="model-label">${label}</span>
                    <span class="model-id">${modelId}</span>
                    <button type="button" class="model-delete" title="Remove Model"><i class="fas fa-trash"></i></button>
                `;
                row.querySelector('.model-delete').addEventListener('click', () => row.remove());
                modelList.appendChild(row);
                input.value = "";
            });
        });

        // --- FORM SUBMISSION ---
        this.element.addEventListener('submit', async (e) => {
            e.preventDefault();
            const formData = new FormData(e.target);

            await game.settings.set(MODULE_ID, 'geminiApiKey', formData.get('geminiApiKey') || '');
            await game.settings.set(MODULE_ID, 'openRouterApiKey', formData.get('openRouterApiKey') || '');

            const collectModels = (provider) => {
                const rows = this.element.querySelectorAll(`.model-list[data-provider="${provider}"] .model-row`);
                return Array.from(rows).map(r => r.dataset.modelId).filter(Boolean);
            };
            await game.settings.set(MODULE_ID, 'geminiModels', JSON.stringify(collectModels('gemini')));
            await game.settings.set(MODULE_ID, 'openRouterModels', JSON.stringify(collectModels('openrouter')));

            this.close();
        });
    }
}

/**
 * Registers all module settings.
 * Called from the init hook in main.js.
 */
export function registerSettings() {

    // --- AI Avatar Settings ---
    game.settings.register(MODULE_ID, "aiAvatarImage", {
        name: "AI Avatar Image",
        hint: "The image used for the AI avatar in chat messages.",
        scope: "world",
        config: true,
        type: String,
        default: `modules/${MODULE_ID}/assets/images/avatar-white-border.webp`,
        filePicker: "image"
    });
    
    // --- Debug Settings ---
    game.settings.register(MODULE_ID, "debugmode", {
        name: "Enable Debug Mode",
        hint: "Prints roll detection and AI payload info to browser console (F12).",
        scope: "world",
        config: true,
        type: Boolean,
        default: false
    });

    // --- AI Persona Settings (managed via AI Settings menu) ---
    game.settings.register(MODULE_ID, "aiPersona", {
        scope: "world",
        config: false,
        type: String,
        default: "cynical"
    });

    game.settings.register(MODULE_ID, "aiCustomPersona", {
        scope: "world",
        config: false,
        type: String,
        default: ""
    });

    // --- AI Stance Settings (managed via AI Settings menu) ---
    game.settings.register(MODULE_ID, "aiStance", {
        scope: "world",
        config: false,
        type: String,
        default: "impartial"
    });

    game.settings.register(MODULE_ID, "aiCustomStance", {
        scope: "world",
        config: false,
        type: String,
        default: ""
    });

    // --- API Keys (managed via AI Settings menu) ---
    game.settings.register(MODULE_ID, "geminiApiKey", {
        scope: "world",
        config: false,
        type: String,
        default: ""
    });

    game.settings.register(MODULE_ID, "openRouterApiKey", {
        scope: "world",
        config: false,
        type: String,
        default: ""
    });

    // --- Model Lists (managed via AI Settings menu) ---
    game.settings.register(MODULE_ID, "geminiModels", {
        scope: "world",
        config: false,
        type: String,
        default: JSON.stringify(Object.keys(MODELS).filter(k => !k.includes("/")))
    });

    game.settings.register(MODULE_ID, "openRouterModels", {
        scope: "world",
        config: false,
        type: String,
        default: JSON.stringify(Object.keys(MODELS).filter(k => k.includes("/")))
    });

    // --- AI Configuration (Hidden, managed via menu) ---
    game.settings.register(MODULE_ID, "aiEnablePlayerActions", {
        scope: "world",
        config: false,
        type: Boolean,
        default: true
    });

    game.settings.register(MODULE_ID, "aiEnablePlayerAttacks", {
        scope: "world",
        config: false,
        type: Boolean,
        default: true
    });

    game.settings.register(MODULE_ID, "aiEnablePlayerReactions", {
        scope: "world",
        config: false,
        type: Boolean,
        default: true
    });

    game.settings.register(MODULE_ID, "aiEnableGMAttacks", {
        scope: "world",
        config: false,
        type: Boolean,
        default: true
    });

    game.settings.register(MODULE_ID, "aiEnableGMReactions", {
        scope: "world",
        config: false,
        type: Boolean,
        default: true
    });

    game.settings.register(MODULE_ID, "aiLengthLevel", {
        scope: "world",
        config: false,
        type: String,
        default: "medium"
    });

    game.settings.register(MODULE_ID, "aiActivationChance", {
        scope: "world",
        config: false,
        type: String,
        default: "100"
    });

    game.settings.register(MODULE_ID, "aiCommonRules", {
        scope: "world",
        config: false,
        type: String,
        default: "[]"
    });

    game.settings.register(MODULE_ID, "aiAdversaryRules", {
        scope: "world",
        config: false,
        type: String,
        default: "[]"
    });

    game.settings.register(MODULE_ID, "aiCharacterRules", {
        scope: "world",
        config: false,
        type: String,
        default: "[]"
    });

    // --- Model Smart Routing (Hidden, managed automatically) ---
    game.settings.register(MODULE_ID, "modelCooldowns", {
        scope: "world",
        config: false,
        type: Object,
        default: {}
    });

    game.settings.register(MODULE_ID, "modelReputation", {
        scope: "world",
        config: false,
        type: Object,
        default: {}
    });

    // --- Menu Buttons ---
    game.settings.registerMenu(MODULE_ID, "aiSettingsMenu", {
        name: "AI Rules & Configuration",
        label: "Open AI Settings",
        hint: "Configure AI behavior, common rules, adversary rules, and character rules.",
        icon: "fas fa-brain",
        type: AISettingsApp,
        restricted: true
    });

    game.settings.registerMenu(MODULE_ID, "aiProvidersMenu", {
        name: "AI Providers & Models",
        label: "Open AI Providers",
        hint: "Configure API keys and manage the model list for Gemini and OpenRouter.",
        icon: "fas fa-key",
        type: AIProvidersApp,
        restricted: true
    });
}
