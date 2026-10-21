package au.com.adam.gym;

import android.content.Context;
import android.content.res.Configuration;
import android.content.res.Resources;
import android.app.Activity;
import android.os.Build;
import android.view.Window;
import androidx.core.view.WindowCompat;
import androidx.core.view.WindowInsetsControllerCompat;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

/**
 * Remembers the in-app theme choice natively so the window and WebView can be
 * painted the right colour at launch, before any web content has loaded.
 */
@CapacitorPlugin(name = "Theme")
public class ThemePlugin extends Plugin {

    private static final String PREFS = "theme";
    private static final String KEY = "pref";
    static final int LIGHT_BG = 0xFFF4F4F5;
    static final int DARK_BG = 0xFF09090B;

    @PluginMethod
    public void setPreference(PluginCall call) {
        String pref = call.getString("pref", "system");
        getContext().getSharedPreferences(PREFS, Context.MODE_PRIVATE).edit().putString(KEY, pref).apply();
        // Android 13+ remembers a per-app splash theme for future launches.
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU && getActivity() != null) {
            int theme = "dark".equals(pref)
                ? R.style.AppTheme_Launch_Dark
                : "light".equals(pref) ? R.style.AppTheme_Launch_Light : Resources.ID_NULL;
            getActivity().getSplashScreen().setSplashScreenTheme(theme);
        }
        call.resolve();
    }

    /** Status- and navigation-bar icon colours for the theme the page resolved. */
    @PluginMethod
    public void setSystemBars(PluginCall call) {
        boolean dark = Boolean.TRUE.equals(call.getBoolean("dark", false));
        Activity activity = getActivity();
        if (activity != null) activity.runOnUiThread(() -> applySystemBars(activity, dark));
        call.resolve();
    }

    /** Whether the saved preference resolves to dark ("system" follows the phone). */
    static boolean savedIsDark(Context ctx) {
        String pref = ctx.getSharedPreferences(PREFS, Context.MODE_PRIVATE).getString(KEY, "system");
        return "dark".equals(pref)
            || ("system".equals(pref)
                && (ctx.getResources().getConfiguration().uiMode & Configuration.UI_MODE_NIGHT_MASK) == Configuration.UI_MODE_NIGHT_YES);
    }

    /**
     * Dark icons on light backgrounds and vice versa, for both the status bar
     * and the navigation bar (3-button bar or gesture pill). On pre-edge-to-edge
     * Android the bars also get the app's background colour.
     */
    @SuppressWarnings("deprecation")
    static void applySystemBars(Activity activity, boolean dark) {
        Window window = activity.getWindow();
        WindowInsetsControllerCompat bars = WindowCompat.getInsetsController(window, window.getDecorView());
        bars.setAppearanceLightStatusBars(!dark);
        bars.setAppearanceLightNavigationBars(!dark);
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.VANILLA_ICE_CREAM) {
            window.setNavigationBarColor(dark ? DARK_BG : LIGHT_BG);
            window.setStatusBarColor(dark ? DARK_BG : LIGHT_BG);
        }
    }
}
