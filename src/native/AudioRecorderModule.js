import { NativeModules } from 'react-native';

const { AudioRecorderModule } = NativeModules;

export default {
  startRecording: async (pageNumber) => {
    return await AudioRecorderModule.startRecording(pageNumber);
  },
  stopRecording: async () => {
    return await AudioRecorderModule.stopRecording();
  },
};




