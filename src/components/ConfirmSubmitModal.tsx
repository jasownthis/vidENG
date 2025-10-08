import React from 'react';
import { Modal, View, Text, StyleSheet, TouchableOpacity } from 'react-native';

interface ConfirmSubmitModalProps {
  visible: boolean;
  onClose: () => void;
  onSubmitInProgress: () => void;
  onCompleteBook: () => void;
}

const ConfirmSubmitModal: React.FC<ConfirmSubmitModalProps> = ({ visible, onClose, onSubmitInProgress, onCompleteBook }) => {
  return (
    <Modal visible={visible} transparent animationType="fade" statusBarTranslucent>
      <View style={styles.overlay}>
        <View style={styles.card}>
          <Text style={styles.title}>Finish Reading?</Text>
          <Text style={styles.subtitle}>Choose how you want to save your progress.</Text>

          <View style={styles.option}>
            <Text style={styles.optionIcon}>💾</Text>
            <View style={styles.optionTexts}>
              <Text style={styles.optionTitle}>Submit (In-Progress)</Text>
              <Text style={styles.optionDesc}>Upload audio and keep reading progress open.</Text>
            </View>
          </View>
          <TouchableOpacity style={[styles.button, styles.progressBtn]} onPress={onSubmitInProgress}>
            <Text style={styles.buttonText}>Submit & Save Audio</Text>
          </TouchableOpacity>

          <View style={[styles.option, { marginTop: 14 }]}>
            <Text style={styles.optionIcon}>🏁</Text>
            <View style={styles.optionTexts}>
              <Text style={styles.optionTitle}>Complete Book</Text>
              <Text style={styles.optionDesc}>Upload audio and mark the book completed to unlock the quiz.</Text>
            </View>
          </View>
          <TouchableOpacity style={[styles.button, styles.completeBtn]} onPress={onCompleteBook}>
            <Text style={styles.completeText}>Complete Book</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.cancelArea} onPress={onClose}>
            <Text style={styles.cancelText}>Cancel</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center', padding: 20 },
  card: { width: '100%', maxWidth: 420, backgroundColor: '#fff', borderRadius: 16, padding: 18 },
  title: { fontSize: 18, fontWeight: '800', color: '#2E7D32', marginBottom: 4, textAlign: 'center' },
  subtitle: { fontSize: 13, color: '#666', textAlign: 'center', marginBottom: 12 },
  option: { flexDirection: 'row', alignItems: 'flex-start' },
  optionIcon: { fontSize: 18, marginRight: 10, marginTop: 2 },
  optionTexts: { flex: 1 },
  optionTitle: { fontSize: 14, fontWeight: '700', color: '#333' },
  optionDesc: { fontSize: 12, color: '#666', marginTop: 2 },
  button: { marginTop: 8, paddingVertical: 12, borderRadius: 10, alignItems: 'center' },
  progressBtn: { backgroundColor: '#2196F3' },
  buttonText: { color: '#fff', fontSize: 15, fontWeight: '700' },
  completeBtn: { backgroundColor: '#E8F5E8', borderWidth: 1, borderColor: '#2E7D32' },
  completeText: { color: '#2E7D32', fontSize: 15, fontWeight: '700' },
  cancelArea: { paddingVertical: 10, alignItems: 'center' },
  cancelText: { color: '#999', fontSize: 14 },
});

export default ConfirmSubmitModal;


