package au.com.adam.gym

import android.content.Intent
import android.net.Uri
import androidx.activity.result.ActivityResult
import androidx.health.connect.client.HealthConnectClient
import androidx.health.connect.client.PermissionController
import androidx.health.connect.client.permission.HealthPermission
import androidx.health.connect.client.records.ExerciseSegment
import androidx.health.connect.client.records.ExerciseSessionRecord
import androidx.health.connect.client.records.HeartRateRecord
import androidx.health.connect.client.records.TotalCaloriesBurnedRecord
import androidx.health.connect.client.records.metadata.Device
import androidx.health.connect.client.records.metadata.Metadata
import androidx.health.connect.client.units.Energy
import com.getcapacitor.JSObject
import com.getcapacitor.Plugin
import com.getcapacitor.PluginCall
import com.getcapacitor.PluginMethod
import com.getcapacitor.annotation.ActivityCallback
import com.getcapacitor.annotation.CapacitorPlugin
import java.time.Instant
import java.time.ZoneOffset
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.cancel
import kotlinx.coroutines.launch
import org.json.JSONObject

/**
 * Writes finished workouts to Health Connect: one strength-training session
 * (with a segment per set), its heart rate samples and total calories. Records
 * are keyed by the workout's id, so saving again replaces rather than duplicates.
 */
@CapacitorPlugin(name = "HealthConnect")
class HealthConnectPlugin : Plugin() {

    private val scope = CoroutineScope(SupervisorJob() + Dispatchers.Main)

    private val permissions = setOf(
        HealthPermission.getWritePermission(ExerciseSessionRecord::class),
        HealthPermission.getWritePermission(HeartRateRecord::class),
        HealthPermission.getWritePermission(TotalCaloriesBurnedRecord::class),
    )

    private val client get() = HealthConnectClient.getOrCreate(context)

    override fun handleOnDestroy() {
        scope.cancel()
    }

    /** availability: "available" | "update_required" | "unavailable"; granted: all write permissions held. */
    @PluginMethod
    fun status(call: PluginCall) {
        val availability = availability()
        if (availability != "available") {
            call.resolve(JSObject().put("availability", availability).put("granted", false))
            return
        }
        scope.launch {
            try {
                val granted = client.permissionController.getGrantedPermissions().containsAll(permissions)
                call.resolve(JSObject().put("availability", availability).put("granted", granted))
            } catch (e: Exception) {
                call.reject(e.message ?: "Health Connect error")
            }
        }
    }

    @PluginMethod
    fun requestAccess(call: PluginCall) {
        if (availability() != "available") {
            call.reject("Health Connect isn't available")
            return
        }
        val intent = PermissionController.createRequestPermissionResultContract()
            .createIntent(context, permissions)
        startActivityForResult(call, intent, "permissionsResult")
    }

    @ActivityCallback
    private fun permissionsResult(call: PluginCall, result: ActivityResult) {
        scope.launch {
            val granted = try {
                client.permissionController.getGrantedPermissions().containsAll(permissions)
            } catch (e: Exception) {
                false
            }
            call.resolve(JSObject().put("granted", granted))
        }
    }

    /** Sends the user to Play to install or update the Health Connect app (Android 13 and below). */
    @PluginMethod
    fun openStore(call: PluginCall) {
        val uri = Uri.parse("market://details?id=$PROVIDER&url=healthconnect%3A%2F%2Fonboarding")
        val intent = Intent(Intent.ACTION_VIEW, uri).setPackage("com.android.vending")
            .addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
        try {
            context.startActivity(intent)
        } catch (e: Exception) {
            context.startActivity(
                Intent(Intent.ACTION_VIEW, Uri.parse("https://play.google.com/store/apps/details?id=$PROVIDER"))
                    .addFlags(Intent.FLAG_ACTIVITY_NEW_TASK),
            )
        }
        call.resolve()
    }

