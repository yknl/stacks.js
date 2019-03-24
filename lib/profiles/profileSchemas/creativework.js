"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
// @ts-ignore: Could not find a declaration file for module
const schema_inspector_1 = __importDefault(require("schema-inspector"));
const profileTokens_1 = require("../profileTokens");
const profile_1 = require("../profile");
const schemaDefinition = {
    type: 'object',
    properties: {
        '@context': { type: 'string', optional: true },
        '@type': { type: 'string' },
        '@id': { type: 'string', optional: true }
    }
};
class CreativeWork extends profile_1.Profile {
    constructor(profile = {}) {
        super(profile);
        this._profile = Object.assign({}, {
            '@type': 'CreativeWork'
        }, this._profile);
    }
    static validateSchema(profile, strict = false) {
        schemaDefinition.strict = strict;
        return schema_inspector_1.default.validate(schemaDefinition, profile);
    }
    static fromToken(token, publicKeyOrAddress = null) {
        const profile = profileTokens_1.extractProfile(token, publicKeyOrAddress);
        return new CreativeWork(profile);
    }
}
exports.CreativeWork = CreativeWork;
//# sourceMappingURL=creativework.js.map