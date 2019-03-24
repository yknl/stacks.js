
import bitcoinjs from 'bitcoinjs-lib'
import FormData from 'form-data'
import BN from 'bn.js'
import RIPEMD160 from 'ripemd160'
import { MissingParameterError, RemoteServiceError } from './errors'
import { Logger } from './logger'

export interface UTXO {
  value?: number;
  confirmations?: number;
  tx_hash: string;
  tx_output_n: number;
}

const SATOSHIS_PER_BTC = 1e8
const TX_BROADCAST_SERVICE_ZONE_FILE_ENDPOINT = 'zone-file'
const TX_BROADCAST_SERVICE_REGISTRATION_ENDPOINT = 'registration'
const TX_BROADCAST_SERVICE_TX_ENDPOINT = 'transaction'

export class BitcoinNetwork {
  async broadcastTransaction(transaction: string): Promise<any> {
    throw new Error(`Not implemented, broadcastTransaction(${transaction})`)
  }

  async getBlockHeight(): Promise<number> {
    throw new Error('Not implemented, getBlockHeight()')
  }

  async getTransactionInfo(txid: string): Promise<{block_height: number}> {
    throw new Error(`Not implemented, getTransactionInfo(${txid})`)
  }

  async getNetworkedUTXOs(address: string): Promise<UTXO[]> {
    throw new Error(`Not implemented, getNetworkedUTXOs(${address})`)
  }
}

export class BlockstackNetwork {
  blockstackAPIUrl: string

  broadcastServiceUrl: string

  layer1: any

  DUST_MINIMUM: number

  includeUtxoMap: {[address: string]: UTXO[]}

  excludeUtxoSet: UTXO[]

  btc: BitcoinNetwork

  MAGIC_BYTES: string

  constructor(apiUrl: string, broadcastServiceUrl: string,
              bitcoinAPI: BitcoinNetwork,
              network = bitcoinjs.networks.bitcoin) {
    this.blockstackAPIUrl = apiUrl
    this.broadcastServiceUrl = broadcastServiceUrl
    this.layer1 = network
    this.btc = bitcoinAPI

    this.DUST_MINIMUM = 5500
    this.includeUtxoMap = {}
    this.excludeUtxoSet = []
    this.MAGIC_BYTES = 'id'
  }

  coerceAddress(address: string) {
    const { hash, version } = bitcoinjs.address.fromBase58Check(address)
    const scriptHashes = [bitcoinjs.networks.bitcoin.scriptHash,
                          bitcoinjs.networks.testnet.scriptHash]
    const pubKeyHashes = [bitcoinjs.networks.bitcoin.pubKeyHash,
                          bitcoinjs.networks.testnet.pubKeyHash]
    let coercedVersion
    if (scriptHashes.indexOf(version) >= 0) {
      coercedVersion = this.layer1.scriptHash
    } else if (pubKeyHashes.indexOf(version) >= 0) {
      coercedVersion = this.layer1.pubKeyHash
    } else {
      throw new Error(`Unrecognized address version number ${version} in ${address}`)
    }
    return bitcoinjs.address.toBase58Check(hash, coercedVersion)
  }

  getDefaultBurnAddress() {
    return this.coerceAddress('1111111111111111111114oLvT2')
  }

  /**
   * Get the price of a name via the legacy /v1/prices API endpoint.
   * @param {String} fullyQualifiedName the name to query
   * @return {Promise} a promise to an Object with { units: String, amount: BigInteger }
   * @private
   */
  async getNamePriceV1(fullyQualifiedName: string): Promise<{units: string; amount: BN}> {
    // legacy code path
    const resp = await fetch(`${this.blockstackAPIUrl}/v1/prices/names/${fullyQualifiedName}`)
    if (!resp.ok) {
      throw new Error(`Failed to query name price for ${fullyQualifiedName}`)
    }
    const respJson = await resp.json()
    const namePrice = respJson.name_price
    if (!namePrice || !namePrice.satoshis) {
      throw new Error(`Failed to get price for ${fullyQualifiedName}. Does the namespace exist?`)
    }
    if (namePrice.satoshis < this.DUST_MINIMUM) {
      namePrice.satoshis = this.DUST_MINIMUM
    }
    const result = {
      units: 'BTC',
      amount: new BN(String(namePrice.satoshis))
    }
    return result
  }

