import { registerPlugin } from '@capacitor/core'

export interface BackupFilePlugin {
  // Copies the file at path (a file:// URI) to where the user picks in the
  // system "Save to" screen; saved is false if they backed out.
  save(options: { filename: string; path: string }): Promise<{ saved: boolean }>
}

export const BackupFile = registerPlugin<BackupFilePlugin>('BackupFile')
