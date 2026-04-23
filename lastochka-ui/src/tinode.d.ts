// Vite environment variables
interface ImportMetaEnv {
  readonly VITE_TINODE_HOST: string
  readonly VITE_TINODE_API_KEY: string
  readonly VITE_TINODE_SECURE: string
  readonly VITE_APP_NAME: string
  readonly VITE_BOT_GATEWAY_URL: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}

declare module 'tinode-sdk' {
  interface TinodeConfig {
    appName: string
    host: string
    apiKey: string
    transport?: string
    secure?: boolean
    persist?: boolean
  }

  interface MetaQueryBuilder {
    withLaterSub(): this
    withLaterDesc(): this
    withDesc(): this
    withTags(): this
    withCred(): this
    withSub(): this
    withLaterData(count?: number): this
    withLaterDel(): this
    withAux(): this
    build(): unknown
  }

  export interface TinodeContact {
    topic: string
    name?: string
    public?: {
      fn?: string
      uname?: string
      phone?: string
      tel?: string
      note?: string
      photo?: { type?: string; data?: string; ref?: string; large?: { type?: string; data?: string; ref?: string } }
    }
    private?: { comment?: string; login?: string; phone?: string; tel?: string }
    online?: boolean
    unread?: number
    touched?: Date
    acs?: unknown
  }

  export interface TinodeMessage {
    seq: number
    from: string
    ts: Date
    content: string | unknown
    head?: Record<string, unknown>
  }

  export interface MeTopic {
    onMetaDesc: ((desc: unknown) => void) | undefined
    onContactUpdate: ((what: string, cont: TinodeContact) => void) | undefined
    onSubsUpdated: (() => void) | undefined
    subscribe(query: unknown): Promise<unknown>
    contacts(callback: (cont: TinodeContact) => void): void
    startMetaQuery(): MetaQueryBuilder
    isSubscribed(): boolean
    pinnedTopicRank(topic: string): number
    setMeta(params: unknown): Promise<unknown>
    delTopic(hard?: boolean): Promise<unknown>
  }

  export interface Topic {
    name: string  // Topic ID, assigned after subscribe('new')
    onData: ((msg: TinodeMessage) => void) | undefined
    onAllMessagesReceived: ((count: number) => void) | undefined
    onInfo: ((msg: unknown) => void) | undefined
    onMetaDesc: ((desc: unknown) => void) | undefined
    subscribe(getQuery: unknown, setQuery?: unknown): Promise<unknown>
    publishMessage(msg: unknown): Promise<unknown>
    createMessage(content: string | unknown, noEcho?: boolean): unknown
    setMeta(params: unknown): Promise<unknown>
    startMetaQuery(): MetaQueryBuilder
    isSubscribed(): boolean
    getMessagesPage(count: number, gaps?: unknown, min?: number, max?: number): Promise<void>
    msgHasMoreMessages(min: number, max: number, desc: boolean): unknown[]
    messages(callback: (msg: TinodeMessage) => void, start?: number, end?: number): void
    contacts(callback: (cont: TinodeContact) => void): void
    leave(unsub?: boolean): Promise<unknown>
    delTopic(hard?: boolean): Promise<unknown>
    del(seqList: number[], hard?: boolean): Promise<unknown>
    isArchived(): boolean
    getDesc(): { unread?: number; [key: string]: unknown } | null
    noteRead(): void
    noteKeyPress(): void
  }

  export class Tinode {
    constructor(config: TinodeConfig, onSetup?: (err?: Error) => void)

    onConnect: (() => void) | undefined
    onDisconnect: ((err?: Error) => void) | undefined
    onAutoreconnectIteration: ((sec: number, prom?: Promise<unknown>) => void) | undefined

    connect(host?: string): Promise<unknown>
    disconnect(): void
    reconnect(): void
    logout(): Promise<unknown>

    // Account creation
    acc(params: {
      user?: string
      scheme?: string
      secret?: string
      login?: boolean
      desc?: {
        public?: { fn?: string }
        private?: { email?: string }
      }
    }): Promise<{ code: number; text: string; params?: unknown }>

    createAccountBasic(login: string, password: string, params?: { public?: unknown; tags?: string[]; login?: boolean; cred?: unknown; private?: unknown }): Promise<{ code: number; text: string; params?: unknown }>
    loginBasic(login: string, password: string, cred?: unknown): Promise<{ code: number; text: string; params?: unknown }>
    loginToken(token: string, cred?: unknown): Promise<{ code: number; text: string; params?: unknown }>

    isConnected(): boolean
    isAuthenticated(): boolean
    getCurrentUserID(): string
    getAuthToken(): { token: string; expires: Date } | null
    setAuthToken(token: { token: string; expires: Date }): void
    getServerInfo(): { ver: string; build?: string; reqCred?: unknown }

    getMeTopic(): MeTopic
    getTopic(name: string): Topic
    getFndTopic(): Topic

    enableLogging(enable: boolean, verbose?: boolean): void
    setHumanLanguage(lang: string): void
    setDeviceToken(token: string): void
    getTopicAccessMode(topicName: string): unknown

    initStorage(): Promise<void>
    clearStorage(): Promise<void>

    static topicType(name: string): string | undefined
    static isP2PTopicName(name: string): boolean
    static isSelfTopicName(name: string): boolean
    static credential(cred?: unknown): unknown
  }

  export class Drafty {
    static isPlainText(content: unknown): boolean
    static toPlainText(content: unknown): string
    static getContentType(content: unknown): string | null
  }

}
