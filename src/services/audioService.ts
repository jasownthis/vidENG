import Sound, {
  type AudioSet,
  AudioEncoderAndroidType,
  OutputFormatAndroidType,
} from 'react-native-nitro-sound';
import { Platform, PermissionsAndroid, Alert } from 'react-native';
import storageService from './storageService';
import * as RNFS from 'react-native-fs';
import NetInfo from '@react-native-community/netinfo';

export interface RecordingSession {
  isRecording: boolean;
  startTime: Date;
  filePath?: string;
  duration: number;
}

export interface AudioMergeResult {
  success: boolean;
  downloadURL?: string;
  error?: string;
}

class AudioService {
  private recorder: typeof Sound | null = null;
  private currentSession: RecordingSession | null = null;
  private recordingTimer: NodeJS.Timeout | null = null;

  /**
   * Request microphone permissions
   */
  async requestPermissions(): Promise<boolean> {
    try {
      if (Platform.OS === 'android') {
        const granted = await PermissionsAndroid.request(
          PermissionsAndroid.PERMISSIONS.RECORD_AUDIO,
          {
            title: 'VidENG Audio Recording Permission',
            message: 'VidENG needs access to your microphone to record your reading.',
            buttonNeutral: 'Ask Me Later',
            buttonNegative: 'Cancel',
            buttonPositive: 'OK',
          }
        );
        return granted === PermissionsAndroid.RESULTS.GRANTED;
      }
      // iOS permissions are handled automatically by the library
      return true;
    } catch (error) {
      console.error('Error requesting audio permissions:', error);
      return false;
    }
  }

  /**
   * Initialize the audio recorder
   */
  private async initializeRecorder(): Promise<void> {
    // Nitro Sound exposes a singleton-like default export. No explicit init required.
    if (!this.recorder) {
      this.recorder = Sound;
    }
  }

  /**
   * Start recording audio for a specific page
   */
  async startRecording(pageNumber: number): Promise<boolean> {
    try {
      // Check permissions first
      const hasPermission = await this.requestPermissions();
      if (!hasPermission) {
        Alert.alert('Permission Required', 'Please grant microphone permission to record audio.');
        return false;
      }

      // Initialize recorder
      await this.initializeRecorder();

      // Stop any existing recording
      if (this.currentSession?.isRecording) {
        await this.stopRecording();
      }

      // Configure audio settings (closest to PCM-like quality within Android MediaRecorder constraints)
      // NOTE: MediaRecorder does not natively support WAV on Android. We record to MPEG_4/AAC.
      // The returned URI will be used for upload. Merging will require container-aware processing later.
      const audioSets: AudioSet = {
        OutputFormatAndroid: OutputFormatAndroidType.MPEG_4,
        AudioEncoderAndroid: AudioEncoderAndroidType.AAC,
        AudioSamplingRate: 44100,
        AudioChannels: 1,
        AudioEncodingBitRate: 128000,
      };

      // Let native side choose a proper file path if uri is omitted; method returns a file:// URI
      const fileUri = await this.recorder.startRecorder(undefined, audioSets, false);

      // Create recording session
      this.currentSession = {
        isRecording: true,
        startTime: new Date(),
        filePath: fileUri,
        duration: 0,
      };

      // Start duration timer
      this.startDurationTimer();

      console.log('Started recording for page', pageNumber, 'at', fileUri);
      return true;

    } catch (error) {
      console.error('Error starting recording:', error);
      Alert.alert('Recording Error', 'Failed to start recording. Please try again.');
      return false;
    }
  }

  /**
   * Stop the current recording
   */
  async stopRecording(): Promise<string | null> {
    try {
      if (!this.currentSession?.isRecording) {
        return null;
      }

      // Stop the recorder
      const resultUri = await this.recorder!.stopRecorder();
      
      // Stop duration timer
      this.stopDurationTimer();

      // Update session
      const filePath = resultUri || this.currentSession.filePath;
      this.currentSession = {
        ...this.currentSession,
        isRecording: false,
      };

      console.log('Stopped recording, file saved at:', filePath);
      return filePath || null;

    } catch (error) {
      console.error('Error stopping recording:', error);
      return null;
    }
  }

  /**
   * Start the duration timer
   */
  private startDurationTimer(): void {
    this.recordingTimer = setInterval(() => {
      if (this.currentSession) {
        const now = new Date();
        this.currentSession.duration = Math.floor(
          (now.getTime() - this.currentSession.startTime.getTime()) / 1000
        );
      }
    }, 1000);
  }

  /**
   * Stop the duration timer
   */
  private stopDurationTimer(): void {
    if (this.recordingTimer) {
      clearInterval(this.recordingTimer);
      this.recordingTimer = null;
    }
  }

  /**
   * Get current recording session info
   */
  getCurrentSession(): RecordingSession | null {
    return this.currentSession;
  }

  /**
   * Check network connectivity
   */
  async checkNetworkConnection(): Promise<boolean> {
    try {
      const netInfo = await NetInfo.fetch();
      return netInfo.isConnected === true && netInfo.isInternetReachable === true;
    } catch (error) {
      console.error('Error checking network:', error);
      return false;
    }
  }

  /**
   * Convert local audio file to blob for upload
   */
  async audioFileToBlob(filePath: string): Promise<Blob> {
    try {
      // Normalize to file:// URI expected by fetch
      const uri = filePath.startsWith('file://') ? filePath : `file://${filePath}`;
      const response = await fetch(uri);
      const blob = await response.blob();
      return blob;
    } catch (error) {
      console.error('Error converting audio file to blob:', error);
      throw error;
    }
  }

  // FFmpeg removal: no local concatenation; segments are uploaded individually

  /**
   * Upload a single recorded segment (no merge). Returns download URL.
   */
  async uploadSegment(
    localFilePath: string,
    userId: string,
    bookId: string,
    gradeLevel: number,
    pageNumber: number,
    onProgress?: (progress: number) => void
  ): Promise<AudioMergeResult> {
    try {
      // Step 1: Check network connectivity
      const hasNetwork = await this.checkNetworkConnection();
      if (!hasNetwork) {
        throw new Error('No internet connection. Please check your network and try again.');
      }

      onProgress?.(10);

      // Step 2: Convert local file to blob
      const newAudioBlob = await this.audioFileToBlob(localFilePath);
      onProgress?.(20);
      onProgress?.(40);

      // Step 3: Upload this segment as-is (no merge)
      const timestamp = Date.now();
      const downloadURL = await storageService.uploadAudioFile(
        newAudioBlob,
        userId,
        bookId,
        gradeLevel,
        pageNumber,
        timestamp
      );
      onProgress?.(90);

      // Step 4: Clean up local file (optional)
      try {
        // await RNFS.unlink(localFilePath);
      } catch (cleanupError) {
        console.warn('Could not delete local file:', cleanupError);
      }

      onProgress?.(100);

      return {
        success: true,
        downloadURL,
      };

    } catch (error) {
      console.error('Error in uploadAudioWithMerge:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error occurred',
      };
    }
  }

  /**
   * Clean up resources
   */
  async cleanup(): Promise<void> {
    try {
      if (this.currentSession?.isRecording) {
        await this.stopRecording();
      }
      
      this.stopDurationTimer();
      
      if (this.recorder) {
        await this.recorder.release();
        this.recorder = null;
      }
    } catch (error) {
      console.error('Error during cleanup:', error);
    }
  }
}

export default new AudioService();
