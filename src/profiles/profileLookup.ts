
import { resolveZoneFileToProfile } from './profileZoneFiles'
import { config } from '../config'

/**
 * Look up a user profile by blockstack ID
 *
 * @param {string} username - The Blockstack ID of the profile to look up
 * @param {string} [zoneFileLookupURL=null] - The URL
 * to use for zonefile lookup. If falsey, lookupProfile will use the
 * blockstack.js getNameInfo function.
 * @returns {Promise} that resolves to a profile object
 */
export async function lookupProfile(
  username: string, zoneFileLookupURL?: string
): Promise<any> {
  if (!username) {
    return Promise.reject()
  }
  let responseJSON: any
  if (zoneFileLookupURL) {
    const url = `${zoneFileLookupURL.replace(/\/$/, '')}/${username}`
    const response = await fetch(url)
    responseJSON = await response.json()
  } else {
    responseJSON = await config.network.getNameInfo(username)
  }
  if (responseJSON.hasOwnProperty('zonefile')
    && responseJSON.hasOwnProperty('address')) {
    return resolveZoneFileToProfile(responseJSON.zonefile, responseJSON.address)
  } else {
    throw new Error('Invalid zonefile lookup response: did not contain `address`'
      + ' or `zonefile` field')
  }
}
