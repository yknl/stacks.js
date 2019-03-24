"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : new P(function (resolve) { resolve(result.value); }).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const bitcoinjs_lib_1 = __importDefault(require("bitcoinjs-lib"));
const crypto_1 = __importDefault(require("crypto"));
// @ts-ignore: Could not find a declaration file for module
const jsontokens_1 = require("jsontokens");
const utils_1 = require("../utils");
const keys_1 = require("../keys");
const logger_1 = require("../logger");
exports.BLOCKSTACK_GAIA_HUB_LABEL = 'blockstack-gaia-hub-config';
function uploadToGaiaHub(filename, contents, hubConfig, contentType = 'application/octet-stream') {
    return __awaiter(this, void 0, void 0, function* () {
        logger_1.Logger.debug(`uploadToGaiaHub: uploading ${filename} to ${hubConfig.server}`);
        const response = yield fetch(`${hubConfig.server}/store/${hubConfig.address}/${filename}`, {
            method: 'POST',
            headers: {
                'Content-Type': contentType,
                Authorization: `bearer ${hubConfig.token}`
            },
            body: contents
        });
        if (!response.ok) {
            throw new Error('Error when uploading to Gaia hub');
        }
        const responseText = yield response.text();
        const responseJSON = JSON.parse(responseText);
        return responseJSON.publicURL;
    });
}
exports.uploadToGaiaHub = uploadToGaiaHub;
function getFullReadUrl(filename, hubConfig) {
    return Promise.resolve(`${hubConfig.url_prefix}${hubConfig.address}/${filename}`);
}
exports.getFullReadUrl = getFullReadUrl;
function makeLegacyAuthToken(challengeText, signerKeyHex) {
    // only sign specific legacy auth challenges.
    let parsedChallenge;
    try {
        parsedChallenge = JSON.parse(challengeText);
    }
    catch (err) {
        throw new Error('Failed in parsing legacy challenge text from the gaia hub.');
    }
    if (parsedChallenge[0] === 'gaiahub'
        && parsedChallenge[3] === 'blockstack_storage_please_sign') {
        const signer = utils_1.hexStringToECPair(signerKeyHex
            + (signerKeyHex.length === 64 ? '01' : ''));
        const digest = bitcoinjs_lib_1.default.crypto.sha256(Buffer.from(challengeText));
        const signatureBuffer = signer.sign(digest);
        const signatureWithHash = bitcoinjs_lib_1.default.script.signature.encode(signatureBuffer, bitcoinjs_lib_1.default.Transaction.SIGHASH_NONE);
        // We only want the DER encoding so remove the sighash version byte at the end.
        // See: https://github.com/bitcoinjs/bitcoinjs-lib/issues/1241#issuecomment-428062912
        const signature = signatureWithHash.toString('hex').slice(0, -2);
        const publickey = keys_1.getPublicKeyFromPrivate(signerKeyHex);
        const token = Buffer.from(JSON.stringify({ publickey, signature })).toString('base64');
        return token;
    }
    else {
        throw new Error('Failed to connect to legacy gaia hub. If you operate this hub, please update.');
    }
}
function makeV1GaiaAuthToken(hubInfo, signerKeyHex, hubUrl, associationToken) {
    const challengeText = hubInfo.challenge_text;
    const handlesV1Auth = (hubInfo.latest_auth_version
        && parseInt(hubInfo.latest_auth_version.slice(1), 10) >= 1);
    const iss = keys_1.getPublicKeyFromPrivate(signerKeyHex);
    if (!handlesV1Auth) {
        return makeLegacyAuthToken(challengeText, signerKeyHex);
    }
    const salt = crypto_1.default.randomBytes(16).toString('hex');
    const payload = {
        gaiaChallenge: challengeText,
        hubUrl,
        iss,
        salt,
        associationToken
    };
    const token = new jsontokens_1.TokenSigner('ES256K', signerKeyHex).sign(payload);
    return `v1:${token}`;
}
function connectToGaiaHub(gaiaHubUrl, challengeSignerHex, associationToken) {
    return __awaiter(this, void 0, void 0, function* () {
        logger_1.Logger.debug(`connectToGaiaHub: ${gaiaHubUrl}/hub_info`);
        const response = yield fetch(`${gaiaHubUrl}/hub_info`);
        const hubInfo = yield response.json();
        const readURL = hubInfo.read_url_prefix;
        const token = makeV1GaiaAuthToken(hubInfo, challengeSignerHex, gaiaHubUrl, associationToken);
        const address = utils_1.ecPairToAddress(utils_1.hexStringToECPair(challengeSignerHex
            + (challengeSignerHex.length === 64 ? '01' : '')));
        return {
            url_prefix: readURL,
            address,
            token,
            server: gaiaHubUrl
        };
    });
}
exports.connectToGaiaHub = connectToGaiaHub;
function getBucketUrl(gaiaHubUrl, appPrivateKey) {
    return __awaiter(this, void 0, void 0, function* () {
        const challengeSigner = bitcoinjs_lib_1.default.ECPair.fromPrivateKey(Buffer.from(appPrivateKey, 'hex'));
        const response = yield fetch(`${gaiaHubUrl}/hub_info`);
        const responseText = yield response.text();
        const responseJSON = JSON.parse(responseText);
        const readURL = responseJSON.read_url_prefix;
        const address = utils_1.ecPairToAddress(challengeSigner);
        const bucketUrl = `${readURL}${address}/`;
        return bucketUrl;
    });
}
exports.getBucketUrl = getBucketUrl;
//# sourceMappingURL=hub.js.map