import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  ActivityIndicator,
  Dimensions,
} from 'react-native';

const { width } = Dimensions.get('window');

interface UploadProgressModalProps {
  visible: boolean;
  progress: number;
  message?: string;
  subMessage?: string;
}

const UploadProgressModal: React.FC<UploadProgressModalProps> = ({
  visible,
  progress,
  message = 'Saving your audio recording...',
  subMessage = 'Please don\'t close the app',
}) => {
  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      statusBarTranslucent
    >
      <View style={styles.overlay}>
        <View style={styles.container}>
          {/* Loading Icon */}
          <View style={styles.iconContainer}>
            <ActivityIndicator size="large" color="#2E7D32" />
            <Text style={styles.iconText}>🎤</Text>
          </View>

          {/* Main Message */}
          <Text style={styles.mainMessage}>{message}</Text>
          <Text style={styles.subMessage}>{subMessage}</Text>

          {/* Progress Bar */}
          <View style={styles.progressContainer}>
            <View style={styles.progressBar}>
              <View
                style={[
                  styles.progressFill,
                  { width: `${Math.max(0, Math.min(100, progress))}%` },
                ]}
              />
            </View>
            <Text style={styles.progressText}>{Math.round(progress)}%</Text>
          </View>

          {/* Progress Steps */}
          <View style={styles.stepsContainer}>
            <View style={styles.step}>
              <View style={[
                styles.stepDot,
                { backgroundColor: progress >= 20 ? '#4CAF50' : '#E0E0E0' }
              ]} />
              <Text style={styles.stepText}>Processing</Text>
            </View>
            
            <View style={styles.stepLine} />
            
            <View style={styles.step}>
              <View style={[
                styles.stepDot,
                { backgroundColor: progress >= 50 ? '#4CAF50' : '#E0E0E0' }
              ]} />
              <Text style={styles.stepText}>Merging</Text>
            </View>
            
            <View style={styles.stepLine} />
            
            <View style={styles.step}>
              <View style={[
                styles.stepDot,
                { backgroundColor: progress >= 90 ? '#4CAF50' : '#E0E0E0' }
              ]} />
              <Text style={styles.stepText}>Uploading</Text>
            </View>
          </View>

          {/* Warning Message */}
          <View style={styles.warningContainer}>
            <Text style={styles.warningIcon}>⚠️</Text>
            <Text style={styles.warningText}>
              Your audio is being saved to the cloud.{'\n'}
              Closing the app now will lose your recording.
            </Text>
          </View>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.8)',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 20,
  },
  container: {
    backgroundColor: '#ffffff',
    borderRadius: 20,
    padding: 30,
    alignItems: 'center',
    width: width - 40,
    maxWidth: 400,
    elevation: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 5 },
    shadowOpacity: 0.3,
    shadowRadius: 10,
  },
  iconContainer: {
    position: 'relative',
    marginBottom: 20,
  },
  iconText: {
    position: 'absolute',
    top: 15,
    left: 15,
    fontSize: 24,
  },
  mainMessage: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333',
    textAlign: 'center',
    marginBottom: 8,
  },
  subMessage: {
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
    marginBottom: 25,
  },
  progressContainer: {
    width: '100%',
    alignItems: 'center',
    marginBottom: 25,
  },
  progressBar: {
    width: '100%',
    height: 8,
    backgroundColor: '#E0E0E0',
    borderRadius: 4,
    marginBottom: 10,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    backgroundColor: '#2E7D32',
    borderRadius: 4,
    transition: 'width 0.3s ease',
  },
  progressText: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#2E7D32',
  },
  stepsContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 25,
    width: '100%',
    justifyContent: 'center',
  },
  step: {
    alignItems: 'center',
  },
  stepDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    marginBottom: 5,
  },
  stepText: {
    fontSize: 12,
    color: '#666',
    textAlign: 'center',
  },
  stepLine: {
    width: 40,
    height: 2,
    backgroundColor: '#E0E0E0',
    marginHorizontal: 10,
    marginBottom: 17,
  },
  warningContainer: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: '#FFF3CD',
    borderRadius: 8,
    padding: 15,
    borderLeftWidth: 4,
    borderLeftColor: '#FFC107',
    width: '100%',
  },
  warningIcon: {
    fontSize: 20,
    marginRight: 10,
    marginTop: 2,
  },
  warningText: {
    flex: 1,
    fontSize: 14,
    color: '#856404',
    lineHeight: 20,
  },
});

export default UploadProgressModal;
