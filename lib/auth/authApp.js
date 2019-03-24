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
const query_string_1 = __importDefault(require("query-string"));
// @ts-ignore: Could not find a declaration file for module
const jsontokens_1 = require("jsontokens");
const authVerification_1 = require("./authVerification");
const utils_1 = require("../utils");
const dids_1 = require("../dids");
const errors_1 = require("../errors");
const authMessages_1 = require("./authMessages");
const authConstants_1 = require("./authConstants");
const profileTokens_1 = require("../profiles/profileTokens");
const userSession_1 = require("./userSession");
const config_1 = require("../config");
const logger_1 = require("../logger");
const DEFAULT_PROFILE = {
    '@type': 'Person',
    '@context': 'http://schema.org'
};
/**
 * Check if a user is currently signed in.
 * @method isUserSignedIn
 * @return {Boolean} `true` if the user is signed in, `false` if not.
 */
function isUserSignedIn() {
    console.warn('DEPRECATION WARNING: The static isUserSignedIn() function will be deprecated in '
        + 'the next major release of blockstack.js. Create an instance of UserSession and call the '
        + 'instance method isUserSignedIn().');
    const userSession = new userSession_1.UserSession();
    return userSession.isUserSignedIn();
}
exports.isUserSignedIn = isUserSignedIn;
/**
 * Generates an authentication request and redirects the user to the Blockstack
 * browser to approve the sign in request.
 *
 * Please note that this requires that the web browser properly handles the
 * `blockstack:` URL protocol handler.
 *
 * Most applications should use this
 * method for sign in unless they require more fine grained control over how the
 * authentication request is generated. If your app falls into this category,
 * use `makeAuthRequest` and `redirectToSignInWithAuthRequest` to build your own sign in process.
 *
 * @param {String} [redirectURI=`${window.location.origin}/`]
 * The location to which the identity provider will redirect the user after
 * the user approves sign in.
 * @param  {String} [manifestURI=`${window.location.origin}/manifest.json`]
 * Location of the manifest file.
 * @param  {Array} [scopes=DEFAULT_SCOPE] Defaults to requesting write access to
 * this app's data store.
 * An array of strings indicating which permissions this app is requesting.
 * @return {void}
 */
function redirectToSignIn(redirectURI, manifestURI, scopes) {
    console.warn('DEPRECATION WARNING: The static redirectToSignIn() function will be deprecated in the '
        + 'next major release of blockstack.js. Create an instance of UserSession and call the '
        + 'instance method redirectToSignIn().');
    const authRequest = authMessages_1.makeAuthRequest(null, redirectURI, manifestURI, scopes);
    redirectToSignInWithAuthRequest(authRequest);
}
exports.redirectToSignIn = redirectToSignIn;
/**
 * Check if there is a authentication request that hasn't been handled.
 * @return {Boolean} `true` if there is a pending sign in, otherwise `false`
 */
function isSignInPending() {
    return !!getAuthResponseToken();
}
exports.isSignInPending = isSignInPending;
/**
 * Retrieve the authentication token from the URL query
 * @return {String} the authentication token if it exists otherwise `null`
 */
function getAuthResponseToken() {
    utils_1.checkWindowAPI('getAuthResponseToken', 'location');
    const queryDict = query_string_1.default.parse(window.location.search);
    return queryDict.authResponse ? queryDict.authResponse : '';
}
exports.getAuthResponseToken = getAuthResponseToken;
/**
 * Retrieves the user data object. The user's profile is stored in the key `profile`.
 * @return {Object} User data object.
 */
function loadUserData() {
    console.warn('DEPRECATION WARNING: The static loadUserData() function will be deprecated in the '
        + 'next major release of blockstack.js. Create an instance of UserSession and call the '
        + 'instance method loadUserData().');
    const userSession = new userSession_1.UserSession();
    return userSession.loadUserData();
}
exports.loadUserData = loadUserData;
/**
 * Sign the user out and optionally redirect to given location.
 * @param  redirectURL
 * Location to redirect user to after sign out.
 * Only used in environments with `window` available
 */
function signUserOut(redirectURL, caller) {
    const userSession = caller || new userSession_1.UserSession();
    userSession.store.deleteSessionData();
    if (redirectURL) {
        if (typeof window !== 'undefined') {
            window.location.href = redirectURL;
        }
        else {
            const errMsg = '`signUserOut` called with `redirectURL` specified'
                + ` ("${redirectURL}")`
                + ' but `window.location.href` is not available in this environment';
            logger_1.Logger.error(errMsg);
            throw new Error(errMsg);
        }
    }
}
exports.signUserOut = signUserOut;
/**
 * Detects if the native auth-browser is installed and is successfully
 * launched via a custom protocol URI.
 * @param {String} authRequest
 * The encoded authRequest to be used as a query param in the custom URI.
 * @param {String} successCallback
 * The callback that is invoked when the protocol handler was detected.
 * @param {String} failCallback
 * The callback that is invoked when the protocol handler was not detected.
 * @return {void}
 */