  /**
   * Get the price of a namespace via the legacy /v1/prices API endpoint.
   * @param {String} namespaceID the namespace to query
   * @return {Promise} a promise to an Object with { units: String, amount: BigInteger }
   * @private
   */
  async getNamespacePriceV1(namespaceID: string): Promise<{units: string; amount: BN}> {
    // legacy code path
    const resp = await fetch(`${this.blockstackAPIUrl}/v1/prices/namespaces/${namespaceID}`)
    if (!resp.ok) {
      throw new Error(`Failed to query name price for ${namespaceID}`)
    }
    const namespacePrice = await resp.json()
    if (!namespacePrice || !namespacePrice.satoshis) {
      throw new Error(`Failed to get price for ${namespaceID}`)
    }
    if (namespacePrice.satoshis < this.DUST_MINIMUM) {
      namespacePrice.satoshis = this.DUST_MINIMUM
    }
    const result = {
      units: 'BTC',
      amount: new BN(String(namespacePrice.satoshis))
    }
    return result
  }
  
  /**
   * Get the price of a name via the /v2/prices API endpoint.
   * @param {String} fullyQualifiedName the name to query
   * @return {Promise} a promise to an Object with { units: String, amount: BigInteger }
   * @private
   */
  async getNamePriceV2(fullyQualifiedName: string): Promise<{units: string; amount: BN}> {
    const resp = await fetch(`${this.blockstackAPIUrl}/v2/prices/names/${fullyQualifiedName}`)
    if (resp.status !== 200) {
      // old core node 
      throw new Error('The upstream node does not handle the /v2/ price namespace')
    }
    const respJson = await resp.json()
    const namePrice = respJson.name_price
    if (!namePrice) {
      throw new Error(`Failed to get price for ${fullyQualifiedName}. Does the namespace exist?`)
    }
    const result = {
      units: namePrice.units,
      amount: new BN(namePrice.amount)
    }
    if (namePrice.units === 'BTC') {
      // must be at least dust-minimum
      const dustMin = new BN(String(this.DUST_MINIMUM))
      if (result.amount.ucmp(dustMin) < 0) {
        result.amount = dustMin
      }
    }
    return result
  }

  /**
   * Get the price of a namespace via the /v2/prices API endpoint.
   * @param {String} namespaceID the namespace to query
   * @return {Promise} a promise to an Object with { units: String, amount: BigInteger }
   * @private
   */
  async getNamespacePriceV2(namespaceID: string): Promise<{units: string; amount: BN}> {
    const resp = await fetch(`${this.blockstackAPIUrl}/v2/prices/namespaces/${namespaceID}`)
    if (resp.status !== 200) {
      // old core node 
      throw new Error('The upstream node does not handle the /v2/ price namespace')
    }
    const namespacePrice = await resp.json()
    if (!namespacePrice) {
      throw new Error(`Failed to get price for ${namespaceID}`)
    }
    const result = {
      units: namespacePrice.units,
      amount: new BN(namespacePrice.amount)
    }
    if (namespacePrice.units === 'BTC') {
      // must be at least dust-minimum
      const dustMin = new BN(String(this.DUST_MINIMUM))
      if (result.amount.ucmp(dustMin) < 0) {
        result.amount = dustMin
      }
    }
    return result
  }

  /**
   * Get the price of a name.
   * @param {String} fullyQualifiedName the name to query
   * @return {Promise} a promise to an Object with { units: String, amount: BigInteger }, where
   *   .units encodes the cryptocurrency units to pay (e.g. BTC, STACKS), and
   *   .amount encodes the number of units, in the smallest denominiated amount
   *   (e.g. if .units is BTC, .amount will be satoshis; if .units is STACKS, 
   *   .amount will be microStacks)
   */
  async getNamePrice(fullyQualifiedName: string): Promise<{units: string; amount: BN}> {
    // handle v1 or v2 
    try {
      return await this.getNamePriceV2(fullyQualifiedName)
    } catch (e) {
      return this.getNamePriceV1(fullyQualifiedName)
    }
  }

  /**
   * Get the price of a namespace
   * @param {String} namespaceID the namespace to query
   * @return {Promise} a promise to an Object with { units: String, amount: BigInteger }, where
   *   .units encodes the cryptocurrency units to pay (e.g. BTC, STACKS), and
   *   .amount encodes the number of units, in the smallest denominiated amount
   *   (e.g. if .units is BTC, .amount will be satoshis; if .units is STACKS, 
   *   .amount will be microStacks)
   */
  async getNamespacePrice(namespaceID: string): Promise<{units: string; amount: BN}> {
    // handle v1 or v2 
    try {
      return await this.getNamespacePriceV2(namespaceID)
    } catch (e) {
      return this.getNamespacePriceV1(namespaceID)
    }
  }

  /**
   * How many blocks can pass between a name expiring and the name being able to be
   * re-registered by a different owner?
   * @param {string} fullyQualifiedName unused
   * @return {Promise} a promise to the number of blocks
   */
  /* eslint-disable-next-line */
  getGracePeriod(fullyQualifiedName?: string) {
    return Promise.resolve(5000)
  }

