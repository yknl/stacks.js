

import {
  getOrSetLocalGaiaHubConnection, getFullReadUrl, connectToGaiaHub, 
  uploadToGaiaHub, getBucketUrl, BLOCKSTACK_GAIA_HUB_LABEL
} from './hub'
import { verifyECDSA } from '../encryption/ec'
import { getPublicKeyFromPrivate, publicKeyToAddress } from '../keys'
import { lookupProfile } from '../profiles'
import { SignatureVerificationError } from '../errors'
import { Logger } from '../logger'
import { UserSession } from '../auth/userSession'

export type PutFileOptions = {
  encrypt?: boolean | string,
  sign?: boolean,
  contentType?: string
}

export const SIGNATURE_FILE_SUFFIX = '.sig'


/**
 * Encrypts the data provided with the app public key.
 * @param {String|Buffer} content - data to encrypt
 * @param {Object} [options=null] - options object
 * @param {String} options.publicKey - the hex string of the ECDSA public
 * key to use for encryption. If not provided, will use user's appPublicKey.
 * @return {String} Stringified ciphertext object
 */
export function encryptContent(content: string | Buffer, options?: {publicKey?: string}) {
  console.warn('DEPRECATION WARNING: The static encryptContent() function will be deprecated in '
    + 'the next major release of blockstack.js. Create an instance of UserSession and call the '
    + 'instance method encryptContent().')
  const userSession = new UserSession()
  return userSession.encryptContent(content, options)
}

/**
 * Decrypts data encrypted with `encryptContent` with the
 * transit private key.
 * @param {String|Buffer} content - encrypted content.
 * @param {Object} [options=null] - options object
 * @param {String} options.privateKey - the hex string of the ECDSA private
 * key to use for decryption. If not provided, will use user's appPrivateKey.
 * @return {String|Buffer} decrypted content.
 */
export function decryptContent(content: string, options?: {privateKey?: string}) {
  console.warn('DEPRECATION WARNING: The static decryptContent() function will be deprecated in '
    + 'the next major release of blockstack.js. Create an instance of UserSession and call the '
    + 'instance method decryptContent().')
  const userSession = new UserSession()
  return userSession.decryptContent(content, options)
}

/**
 * Retrieves the specified file from the app's data store.
 * @param {String} path - the path to the file to read
 * @param {Object} [options=null] - options object
 * @param {Boolean} [options.decrypt=true] - try to decrypt the data with the app private key
 * @param {String} options.username - the Blockstack ID to lookup for multi-player storage
 * @param {Boolean} options.verify - Whether the content should be verified, only to be used
 * when `putFile` was set to `sign = true`
 * @param {String} options.app - the app to lookup for multi-player storage -
 * defaults to current origin
 * @param {String} [options.zoneFileLookupURL=null] - The URL
 * to use for zonefile lookup. If falsey, this will use the
 * blockstack.js's getNameInfo function instead.
 * @returns {Promise} that resolves to the raw data in the file
 * or rejects with an error
 */
export function getFile(path: string, options?: {
  decrypt?: boolean;
  verify?: boolean;
  username?: string;
  app?: string;
  zoneFileLookupURL?: string;
}) {
  console.warn('DEPRECATION WARNING: The static getFile() function will be deprecated in '
    + 'the next major release of blockstack.js. Create an instance of UserSession and call the '
    + 'instance method getFile().')
  const userSession = new UserSession()
  return userSession.getFile(path, options)
}

/**
 * Stores the data provided in the app's data store to to the file specified.
 * @param {String} path - the path to store the data in
 * @param {String|Buffer} content - the data to store in the file
 * @param {Object} [options=null] - options object
 * @param {Boolean|String} [options.encrypt=true] - encrypt the data with the app public key
 *                                                  or the provided public key
 * @param {Boolean} [options.sign=false] - sign the data using ECDSA on SHA256 hashes with
 *                                         the app private key
 * @param {String} [options.contentType=''] - set a Content-Type header for unencrypted data
 * @return {Promise} that resolves if the operation succeed and rejects
 * if it failed
 */
export function putFile(path: string, content: string | Buffer, options?: {
  encrypt?: boolean | string,
  sign?: boolean,
  contentType?: string
}) {
  console.warn('DEPRECATION WARNING: The static putFile() function will be deprecated in '
    + 'the next major release of blockstack.js. Create an instance of UserSession and call the '
    + 'instance method putFile().')
  const userSession = new UserSession()
  return userSession.putFile(path, content, options)
}

/**
 * List the set of files in this application's Gaia storage bucket.
 * @param {function} callback - a callback to invoke on each named file that
 * returns `true` to continue the listing operation or `false` to end it
 * @return {Promise} that resolves to the number of files listed
 */
export function listFiles(callback: (name: string) => boolean): Promise<number> {
  console.warn('DEPRECATION WARNING: The static listFiles() function will be deprecated in '
    + 'the next major release of blockstack.js. Create an instance of UserSession and call the '
    + 'instance method listFiles().')
  const userSession = new UserSession()
  return userSession.listFiles(callback)
}