function detectProtocolLaunch(authRequest, successCallback, failCallback) {
    // Create a unique ID used for this protocol detection attempt.
    const echoReplyID = Math.random().toString(36).substr(2, 9);
    const echoReplyKeyPrefix = 'echo-reply-';
    const echoReplyKey = `${echoReplyKeyPrefix}${echoReplyID}`;
    const apis = ['localStorage', 'document', 'setTimeout', 'clearTimeout', 'addEventListener', 'removeEventListener'];
    apis.forEach((windowAPI) => utils_1.checkWindowAPI('detectProtocolLaunch', windowAPI));
    // Use localStorage as a reliable cross-window communication method.
    // Create the storage entry to signal a protocol detection attempt for the
    // next browser window to check.
    window.localStorage.setItem(echoReplyKey, Date.now().toString());
    const cleanUpLocalStorage = () => {
        try {
            window.localStorage.removeItem(echoReplyKey);
            // Also clear out any stale echo-reply keys older than 1 hour.
            for (let i = 0; i < window.localStorage.length; i++) {
                const storageKey = window.localStorage.key(i);
                if (storageKey && storageKey.startsWith(echoReplyKeyPrefix)) {
                    const storageValue = window.localStorage.getItem(storageKey);
                    if (storageValue === 'success' || (Date.now() - parseInt(storageValue, 10)) > 3600000) {
                        window.localStorage.removeItem(storageKey);
                    }
                }
            }
        }
        catch (err) {
            logger_1.Logger.error('Exception cleaning up echo-reply entries in localStorage');
            logger_1.Logger.error(err);
        }
    };
    const detectionTimeout = 1000;
    let redirectToWebAuthTimer = 0;
    const cancelWebAuthRedirectTimer = () => {
        if (redirectToWebAuthTimer) {
            window.clearTimeout(redirectToWebAuthTimer);
            redirectToWebAuthTimer = 0;
        }
    };
    const startWebAuthRedirectTimer = (timeout = detectionTimeout) => {
        cancelWebAuthRedirectTimer();
        redirectToWebAuthTimer = window.setTimeout(() => {
            if (redirectToWebAuthTimer) {
                cancelWebAuthRedirectTimer();
                let nextFunc;
                if (window.localStorage.getItem(echoReplyKey) === 'success') {
                    logger_1.Logger.info('Protocol echo reply detected.');
                    nextFunc = successCallback;
                }
                else {
                    logger_1.Logger.info('Protocol handler not detected.');
                    nextFunc = failCallback;
                }
                failCallback = () => { };
                successCallback = () => { };
                cleanUpLocalStorage();
                // Briefly wait since localStorage changes can 
                // sometimes be ignored when immediately redirected.
                setTimeout(() => nextFunc(), 100);
            }
        }, timeout);
    };
    startWebAuthRedirectTimer();
    const inputPromptTracker = window.document.createElement('input');
    inputPromptTracker.type = 'text';
    const inputStyle = inputPromptTracker.style;
    // Prevent this element from inherited any css.
    inputStyle.all = 'initial';
    // Setting display=none on an element prevents them from being focused/blurred.
    // So hide the element using other properties..
    inputStyle.opacity = '0';
    inputStyle.filter = 'alpha(opacity=0)';
    inputStyle.height = '0';
    inputStyle.width = '0';
    // If the the focus of a page element is immediately changed then this likely indicates 
    // the protocol handler is installed, and the browser is prompting the user if they want 
    // to open the application. 
    const inputBlurredFunc = () => {
        // Use a timeout of 100ms to ignore instant toggles between blur and focus.
        // Browsers often perform an instant blur & focus when the protocol handler is working
        // but not showing any browser prompts, so we want to ignore those instances.
        let isRefocused = false;
        inputPromptTracker.addEventListener('focus', () => { isRefocused = true; }, { once: true, capture: true });
        setTimeout(() => {
            if (redirectToWebAuthTimer && !isRefocused) {
                logger_1.Logger.info('Detected possible browser prompt for opening the protocol handler app.');
                window.clearTimeout(redirectToWebAuthTimer);
                inputPromptTracker.addEventListener('focus', () => {
                    if (redirectToWebAuthTimer) {
                        logger_1.Logger.info('Possible browser prompt closed, restarting auth redirect timeout.');
                        startWebAuthRedirectTimer();
                    }
                }, { once: true, capture: true });
            }
        }, 100);
    };
    inputPromptTracker.addEventListener('blur', inputBlurredFunc, { once: true, capture: true });
    setTimeout(() => inputPromptTracker.removeEventListener('blur', inputBlurredFunc), 200);
    window.document.body.appendChild(inputPromptTracker);
    inputPromptTracker.focus();
    // Detect if document.visibility is immediately changed which is a strong 
    // indication that the protocol handler is working. We don't know for sure and 
    // can't predict future browser changes, so only increase the redirect timeout.
    // This reduces the probability of a false-negative (where local auth works, but 
    // the original page was redirect to web auth because something took too long),
    const pageVisibilityChanged = () => {
        if (window.document.hidden && redirectToWebAuthTimer) {
            logger_1.Logger.info('Detected immediate page visibility change (protocol handler probably working).');
            startWebAuthRedirectTimer(3000);
        }
    };
    window.document.addEventListener('visibilitychange', pageVisibilityChanged, { once: true, capture: true });
    setTimeout(() => window.document.removeEventListener('visibilitychange', pageVisibilityChanged), 500);
    // Listen for the custom protocol echo reply via localStorage update event.
    window.addEventListener('storage', function replyEventListener(event) {
        if (event.key === echoReplyKey && window.localStorage.getItem(echoReplyKey) === 'success') {
            // Custom protocol worked, cancel the web auth redirect timer.
            cancelWebAuthRedirectTimer();
            inputPromptTracker.removeEventListener('blur', inputBlurredFunc);
            logger_1.Logger.info('Protocol echo reply detected from localStorage event.');
            // Clean up event listener and localStorage.
            window.removeEventListener('storage', replyEventListener);
            const nextFunc = successCallback;
            successCallback = () => { };
            failCallback = () => { };
            cleanUpLocalStorage();
            // Briefly wait since localStorage changes can sometimes 
            // be ignored when immediately redirected.
            setTimeout(() => nextFunc(), 100);
        }
    }, false);
    // Use iframe technique for launching the protocol URI rather than setting `window.location`.
    // This method prevents browsers like Safari, Opera, Firefox from showing error prompts
    // about unknown protocol handler when app is not installed, and avoids an empty
    // browser tab when the app is installed. 
    logger_1.Logger.info('Attempting protocol launch via iframe injection.');
    const locationSrc = `${utils_1.BLOCKSTACK_HANDLER}:${authRequest}&echo=${echoReplyID}`;
    const iframe = window.document.createElement('iframe');
    const iframeStyle = iframe.style;
    iframeStyle.all = 'initial';
    iframeStyle.display = 'none';
    iframe.src = locationSrc;
    window.document.body.appendChild(iframe);
}
/**
 * Redirects the user to the Blockstack browser to approve the sign in request
 * given.
 *
 * The user is redirected to the `blockstackIDHost` if the `blockstack:`
 * protocol handler is not detected. Please note that the protocol handler detection
 * does not work on all browsers.
 * @param  {String} authRequest - the authentication request generated by `makeAuthRequest`
 * @param  {String} blockstackIDHost - the URL to redirect the user to if the blockstack
 *                                     protocol handler is not detected
 * @return {void}
 */
