export interface ProxySettings {
  enabled: boolean;
  protocol: string; // http | https | socks4 | socks5
  host: string;
  port: number;
  username: string;
  password: string;
}

export interface WebhookSettings {
  enabled: boolean;
  url: string;
  events: string[];
  /** Opcional: assina o payload com HMAC-SHA256 (header X-Signature). */
  secret?: string;
}

export interface WebSocketSettings {
  enabled: boolean;
  events: string[];
}

export interface RabbitMQSettings {
  enabled: boolean;
  uri: string;
  exchange: string;
  events: string[];
}

export interface SQSSettings {
  enabled: boolean;
  accessKeyId: string;
  secretAccessKey: string;
  region: string;
  queueUrl: string;
  events: string[];
}

export interface BotBaseSettings {
  enabled: boolean;
  triggerType: string; // keyword | all | none
  triggerOperator: string; // contains | equals | startsWith | endsWith | regex
  keyword: string;
  expireMinutes: number;
  keywordFinish: string;
  delayMessage: number;
  unknownMessage: string;
  listeningFromMe: boolean;
  stopBotFromMe: boolean;
  keepOpen: boolean;
  debounceTime: number;
}

export interface TypebotSettings extends BotBaseSettings {
  apiUrl: string;
  publicName: string;
}

export interface N8nSettings extends BotBaseSettings {
  webhookUrl: string;
  basicAuthUser: string;
  basicAuthPassword: string;
  splitMessages: boolean;
}

export interface ChatwootSettings {
  enabled: boolean;
  url: string;
  accountId: string;
  token: string;
  signMessages: boolean;
  signDelimiter: string;
  nameInbox: string;
  organization: string;
  logo: string;
  conversationPending: boolean;
  reopenConversation: boolean;
  importContacts: boolean;
  importMessages: boolean;
  daysLimitImport: number;
  ignoreJids: string;
  autoCreate: boolean;
}

export interface InstanceSettings {
  rejectCalls: boolean;
  /** Mensagem enviada ao rejeitar chamadas (opcional). */
  rejectCallMessage: string;
  ignoreGroups: boolean;
  alwaysOnline: boolean;
  readMessages: boolean;
  syncFullHistory: boolean;
  readStatus: boolean;
  proxy: ProxySettings;
  webhook: WebhookSettings;
  websocket: WebSocketSettings;
  rabbitmq: RabbitMQSettings;
  sqs: SQSSettings;
  typebot: TypebotSettings;
  n8n: N8nSettings;
  chatwoot: ChatwootSettings;
}

export type InstanceSettingsPatch = Partial<{
  [K in keyof InstanceSettings]: InstanceSettings[K] extends object ? Partial<InstanceSettings[K]> : InstanceSettings[K];
}>;

const BOT_DEFAULTS: BotBaseSettings = {
  enabled: false,
  triggerType: 'keyword',
  triggerOperator: 'contains',
  keyword: '',
  expireMinutes: 0,
  keywordFinish: '',
  delayMessage: 1000,
  unknownMessage: '',
  listeningFromMe: false,
  stopBotFromMe: false,
  keepOpen: false,
  debounceTime: 10,
};

export const DEFAULT_SETTINGS: InstanceSettings = {
  rejectCalls: false,
  rejectCallMessage: '',
  ignoreGroups: false,
  alwaysOnline: false,
  readMessages: false,
  syncFullHistory: false,
  readStatus: false,
  proxy: { enabled: false, protocol: 'http', host: '', port: 0, username: '', password: '' },
  webhook: { enabled: false, url: '', events: [], secret: '' },
  websocket: { enabled: false, events: [] },
  rabbitmq: { enabled: false, uri: '', exchange: '', events: [] },
  sqs: { enabled: false, accessKeyId: '', secretAccessKey: '', region: '', queueUrl: '', events: [] },
  typebot: { ...BOT_DEFAULTS, apiUrl: '', publicName: '' },
  n8n: { ...BOT_DEFAULTS, webhookUrl: '', basicAuthUser: '', basicAuthPassword: '', splitMessages: false },
  chatwoot: {
    enabled: false,
    url: '',
    accountId: '',
    token: '',
    signMessages: false,
    signDelimiter: '\n',
    nameInbox: '',
    organization: '',
    logo: '',
    conversationPending: false,
    reopenConversation: true,
    importContacts: false,
    importMessages: false,
    daysLimitImport: 3,
    ignoreJids: '',
    autoCreate: true,
  },
};

const SECTION_KEYS = ['proxy', 'webhook', 'websocket', 'rabbitmq', 'sqs', 'typebot', 'n8n', 'chatwoot'] as const;

/** Mescla configurações salvas (possivelmente parciais/antigas) com os padrões atuais. */
export function mergeSettings(base: InstanceSettings, patch: InstanceSettingsPatch | null | undefined): InstanceSettings {
  const result: InstanceSettings = structuredClone(base);
  if (!patch || typeof patch !== 'object') return result;

  for (const [key, value] of Object.entries(patch)) {
    if (value === undefined || value === null || !(key in DEFAULT_SETTINGS)) continue;
    if ((SECTION_KEYS as readonly string[]).includes(key)) {
      if (typeof value === 'object') Object.assign((result as any)[key], value);
    } else {
      (result as any)[key] = value;
    }
  }
  // Compatibilidade: versões antigas salvavam o delimitador escapado ("\\n").
  result.chatwoot.signDelimiter = (result.chatwoot.signDelimiter || '\n').replace(/\\n/g, '\n');
  return result;
}
