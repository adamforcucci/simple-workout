package au.com.adam.gym;

import android.app.Activity;
import android.content.ContentResolver;
import android.content.Intent;
import android.net.Uri;
import androidx.activity.result.ActivityResult;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.ActivityCallback;
import com.getcapacitor.annotation.CapacitorPlugin;
import java.io.InputStream;
import java.io.OutputStream;

/**
 * Copies a backup file (already written to the app's cache) wherever the user
 * picks with the system "Save to" screen (Downloads by default). Needs no
 * storage permission on any Android version. Only the path crosses the bridge:
 * Android keeps the pending call's options in a size-limited Bundle while the
 * picker is open, and a whole backup is too big for it.
 */
@CapacitorPlugin(name = "BackupFile")
public class BackupFilePlugin extends Plugin {

    @PluginMethod
    public void save(PluginCall call) {
        if (call.getString("path") == null) {
            call.reject("Missing path");
            return;
        }
        Intent intent = new Intent(Intent.ACTION_CREATE_DOCUMENT)
            .addCategory(Intent.CATEGORY_OPENABLE)
            .setType("application/json")
            .putExtra(Intent.EXTRA_TITLE, call.getString("filename", "backup.json"));
        startActivityForResult(call, intent, "saveResult");
    }

    @ActivityCallback
    private void saveResult(PluginCall call, ActivityResult result) {
        Uri uri = result.getData() != null ? result.getData().getData() : null;
        if (result.getResultCode() != Activity.RESULT_OK || uri == null) {
            call.resolve(new JSObject().put("saved", false));
            return;
        }
        Uri source = Uri.parse(call.getString("path"));
        new Thread(() -> {
            ContentResolver resolver = getContext().getContentResolver();
            try (InputStream in = resolver.openInputStream(source); OutputStream out = resolver.openOutputStream(uri, "wt")) {
                if (in == null || out == null) throw new IllegalStateException("Couldn't open the file");
                byte[] buffer = new byte[64 * 1024];
                for (int n; (n = in.read(buffer)) > 0; ) out.write(buffer, 0, n);
                call.resolve(new JSObject().put("saved", true));
            } catch (Exception e) {
                call.reject("Couldn't save the file: " + e.getMessage());
            }
        }).start();
    }
}
