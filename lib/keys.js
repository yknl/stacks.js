"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const crypto_1 = require("crypto");
const bitcoinjs_lib_1 = require("bitcoinjs-lib");
function getEntropy(numberOfBytes) {
    if (!numberOfBytes) {
        numberOfBytes = 32;
    }
    return crypto_1.randomBytes(numberOfBytes);
}
exports.getEntropy = getEntropy;
function makeECPrivateKey() {
    const keyPair = bitcoinjs_lib_1.ECPair.makeRandom({ rng: getEntropy });
    return keyPair.privateKey.toString('hex');
}
exports.makeECPrivateKey = makeECPrivateKey;
function publicKeyToAddress(publicKey) {
    const publicKeyBuffer = Buffer.from(publicKey, 'hex');
    const publicKeyHash160 = bitcoinjs_lib_1.crypto.hash160(publicKeyBuffer);
    const address = bitcoinjs_lib_1.address.toBase58Check(publicKeyHash160, 0x00);
    return address;
}
exports.publicKeyToAddress = publicKeyToAddress;
function getPublicKeyFromPrivate(privateKey) {
    const keyPair = bitcoinjs_lib_1.ECPair.fromPrivateKey(Buffer.from(privateKey, 'hex'));
    return keyPair.publicKey.toString('hex');
}
exports.getPublicKeyFromPrivate = getPublicKeyFromPrivate;
//# sourceMappingURL=keys.js.map