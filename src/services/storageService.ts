import { storage } from '../config/firebase';
import { ref, uploadBytes, getDownloadURL, listAll, deleteObject, getMetadata } from 'firebase/storage';
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
   * Format: audio_raw/grade_{gradeLevel}/{bookId}/{userId}/page_{pageNumber}_{timestamp}.wav
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
    return `${basePath}/page_${pageNumber}_${ts}.wav`;
  }

  /**
   * Upload a WAV audio file to Firebase Storage
   */
  async uploadAudioFile(
    audioBlob: Blob,
    userId: string,
    bookId: string,
    gradeLevel: number,
    pageNumber: number,
    timestamp?: number
  ): Promise<string> {
    try {
      const filePath = this.getPageAudioPath(userId, bookId, gradeLevel, pageNumber, timestamp);
      const storageRef = ref(storage, filePath);
      
      console.log('Uploading audio to:', filePath);
      
      // Upload the audio blob
      const snapshot = await uploadBytes(storageRef, audioBlob, {
        contentType: 'audio/wav',
        customMetadata: {
          userId,
          bookId,
          pageNumber: pageNumber.toString(),
          gradeLevel: gradeLevel.toString(),
          uploadedAt: new Date().toISOString(),
        }
      });
      
      // Get the download URL
      const downloadURL = await getDownloadURL(snapshot.ref);
      console.log('Audio uploaded successfully:', downloadURL);
      
      return downloadURL;
    } catch (error) {
      console.error('Error uploading audio file:', error);
      throw error;
    }
  }

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
        item.name.startsWith(`page_${pageNumber}_`) && item.name.endsWith('.wav')
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

  /**
   * Download an existing audio file as blob for merging
   */
  async downloadAudioFile(downloadURL: string): Promise<Blob> {
    try {
      const response = await fetch(downloadURL);
      if (!response.ok) {
        throw new Error(`Failed to download audio: ${response.statusText}`);
      }
      
      const blob = await response.blob();
      return blob;
    } catch (error) {
      console.error('Error downloading audio file:', error);
      throw error;
    }
  }

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
      
      // Process each audio file
      for (const item of listResult.items) {
        try {
          // Parse filename: page_{pageNumber}_{timestamp}.wav
          const filename = item.name;
          const match = filename.match(/page_(\d+)_(\d+)\.wav/);
          
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
              processedAudioUrl: downloadURL, // Same as raw for WAV-only approach
              duration: 0, // TODO: Calculate from metadata or file analysis
              recordedAt: new Date(timestamp),
              isProcessed: true, // Always true for WAV-only approach
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
   * Generate a unique filename for new recordings
   */
  generateAudioFileName(pageNumber: number, timestamp?: number): string {
    const ts = timestamp || Date.now();
    return `page_${pageNumber}_${ts}.wav`;
  }
}

export default new StorageService();
