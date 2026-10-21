package au.com.adam.gym;

import android.os.Bundle;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {

    @Override
    public void onCreate(Bundle savedInstanceState) {
        registerPlugin(WorkoutServicePlugin.class);
        registerPlugin(ThemePlugin.class);
        super.onCreate(savedInstanceState);
        // Avoid a flash of the wrong colour before the page paints.
        int bg = ThemePlugin.launchBackground(this);
        getWindow().getDecorView().setBackgroundColor(bg);
        getBridge().getWebView().setBackgroundColor(bg);
    }
}