  /**
   * Get the names -- both on-chain and off-chain -- owned by an address.
   * @param {String} address the blockchain address (the hash of the owner public key)
   * @return {Promise} a promise that resolves to a list of names (Strings)
   */
  async getNamesOwned(address: string): Promise<string[]> {
    const networkAddress = this.coerceAddress(address)
    const resp = await fetch(`${this.blockstackAPIUrl}/v1/addresses/bitcoin/${networkAddress}`)
    const obj = await resp.json()
    return obj.names
  }

  /**
   * Get the blockchain address to which a name's registration fee must be sent
   * (the address will depend on the namespace in which it is registered.)
   * @param {String} namespace the namespace ID
   * @return {Promise} a promise that resolves to an address (String)
   */
  async getNamespaceBurnAddress(namespace: string) {
    const [resp, blockHeight] = await Promise.all([
      fetch(`${this.blockstackAPIUrl}/v1/namespaces/${namespace}`),
      this.getBlockHeight()
    ])
    if (resp.status === 404) {
      throw new Error(`No such namespace '${namespace}'`)
    }
    const namespaceInfo = await resp.json()
    let address = this.getDefaultBurnAddress()
    if (namespaceInfo.version === 2) {
      // pay-to-namespace-creator if this namespace is less than 1 year old
      if (namespaceInfo.reveal_block + 52595 >= blockHeight) {
        address = namespaceInfo.address
      }
    }
    return this.coerceAddress(address)
  }

  /**
   * Get WHOIS-like information for a name, including the address that owns it,
   * the block at which it expires, and the zone file anchored to it (if available).
   * @param {String} fullyQualifiedName the name to query.  Can be on-chain of off-chain.
   * @return {Promise} a promise that resolves to the WHOIS-like information 
   */
  async getNameInfo(fullyQualifiedName: string) {
    Logger.debug(this.blockstackAPIUrl)
    const nameLookupURL = `${this.blockstackAPIUrl}/v1/names/${fullyQualifiedName}`
    const resp = await fetch(nameLookupURL)
    if (resp.status === 404) {
      throw new Error('Name not found')
    } else if (resp.status !== 200) {
      throw new Error(`Bad response status: ${resp.status}`)
    }
    const nameInfo = await resp.json()
    Logger.debug(`nameInfo: ${JSON.stringify(nameInfo)}`)
    // the returned address _should_ be in the correct network ---
    //  blockstackd gets into trouble because it tries to coerce back to mainnet
    //  and the regtest transaction generation libraries want to use testnet addresses
    if (nameInfo.address) {
      return Object.assign({}, nameInfo, { address: this.coerceAddress(nameInfo.address) })
    } else {
      return nameInfo
    }
  }

  /**
   * Get the pricing parameters and creation history of a namespace.
   * @param {String} namespaceID the namespace to query
   * @return {Promise} a promise that resolves to the namespace information.
   */
  async getNamespaceInfo(namespaceID: string) {
    const resp = await fetch(`${this.blockstackAPIUrl}/v1/namespaces/${namespaceID}`)
    if (resp.status === 404) {
      throw new Error('Namespace not found')
    } else if (resp.status !== 200) {
      throw new Error(`Bad response status: ${resp.status}`)
    }
    const namespaceInfo = await resp.json()
    // the returned address _should_ be in the correct network ---
    //  blockstackd gets into trouble because it tries to coerce back to mainnet
    //  and the regtest transaction generation libraries want to use testnet addresses
    if (namespaceInfo.address && namespaceInfo.recipient_address) {
      return Object.assign({}, namespaceInfo, {
        address: this.coerceAddress(namespaceInfo.address),
        recipient_address: this.coerceAddress(namespaceInfo.recipient_address)
      })
    } else {
      return namespaceInfo
    }
  }

  /**
   * Get a zone file, given its hash.  Throws an exception if the zone file
   * obtained does not match the hash.
   * @param {String} zonefileHash the ripemd160(sha256) hash of the zone file
   * @return {Promise} a promise that resolves to the zone file's text
   */
  async getZonefile(zonefileHash: string) {
    const resp = await fetch(`${this.blockstackAPIUrl}/v1/zonefiles/${zonefileHash}`)
    if (resp.status !== 200) {
      throw new Error(`Bad response status: ${resp.status}`)
    }
    const body = await resp.text()
    const sha256 = bitcoinjs.crypto.sha256(Buffer.from(body))
    const h = (new RIPEMD160()).update(sha256).digest('hex')
    if (h !== zonefileHash) {
      throw new Error(`Zone file contents hash to ${h}, not ${zonefileHash}`)
    }
    return body
  }

