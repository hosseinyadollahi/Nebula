import { FileEntry } from '../types';

/**
 * SIMULATION LAYER
 * Since we don't have a real WebSocket SSH backend, this class simulates
 * a Linux file system and shell command responses.
 */

interface MockFile {
  name: string;
  content: string;
  size: number;
  date: string;
}

interface MockDir {
  name: string;
  files: Record<string, MockFile>;
  dirs: Record<string, MockDir>;
  parent: MockDir | null;
  path: string;
}

class MockFileSystem {
  private root: MockDir;
  private current: MockDir;

  constructor() {
    // Build a fake file system structure
    this.root = {
      name: '',
      files: {},
      dirs: {},
      parent: null,
      path: '/'
    };
    
    // Setup /home/user
    const home = this.mkdir(this.root, 'home');
    const user = this.mkdir(home, 'user');
    
    // Setup /var/log
    const variable = this.mkdir(this.root, 'var');
    const log = this.mkdir(variable, 'log');
    this.touch(log, 'syslog', 'Sep 20 10:00:01 server systemd[1]: Started System Logging Service.', 1024);
    this.touch(log, 'auth.log', 'Sep 20 10:05:22 server sshd[123]: Accepted password for user', 512);

    // Setup user files
    this.touch(user, 'notes.txt', 'Don\'t forget to update the production database.', 45);
    this.touch(user, 'config.json', '{\n  "env": "production"\n}', 26);
    this.touch(user, 'project.py', 'print("Hello World")', 20);

    // Initial State
    this.current = user;
  }

  private mkdir(parent: MockDir, name: string): MockDir {
    const newDir: MockDir = {
      name,
      files: {},
      dirs: {},
      parent,
      path: parent.path === '/' ? `/${name}` : `${parent.path}/${name}`
    };
    parent.dirs[name] = newDir;
    return newDir;
  }

  private touch(dir: MockDir, name: string, content: string, size: number) {
    dir.files[name] = {
      name,
      content,
      size,
      date: new Date().toISOString()
    };
  }

  public getCwd(): string {
    return this.current.path;
  }

  public listFiles(): FileEntry[] {
    const entries: FileEntry[] = [];
    
    // Directories
    Object.values(this.current.dirs).forEach(d => {
      entries.push({
        name: d.name,
        size: 4096,
        isDirectory: true,
        permissions: 'drwxr-xr-x',
        modifiedDate: new Date().toISOString(),
        path: d.path
      });
    });

    // Files
    Object.values(this.current.files).forEach(f => {
      entries.push({
        name: f.name,
        size: f.size,
        isDirectory: false,
        permissions: '-rw-r--r--',
        modifiedDate: f.date,
        path: `${this.current.path === '/' ? '' : this.current.path}/${f.name}`
      });
    });

    return entries.sort((a, b) => {
      if (a.isDirectory === b.isDirectory) return a.name.localeCompare(b.name);
      return a.isDirectory ? -1 : 1;
    });
  }

  public changeDir(path: string): string {
    if (path === '/' || path === '~') {
      // Simple reset for demo
      if (path === '/') {
        this.current = this.root;
      } else {
        // Find /home/user roughly
        if (this.root.dirs['home']?.dirs['user']) {
            this.current = this.root.dirs['home'].dirs['user'];
        }
      }
      return '';
    }
    
    if (path === '..') {
      if (this.current.parent) {
        this.current = this.current.parent;
      }
      return '';
    }

    if (this.current.dirs[path]) {
      this.current = this.current.dirs[path];
      return '';
    }

    return `cd: no such file or directory: ${path}`;
  }
}

export const mockFS = new MockFileSystem();