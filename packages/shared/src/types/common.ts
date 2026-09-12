export type UUID = string;
export type ISODateString = string;

export enum PlatformRole {
  PLATFORM_ADMIN = "PLATFORM_ADMIN",
  FACILITATOR = "FACILITATOR",
  PLAYER = "PLAYER",
}

export enum LLMProviderKind {
  OLLAMA = "OLLAMA",
  GEMINI = "GEMINI",
  CLAUDE = "CLAUDE",
  OPENAI = "OPENAI",
}

export interface Paginated<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
}