  /**
   * Get the status of an account for a particular token holding.  This includes its total number of
   * expenditures and credits, lockup times, last txid, and so on.
   * @param {String} address the account
   * @param {String} tokenType the token type to query
   * @return {Promise} a promise that resolves to an object representing the state of the account
   *   for this token
   */
  async getAccountStatus(address: string, tokenType: string) {
    const resp = await fetch(`${this.blockstackAPIUrl}/v1/accounts/${address}/${tokenType}/status`)
    if (resp.status === 404) {
      throw new Error('Account not found')
    } else if (resp.status !== 200) {
      throw new Error(`Bad response status: ${resp.status}`)
    }
    const accountStatus = await resp.json()
    // coerce all addresses, and convert credit/debit to biginteger
    const formattedStatus = Object.assign({}, accountStatus, {
      address: this.coerceAddress(accountStatus.address),
      debit_value: new BN(String(accountStatus.debit_value)),
      credit_value: new BN(String(accountStatus.credit_value))
    })
    return formattedStatus
  }
  
  
  /**
   * Get a page of an account's transaction history.
   * @param {String} address the account's address
   * @param {number} page the page number.  Page 0 is the most recent transactions
   * @return {Promise} a promise that resolves to an Array of Objects, where each Object encodes
   *   states of the account at various block heights (e.g. prior balances, txids, etc)
   */
  async getAccountHistoryPage(
    address: string,
    page: number
  ): Promise<any[]> {
    const url = `${this.blockstackAPIUrl}/v1/accounts/${address}/history?page=${page}`
    const resp = await fetch(url)
    if (resp.status === 404) {
      throw new Error('Account not found')
    } else if (resp.status !== 200) {
      throw new Error(`Bad response status: ${resp.status}`)
    }
    const historyList: {
      address: any; 
      debit_value: any; 
      credit_value: any;
    }[] & { error: any } = await resp.json()

    if (historyList.error) {
      throw new Error(`Unable to get account history page: ${historyList.error}`)
    }
    // coerse all addresses and convert to bigint
    return historyList.map((histEntry) => {
      histEntry.address = this.coerceAddress(histEntry.address)
      histEntry.debit_value = new BN(String(histEntry.debit_value))
      histEntry.credit_value = new BN(String(histEntry.credit_value))
      return histEntry
    })
  }

  /**
   * Get the state(s) of an account at a particular block height.  This includes the state of the
   * account beginning with this block's transactions, as well as all of the states the account
   * passed through when this block was processed (if any).
   * @param {String} address the account's address
   * @param {Integer} blockHeight the block to query
   * @return {Promise} a promise that resolves to an Array of Objects, where each Object encodes
   *   states of the account at this block.
   */
  async getAccountAt(address: string, blockHeight: number): Promise<any[]> {
    const url = `${this.blockstackAPIUrl}/v1/accounts/${address}/history/${blockHeight}`
    const resp = await fetch(url)
    if (resp.status === 404) {
      throw new Error('Account not found')
    } else if (resp.status !== 200) {
      throw new Error(`Bad response status: ${resp.status}`)
    }
    const historyList: {
      address: any; 
      debit_value: any; 
      credit_value: any;
    }[] & { error: any } = await resp.json()

    if (historyList.error) {
      throw new Error(`Unable to get historic account state: ${historyList.error}`)
    }
    // coerce all addresses 
    return historyList.map((histEntry) => {
      histEntry.address = this.coerceAddress(histEntry.address)
      histEntry.debit_value = new BN(String(histEntry.debit_value))
      histEntry.credit_value = new BN(String(histEntry.credit_value))
      return histEntry
    })
  }

  /**
   * Get the set of token types that this account owns
   * @param {String} address the account's address
   * @return {Promise} a promise that resolves to an Array of Strings, where each item encodes the 
   *   type of token this account holds (excluding the underlying blockchain's tokens)
   */
  async getAccountTokens(address: string): Promise<string[]> {
    const resp = await fetch(`${this.blockstackAPIUrl}/v1/accounts/${address}/tokens`)
    if (resp.status === 404) {
      throw new Error('Account not found')
    } else if (resp.status !== 200) {
      throw new Error(`Bad response status: ${resp.status}`)
    }
    const tokenList = await resp.json()
    if (tokenList.error) {
      throw new Error(`Unable to get token list: ${tokenList.error}`)
    }
    return tokenList
  }

  /**
   * Get the number of tokens owned by an account.  If the account does not exist or has no
   * tokens of this type, then 0 will be returned.
   * @param {String} address the account's address
   * @param {String} tokenType the type of token to query.
   * @return {Promise} a promise that resolves to a BigInteger that encodes the number of tokens 
   *   held by this account.
   */
  async getAccountBalance(address: string, tokenType: string): Promise<BN> {
    const resp = await fetch(`${this.blockstackAPIUrl}/v1/accounts/${address}/${tokenType}/balance`)
    if (resp.status === 404) {
      // talking to an older blockstack core node without the accounts API
      return new BN('0')
    } else if (resp.status !== 200) {
      throw new Error(`Bad response status: ${resp.status}`)
    }
    const tokenBalance = await resp.json()
    if (tokenBalance.error) {
      throw new Error(`Unable to get account balance: ${tokenBalance.error}`)
    }
    let balance = '0'
    if (tokenBalance && tokenBalance.balance) {
      balance = tokenBalance.balance
    }
    return new BN(balance)
  }

