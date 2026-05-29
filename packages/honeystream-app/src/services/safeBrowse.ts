import { getHost } from 'utils/url'

const STORAGE_KEY = 'safeBrowseHosts'

const SAFE_HOSTS = new Set([
  'www.youtube.com',
  'www.youtu.be',
  'm.youtube.com',
  'youtube.com',
  'youtube-nocookie.com',
  'www.youtube-nocookie.com',
  'www.netflix.com',
  'www.crunchyroll.com',
  'www.google.com',
  'www.hulu.com',
  'soundcloud.com',
  'w.soundcloud.com',
  'www.amazon.com',
  'www.twitch.tv',
  'player.twitch.tv',
  'clips.twitch.tv',
  'drive.google.com',
  'www.dailymotion.com',
  'roosterteeth.com',
  'www.reddit.com',
  'www.funimation.com',
  'twitter.com',
  'www.bilibili.com',
  'www.facebook.com',
  'open.spotify.com',
  'www.primevideo.com',
  'www.amazon.co.uk',
  'play.hbogo.com',
  'play.hbonow.com',
  'streamable.com',
  'www.dropbox.com',
  'www.plex.tv',
  'app.plex.tv',
  'www.nicovideo.jp',
  'i.imgur.com',
  'www.disneyplus.com'
])

const SAFE_PROVIDER_DOMAINS = [
  'youtube.com',
  'youtube-nocookie.com',
  'youtu.be',
  'animepahe.com',
  'animepahe.ru',
  'animepahe.si',
  'cineby.app',
  'cineby.ru',
  'cineby.to',
  'miruro.to',
  'miruro.tv'
] as const

const normalizeHost = (host: string): string =>
  host
    .trim()
    .toLowerCase()
    .replace(/:\d+$/, '')
    .replace(/\.$/, '')

const isHostOrSubdomain = (host: string, domain: string): boolean =>
  host === domain || host.endsWith(`.${domain}`)

export const isSafeBrowseHost = (host: string): boolean => {
  const normalizedHost = normalizeHost(host)
  return (
    SAFE_HOSTS.has(normalizedHost) ||
    SAFE_PROVIDER_DOMAINS.some(domain => isHostOrSubdomain(normalizedHost, domain))
  )
}

let safeBrowse: SafeBrowse | undefined

export class SafeBrowse {
  private enabled = true
  private persistentHosts!: Set<string>

  static getInstance() {
    return safeBrowse || (safeBrowse = new SafeBrowse())
  }

  private constructor() {
    this.load()
    window.addEventListener('beforeunload', this.save.bind(this), false)
  }

  private load() {
    const value =
      process.env.NODE_ENV === 'development' ? '' : localStorage.getItem(STORAGE_KEY) || ''
    const hosts = value
      .split(',')
      .map(normalizeHost)
      .filter(host => host.length > 0)
    this.persistentHosts = new Set(hosts)
  }

  private save() {
    const hosts = Array.from(this.persistentHosts)
    if (hosts.length === 0) return
    const value = hosts.join(',')
    localStorage.setItem(STORAGE_KEY, value)
  }

  isPermittedURL(url: string) {
    if (!this.enabled) return true

    const host = getHost(url)
    if (!host) return true

    const normalizedHost = normalizeHost(host)
    const isPermitted = isSafeBrowseHost(normalizedHost) || this.persistentHosts.has(normalizedHost)
    return isPermitted
  }

  permitURL(url: string) {
    const host = getHost(url)
    if (!host) return
    this.persistentHosts.add(normalizeHost(host))
  }

  enable() {
    this.enabled = true
  }

  disable() {
    this.enabled = false
  }
}
