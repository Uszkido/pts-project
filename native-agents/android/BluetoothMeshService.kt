package com.pts.sentinel.services

import android.Manifest
import android.app.Service
import android.bluetooth.BluetoothAdapter
import android.bluetooth.BluetoothManager
import android.bluetooth.le.AdvertiseData
import android.bluetooth.le.AdvertiseSettings
import android.bluetooth.le.BluetoothLeAdvertiser
import android.bluetooth.le.BluetoothLeScanner
import android.bluetooth.le.ScanCallback
import android.bluetooth.le.ScanFilter
import android.bluetooth.le.ScanResult
import android.bluetooth.le.ScanSettings
import android.content.Context
import android.content.Intent
import android.content.pm.PackageManager
import android.os.IBinder
import android.os.ParcelUuid
import android.util.Log
import androidx.core.app.ActivityCompat
import java.util.UUID

/**
 * PTS SENTINEL MESH (Hydra Network) - BLUETOOTH LOW ENERGY INTERFACE
 * 
 * If a thief removes the SIM card and turns off Wi-Fi, the device goes completely "offline."
 * This service activates a stealth Bluetooth Low Energy (BLE) beacon.
 * 
 * 1. THE BROADCASTER: The stolen offline phone acts as a silent beacon, broadcasting a cryptographically 
 * signed SOS packet.
 * 2. THE RECEIVER: Any other phone in the country with PTS installed (or a vendor terminal) constantly
 * listens in the background. If it hears the SOS beacon, it grabs the offline phone's location and 
 * forwards it to the PTS cloud via the *Receiving phone's* internet connection.
 */
class BluetoothMeshService : Service() {

    private var bluetoothAdapter: BluetoothAdapter? = null
    private var bleAdvertiser: BluetoothLeAdvertiser? = null
    private var bleScanner: BluetoothLeScanner? = null

    // We generate a strict custom UUID specific to PTS Sentinel
    private val PTS_MESH_UUID = ParcelUuid(UUID.fromString("0000FEAA-0000-1000-8000-00805F9B34FB")) // Example custom UUID
    private val TAG = "PTS_Mesh_Network"
    
    private var isLostMode = false

    override fun onCreate() {
        super.onCreate()
        val bluetoothManager = getSystemService(Context.BLUETOOTH_SERVICE) as BluetoothManager
        bluetoothAdapter = bluetoothManager.adapter
    }

    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
        isLostMode = intent?.getBooleanExtra("LOST_MODE", false) ?: false

        if (bluetoothAdapter == null || !bluetoothAdapter!!.isEnabled) {
            Log.e(TAG, "Bluetooth is disabled or not supported. Cannot start Mesh.")
            // In a real device admin scenario, we would forcefully enable Bluetooth here.
            return START_STICKY
        }

        if (isLostMode) {
            // My device is stolen and offline! Start screaming silently via BLE.
            startSilentMeshBroadcast()
        } else {
            // My device is safe. Act as a Good Samaritan router for other stolen devices.
            startMeshListeningForStolenDevices()
        }

