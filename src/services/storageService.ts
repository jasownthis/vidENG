import { storage } from '../config/firebase';
import { ref, getDownloadURL, listAll, deleteObject, getMetadata } from 'firebase/storage';
import { getAuth } from 'firebase/auth';
import { AudioRecording } from '../types';

class StorageService {
  private readonly AUDIO_RAW_PREFIX = 'audio_raw';
  
  /**
   * Construct the Firebase Storage path for audio files
   * Path format: audio_raw/grade_{gradeLevel}/{bookId}/{userId}/
   */
  private getAudioPath(userId: string, bookId: string, gradeLevel: number): string {
    return `${this.AUDIO_RAW_PREFIX}/grade_${gradeLevel}/${bookId}/${userId}`;
  }

  /**
   * Construct the full file path for a specific page audio
   * Format: audio_raw/grade_{gradeLevel}/{bookId}/{userId}/page_{pageNumber}_{timestamp}.m4a
   */
  private getPageAudioPath(
    userId: string, 
    bookId: string, 
    gradeLevel: number, 
    pageNumber: number, 
    timestamp?: number
  ): string {
    const basePath = this.getAudioPath(userId, bookId, gradeLevel);
    const ts = timestamp || Date.now();
    return `${basePath}/page_${pageNumber}_${ts}.m4a`;
  }

  /**
   * Upload a WAV audio file to Firebase Storage
   */
  async uploadAudioFile(
    audioBase64: string,
    userId: string,
    bookId: string,
    gradeLevel: number,
    pageNumber: number,
    timestamp?: number
  ): Promise<string> {
    try {
      const filePath = this.getPageAudioPath(userId, bookId, gradeLevel, pageNumber, timestamp);
      console.log('Uploading audio via REST to:', filePath);

      const bucket = (storage as any).app?.options?.storageBucket as string;
      if (!bucket) throw new Error('Storage bucket not configured');

      const currentUser = getAuth().currentUser;
      const idToken = currentUser ? await currentUser.getIdToken() : null;
      if (!idToken) throw new Error('Not authenticated');

      // Firebase Storage simple upload endpoint (v0 API)
      const url = `https://firebasestorage.googleapis.com/v0/b/${bucket}/o?name=${encodeURIComponent(filePath)}&uploadType=media`;
      const bytes = StorageService.base64ToUint8Array(audioBase64);

      const res = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'audio/mp4',
          'Authorization': `Bearer ${idToken}`,
          'x-goog-meta-userId': userId,
          'x-goog-meta-bookId': bookId,
          'x-goog-meta-pageNumber': String(pageNumber),
          'x-goog-meta-gradeLevel': String(gradeLevel),
          'x-goog-meta-uploadedAt': new Date().toISOString(),
        } as any,
        body: bytes as any,
      });

      if (!res.ok) {
        const t = await StorageService.safeText(res);
        throw new Error(`Firebase upload failed (${res.status}): ${t}`);
      }

      const meta = await res.json() as { bucket?: string; name?: string; downloadTokens?: string };
      if (meta?.bucket && meta?.name && meta?.downloadTokens) {
        const direct = `https://firebasestorage.googleapis.com/v0/b/${meta.bucket}/o/${encodeURIComponent(meta.name)}?alt=media&token=${meta.downloadTokens}`;
        console.log('Audio uploaded successfully (REST token URL):', direct);
        return direct;
      }

      const downloadURL = await getDownloadURL(ref(storage, filePath));
      console.log('Audio uploaded successfully (SDK URL):', downloadURL);
      return downloadURL;
    } catch (error) {
      console.error('Error uploading audio file:', error);
      throw error;
    }
  }

  // Helpers kept as private static to avoid leaking symbols outside module scope
  private static base64ToUint8Array(base64: string): Uint8Array {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/=';
    const clean = base64.replace(/^data:[^;]+;base64,/, '');
    const output: number[] = [];
    let i = 0;
    while (i < clean.length) {
      const enc1 = chars.indexOf(clean[i++]);
      const enc2 = chars.indexOf(clean[i++]);
      const enc3 = chars.indexOf(clean[i++]);
      const enc4 = chars.indexOf(clean[i++]);
      const chr1 = (enc1 << 2) | (enc2 >> 4);
      const chr2 = ((enc2 & 15) << 4) | (enc3 >> 2);
      const chr3 = ((enc3 & 3) << 6) | enc4;
      output.push(chr1);
      if (enc3 !== 64) output.push(chr2);
      if (enc4 !== 64) output.push(chr3);
    }
    return new Uint8Array(output);
  }

  private static async safeText(res: Response): Promise<string> {
    try {
      return await res.text();
    } catch {
      return '<no body>';
    }
  }

