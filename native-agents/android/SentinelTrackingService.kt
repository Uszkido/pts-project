package com.pts.sentinel.services

import android.Manifest
import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.Service
import android.app.admin.DevicePolicyManager
import android.content.ComponentName
import android.content.Context
import android.content.Intent
import android.content.pm.PackageManager
import android.location.Location
import android.os.Build
import android.os.IBinder
import android.os.Looper
import android.os.PowerManager
import android.telephony.SmsManager
import android.util.Log
import androidx.core.app.ActivityCompat
import androidx.core.app.NotificationCompat
import com.google.android.gms.location.*
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch
import java.net.HttpURLConnection
import java.net.URL
import org.json.JSONObject

class SentinelTrackingService : Service() {

    private lateinit var fusedLocationClient: FusedLocationProviderClient
    private lateinit var locationCallback: LocationCallback
    private lateinit var geofencingClient: GeofencingClient
    private var wakeLock: PowerManager.WakeLock? = null
    
    private val PTS_API_URL = "https://pts-backend-main-project.onrender.com/api/v1/guardian/beacon"
    private val PTS_SMS_GATEWAY = "+2348000000000" // Replace with actual PTS Twilio/Gateway Number
    private var isLostMode = false

    override fun onCreate() {
        super.onCreate()
        fusedLocationClient = LocationServices.getFusedLocationProviderClient(this)
        geofencingClient = LocationServices.getGeofencingClient(this)
        
        setupLocationCallback()
    }

    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
        isLostMode = intent?.getBooleanExtra("LOST_MODE", false) ?: false
        
        // 4. THE UNDEAD TRACKER: Acquire WakeLock to survive Doze mode
        val powerManager = getSystemService(Context.POWER_SERVICE) as PowerManager
        wakeLock = powerManager.newWakeLock(PowerManager.PARTIAL_WAKE_LOCK, "Sentinel::UndeadWakeLock")
        wakeLock?.acquire(10 * 60 * 1000L /*10 minutes max per sweep*/)

        if (isLostMode) {
            triggerGhostCapture()
        }

        startForeground(1, createNotification())
        requestLocationUpdates()
        
        return START_STICKY // OS will auto-restart this if killed
    }

    private fun requestLocationUpdates() {
        val locationRequest = LocationRequest.Builder(
            if (isLostMode) Priority.PRIORITY_HIGH_ACCURACY else Priority.PRIORITY_BALANCED_POWER_ACCURACY,
            if (isLostMode) 5000L else 30000L
        ).build()

        if (ActivityCompat.checkSelfPermission(this, Manifest.permission.ACCESS_FINE_LOCATION) == PackageManager.PERMISSION_GRANTED) {
            fusedLocationClient.requestLocationUpdates(locationRequest, locationCallback, Looper.getMainLooper())
        }
    }

    private fun setupLocationCallback() {
        locationCallback = object : LocationCallback() {
            override fun onLocationResult(locationResult: LocationResult) {
                for (location in locationResult.locations) {
                    Log.d("Sentinel", "GPS Update: ${location.latitude}, ${location.longitude}")
                    transmitToBackend(location)
                }
            }
        }
    }

    private fun transmitToBackend(location: Location) {
        CoroutineScope(Dispatchers.IO).launch {
            try {
                val url = URL(PTS_API_URL)
                val conn = url.openConnection() as HttpURLConnection
                conn.requestMethod = "POST"
                conn.setRequestProperty("Content-Type", "application/json; utf-8")
                conn.doOutput = true

                val payload = JSONObject().apply {
                    put("latitude", location.latitude)
                    put("longitude", location.longitude)
                    put("accuracy", location.accuracy)
                    put("status", if (isLostMode) "LOST" else "ONLINE")
                }

                conn.outputStream.use { os ->
                    val input = payload.toString().toByteArray(Charsets.UTF_8)
                    os.write(input, 0, input.size)
                }
                
                val responseCode = conn.responseCode
                if (responseCode != 200 && isLostMode) {
                    executeOfflineFailsafe(location)
                }
            } catch (e: Exception) {
                Log.e("Sentinel", "Network Error - Triggering Offline Failsafe", e)
                if (isLostMode) {
                    executeOfflineFailsafe(location)
                }
            }
        }
    }

    /**
     * 1. OFFLINE FAILSAFE
     * If Wi-Fi/Data drops, bypass the internet and route data directly through the cellular network.
     */
    private fun executeOfflineFailsafe(location: Location) {
        try {
            Log.d("Sentinel", "Executing Offline SMS Failsafe...")
            val smsManager = SmsManager.getDefault()
            val text = "PTS_LOST_PULSE:${location.latitude},${location.longitude},AC:${location.accuracy}"
            
            // Sends a hidden SMS directly to the server's gateway number without showing up in the Sent folder
            smsManager.sendTextMessage(PTS_SMS_GATEWAY, null, text, null, null)
        } catch (e: Exception) {
            Log.e("Sentinel", "Offline Failsafe blocked (No cellular signal or permission)", e)
        }
    }

    /**
     * 2. GHOST CAPTURE (Architecture Mock)
     * Takes a silent photo using Camera2 API in the background upon theft confirmation.
     */
    private fun triggerGhostCapture() {
        Log.d("Sentinel", "Activating Ghost Capture (Camera/Mic Trap)...")
        // Implementation Note for Developer:
        // Due to Android 11+ background camera restrictions, this must be fired from a foreground 
        // service or transparent activity wrapper utilizing `android.hardware.camera2`.
        // The image ByteArray will then be passed to the backend via POST /api/v1/upload.
    }

    /**
     * 3. ANTI-DELETE SHIELD (Architecture Helper)
     * Verify if we have Device Administrator rights.
     */
    private fun ensureAdminShield() {
        val dpm = getSystemService(Context.DEVICE_POLICY_SERVICE) as DevicePolicyManager
        // val componentName = ComponentName(this, SentinelAdminReceiver::class.java)
        // if (!dpm.isAdminActive(componentName)) {
        //     // Prompt UI to force physical lock-in
        // }
    }

    private fun createNotification(): Notification {
        val channelId = "sentinel_channel_id"
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            val channel = NotificationChannel(channelId, "System Service", NotificationManager.IMPORTANCE_MIN)
            getSystemService(NotificationManager::class.java).createNotificationChannel(channel)
        }
        return NotificationCompat.Builder(this, channelId)
            .setContentTitle("Device Protected")
            .setContentText("Sentinel is guarding this device.")
            .setSmallIcon(android.R.drawable.sym_def_app_icon) 
            .build()
    }

    override fun onDestroy() {
        super.onDestroy()
        fusedLocationClient.removeLocationUpdates(locationCallback)
        if (wakeLock?.isHeld == true) {
            wakeLock?.release() // Ensure we don't leak CPU
        }
    }

    override fun onBind(intent: Intent?): IBinder? = null
}