        return START_STICKY
    }

    /**
     * =========================================
     * STAGE 1: OFFLINE DEVICE BROADCAST (SOS)
     * =========================================
     */
    private fun startSilentMeshBroadcast() {
        if (ActivityCompat.checkSelfPermission(this, Manifest.permission.BLUETOOTH_ADVERTISE) != PackageManager.PERMISSION_GRANTED) {
            Log.e(TAG, "Missing BLE Advertise Permission")
            return
        }

        bleAdvertiser = bluetoothAdapter?.bluetoothLeAdvertiser
        if (bleAdvertiser == null) return

        // Configure to be extremely stealthy but reliable
        val settings = AdvertiseSettings.Builder()
            .setAdvertiseMode(AdvertiseSettings.ADVERTISE_MODE_LOW_LATENCY)
            .setTxPowerLevel(AdvertiseSettings.ADVERTISE_TX_POWER_HIGH) // Blast signal far
            .setConnectable(false) // Don't let the thief's phone connect. Pure beacon.
            .build()

        // Hide a heavily encrypted 15-byte ID (Hash of IMEI) in the Manufacturer specific data
        // For demonstration, encoding "PTS-SOS" payload
        val secretPayload = "PTS-SOS-99238".toByteArray(Charsets.UTF_8)
        
        val data = AdvertiseData.Builder()
            .setIncludeDeviceName(false) // Never include real name. Keep it completely anonymous to sniffers.
            .addServiceUuid(PTS_MESH_UUID)
            .addManufacturerData(1010, secretPayload) // 1010 = PTS Manufacturer ID Code
            .build()

        bleAdvertiser?.startAdvertising(settings, data, advertiseCallback)
        Log.d(TAG, "OFFLINE MESH: Stolen device is now silently blasting BLE SOS signals.")
    }

    private val advertiseCallback = object : android.bluetooth.le.AdvertiseCallback() {
        override fun onStartSuccess(settingsInEffect: AdvertiseSettings) {
            Log.d(TAG, "BLE SOS Broadcast started successfully.")
        }
        override fun onStartFailure(errorCode: Int) {
            Log.e(TAG, "BLE SOS Broadcast Failed: $errorCode")
        }
    }

    /**
     * =========================================
     * STAGE 2: GOOD SAMARITAN LISTENING ROUTER
     * =========================================
     */
    private fun startMeshListeningForStolenDevices() {
        if (ActivityCompat.checkSelfPermission(this, Manifest.permission.BLUETOOTH_SCAN) != PackageManager.PERMISSION_GRANTED) {
            Log.e(TAG, "Missing BLE Scan Permission")
            return
        }

        bleScanner = bluetoothAdapter?.bluetoothLeScanner
        if (bleScanner == null) return

        // We only want to listen for devices broadcasting the PTS MESH UUID, saving battery.
        val filter = ScanFilter.Builder()
            .setServiceUuid(PTS_MESH_UUID)
            .build()

        val settings = ScanSettings.Builder()
            .setScanMode(ScanSettings.SCAN_MODE_LOW_POWER) // Keep battery impact near zero for normal users
            .build()

        bleScanner?.startScan(listOf(filter), settings, scanCallback)
        Log.d(TAG, "MESH ROUTER: Device is safely listening for stolen offline devices nearby.")
    }

    private val scanCallback = object : ScanCallback() {
        override fun onScanResult(callbackType: Int, result: ScanResult) {
            if (ActivityCompat.checkSelfPermission(this@BluetoothMeshService, Manifest.permission.BLUETOOTH_CONNECT) != PackageManager.PERMISSION_GRANTED) return
            
            // We caught a stray signal!
            val manufacturerData = result.scanRecord?.getManufacturerSpecificData(1010)
            if (manufacturerData != null) {
                val decodedSignal = String(manufacturerData, Charsets.UTF_8)
                Log.d(TAG, "🚨 MATCH! Intercepted offline stolen device SOS: $decodedSignal")

                // ============================================
                // WHAT HAPPENS NEXT:
                // 1. Get THIS phone's current GPS Location.
                // 2. Package THIS location + the Decoded Stolen ID.
                // 3. Send over HTTP POST to /api/v1/police/mesh-triangulate using THIS phone's internet.
                // ============================================
            }
        }

        override fun onScanFailed(errorCode: Int) {
            Log.e(TAG, "Mesh Router Scan Failed with code: $errorCode")
        }
    }

    override fun onDestroy() {
        super.onDestroy()
        if (ActivityCompat.checkSelfPermission(this, Manifest.permission.BLUETOOTH_ADVERTISE) == PackageManager.PERMISSION_GRANTED) {
            bleAdvertiser?.stopAdvertising(advertiseCallback)
            bleScanner?.stopScan(scanCallback)
        }
    }

    override fun onBind(intent: Intent?): IBinder? = null
}
