package au.com.adam.gym;

import android.content.Context;
import android.media.AudioManager;
import android.media.ToneGenerator;
import android.os.Build;
import android.os.Handler;
import android.os.Looper;
import android.os.SystemClock;
import android.os.VibrationEffect;
import android.os.Vibrator;
import android.os.VibratorManager;

/**
 * Fires the end-of-rest alert natively so it still arrives with the screen off.
 * The foreground service's wake lock keeps the CPU awake for the handler.
 */
public final class RestAlarm {

    private static final Handler main = new Handler(Looper.getMainLooper());
    private static Runnable pending;

    public static synchronized void schedule(Context ctx, long endsAtEpochMs, boolean sound) {
        cancel();
        Context app = ctx.getApplicationContext();
        long delay = Math.max(0, endsAtEpochMs - System.currentTimeMillis());
        pending = () -> fire(app, sound);
        main.postAtTime(pending, SystemClock.uptimeMillis() + delay);
    }

    public static synchronized void cancel() {
        if (pending != null) main.removeCallbacks(pending);
        pending = null;
    }

    private static void fire(Context ctx, boolean sound) {
        synchronized (RestAlarm.class) {
            pending = null;
        }
        vibrate(ctx);
        if (sound) beep();
    }

    @SuppressWarnings("deprecation")
    private static void vibrate(Context ctx) {
        Vibrator v = Build.VERSION.SDK_INT >= Build.VERSION_CODES.S
            ? ((VibratorManager) ctx.getSystemService(Context.VIBRATOR_MANAGER_SERVICE)).getDefaultVibrator()
            : (Vibrator) ctx.getSystemService(Context.VIBRATOR_SERVICE);
        if (v == null) return;
        long[] pattern = { 0, 400, 150, 400, 150, 700 };
        v.vibrate(VibrationEffect.createWaveform(pattern, -1));
    }

    private static void beep() {
        // Music stream so it plays through earbuds when connected.
        ToneGenerator tone = new ToneGenerator(AudioManager.STREAM_MUSIC, 80);
        tone.startTone(ToneGenerator.TONE_PROP_BEEP2, 600);
        main.postDelayed(tone::release, 1000);
    }
}
