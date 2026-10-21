package au.com.adam.gym;

import android.content.Context;
import android.content.res.Configuration;
import android.content.res.Resources;
import android.os.Build;
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

    /** Background colour for the saved preference ("system" follows the phone). */
    static int launchBackground(Context ctx) {
        String pref = ctx.getSharedPreferences(PREFS, Context.MODE_PRIVATE).getString(KEY, "system");
        boolean dark = "dark".equals(pref)
            || ("system".equals(pref)
                && (ctx.getResources().getConfiguration().uiMode & Configuration.UI_MODE_NIGHT_MASK) == Configuration.UI_MODE_NIGHT_YES);
        return dark ? DARK_BG : LIGHT_BG;
    }
}
