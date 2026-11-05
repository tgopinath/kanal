package com.gopinath.kanal

import android.app.Activity
import android.content.Intent
import androidx.activity.result.ActivityResult
import com.getcapacitor.JSObject
import com.getcapacitor.Plugin
import com.getcapacitor.PluginCall
import com.getcapacitor.PluginMethod
import com.getcapacitor.annotation.ActivityCallback
import com.getcapacitor.annotation.CapacitorPlugin
import com.google.ar.core.ArCoreApk

/**
 * The web menu's door to the camera.
 * - support(): is ARCore available on this phone (and installed)?
 * - open({ dishes, index }): starts [TableArActivity]; resolves with the dish the guest was looking at when they closed it.
 */
@CapacitorPlugin(name = "TableAR")
class TableARPlugin : Plugin() {

    @PluginMethod
    fun support(call: PluginCall) {
        val a = ArCoreApk.getInstance().checkAvailability(context)
        call.resolve(JSObject().apply {
            put("supported", a.isSupported || a.isTransient)
            put("status", a.name)
        })
    }

    @PluginMethod
    fun open(call: PluginCall) {
        val dishes = call.getArray("dishes")?.toString() ?: return call.reject("No dishes")
        val intent = Intent(context, TableArActivity::class.java)
            .putExtra(TableArActivity.EXTRA_DISHES, dishes)
            .putExtra(TableArActivity.EXTRA_INDEX, call.getInt("index", 0) ?: 0)
            .putExtra(TableArActivity.EXTRA_LOCKUP, call.getString("lockup")?.takeIf { it.startsWith("ar/") } ?: "ar/lockup")
        startActivityForResult(call, intent, "arClosed")
    }

    @ActivityCallback
    private fun arClosed(call: PluginCall?, result: ActivityResult) {
        if (call == null) return
        val index = result.data?.getIntExtra(TableArActivity.EXTRA_INDEX, -1) ?: -1
        val error = result.data?.getStringExtra(TableArActivity.EXTRA_ERROR)
        call.resolve(JSObject().apply {
            put("index", index)
            put("ok", result.resultCode == Activity.RESULT_OK)
            if (error != null) put("error", error)
        })
    }
}