/**
 * Deletes the specified file from the app's data store. Currently not implemented.
 * @param {String} path - the path to the file to delete
 * @returns {Promise} that resolves when the file has been removed
 * or rejects with an error
 * @private
 */
export function deleteFile(path: string) {
  Promise.reject(new Error(`Delete of ${path} not supported by gaia hubs`))
}

/**
 * Fetch the public read URL of a user file for the specified app.
 * @param {String} path - the path to the file to read
 * @param {String} username - The Blockstack ID of the user to look up
 * @param {String} appOrigin - The app origin
 * @param {String} [zoneFileLookupURL=null] - The URL
 * to use for zonefile lookup. If falsey, this will use the
 * blockstack.js's getNameInfo function instead.
 * @return {Promise<string>} that resolves to the public read URL of the file
 * or rejects with an error
 */
export function getUserAppFileUrl(path: string, username: string, appOrigin: string,
                                  zoneFileLookupURL: string | undefined = null
): Promise<string|null> {
  return lookupProfile(username, zoneFileLookupURL)
    .then((profile) => {
      if (profile.hasOwnProperty('apps')) {
        if (profile.apps.hasOwnProperty(appOrigin)) {
          return profile.apps[appOrigin]
        } else {
          return null
        }
      } else {
        return null
      }
    })
    .then((bucketUrl) => {
      if (bucketUrl) {
        const bucket = bucketUrl.replace(/\/?(\?|#|$)/, '/$1')
        return `${bucket}${path}`
      } else {
        return null
      }
    })
}


/* Get the gaia address used for servicing multiplayer reads for the given
 * (username, app) pair.
 * @private
 */
function getGaiaAddress(caller: UserSession,
                        app: string, username?: string, zoneFileLookupURL?: string) {
  return Promise.resolve()
    .then(() => {
      if (username) {
        return getUserAppFileUrl('/', username, app, zoneFileLookupURL)
      } else {
        return getOrSetLocalGaiaHubConnection(caller)
          .then(gaiaHubConfig => getFullReadUrl('/', gaiaHubConfig))
      }
    })
    .then((fileUrl) => {
      const matches = fileUrl.match(/([13][a-km-zA-HJ-NP-Z0-9]{26,35})/)
      if (!matches) {
        throw new Error('Failed to parse gaia address')
      }
      return matches[matches.length - 1]
    })
}

/**
 * Get the URL for reading a file from an app's data store.
 * @param {String} path - the path to the file to read
 * @param {Object} [options=null] - options object
 * @param {String} options.username - the Blockstack ID to lookup for multi-player storage
 * @param {String} options.app - the app to lookup for multi-player storage -
 * defaults to current origin
 * @param {String} [options.zoneFileLookupURL=null] - The URL
 * to use for zonefile lookup. If falsey, this will use the
 * blockstack.js's getNameInfo function instead.
 * @returns {Promise<string>} that resolves to the URL or rejects with an error
 */
export function getFileUrl(path: string, options?: {
  username?: string,
  app?: string,
  zoneFileLookupURL?: string
}): Promise<string> {
  console.warn('DEPRECATION WARNING: The static getFileUrl() function will be deprecated in '
    + 'the next major release of blockstack.js. Create an instance of UserSession and call the '
    + 'instance method getFileUrl().')
  const userSession = new UserSession()
  return userSession.getFileUrl(path, options)
}

/* Handle fetching the contents from a given path. Handles both
 *  multi-player reads and reads from own storage.
 * @private
 */
export function getFileContents(
  caller: UserSession,
  path: string, app: string, username: string | undefined, 
  zoneFileLookupURL: string | undefined,
  forceText: boolean): Promise<string | ArrayBuffer | null> {
  return Promise.resolve()
    .then(() => {
      const opts = { app, username, zoneFileLookupURL }
      return caller.getFileUrl(path, opts)
    })
    .then(readUrl => fetch(readUrl))
    .then<string | ArrayBuffer | null>((response) => {
      if (response.status !== 200) {
        if (response.status === 404) {
          Logger.debug(`getFile ${path} returned 404, returning null`)
          return null
        } else {
          throw new Error(`getFile ${path} failed with HTTP status ${response.status}`)
        }
      }
      const contentType = response.headers.get('Content-Type')
      if (forceText || contentType === null
          || contentType.startsWith('text')
          || contentType === 'application/json') {
        return response.text()
      } else {
        return response.arrayBuffer()
      }
    })
}

/* Handle fetching an unencrypted file, its associated signature
 *  and then validate it. Handles both multi-player reads and reads
 *  from own storage.
 * @private
 */
export function getFileSignedUnencrypted(caller: UserSession, path: string, opt: GetFileOptions & {
  username?: string | null;
  app?: string | null;
  zoneFileLookupURL?: string | null;
}) {
  // future optimization note:
  //    in the case of _multi-player_ reads, this does a lot of excess
  //    profile lookups to figure out where to read files
  //    do browsers cache all these requests if Content-Cache is set?
  return Promise.all(
    [getFileContents(caller, path, opt.app, opt.username, opt.zoneFileLookupURL, false),
     getFileContents(caller, `${path}${SIGNATURE_FILE_SUFFIX}`, opt.app, opt.username,
                     opt.zoneFileLookupURL, true),
     getGaiaAddress(caller, opt.app, opt.username, opt.zoneFileLookupURL)]
  )
    .then(([fileContents, signatureContents, gaiaAddress]) => {
      if (!fileContents) {
        return fileContents
      }
      if (!gaiaAddress) {
        throw new SignatureVerificationError('Failed to get gaia address for verification of: '
                                             + `${path}`)
      }
      if (!signatureContents || typeof signatureContents !== 'string') {
        throw new SignatureVerificationError('Failed to obtain signature for file: '
                                             + `${path} -- looked in ${path}${SIGNATURE_FILE_SUFFIX}`)
      }
      let signature
      let publicKey
      try {
        const sigObject = JSON.parse(signatureContents)
        signature = sigObject.signature
        publicKey = sigObject.publicKey
      } catch (err) {
        if (err instanceof SyntaxError) {
          throw new Error('Failed to parse signature content JSON '
                          + `(path: ${path}${SIGNATURE_FILE_SUFFIX})`
                          + ' The content may be corrupted.')
        } else {
          throw err
        }
      }
      const signerAddress = publicKeyToAddress(publicKey)
      if (gaiaAddress !== signerAddress) {
        throw new SignatureVerificationError(`Signer pubkey address (${signerAddress}) doesn't`
                                             + ` match gaia address (${gaiaAddress})`)
      } else if (!verifyECDSA(fileContents, publicKey, signature)) {
        throw new SignatureVerificationError(
          'Contents do not match ECDSA signature: '
            + `path: ${path}, signature: ${path}${SIGNATURE_FILE_SUFFIX}`
        )
      } else {
        return fileContents
      }
    })
}


/* Handle signature verification and decryption for contents which are
 *  expected to be signed and encrypted. This works for single and
 *  multiplayer reads. In the case of multiplayer reads, it uses the
 *  gaia address for verification of the claimed public key.
 * @private
 */
export function handleSignedEncryptedContents(
  caller: UserSession, path: string, storedContents: string,
  app: string, username?: string, zoneFileLookupURL?: string
) {
  const appPrivateKey = caller.loadUserData().appPrivateKey
  const appPublicKey = getPublicKeyFromPrivate(appPrivateKey)

  let addressPromise: Promise<string>
  if (username) {
    addressPromise = getGaiaAddress(caller, app, username, zoneFileLookupURL)
  } else {
    const address = publicKeyToAddress(appPublicKey)
    addressPromise = Promise.resolve(address)
  }

  return addressPromise.then((address) => {
    if (!address) {
      throw new SignatureVerificationError('Failed to get gaia address for verification of: '
                                           + `${path}`)
    }
    let sigObject
    try {
      sigObject = JSON.parse(storedContents)
    } catch (err) {
      if (err instanceof SyntaxError) {
        throw new Error('Failed to parse encrypted, signed content JSON. The content may not '
                        + 'be encrypted. If using getFile, try passing'
                        + ' { verify: false, decrypt: false }.')
      } else {
        throw err
      }
    }
    const signature = sigObject.signature
    const signerPublicKey = sigObject.publicKey
    const cipherText = sigObject.cipherText
    const signerAddress = publicKeyToAddress(signerPublicKey)

    if (!signerPublicKey || !cipherText || !signature) {
      throw new SignatureVerificationError(
        'Failed to get signature verification data from file:'
          + ` ${path}`
      )
    } else if (signerAddress !== address) {
      throw new SignatureVerificationError(`Signer pubkey address (${signerAddress}) doesn't`
                                           + ` match gaia address (${address})`)
    } else if (!verifyECDSA(cipherText, signerPublicKey, signature)) {
      throw new SignatureVerificationError('Contents do not match ECDSA signature in file:'
                                           + ` ${path}`)
    } else {
      return caller.decryptContent(cipherText)
    }
  })
}

export type GetFileOptions = {
  decrypt?: boolean,
  verify?: boolean,
  username?: string | null,
  app?: string | null,
  zoneFileLookupURL?: string | null
}

/**
 * Get the app storage bucket URL
 * @param {String} gaiaHubUrl - the gaia hub URL
 * @param {String} appPrivateKey - the app private key used to generate the app address
 * @returns {Promise} That resolves to the URL of the app index file
 * or rejects if it fails
 */
export function getAppBucketUrl(gaiaHubUrl: string, appPrivateKey: string) {
  return getBucketUrl(gaiaHubUrl, appPrivateKey)
}


export { connectToGaiaHub, uploadToGaiaHub, BLOCKSTACK_GAIA_HUB_LABEL }
