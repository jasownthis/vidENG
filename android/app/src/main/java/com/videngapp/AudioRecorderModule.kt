package com.videngapp

import android.media.MediaRecorder
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod
import java.io.File

class AudioRecorderModule(reactContext: ReactApplicationContext) :
  ReactContextBaseJavaModule(reactContext) {

  private var recorder: MediaRecorder? = null
  private var currentFilePath: String? = null

  override fun getName(): String = "AudioRecorderModule"

  @ReactMethod
  fun startRecording(pageNumber: Int, promise: Promise) {
    try {
      val context = reactApplicationContext
      val dir = File(context.filesDir, "recordings")
      if (!dir.exists()) dir.mkdirs()

      val file = File(dir, "page_" + pageNumber + "_" + System.currentTimeMillis().toString() + ".mp4")
      currentFilePath = file.absolutePath

      recorder = MediaRecorder().apply {
        setAudioSource(MediaRecorder.AudioSource.MIC)
        setOutputFormat(MediaRecorder.OutputFormat.MPEG_4)
        setAudioEncoder(MediaRecorder.AudioEncoder.AAC)
        setAudioEncodingBitRate(128000)
        setAudioSamplingRate(44100)
        setOutputFile(file.absolutePath)
        prepare()
        start()
      }

      promise.resolve(file.absolutePath)
    } catch (e: Exception) {
      e.printStackTrace()
      promise.reject("RECORDER_ERROR", e)
    }
  }

  @ReactMethod
  fun stopRecording(promise: Promise) {
    try {
      recorder?.apply {
        stop()
        release()
      }
      recorder = null

      val path = currentFilePath ?: ""
      currentFilePath = null
      promise.resolve("file://" + path)
    } catch (e: Exception) {
      e.printStackTrace()
      promise.reject("STOP_ERROR", e)
    }
  }
}