// (class continues below)

  /**
   * Check if audio file exists for a specific page
   */
  async checkPageAudioExists(
    userId: string,
    bookId: string,
    gradeLevel: number,
    pageNumber: number
  ): Promise<{ exists: boolean; filePath?: string; downloadURL?: string }> {
    try {
      const basePath = this.getAudioPath(userId, bookId, gradeLevel);
      const folderRef = ref(storage, basePath);
      
      // List all files in the user's folder for this book
      const listResult = await listAll(folderRef);
      
      // Find files for the specific page
      const pageFiles = listResult.items.filter(item => 
        item.name.startsWith(`page_${pageNumber}_`) && item.name.endsWith('.m4a')
      );
      
      if (pageFiles.length > 0) {
        // Return the most recent file (highest timestamp)
        const latestFile = pageFiles.sort((a, b) => 
          b.name.localeCompare(a.name) // Sort by name descending (higher timestamp first)
        )[0];
        
        const downloadURL = await getDownloadURL(latestFile);
        
        return {
          exists: true,
          filePath: latestFile.fullPath,
          downloadURL
        };
      }
      
      return { exists: false };
    } catch (error) {
      console.error('Error checking page audio:', error);
      return { exists: false };
    }
  }

  // Removed blob download helper to avoid Blob usage on Hermes

  /**
   * List all audio files for a user's book
   */
  async listUserBookAudio(
    userId: string,
    bookId: string,
    gradeLevel: number
  ): Promise<AudioRecording[]> {
    try {
      const basePath = this.getAudioPath(userId, bookId, gradeLevel);
      const folderRef = ref(storage, basePath);
      
      console.log('Listing audio files from:', basePath);
      
      const listResult = await listAll(folderRef);
      const audioRecordings: AudioRecording[] = [];
      const items = listResult.items;

      // Prefer master files per page if present
      const masterRegex = /^page_(\d+)_master\.(m4a|mp4|aac|wav)$/;
      const segmentRegex = /^page_(\d+)_(\d+)\.(wav|mp4|m4a|aac)$/;

      // First, collect masters by page
      const mastersByPage: Record<number, typeof items[number]> = {} as any;
      for (const item of items) {
        const m = item.name.match(masterRegex);
        if (m) {
          const page = parseInt(m[1], 10);
          mastersByPage[page] = item;
        }
      }
      
      // Process each audio file
      for (const item of items) {
        try {
          const filename = item.name;
          // Skip non-audio files
          if (!segmentRegex.test(filename) && !masterRegex.test(filename)) continue;

          // If master exists for this page, skip segments for that page
          const masterMatch = filename.match(masterRegex);
          if (!masterMatch) {
            const seg = filename.match(segmentRegex);
            if (seg) {
              const segPage = parseInt(seg[1], 10);
              if (mastersByPage[segPage]) {
                continue; // master present, ignore segment
              }
            }
          }

          // Parse either master or segment
          let match = filename.match(/page_(\d+)_master\.(m4a|mp4|aac|wav)/);
          let isMaster = false;
          let pageNumber = 0;
          let timestamp = 0;
          if (match) {
            isMaster = true;
            pageNumber = parseInt(match[1], 10);
            timestamp = Date.now(); // unknown, use now
          } else {
            match = filename.match(/page_(\d+)_(\d+)\.(wav|mp4|m4a|aac)/);
            if (!match) continue;
            pageNumber = parseInt(match[1], 10);
            timestamp = parseInt(match[2], 10);
          }
          
          if (match) {
            const pageNumber = parseInt(match[1], 10);
            const timestamp = parseInt(match[2], 10);
            
            // Get file metadata and download URL
            const [metadata, downloadURL] = await Promise.all([
              getMetadata(item),
              getDownloadURL(item)
            ]);
            
            const audioRecording: AudioRecording = {
              id: `${userId}_${bookId}_page_${pageNumber}_${timestamp}`,
              userId,
              bookId,
              pageNumber,
              rawAudioUrl: downloadURL,
              processedAudioUrl: downloadURL,
              duration: 0, // TODO: Calculate from metadata or file analysis
              recordedAt: new Date(timestamp),
              isProcessed: true,
            };
            
            audioRecordings.push(audioRecording);
          }
        } catch (itemError) {
          console.error('Error processing audio item:', item.name, itemError);
          // Continue with other files
        }
      }
      
      // Sort by page number and timestamp
      audioRecordings.sort((a, b) => {
        if (a.pageNumber !== b.pageNumber) {
          return a.pageNumber - b.pageNumber;
        }
        return b.recordedAt.getTime() - a.recordedAt.getTime();
      });
      
      console.log(`Found ${audioRecordings.length} audio recordings`);
      return audioRecordings;
      
    } catch (error) {
      console.error('Error listing user book audio:', error);
      return [];
    }
  }

  /**
   * Delete all audio files for a user's book folder
   */
  async deleteAllUserBookAudio(userId: string, bookId: string, gradeLevel: number): Promise<void> {
    try {
      const basePath = this.getAudioPath(userId, bookId, gradeLevel);
      const folderRef = ref(storage, basePath);
      const listResult = await listAll(folderRef);
      // Delete items
      for (const item of listResult.items) {
        await deleteObject(item);
      }
    } catch (error) {
      console.error('Error deleting all user book audio:', error);
      throw error;
    }
  }

  /**
   * Delete an audio file from Firebase Storage
   */
  async deleteAudioFile(filePath: string): Promise<void> {
    try {
      const fileRef = ref(storage, filePath);
      await deleteObject(fileRef);
      console.log('Audio file deleted:', filePath);
    } catch (error) {
      console.error('Error deleting audio file:', error);
      throw error;
    }
  }

  /**
   * Get Firebase Storage reference for a file path
   */
  getStorageRef(filePath: string) {
    return ref(storage, filePath);
  }

  /**
   * Resolve a Firebase Storage path to a download URL
   */
  async getDownloadUrlForPath(filePath: string): Promise<string> {
    const r = ref(storage, filePath);
    return await getDownloadURL(r);
  }

  /**
   * Generate a unique filename for new recordings
   */
  generateAudioFileName(pageNumber: number, timestamp?: number): string {
    const ts = timestamp || Date.now();
    return `page_${pageNumber}_${ts}.m4a`;
  }
}

export default new StorageService();
