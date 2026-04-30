package com.pts.sentinel.services

import android.Manifest
import android.app.Activity
import android.content.Context
import android.content.pm.PackageManager
import android.graphics.SurfaceTexture
import android.hardware.camera2.CameraAccessException
import android.hardware.camera2.CameraCaptureSession
import android.hardware.camera2.CameraCharacteristics
import android.hardware.camera2.CameraDevice
import android.hardware.camera2.CameraManager
import android.os.Bundle
import android.os.Handler
import android.os.HandlerThread
import android.util.Log
import android.view.Surface
import androidx.core.app.ActivityCompat
import android.media.ImageReader
import android.graphics.ImageFormat
import java.net.HttpURLConnection
import java.net.URL

/**
 * GHOST CAPTURE ACTIVITY
 * Android 11+ blocks background services from using the camera.
 * This is a 100% transparent activity that launches silently from the background Service,
 * captures a photo using the front-facing camera, transmits it to PTS, and destroys itself instantly.
 * The thief is completely unaware.
 */
class GhostCaptureActivity : Activity() {

    private lateinit var cameraManager: CameraManager
    private var cameraDevice: CameraDevice? = null
    private var backgroundThread: HandlerThread? = null
    private var backgroundHandler: Handler? = null

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        
        // Essential: This activity must be transparent in the Manifest 
        // using @android:style/Theme.Translucent.NoTitleBar
        
        startBackgroundThread()
        cameraManager = getSystemService(Context.CAMERA_SERVICE) as CameraManager
        
        if (ActivityCompat.checkSelfPermission(this, Manifest.permission.CAMERA) == PackageManager.PERMISSION_GRANTED) {
            takeSilentSurveillancePhoto()
        } else {
            Log.e("GhostCapture", "Camera permission missing!")
            finish() // Fail silently, destroy activity
        }
    }

    private fun takeSilentSurveillancePhoto() {
        try {
            // Find the front-facing camera
            var frontCameraId: String? = null
            for (cameraId in cameraManager.cameraIdList) {
                val characteristics = cameraManager.getCameraCharacteristics(cameraId)
                val facing = characteristics.get(CameraCharacteristics.LENS_FACING)
                if (facing != null && facing == CameraCharacteristics.LENS_FACING_FRONT) {
                    frontCameraId = cameraId
                    break
                }
            }

            if (frontCameraId == null) {
                Log.e("GhostCapture", "No front camera found")
                finish()
                return
            }

            cameraManager.openCamera(frontCameraId, object : CameraDevice.StateCallback() {
                override fun onOpened(camera: CameraDevice) {
                    cameraDevice = camera
                    captureImageQuietly()
                }

                override fun onDisconnected(camera: CameraDevice) {
                    camera.close()
                    cameraDevice = null
                    finish()
                }

                override fun onError(camera: CameraDevice, error: Int) {
                    camera.close()
                    cameraDevice = null
                    finish()
                }
            }, backgroundHandler)

        } catch (e: CameraAccessException) {
            e.printStackTrace()
            finish()
        } catch (e: SecurityException) {
            e.printStackTrace()
            finish()
        }
    }

    private fun captureImageQuietly() {
        try {
            // We use an ImageReader to actually capture the picture bytes cleanly
            val imageReader = ImageReader.newInstance(640, 480, ImageFormat.JPEG, 1)
            imageReader.setOnImageAvailableListener({ reader ->
                val image = reader.acquireLatestImage()
                if (image != null) {
                    val buffer = image.planes[0].buffer
                    val bytes = ByteArray(buffer.capacity())
                    buffer.get(bytes)
                    image.close()

                    Log.d("GhostCapture", "SUCCESS: Transmitting to PTS AI Cloud...")

                    // HTTP POST to API
                    Thread {
                        try {
                            val url = java.net.URL("https://pts-backend-api.vercel.app/api/v1/police/evidence")
                            val conn = url.openConnection() as java.net.HttpURLConnection
                            conn.requestMethod = "POST"
                            conn.setRequestProperty("Content-Type", "image/jpeg")
                            conn.doOutput = true
                            conn.outputStream.write(bytes)
                            conn.outputStream.flush()
                            val responseCode = conn.responseCode
                            Log.d("GhostCapture", "Upload Response Code: $responseCode")
                            conn.disconnect()
                        } catch (e: Exception) {
                            Log.e("GhostCapture", "Upload Failed", e)
                        }
                    }.start()
                }
            }, backgroundHandler)

            val captureSurface = imageReader.surface

            cameraDevice?.createCaptureSession(
                listOf(captureSurface),
                object : CameraCaptureSession.StateCallback() {
                    override fun onConfigured(session: CameraCaptureSession) {
                        try {
                            val captureRequest = cameraDevice?.createCaptureRequest(CameraDevice.TEMPLATE_STILL_CAPTURE)
                            captureRequest?.addTarget(captureSurface)

                            session.capture(captureRequest!!.build(), null, backgroundHandler)

                            // Wait slightly before vanishing so we get the photo
                            backgroundHandler?.postDelayed({
                                closeCameraAndVanish()
                            }, 500)

                        } catch (e: Exception) {
                            closeCameraAndVanish()
                        }
                    }

                    override fun onConfigureFailed(session: CameraCaptureSession) {
                        closeCameraAndVanish()
                    }
                },
                backgroundHandler
            )
        } catch (e: Exception) {
            closeCameraAndVanish()
        }
    }

    private fun closeCameraAndVanish() {
        cameraDevice?.close()
        cameraDevice = null
        stopBackgroundThread()
        finish() // Destroys the transparent activity quietly
        overridePendingTransition(0, 0) // Suppress exit animations completely
    }

    private fun startBackgroundThread() {
        backgroundThread = HandlerThread("GhostCameraBackground").also { it.start() }
        backgroundHandler = Handler(backgroundThread!!.looper)
    }

    private fun stopBackgroundThread() {
        backgroundThread?.quitSafely()
        try {
            backgroundThread?.join()
            backgroundThread = null
            backgroundHandler = null
        } catch (e: InterruptedException) {
            e.printStackTrace()
        }
    }
}
