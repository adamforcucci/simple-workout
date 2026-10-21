package au.com.adam.gym;

import android.os.Bundle;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {

    @Override
    public void onCreate(Bundle savedInstanceState) {
        registerPlugin(WorkoutServicePlugin.class);
        registerPlugin(ThemePlugin.class);
        super.onCreate(savedInstanceState);
        // Avoid a flash of the wrong colour (and wrong bar icons) before the page paints.
        boolean dark = ThemePlugin.savedIsDark(this);
        int bg = dark ? ThemePlugin.DARK_BG : ThemePlugin.LIGHT_BG;
        getWindow().getDecorView().setBackgroundColor(bg);
        getBridge().getWebView().setBackgroundColor(bg);
        ThemePlugin.applySystemBars(this, dark);
    }
}
