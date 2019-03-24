// @ts-ignore: Could not find a declaration file for module
import { TokenSigner, decodeToken, SECP256K1Client } from 'jsontokens'
import 'cross-fetch/polyfill'

/**
 * Create an authentication token to be sent to the Core API server
 * in order to generate a Core session JWT.
 *
 * @param {String} appDomain  The unique application identifier (e.g. foo.app, www.foo.com, etc).
 * @param {Array} appMethods  The list of API methods this application will need.
 * @param {String} appPrivateKey  The application-specific private key
 * @param {String|null} blockchainID  This is the blockchain ID of the requester
 * @param {String} thisDevice Identifier of the current device
 *
 * @return {String} a JWT signed by the app's private key
 * @deprecated
 * @private
 */
export function makeCoreSessionRequest(appDomain: string,
                                       appMethods: string[],
                                       appPrivateKey: string,
                                       blockchainID: string = null,
                                       thisDevice: string = null): string {
  if (thisDevice === null) {
    thisDevice = '.default'
  }

  const appPublicKey = SECP256K1Client.derivePublicKey(appPrivateKey)
  const appPublicKeys = [{
    public_key: appPublicKey,
    device_id: thisDevice
  }]

  const authBody = {
    version: 1,
    blockchain_id: blockchainID,
    app_private_key: appPrivateKey,
    app_domain: appDomain,
    methods: appMethods,
    app_public_keys: appPublicKeys,
    device_id: thisDevice
  }

  // make token
  const tokenSigner = new TokenSigner('ES256k', appPrivateKey)
  const token = tokenSigner.sign(authBody)

  return token
}


/**
 * Send Core a request for a session token.
 *
 * @param {String} coreHost host name of the core node
 * @param {Number} corePort port number of the core node
 * @param {String} coreAuthRequest  a signed JWT encoding the authentication request
 * @param {String} apiPassword the API password for Core
 *
 * @return {Promise} the resolves to a JWT signed with the Core API server's private key
 * that authorizes the bearer to carry out the requested operations and rejects
 * with an error message otherwise
 * @deprecated
 * @private
 */
export async function sendCoreSessionRequest(
  coreHost: string,
  corePort: number,
  coreAuthRequest: string,
  apiPassword: string
): Promise<string> {
  try {
    if (!apiPassword) {
      throw new Error('Missing API password')
    }
    const options = {
      headers: {
        Authorization: `bearer ${apiPassword}`
      }
    }
    const url = `http://${coreHost}:${corePort}/v1/auth?authRequest=${coreAuthRequest}`
    const response = await fetch(url, options)
    if (!response.ok) {
      throw new Error('HTTP status not OK')
    }
    const responseText = await response.text()
    const responseJson = JSON.parse(responseText)
    const token = responseJson.token
    if (!token) {
      throw new Error('Failed to get Core session token')
    }
    return token
  } catch (error) {
    console.error(error)
    throw new Error('Invalid Core response: not JSON')
  }
}


/**
 * Get a core session token.  Generate an auth request, sign it, send it to Core,
 * and get back a session token.
 *
 * @param {String} coreHost Core API server's hostname
 * @param {Number} corePort Core API server's port number
 * @param {String} apiPassword core api password
 * @param  {String} appPrivateKey Application's private key
 * @param  {String} blockchainId blockchain ID of the user signing in.
 * `null` if user has no blockchain ID
 * @param {String} authRequest authentication request token
 * @param {String} deviceId identifier for the current device
 *
 * @return {Promise} a Promise that resolves to a Core session token or rejects
 * with an error message.
 * @deprecated
 * @private
 */
export async function getCoreSession(
  coreHost: string,
  corePort: number,
  apiPassword: string,
  appPrivateKey: string,
  blockchainId: string = null,
  authRequest: string = null,
  deviceId: string = '0'
): Promise<string> {
  if (!authRequest) {
    throw new Error('No authRequest provided')
  }

  let payload = null
  let authRequestObject = null
  try {
    authRequestObject = decodeToken(authRequest)
    if (!authRequestObject) {
      throw new Error('Invalid authRequest in URL query string')
    }
    if (!authRequestObject.payload) {
      throw new Error('Invalid authRequest in URL query string')
    }
    payload = authRequestObject.payload
  } catch (e) {
    console.error(e.stack)
    throw new Error('Failed to parse authRequest in URL')
  }

  const appDomain = payload.domain_name
  if (!appDomain) {
    throw new Error('No domain_name in authRequest')
  }
  const appMethods = payload.scopes

  const coreAuthRequest = makeCoreSessionRequest(
    appDomain, appMethods, appPrivateKey, blockchainId, deviceId
  )

  return sendCoreSessionRequest(
    coreHost, corePort, coreAuthRequest, apiPassword
  )
}
