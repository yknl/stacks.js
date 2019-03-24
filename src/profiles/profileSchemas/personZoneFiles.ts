// @ts-ignore: Could not find a declaration file for module
import { parseZoneFile } from 'zone-file'

import { Person } from './person'
import { getTokenFileUrl } from '../profileZoneFiles'
import { extractProfile } from '../profileTokens'

export async function resolveZoneFileToPerson(
  zoneFile: any, 
  publicKeyOrAddress: string, 
  callback: (profile: any) => void
): Promise<void> {
  let zoneFileJson = null
  try {
    zoneFileJson = parseZoneFile(zoneFile)
    if (!zoneFileJson.hasOwnProperty('$origin')) {
      zoneFileJson = null
      throw new Error('zone file is missing an origin')
    }
  } catch (e) {
    console.error(e)
  }

  let tokenFileUrl = null
  if (zoneFileJson && Object.keys(zoneFileJson).length > 0) {
    tokenFileUrl = getTokenFileUrl(zoneFileJson)
  } else {
    let profile = null
    try {
      profile = JSON.parse(zoneFile)
      const person = Person.fromLegacyFormat(profile)
      profile = person.profile()
    } catch (error) {
      console.warn(error)
    }
    callback(profile)
    return
  }

  if (tokenFileUrl) {
    try {
      const response = await fetch(tokenFileUrl)
      const responseText = await response.text()
      const responseJson = JSON.parse(responseText)
      const tokenRecords = responseJson
      const token = tokenRecords[0].token
      const profile = extractProfile(token, publicKeyOrAddress)
      callback(profile)
    } catch (error) {
      console.warn(error)
    }
  } else {
    console.warn('Token file url not found')
    callback({})
  }
}