function redirectToSignInWithAuthRequest(authRequest, blockstackIDHost = authConstants_1.DEFAULT_BLOCKSTACK_HOST) {
    authRequest = authRequest || authMessages_1.makeAuthRequest();
    const httpsURI = `${blockstackIDHost}?authRequest=${authRequest}`;
    utils_1.checkWindowAPI('redirectToSignInWithAuthRequest', 'navigator');
    utils_1.checkWindowAPI('redirectToSignInWithAuthRequest', 'location');
    // If they're on a mobile OS, always redirect them to HTTPS site
    if (/Android|webOS|iPhone|iPad|iPod|Opera Mini/i.test(window.navigator.userAgent)) {
        logger_1.Logger.info('detected mobile OS, sending to https');
        window.location.href = httpsURI;
        return;
    }
    function successCallback() {
        logger_1.Logger.info('protocol handler detected');
        // The detection function should open the link for us
    }
    function failCallback() {
        logger_1.Logger.warn('protocol handler not detected');
        window.location.href = httpsURI;
    }
    detectProtocolLaunch(authRequest, successCallback, failCallback);
}
exports.redirectToSignInWithAuthRequest = redirectToSignInWithAuthRequest;
/**
 * Try to process any pending sign in request by returning a `Promise` that resolves
 * to the user data object if the sign in succeeds.
 *
 * @param {String} nameLookupURL - the endpoint against which to verify public
 * keys match claimed username
 * @param {String} authResponseToken - the signed authentication response token
 * @param {String} transitKey - the transit private key that corresponds to the transit public key
 * that was provided in the authentication request
 * @return {Promise} that resolves to the user data object if successful and rejects
 * if handling the sign in request fails or there was no pending sign in request.
 */
