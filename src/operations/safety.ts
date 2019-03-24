import { config } from '../config'

async function isNameValid(fullyQualifiedName: string = '') {
  const NAME_PART_RULE = /^[a-z0-9\-_+]+$/
  const LENGTH_MAX_NAME = 37

  if (!fullyQualifiedName
      || fullyQualifiedName.length > LENGTH_MAX_NAME) {
    return false
  }
  const nameParts = fullyQualifiedName.split('.')
  if (nameParts.length !== 2) {
    return false
  }
  return nameParts.reduce(
    (agg, namePart) => {
      if (!agg) {
        return false
      } else {
        return NAME_PART_RULE.test(namePart)
      }
    }, true
  )
}

async function isNamespaceValid(namespaceID: string) {
  const NAMESPACE_RULE = /^[a-z0-9\-_]{1,19}$/
  return namespaceID.match(NAMESPACE_RULE) !== null
}

async function isNameAvailable(fullyQualifiedName: string) {
  try {
    await config.network.getNameInfo(fullyQualifiedName)
    return false
  } catch (e) {
    if (e.message === 'Name not found') {
      return true
    } else {
      throw e
    }
  }
}

async function isNamespaceAvailable(namespaceID: string) {
  try {
    await config.network.getNamespaceInfo(namespaceID)
    return false
  } catch (e) {
    if (e.message === 'Namespace not found') {
      return true
    } else {
      throw e
    }
  }
}       

async function ownsName(fullyQualifiedName: string, ownerAddress: string) {
  try {
    const nameInfo = await config.network.getNameInfo(fullyQualifiedName)
    return nameInfo.address === ownerAddress
  } catch (e) {
    if (e.message === 'Name not found') {
      return false
    } else {
      throw e
    }
  }
}

async function revealedNamespace(namespaceID: string, revealAddress: string) {
  try {
    const namespaceInfo = await config.network.getNamespaceInfo(namespaceID)
    return namespaceInfo.recipient_address === revealAddress
  } catch (e) {
    if (e.message === 'Namespace not found') {
      return false
    } else {
      throw e
    }
  }
}

async function namespaceIsReady(namespaceID: string) {
  try {
    const namespaceInfo = await config.network.getNamespaceInfo(namespaceID)
    return namespaceInfo.ready
  } catch (e) {
    if (e.message === 'Namespace not found') {
      return false
    } else {
      throw e
    }
  }
}

async function namespaceIsRevealed(namespaceID: string) {
  try {
    const namespaceInfo = await config.network.getNamespaceInfo(namespaceID)
    return !namespaceInfo.ready
  } catch (e) {
    if (e.message === 'Namespace not found') {
      return false
    } else {
      throw e
    }
  }
}

async function isInGracePeriod(fullyQualifiedName: string) {
  const network = config.network
  try {
    const [nameInfo, blockHeight, gracePeriod] = await Promise.all([
      network.getNameInfo(fullyQualifiedName),
      network.getBlockHeight(),
      network.getGracePeriod(fullyQualifiedName)
    ])
    const expiresAt = nameInfo.expire_block
    return (blockHeight >= expiresAt) && (blockHeight < (gracePeriod + expiresAt))
  } catch (e) {
    if (e.message === 'Name not found') {
      return false
    } else {
      throw e
    }
  }
}

async function addressCanReceiveName(address: string) {
  const names = await config.network.getNamesOwned(address)
  const validNames = await Promise.all(names.map(async (name) => isNameValid(name)))
  return validNames.filter(nameValid => nameValid).length < 25
}

async function isAccountSpendable(address: string, tokenType: string, blockHeight: number) {
  const accountStatus = await config.network.getAccountStatus(address, tokenType)
  return accountStatus.transfer_send_block_id >= blockHeight
}

export const safety = {
  addressCanReceiveName,
  isInGracePeriod,
  ownsName,
  isNameAvailable,
  isNameValid,
  isNamespaceValid,
  isNamespaceAvailable,
  revealedNamespace,
  namespaceIsReady,
  namespaceIsRevealed,
  isAccountSpendable
}
