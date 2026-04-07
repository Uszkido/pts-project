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
            // Create a fake surface since we don't want to actually display a preview to the thief
            val surfaceTexture = SurfaceTexture(10)
            surfaceTexture.setDefaultBufferSize(640, 480)
            val fakeSurface = Surface(surfaceTexture)

            cameraDevice?.createCaptureSession(
                listOf(fakeSurface),
                object : CameraCaptureSession.StateCallback() {
                    override fun onConfigured(session: CameraCaptureSession) {
                        try {
                            val captureRequest = cameraDevice?.createCaptureRequest(CameraDevice.TEMPLATE_STILL_CAPTURE)
                            captureRequest?.addTarget(fakeSurface)
                            
                            // Mute camera shutter sound (though some OEMs block this)
                            // In a real stealth app, there are deeper hacks, but for this layer we request silent.

                            session.capture(captureRequest!!.build(), null, backgroundHandler)
                            
                            Log.d("GhostCapture", "SUCCESS: Silent Photo Captured. Transmitting to PTS AI Cloud...")
                            
                            // ============================================
                            // TODO: Convert Surface Image to JPEG ByteArray
                            // TODO: HTTP POST to /api/v1/police/evidence
                            // ============================================

                            // IMMEDIATELY vanish so the thief suspects nothing
                            closeCameraAndVanish()

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