  /**
   * Performs a POST request to the given URL
   * @param  {String} endpoint  the name of
   * @param  {String} body [description]
   * @return {Promise<Object|Error>} Returns a `Promise` that resolves to the object requested.
   * In the event of an error, it rejects with:
   * * a `RemoteServiceError` if there is a problem
   * with the transaction broadcast service
   * * `MissingParameterError` if you call the function without a required
   * parameter
   *
   * @private
   */
  async broadcastServiceFetchHelper(endpoint: string, body: any): Promise<any|Error> {
    const requestHeaders = {
      Accept: 'application/json',
      'Content-Type': 'application/json'
    }

    const options = {
      method: 'POST',
      headers: requestHeaders,
      body: JSON.stringify(body)
    }

    const url = `${this.broadcastServiceUrl}/v1/broadcast/${endpoint}`
    const response = await fetch(url, options)
    if (response.ok) {
      return response.json()
    } else {
      throw new RemoteServiceError(response)
    }
  }

  /**
  * Broadcasts a signed bitcoin transaction to the network optionally waiting to broadcast the
  * transaction until a second transaction has a certain number of confirmations.
  *
  * @param  {string} transaction the hex-encoded transaction to broadcast
  * @param  {string} transactionToWatch the hex transaction id of the transaction to watch for
  * the specified number of confirmations before broadcasting the `transaction`
  * @param  {number} confirmations the number of confirmations `transactionToWatch` must have
  * before broadcasting `transaction`.
  * @return {Promise<Object|Error>} Returns a Promise that resolves to an object with a
  * `transaction_hash` key containing the transaction hash of the broadcasted transaction.
  *
  * In the event of an error, it rejects with:
  * * a `RemoteServiceError` if there is a problem
  *   with the transaction broadcast service
  * * `MissingParameterError` if you call the function without a required
  *   parameter
  * @private
  */
  async broadcastTransaction(
    transaction: string,
    transactionToWatch: string = null,
    confirmations: number = 6
  ) {
    if (!transaction) {
      throw new MissingParameterError('transaction')
    }

    if (!confirmations && confirmations !== 0) {
      throw new MissingParameterError('confirmations')
    }

    if (transactionToWatch === null) {
      return this.btc.broadcastTransaction(transaction)
    } else {
      /*
       * POST /v1/broadcast/transaction
       * Request body:
       * JSON.stringify({
       *  transaction,
       *  transactionToWatch,
       *  confirmations
       * })
       */
      const endpoint = TX_BROADCAST_SERVICE_TX_ENDPOINT

      const requestBody = {
        transaction,
        transactionToWatch,
        confirmations
      }

      return this.broadcastServiceFetchHelper(endpoint, requestBody)
    }
  }

  /**
   * Broadcasts a zone file to the Atlas network via the transaction broadcast service.
   *
   * @param  {String} zoneFile the zone file to be broadcast to the Atlas network
   * @param  {String} transactionToWatch the hex transaction id of the transaction
   * to watch for confirmation before broadcasting the zone file to the Atlas network
   * @return {Promise<Object|Error>} Returns a Promise that resolves to an object with a
   * `transaction_hash` key containing the transaction hash of the broadcasted transaction.
   *
   * In the event of an error, it rejects with:
   * * a `RemoteServiceError` if there is a problem
   *   with the transaction broadcast service
   * * `MissingParameterError` if you call the function without a required
   *   parameter
   * @private
   */
  async broadcastZoneFile(
    zoneFile?: string,
    transactionToWatch: string = null) {
    if (!zoneFile) {
      throw new MissingParameterError('zoneFile')
    }

    // TODO: validate zonefile

    if (transactionToWatch) {
      // broadcast via transaction broadcast service

      /*
       * POST /v1/broadcast/zone-file
       * Request body:
       * JSON.stringify({
       *  zoneFile,
       *  transactionToWatch
       * })
       */

      const requestBody = {
        zoneFile,
        transactionToWatch
      }

      const endpoint = TX_BROADCAST_SERVICE_ZONE_FILE_ENDPOINT
      return this.broadcastServiceFetchHelper(endpoint, requestBody)
    } else {
      // broadcast via core endpoint
      // zone file is two words but core's api treats it as one word 'zonefile'
      const requestBody = { zonefile: zoneFile }
      const resp = await fetch(`${this.blockstackAPIUrl}/v1/zonefile/`, {
        method: 'POST',
        body: JSON.stringify(requestBody),
        headers: {
          'Content-Type': 'application/json'
        }
      })
      const json = resp.json()
      const respObj = await json
      if (respObj.hasOwnProperty('error')) {
        throw new RemoteServiceError(resp)
      }
      return respObj.servers
    }
  }

