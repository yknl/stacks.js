"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ERROR_CODES = {
    MISSING_PARAMETER: 'missing_parameter',
    REMOTE_SERVICE_ERROR: 'remote_service_error',
    INVALID_STATE: 'invalid_state',
    NO_SESSION_DATA: 'no_session_data',
    UNKNOWN: 'unknown'
};
Object.freeze(exports.ERROR_CODES);
class BlockstackError extends Error {
    constructor(error) {
        super(error.message);
        this.message = error.message;
        this.code = error.code;
        this.parameter = error.parameter ? error.parameter : null;
    }
    toString() {
        return `${super.toString()}
    code: ${this.code} param: ${this.parameter ? this.parameter : 'n/a'}`;
    }
}
exports.BlockstackError = BlockstackError;
class InvalidParameterError extends BlockstackError {
    constructor(parameter, message = '') {
        super({ code: 'missing_parameter', message, parameter: '' });
        this.name = 'MissingParametersError';
    }
}
exports.InvalidParameterError = InvalidParameterError;
class MissingParameterError extends BlockstackError {
    constructor(parameter, message = '') {
        super({ code: exports.ERROR_CODES.MISSING_PARAMETER, message, parameter });
        this.name = 'MissingParametersError';
    }
}
exports.MissingParameterError = MissingParameterError;
class RemoteServiceError extends BlockstackError {
    constructor(response, message = '') {
        super({ code: exports.ERROR_CODES.REMOTE_SERVICE_ERROR, message });
        this.response = response;
    }
}
exports.RemoteServiceError = RemoteServiceError;
class InvalidDIDError extends BlockstackError {
    constructor(message = '') {
        super({ code: 'invalid_did_error', message });
        this.name = 'InvalidDIDError';
    }
}
exports.InvalidDIDError = InvalidDIDError;
class NotEnoughFundsError extends BlockstackError {
    constructor(leftToFund) {
        const message = `Not enough UTXOs to fund. Left to fund: ${leftToFund}`;
        super({ code: 'not_enough_error', message });
        this.leftToFund = leftToFund;
        this.name = 'NotEnoughFundsError';
        this.message = message;
    }
}
exports.NotEnoughFundsError = NotEnoughFundsError;
class InvalidAmountError extends BlockstackError {
    constructor(fees, specifiedAmount) {
        const message = `Not enough coin to fund fees transaction fees. Fees would be ${fees},`
            + ` specified spend is  ${specifiedAmount}`;
        super({ code: 'invalid_amount_error', message });
        this.specifiedAmount = specifiedAmount;
        this.fees = fees;
        this.name = 'InvalidAmountError';
        this.message = message;
    }
}
exports.InvalidAmountError = InvalidAmountError;
class LoginFailedError extends BlockstackError {
    constructor(reason) {
        const message = `Failed to login: ${reason}`;
        super({ code: 'login_failed', message });
        this.message = message;
        this.name = 'LoginFailedError';
    }
}
exports.LoginFailedError = LoginFailedError;
class SignatureVerificationError extends BlockstackError {
    constructor(reason) {
        const message = `Failed to verify signature: ${reason}`;
        super({ code: 'signature_verification_failure', message });
        this.message = message;
        this.name = 'SignatureVerificationError';
    }
}
exports.SignatureVerificationError = SignatureVerificationError;
class InvalidStateError extends BlockstackError {
    constructor(message) {
        super({ code: exports.ERROR_CODES.INVALID_STATE, message });
        this.message = message;
        this.name = 'InvalidStateError';
    }
}
exports.InvalidStateError = InvalidStateError;
class NoSessionDataError extends BlockstackError {
    constructor(message) {
        super({ code: exports.ERROR_CODES.INVALID_STATE, message });
        this.message = message;
        this.name = 'NoSessionDataError';
    }
}
exports.NoSessionDataError = NoSessionDataError;
//# sourceMappingURL=errors.js.map