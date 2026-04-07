package com.pts.sentinel.services

import android.app.admin.DeviceAdminReceiver
import android.content.Context
import android.content.Intent
import android.util.Log
import android.widget.Toast

/**
 * ANTI-DELETE SHIELD (Device Administrator)
 * This class prevents the PTS Sentinel app from being uninstalled by thieves.
 * While active, the Android OS physically greys out the "Uninstall" button.
 */
class SentinelAdminReceiver : DeviceAdminReceiver() {

    override fun onEnabled(context: Context, intent: Intent) {
        super.onEnabled(context, intent)
        Log.d("SentinelShield", "Anti-Delete Shield ENABLED. App is now locked into the OS.")
        Toast.makeText(context, "Anti-Delete Shield Activated. Device secured.", Toast.LENGTH_LONG).show()
    }

    override fun onDisableRequested(context: Context, intent: Intent): CharSequence {
        // This is presented to the user as a warning if they try to disable the admin rights.
        Log.w("SentinelShield", "WARNING: Attempt to disable Anti-Delete Shield detected!")
        return "WARNING: Disabling Sentinel Security will leave your device completely vulnerable to theft and wipe out your digital insurance. Are you sure you want to proceed?"
    }

    override fun onDisabled(context: Context, intent: Intent) {
        super.onDisabled(context, intent)
        Log.e("SentinelShield", "CRITICAL: Anti-Delete Shield has been DISABLED.")
        
        // Fired when the user somehow disables the Device Admin.
        // In a true enterprise scenario, we would trigger an immediate "LOST MODE" alert to the backend.
    }
}