  /**
   * Sends the preorder and registration transactions and zone file
   * for a Blockstack name registration
   * along with the to the transaction broadcast service.
   *
   * The transaction broadcast:
   *
   * * immediately broadcasts the preorder transaction
   * * broadcasts the register transactions after the preorder transaction
   * has an appropriate number of confirmations
   * * broadcasts the zone file to the Atlas network after the register transaction
   * has an appropriate number of confirmations
   *
   * @param  {String} preorderTransaction the hex-encoded, signed preorder transaction generated
   * using the `makePreorder` function
   * @param  {String} registerTransaction the hex-encoded, signed register transaction generated
   * using the `makeRegister` function
   * @param  {String} zoneFile the zone file to be broadcast to the Atlas network
   * @return {Promise<Object|Error>} Returns a Promise that resolves to an object with a
   * `transaction_hash` key containing the transaction hash of the broadcasted transaction.
   *
   * In the event of an error, it rejects with:
   * * a `RemoteServiceError` if there is a problem
   *   with the transaction broadcast service
   * * `MissingParameterError` if you call the function without a required
   *   parameter
   * @private
   */
  async broadcastNameRegistration(
    preorderTransaction: string,
    registerTransaction: string,
    zoneFile: string) {
    /*
       * POST /v1/broadcast/registration
       * Request body:
       * JSON.stringify({
       * preorderTransaction,
       * registerTransaction,
       * zoneFile
       * })
       */

    if (!preorderTransaction) {
      throw new MissingParameterError('preorderTransaction')
    }

    if (!registerTransaction) {
      throw new MissingParameterError('registerTransaction')
    }

    if (!zoneFile) {
      throw new MissingParameterError('zoneFile')
    }

    const requestBody = {
      preorderTransaction,
      registerTransaction,
      zoneFile
    }

    const endpoint = TX_BROADCAST_SERVICE_REGISTRATION_ENDPOINT

    return this.broadcastServiceFetchHelper(endpoint, requestBody)
  }

  async getFeeRate(): Promise<number> {
    const resp = await fetch('https://bitcoinfees.earn.com/api/v1/fees/recommended')
    const rates = await resp.json()
    return Math.floor(rates.fastestFee)
  }

  countDustOutputs() {
    throw new Error('Not implemented.')
  }

  async getUTXOs(address: string): Promise<UTXO[]> {
    const networkedUTXOs = await this.getNetworkedUTXOs(address)
    let returnSet = networkedUTXOs.concat()
    if (this.includeUtxoMap.hasOwnProperty(address)) {
      returnSet = networkedUTXOs.concat(this.includeUtxoMap[address])
    }
    // aaron: I am *well* aware this is O(n)*O(m) runtime
    //    however, clients should clear the exclude set periodically
    const excludeSet = this.excludeUtxoSet
    returnSet = returnSet.filter((utxo) => {
      const inExcludeSet = excludeSet.reduce((inSet, utxoToCheck) => inSet 
        || (utxoToCheck.tx_hash === utxo.tx_hash
        && utxoToCheck.tx_output_n === utxo.tx_output_n), false)
      return !inExcludeSet
    })
    return returnSet
  }

  /**
   * This will modify the network's utxo set to include UTXOs
   *  from the given transaction and exclude UTXOs *spent* in
   *  that transaction
   * @param {String} txHex - the hex-encoded transaction to use
   * @return {void} no return value, this modifies the UTXO config state
   * @private
   */
  modifyUTXOSetFrom(txHex: string) {
    const tx = bitcoinjs.Transaction.fromHex(txHex)

    const excludeSet: UTXO[] = this.excludeUtxoSet.concat()

    tx.ins.forEach((utxoUsed) => {
      const reverseHash = Buffer.from(utxoUsed.hash)
      reverseHash.reverse()
      excludeSet.push({
        tx_hash: reverseHash.toString('hex'),
        tx_output_n: utxoUsed.index
      })
    })

    this.excludeUtxoSet = excludeSet

    const txHash = Buffer.from(tx.getHash().reverse()).toString('hex')
    tx.outs.forEach((utxoCreated, txOutputN) => {
      const isNullData = function isNullData(script: Buffer) {
        try {
          bitcoinjs.payments.embed({ output: script }, { validate: true })
          return true
        } catch (_) {
          return false
        }
      }
      if (isNullData(utxoCreated.script)) {
        return
      }
      const address = bitcoinjs.address.fromOutputScript(
        utxoCreated.script, this.layer1
      )

      let includeSet: UTXO[] = []
      if (this.includeUtxoMap.hasOwnProperty(address)) {
        includeSet = includeSet.concat(this.includeUtxoMap[address])
      }

      includeSet.push({
        tx_hash: txHash,
        confirmations: 0,
        value: utxoCreated.value,
        tx_output_n: txOutputN
      })
      this.includeUtxoMap[address] = includeSet
    })
  }

