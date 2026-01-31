// Define core types for the application

export enum ConnectionStatus {
  DISCONNECTED = 'DISCONNECTED',
  CONNECTING = 'CONNECTING',
  CONNECTED = 'CONNECTED',
  ERROR = 'ERROR',
}

export interface SSHConnectionConfig {
  host: string;
  port: number;
  username: string;
  password?: string;
  privateKey?: string;
}

export interface FileEntry {
  name: string;
  size: number;
  isDirectory: boolean;
  permissions: string;
  modifiedDate: string;
  path: string;
}

export interface FileSystemState {
  currentPath: string;
  entries: FileEntry[];
  isLoading: boolean;
  error?: string;
}

export enum TabView {
  TERMINAL = 'TERMINAL',
  SCP = 'SCP',
  SETTINGS = 'SETTINGS',
}

// Log entry for the console/debug
export interface SystemLog {
  id: string;
  timestamp: Date;
  level: 'info' | 'warn' | 'error' | 'success';
  message: string;
}