function handlePendingSignIn(nameLookupURL = '', authResponseToken = getAuthResponseToken(), transitKey, caller) {
    return __awaiter(this, void 0, void 0, function* () {
        if (!caller) {
            caller = new userSession_1.UserSession();
        }
        if (!transitKey) {
            transitKey = caller.store.getSessionData().transitKey;
        }
        if (!nameLookupURL) {
            const tokenPayload = jsontokens_1.decodeToken(authResponseToken).payload;
            if (utils_1.isLaterVersion(tokenPayload.version, '1.3.0')
                && tokenPayload.blockstackAPIUrl !== null && tokenPayload.blockstackAPIUrl !== undefined) {
                // override globally
                logger_1.Logger.info(`Overriding ${config_1.config.network.blockstackAPIUrl} `
                    + `with ${tokenPayload.blockstackAPIUrl}`);
                config_1.config.network.blockstackAPIUrl = tokenPayload.blockstackAPIUrl;
            }
            nameLookupURL = `${config_1.config.network.blockstackAPIUrl}${authConstants_1.NAME_LOOKUP_PATH}`;
        }
        const isValid = yield authVerification_1.verifyAuthResponse(authResponseToken, nameLookupURL);
        if (!isValid) {
            throw new errors_1.LoginFailedError('Invalid authentication response.');
        }
        const tokenPayload = jsontokens_1.decodeToken(authResponseToken).payload;
        // TODO: real version handling
        let appPrivateKey = tokenPayload.private_key;
        let coreSessionToken = tokenPayload.core_token;
        if (utils_1.isLaterVersion(tokenPayload.version, '1.1.0')) {
            if (transitKey !== undefined && transitKey != null) {
                if (tokenPayload.private_key !== undefined && tokenPayload.private_key !== null) {
                    try {
                        appPrivateKey = authMessages_1.decryptPrivateKey(transitKey, tokenPayload.private_key);
                    }
                    catch (e) {
                        logger_1.Logger.warn('Failed decryption of appPrivateKey, will try to use as given');
                        try {
                            utils_1.hexStringToECPair(tokenPayload.private_key);
                        }
                        catch (ecPairError) {
                            throw new errors_1.LoginFailedError('Failed decrypting appPrivateKey. Usually means'
                                + ' that the transit key has changed during login.');
                        }
                    }
                }
                if (coreSessionToken !== undefined && coreSessionToken !== null) {
                    try {
                        coreSessionToken = authMessages_1.decryptPrivateKey(transitKey, coreSessionToken);
                    }
                    catch (e) {
                        logger_1.Logger.info('Failed decryption of coreSessionToken, will try to use as given');
                    }
                }
            }
            else {
                throw new errors_1.LoginFailedError('Authenticating with protocol > 1.1.0 requires transit'
                    + ' key, and none found.');
            }
        }
        let hubUrl = authConstants_1.BLOCKSTACK_DEFAULT_GAIA_HUB_URL;
        let gaiaAssociationToken;
        if (utils_1.isLaterVersion(tokenPayload.version, '1.2.0')
            && tokenPayload.hubUrl !== null && tokenPayload.hubUrl !== undefined) {
            hubUrl = tokenPayload.hubUrl;
        }
        if (utils_1.isLaterVersion(tokenPayload.version, '1.3.0')
            && tokenPayload.associationToken !== null && tokenPayload.associationToken !== undefined) {
            gaiaAssociationToken = tokenPayload.associationToken;
        }
        const userData = {
            username: tokenPayload.username,
            profile: tokenPayload.profile,
            email: tokenPayload.email,
            decentralizedID: tokenPayload.iss,
            identityAddress: dids_1.getAddressFromDID(tokenPayload.iss),
            appPrivateKey,
            coreSessionToken,
            authResponseToken,
            hubUrl,
            gaiaAssociationToken
        };
        const profileURL = tokenPayload.profile_url;
        if (!userData.profile && profileURL) {
            const response = yield fetch(profileURL);
            if (!response.ok) { // return blank profile if we fail to fetch
                userData.profile = Object.assign({}, DEFAULT_PROFILE);
            }
            else {
                const responseText = yield response.text();
                const wrappedProfile = JSON.parse(responseText);
                const profile = profileTokens_1.extractProfile(wrappedProfile[0].token);
                userData.profile = profile;
            }
        }
        else {
            userData.profile = tokenPayload.profile;
        }
        const sessionData = caller.store.getSessionData();
        sessionData.userData = userData;
        caller.store.setSessionData(sessionData);
        return userData;
    });
}
exports.handlePendingSignIn = handlePendingSignIn;
//# sourceMappingURL=authApp.js.map