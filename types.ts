export interface Message {
  role: 'user' | 'model' | 'system';
  text: string;
  timestamp: Date;
}

export enum ConnectionState {
  DISCONNECTED = 'DISCONNECTED',
  CONNECTING = 'CONNECTING',
  CONNECTED = 'CONNECTED',
  ERROR = 'ERROR',
}

export interface AudioConfig {
  sampleRate: number;
}

export interface Source {
  title: string;
  uri: string;
}