import { Platform, PermissionsAndroid, Alert } from 'react-native';
import storageService from './storageService';
import * as RNFS from 'react-native-fs';
import NetInfo from '@react-native-community/netinfo';
import AudioRecorder from '../native/AudioRecorderModule';

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
  private async initializeRecorder(): Promise<void> {}

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

      const fileUri = await AudioRecorder.startRecording(pageNumber);

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

      const resultUri = await AudioRecorder.stopRecording();
      
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

  // Removed blob conversion

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

      // Step 2: Read file as base64 using RNFS
      const path = localFilePath.replace('file://', '');
      const exists = await RNFS.exists(path);
      if (!exists) throw new Error(`Recorded file not found at ${path}`);
      const base64 = await RNFS.readFile(path, 'base64');
      onProgress?.(20);
      onProgress?.(40);

      // Step 3: Upload this segment as-is (no merge)
      const timestamp = Date.now();
      const downloadURL = await storageService.uploadAudioFile(
        base64,
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
      
    } catch (error) {
      console.error('Error during cleanup:', error);
    }
  }
}

export default new AudioService();
