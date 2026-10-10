// Minimal subset of the built-in vscode.git extension API (extensions/git/src/api/git.d.ts).
import type { Event, Uri } from 'vscode';

export interface InputBox {
  value: string;
}

export interface RepositoryState {
  readonly onDidChange: Event<void>;
}

export interface Repository {
  readonly rootUri: Uri;
  readonly inputBox: InputBox;
  readonly state: RepositoryState;
}

export interface API {
  readonly repositories: Repository[];
  readonly onDidOpenRepository: Event<Repository>;
}

export interface GitExtension {
  getAPI(version: 1): API;
}
