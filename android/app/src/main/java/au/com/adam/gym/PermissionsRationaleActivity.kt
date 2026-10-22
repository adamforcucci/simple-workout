package au.com.adam.gym

import android.app.Activity
import android.content.Intent
import android.net.Uri
import android.os.Bundle

/**
 * Health Connect links here ("why does this app need access?"); it has to
 * exist for the permission request to work. Opens the privacy policy.
 */
class PermissionsRationaleActivity : Activity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        try {
            startActivity(Intent(Intent.ACTION_VIEW, Uri.parse(getString(R.string.privacy_policy_url))))
        } catch (_: Exception) {
            // No browser: nothing more we can show.
        }
        finish()
    }
}
