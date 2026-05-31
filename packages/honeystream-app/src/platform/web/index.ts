import sodium from 'libsodium-wrappers'
import createClient from '@honeystream/signal-server/lib/client'
import { waitEvent } from '@honeystream/signal-server/lib/util'

import { NetServer, NetUniqueId } from 'network'
import { ILobbyOptions } from 'platform/types'
import { isP2PHash, isIP, isUrlDomain } from 'utils/network'
import { PeerCoordinator } from 'network/server'
import { initIdentity } from './identity'
import { WebRTCPeerCoordinator } from './rtc-coordinator'
import { NETWORK_TIMEOUT } from 'constants/network'
import { NetworkError, NetworkErrorCode } from '../../network/error'

type HexId = string

export class WebPlatform {
  ready: Promise<void>

  private id!: NetUniqueId
  private server?: NetServer

  constructor() {
    this.ready = initIdentity().then(keyPair => {
      this.id = new NetUniqueId(keyPair.publicKey, keyPair.privateKey)
    })
  }

  getServer() {
    return this.server
  }

  /*
   * Context: Runtime e2e creates and joins private rooms immediately through the WebRTC signal path.
   * Invariant: A host lobby is not advertised as started until its signal room is ready.
   * Options considered: Sleep in e2e, retry guest joins, or expose explicit coordinator readiness.
   * Decision: Await coordinator readiness and close any prior room before replacing ownership.
   * Performance impact: No steady-state cost; startup waits only for existing signal setup work.
   * Memory/lifecycle ownership: WebPlatform owns the active NetServer and closes it before replacement.
   * Failure mode: Signal setup failure closes the partial server and propagates the original error.
   * Validation: Covered by live host/client e2e plus existing runtime and transport tests.
   */
  async createLobby(opts: ILobbyOptions): Promise<void> {
    const coordinators: PeerCoordinator[] = []
    const readyPromises: Promise<void>[] = []

    if (this.server) {
      this.server.close()
      this.server = undefined
    }

    if (opts.p2p) {
      const coordinator = new WebRTCPeerCoordinator({ host: true })
      coordinators.push(coordinator)
      readyPromises.push(coordinator.ready)
    }

    const server = new NetServer({ isHost: true, coordinators })
    this.server = server

    try {
      await Promise.all(readyPromises)
    } catch (error) {
      if (this.server === server) {
        server.close()
        this.server = undefined
      }
      throw error
    }
  }

  private async joinP2PLobby(hash: string): Promise<void> {
    ga('event', { ec: 'session', ea: 'connect', el: 'p2p' })

    if (this.server) {
      this.server.close()
      this.server = undefined
    }

    const coordinator = new WebRTCPeerCoordinator({ host: false, hostId: hash })

    this.server = new NetServer({
      isHost: false,
      coordinators: [coordinator]
    })

    const promises = [
      waitEvent(this.server, 'connect', NETWORK_TIMEOUT),
      waitEvent(this.server, 'error', NETWORK_TIMEOUT)
    ]

    /*
     * Context: Guest joins race connect and error waits through the legacy signal bridge.
     * Invariant: A successful join must not retain timeout handles from losing wait branches.
     * Options considered: Sleep in e2e, shorter global network timeouts, or cancel losing waits.
     * Decision: Always cancel both wait handles after the race settles.
     * Performance impact: Successful joins stop carrying stale timeout work.
     * Memory/lifecycle ownership: WebPlatform owns these wait handles until joinP2PLobby returns.
     * Failure mode: Connect/error races still propagate the original failure or connect result.
     * Validation: Covered by live runtime host/client e2e.
     */
    try {
      const [result] = await Promise.race(promises)
      if (result instanceof Error) throw result
    } catch (e) {
      if (this.server) {
        this.server.close()
        this.server = undefined
      }
      throw e
    } finally {
      promises.forEach(p => p.cancel())
    }
  }

  async joinLobby(lobbyId: string): Promise<void> {
    if (isP2PHash(lobbyId)) {
      await this.joinP2PLobby(lobbyId)
    } else {
      throw new NetworkError(NetworkErrorCode.UnknownSession)
    }
  }

  leaveLobby(id: string): boolean {
    if (this.server) {
      this.server.close()
      this.server = undefined
    }

    return true
  }

  getLocalId(): NetUniqueId {
    return this.id
  }
}
