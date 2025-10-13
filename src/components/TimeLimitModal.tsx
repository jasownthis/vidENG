import React from 'react';
import { Modal, View, Text, StyleSheet, TouchableOpacity } from 'react-native';

interface TimeLimitModalProps {
  visible: boolean;
  title?: string;
  message: string;
  onClose: () => void;
}

const TimeLimitModal: React.FC<TimeLimitModalProps> = ({ visible, title = 'Time limit exceeded', message, onClose }) => {
  return (
    <Modal visible={visible} transparent animationType="fade" statusBarTranslucent>
      <View style={styles.overlay}>
        <View style={styles.card}>
          <Text style={styles.title}>{title}</Text>
          <Text style={styles.subtitle}>{message}</Text>
          <TouchableOpacity style={styles.button} onPress={onClose}>
            <Text style={styles.buttonText}>OK</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'center', alignItems: 'center', padding: 20 },
  card: { width: '100%', maxWidth: 420, backgroundColor: '#fff', borderRadius: 16, padding: 18 },
  title: { fontSize: 18, fontWeight: '800', color: '#D84315', marginBottom: 6, textAlign: 'center' },
  subtitle: { fontSize: 14, color: '#555', textAlign: 'center', marginBottom: 12 },
  button: { alignSelf: 'center', marginTop: 6, backgroundColor: '#2E7D32', borderRadius: 10, paddingVertical: 10, paddingHorizontal: 20 },
  buttonText: { color: '#fff', fontWeight: '700' },
});

export default TimeLimitModal;