    @PluginMethod
    fun openSettings(call: PluginCall) {
        val intent = Intent(HealthConnectClient.getHealthConnectManageDataIntent(context))
            .addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
        try {
            context.startActivity(intent)
            call.resolve()
        } catch (e: Exception) {
            call.reject("Couldn't open Health Connect")
        }
    }

    /**
     * { id, title, notes, startTime, endTime (epoch ms), utcOffsetS, calories?,
     *   heartRate: [{ time, bpm }], segments: [{ startTime, endTime, type, reps }] }
     */
    @PluginMethod
    fun saveWorkout(call: PluginCall) {
        val records = try {
            buildRecords(call.data)
        } catch (e: Exception) {
            call.reject(e.message ?: "Invalid workout")
            return
        }
        scope.launch {
            try {
                client.insertRecords(records)
                call.resolve()
            } catch (e: Exception) {
                call.reject(e.message ?: "Health Connect error")
            }
        }
    }

    @PluginMethod
    fun deleteWorkout(call: PluginCall) {
        val key = recordKey(call.getInt("id") ?: return call.reject("Missing id"))
        scope.launch {
            try {
                client.deleteRecords(ExerciseSessionRecord::class, emptyList(), listOf(key))
                client.deleteRecords(HeartRateRecord::class, emptyList(), listOf(key))
                client.deleteRecords(TotalCaloriesBurnedRecord::class, emptyList(), listOf(key))
                call.resolve()
            } catch (e: Exception) {
                call.reject(e.message ?: "Health Connect error")
            }
        }
    }

    private fun availability() = when (HealthConnectClient.getSdkStatus(context, PROVIDER)) {
        HealthConnectClient.SDK_AVAILABLE -> "available"
        HealthConnectClient.SDK_UNAVAILABLE_PROVIDER_UPDATE_REQUIRED -> "update_required"
        else -> "unavailable"
    }

    private fun buildRecords(data: JSONObject): List<androidx.health.connect.client.records.Record> {
        val key = recordKey(data.getInt("id"))
        val start = Instant.ofEpochMilli(data.getLong("startTime"))
        val end = Instant.ofEpochMilli(data.getLong("endTime"))
        val offset = ZoneOffset.ofTotalSeconds(data.getInt("utcOffsetS"))
        // A newer version replaces the stored records with the same client id.
        fun meta() = Metadata.activelyRecorded(DEVICE, key, System.currentTimeMillis())

        val segments = data.optJSONArray("segments").objects().map {
            ExerciseSegment(
                Instant.ofEpochMilli(it.getLong("startTime")),
                Instant.ofEpochMilli(it.getLong("endTime")),
                it.getInt("type"),
                it.optInt("reps", 0),
            )
        }
        val records = mutableListOf<androidx.health.connect.client.records.Record>(
            ExerciseSessionRecord(
                startTime = start,
                startZoneOffset = offset,
                endTime = end,
                endZoneOffset = offset,
                metadata = meta(),
                exerciseType = ExerciseSessionRecord.EXERCISE_TYPE_STRENGTH_TRAINING,
                title = data.optString("title").ifBlank { null },
                notes = data.optString("notes").ifBlank { null },
                segments = segments,
            ),
        )

        val samples = data.optJSONArray("heartRate").objects().map {
            HeartRateRecord.Sample(Instant.ofEpochMilli(it.getLong("time")), it.getLong("bpm"))
        }
        if (samples.isNotEmpty()) {
            records += HeartRateRecord(start, offset, end, offset, samples, meta())
        }

        val calories = data.optDouble("calories", 0.0)
        if (calories > 0) {
            records += TotalCaloriesBurnedRecord(start, offset, end, offset, Energy.kilocalories(calories), meta())
        }
        return records
    }

    private fun org.json.JSONArray?.objects(): List<JSONObject> =
        if (this == null) emptyList() else (0 until length()).map { getJSONObject(it) }

    private fun recordKey(id: Int) = "workout-$id"

    companion object {
        private const val PROVIDER = "com.google.android.apps.healthdata"
        private val DEVICE = Device(type = Device.TYPE_PHONE)
    }
}
