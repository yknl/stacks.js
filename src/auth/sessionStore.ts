
import { SessionData, SessionOptions } from './sessionData'
// import { BLOCKSTACK_GAIA_HUB_LABEL } from '../storage/hub'
import {
  LOCALSTORAGE_SESSION_KEY
} from './authConstants'
import { NoSessionDataError } from '../errors'
// import { Logger } from '../logger'

/** @ignore */
export interface SessionIdentityChangeEvent {
  newIdentity?: string
  oldIdentity?: string
}

/** @ignore */
export interface SessionIdentityChangeCallback {
  (event: SessionIdentityChangeEvent): void
}

/**
 * An abstract class representing the SessionDataStore interface.
 */
export abstract class SessionDataStore {
  constructor(sessionOptions?: SessionOptions) {
    if (sessionOptions) {
      const newSessionData = new SessionData(sessionOptions)
      this.setSessionData(newSessionData)
    }
  }

  abstract getSessionData(): SessionData

  abstract setSessionData(session: SessionData): boolean

  abstract deleteSessionData(): boolean


  protected identityChangeCallback?: SessionIdentityChangeCallback

  protected lastUpdatedIdentity?: string

  get hasIdentityChangeCallback() {
    return !!this.identityChangeCallback
  }

  abstract setSessionIdentityChangeCallback(callback?: SessionIdentityChangeCallback): void;
}

/**
 * Stores session data in the instance of this class.
 * @ignore
 */
export class InstanceDataStore extends SessionDataStore {
  sessionData?: SessionData

  constructor(sessionOptions?: SessionOptions) {
    super(sessionOptions)
    let sessionData: SessionData
    if (!this.sessionData) {
      sessionData = new SessionData({})
      this.setSessionData(sessionData)
    } else {
      sessionData = this.sessionData
    }
    if (sessionData && sessionData.userData && sessionData.userData.identityAddress) {
      this.lastUpdatedIdentity = sessionData.userData.identityAddress
    }
  }

  getSessionData(): SessionData {
    if (!this.sessionData) {
      throw new NoSessionDataError('No session data was found.')
    }
    return this.sessionData
  }

  setSessionData(session: SessionData): boolean {
    this.sessionData = session
    let currentIdentity: string | undefined
    if (session && session.userData && session.userData.identityAddress) {
      currentIdentity = session.userData.identityAddress
    }
    if (this.hasIdentityChangeCallback && this.lastUpdatedIdentity !== currentIdentity) {
      this.identityChangeCallback({
        oldIdentity: this.lastUpdatedIdentity, 
        newIdentity: currentIdentity
      })
    }
    this.lastUpdatedIdentity = currentIdentity
    return true
  }

  deleteSessionData(): boolean {
    this.setSessionData(new SessionData({}))
    return true
  }

  setSessionIdentityChangeCallback(callback?: SessionIdentityChangeCallback): void {
    this.identityChangeCallback = callback
  }
}

/**
 * Stores session data in browser a localStorage entry.
 * @ignore
 */
export class LocalStorageStore extends SessionDataStore {
  readonly key: string

  // sessionStorageEventCallback: (ev: StorageEvent) => void

  // sessionStorageEventCallback = (ev: StorageEvent) => this.sessionStorageEvent(ev)

  constructor(sessionOptions?: SessionOptions) {
    super(sessionOptions)
    if (sessionOptions
      && sessionOptions.storeOptions
      && sessionOptions.storeOptions.localStorageKey
      && (typeof sessionOptions.storeOptions.localStorageKey === 'string')) {
      this.key = sessionOptions.storeOptions.localStorageKey
    } else {
      this.key = LOCALSTORAGE_SESSION_KEY
    }
    // this.sessionStorageEventCallback = (ev) => this.sessionStorageEvent(ev)
    const data = localStorage.getItem(this.key)
    let sessionData: SessionData
    if (!data) {
      sessionData = new SessionData({})
      this.setSessionData(sessionData)
    } else {
      sessionData = SessionData.fromJSON(JSON.parse(data))
    }
    if (sessionData && sessionData.userData && sessionData.userData.identityAddress) {
      this.lastUpdatedIdentity = sessionData.userData.identityAddress
    }
  }

  getSessionData(): SessionData {
    const data = localStorage.getItem(this.key)
    if (!data) {
      throw new NoSessionDataError('No session data was found in localStorage')
    }
    const dataJSON = JSON.parse(data)
    return SessionData.fromJSON(dataJSON)
  }

  setSessionData(session: SessionData): boolean {
    let currentIdentity: string | undefined
    if (session && session.userData && session.userData.identityAddress) {
      currentIdentity = session.userData.identityAddress
    }

    if (this.hasIdentityChangeCallback && this.lastUpdatedIdentity !== currentIdentity) {
      this.identityChangeCallback({
        oldIdentity: this.lastUpdatedIdentity, 
        newIdentity: currentIdentity
      })
    }

    this.lastUpdatedIdentity = currentIdentity
    
    localStorage.setItem(this.key, session.toString())
    return true
  }

  deleteSessionData(): boolean {
    localStorage.removeItem(this.key)
    this.setSessionData(new SessionData({}))
    return true
  }

  private sessionStorageEvent = (ev: StorageEvent) => {
    if (!this.hasIdentityChangeCallback) {
      return
    }
    let currentSessionDataString: string | undefined
    if (ev.key === this.key) {
      currentSessionDataString = ev.newValue
    } else if (ev.key === null) {
      // event key is null if localStorage.clear() is called
      currentSessionDataString = localStorage.getItem(this.key)
    } else {
      return
    }
    let currentIdentity: string | undefined
    if (currentSessionDataString) {
      const sessionData = SessionData.fromJSON(JSON.parse(currentSessionDataString))
      if (sessionData.userData && sessionData.userData.identityAddress) {
        currentIdentity = sessionData.userData.identityAddress
      }
    }
    if (this.lastUpdatedIdentity !== currentIdentity) {
      const updateEvent: SessionIdentityChangeEvent = {
        newIdentity: currentIdentity,
        oldIdentity: this.lastUpdatedIdentity
      }
      this.lastUpdatedIdentity = currentIdentity
      this.identityChangeCallback(updateEvent)
    }
  }

  setSessionIdentityChangeCallback(callback?: SessionIdentityChangeCallback): void {
    // If previously already set, remove listener to avoid multiple invocations.
    if (this.hasIdentityChangeCallback) {
      removeEventListener('storage', this.sessionStorageEvent)
    }
    this.identityChangeCallback = callback
    // if callback is falsey do not register listener
    if (this.sessionStorageEvent) {
      addEventListener('storage', this.sessionStorageEvent)
    }
  }

  // checkForLegacyDataAndMigrate(): Promise<SessionData> {
  //   const legacyTransitKey = localStorage.getItem(BLOCKSTACK_APP_PRIVATE_KEY_LABEL)
  //   const legacyGaiaConfig = localStorage.getItem(BLOCKSTACK_GAIA_HUB_LABEL)
  //   const legacyUserData = localStorage.getItem(BLOCKSTACK_STORAGE_LABEL)
  //
  //
  //   if (legacyTransitKey) {
  //     localStorage.removeItem(BLOCKSTACK_APP_PRIVATE_KEY_LABEL)
  //   }
  //
  //
  //
  // }
}