  resetUTXOs(address: string) {
    delete this.includeUtxoMap[address]
    this.excludeUtxoSet = []
  }

  async getConsensusHash() {
    const resp = await fetch(`${this.blockstackAPIUrl}/v1/blockchains/bitcoin/consensus`)
    const x = await resp.json()
    return x.consensus_hash
  }

  async getTransactionInfo(txHash: string): Promise<{block_height: number}> {
    return this.btc.getTransactionInfo(txHash)
  }

  async getBlockHeight() {
    return this.btc.getBlockHeight()
  }

  async getNetworkedUTXOs(address: string): Promise<UTXO[]> {
    return this.btc.getNetworkedUTXOs(address)
  }
}

export class LocalRegtest extends BlockstackNetwork {
  constructor(apiUrl: string, broadcastServiceUrl: string,
              bitcoinAPI: BitcoinNetwork) {
    super(apiUrl, broadcastServiceUrl, bitcoinAPI, bitcoinjs.networks.testnet)
  }

  async getFeeRate(): Promise<number> {
    return Promise.resolve(Math.floor(0.00001000 * SATOSHIS_PER_BTC))
  }
}

export class BitcoindAPI extends BitcoinNetwork {
  bitcoindUrl: string

  bitcoindCredentials: {username: string; password: string}

  importedBefore: any

  constructor(bitcoindUrl: string, bitcoindCredentials: {username: string; password: string}) {
    super()
    this.bitcoindUrl = bitcoindUrl
    this.bitcoindCredentials = bitcoindCredentials
    this.importedBefore = {}
  }

  async broadcastTransaction(transaction: string) {
    const jsonRPC = {
      jsonrpc: '1.0',
      method: 'sendrawtransaction',
      params: [transaction]
    }
    const authString = Buffer
      .from(`${this.bitcoindCredentials.username}:${this.bitcoindCredentials.password}`)
      .toString('base64')
    const headers = { Authorization: `Basic ${authString}` }
    const resp = await fetch(this.bitcoindUrl, {
      method: 'POST',
      body: JSON.stringify(jsonRPC),
      headers
    })
    const respObj = await resp.json()
    return respObj.result
  }

  async getBlockHeight() {
    const jsonRPC = {
      jsonrpc: '1.0',
      method: 'getblockcount'
    }
    const authString = Buffer
      .from(`${this.bitcoindCredentials.username}:${this.bitcoindCredentials.password}`)
      .toString('base64')
    const headers = { Authorization: `Basic ${authString}` }
    const resp = await fetch(this.bitcoindUrl, {
      method: 'POST',
      body: JSON.stringify(jsonRPC),
      headers
    })
    const respObj = await resp.json()
    return respObj.result
  }

  async getTransactionInfo(txHash: string): Promise<{block_height: number}> {
    const jsonRPC = {
      jsonrpc: '1.0',
      method: 'gettransaction',
      params: [txHash]
    }
    const authString = Buffer
      .from(`${this.bitcoindCredentials.username}:${this.bitcoindCredentials.password}`)
      .toString('base64')
    const headers = { Authorization: `Basic ${authString}` }
    const resp = await fetch(this.bitcoindUrl, {
      method: 'POST',
      body: JSON.stringify(jsonRPC),
      headers
    })
    const respObj = await resp.json()
    const txInfo = respObj.result
    const blockhash = txInfo.blockhash
    const jsonRPCBlock = {
      jsonrpc: '1.0',
      method: 'getblockheader',
      params: [blockhash]
    }
    headers.Authorization = `Basic ${authString}`
    const resp_1 = await fetch(this.bitcoindUrl, {
      method: 'POST',
      body: JSON.stringify(jsonRPCBlock),
      headers
    })
    const respObj_1 = await resp_1.json()
    if (!respObj_1 || !respObj_1.result) {
      // unconfirmed 
      throw new Error('Unconfirmed transaction')
    } else {
      return { block_height: respObj_1.result.height }
    }
  }

  async getNetworkedUTXOs(address: string): Promise<UTXO[]> {
    const jsonRPCImport = {
      jsonrpc: '1.0',
      method: 'importaddress',
      params: [address]
    }
    const jsonRPCUnspent = {
      jsonrpc: '1.0',
      method: 'listunspent',
      params: [0, 9999999, [address]]
    }
    const authString = Buffer
      .from(`${this.bitcoindCredentials.username}:${this.bitcoindCredentials.password}`)
      .toString('base64')
    const headers = { Authorization: `Basic ${authString}` }

    if (!this.importedBefore[address]) {
      await fetch(this.bitcoindUrl, {
        method: 'POST',
        body: JSON.stringify(jsonRPCImport),
        headers
      })
      this.importedBefore[address] = true
    }

    const resp = await fetch(this.bitcoindUrl, {
      method: 'POST',
      body: JSON.stringify(jsonRPCUnspent),
      headers
    })
    const x = await resp.json()
    const utxos = x.result
    return utxos.map((x_1: any) => ({
      value: Math.round(x_1.amount * SATOSHIS_PER_BTC),
      confirmations: x_1.confirmations,
      tx_hash: x_1.txid,
      tx_output_n: x_1.vout
    }))
  }
}

export class InsightClient extends BitcoinNetwork {
  apiUrl: string

  constructor(insightUrl: string = 'https://utxo.technofractal.com/') {
    super()
    this.apiUrl = insightUrl
  }

  async broadcastTransaction(transaction: string) {
    const jsonData = { rawtx: transaction }
    const resp = await fetch(`${this.apiUrl}/tx/send`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(jsonData)
    })
    return resp.json()
  }

  async getBlockHeight() {
    const resp = await fetch(`${this.apiUrl}/status`)
    const status = await resp.json()
    return status.blocks
  }

  async getTransactionInfo(txHash: string): Promise<{block_height: number}> {
    const resp = await fetch(`${this.apiUrl}/tx/${txHash}`)
    const transactionInfo = await resp.json()
    if (transactionInfo.error) {
      throw new Error(`Error finding transaction: ${transactionInfo.error}`)
    }
    const resp_1 = await fetch(`${this.apiUrl}/block/${transactionInfo.blockHash}`)
    const blockInfo = await resp_1.json()
    return ({ block_height: blockInfo.height })
  }

  async getNetworkedUTXOs(address: string): Promise<UTXO[]> {
    const resp = await fetch(`${this.apiUrl}/addr/${address}/utxo`)
    const utxos = await resp.json()
    return utxos.map((x: any) => ({
      value: x.satoshis,
      confirmations: x.confirmations,
      tx_hash: x.txid,
      tx_output_n: x.vout
    }))
  }
}

export class BlockchainInfoApi extends BitcoinNetwork {
  utxoProviderUrl: string

  constructor(blockchainInfoUrl: string = 'https://blockchain.info') {
    super()
    this.utxoProviderUrl = blockchainInfoUrl
  }

  async getBlockHeight() {
    const resp = await fetch(`${this.utxoProviderUrl}/latestblock?cors=true`)
    const blockObj = await resp.json()
    return blockObj.height
  }

  async getNetworkedUTXOs(address: string): Promise<UTXO[]> {
    const resp = await fetch(`${this.utxoProviderUrl}/unspent?format=json&active=${address}&cors=true`)
    if (resp.status === 500) {
      Logger.debug('UTXO provider 500 usually means no UTXOs: returning []')
      return []
    }
    const utxoJSON = await resp.json()
    const utxoList = utxoJSON.unspent_outputs
    return utxoList.map((utxo: any) => {
      const utxoOut: UTXO = {
        value: utxo.value,
        tx_output_n: utxo.tx_output_n,
        confirmations: utxo.confirmations,
        tx_hash: utxo.tx_hash_big_endian
      }
      return utxoOut
    })
  }

  async getTransactionInfo(txHash: string): Promise<{block_height: number}> {
    const resp = await fetch(`${this.utxoProviderUrl}/rawtx/${txHash}?cors=true`)
    if (resp.status !== 200) {
      throw new Error(`Could not lookup transaction info for '${txHash}'. Server error.`)
    }
    const respObj = await resp.json()
    return ({ block_height: respObj.block_height })
  }

  async broadcastTransaction(transaction: string) {
    const form = new FormData()
    form.append('tx', transaction)
    const resp = await fetch(`${this.utxoProviderUrl}/pushtx?cors=true`, {
      method: 'POST',
      body: (form as any)
    })
    const respText = await resp.text()
    if (respText.toLowerCase().indexOf('transaction submitted') >= 0) {
      const txHash = Buffer.from(bitcoinjs.Transaction.fromHex(transaction)
        .getHash()
        .reverse()).toString('hex') // big_endian
      return txHash
    } else {
      throw new RemoteServiceError(resp, `Broadcast transaction failed with message: ${respText}`)
    }
  }
}

const LOCAL_REGTEST = new LocalRegtest(
  'http://localhost:16268',
  'http://localhost:16269',
  new BitcoindAPI('http://localhost:18332/',
                  { username: 'blockstack', password: 'blockstacksystem' })
)

const MAINNET_DEFAULT = new BlockstackNetwork(
  'https://core.blockstack.org',
  'https://broadcast.blockstack.org',
  new BlockchainInfoApi()
)

export const network = {
  BlockstackNetwork,
  LocalRegtest,
  BlockchainInfoApi,
  BitcoindAPI,
  InsightClient,
  defaults: { LOCAL_REGTEST, MAINNET_DEFAULT }
}
