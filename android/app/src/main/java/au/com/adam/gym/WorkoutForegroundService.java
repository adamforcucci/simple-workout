package au.com.adam.gym;

import android.Manifest;
import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.app.Service;
import android.content.Context;
import android.content.Intent;
import android.content.pm.PackageManager;
import android.content.pm.ServiceInfo;
import android.os.Build;
import android.os.IBinder;
import android.os.PowerManager;
import androidx.core.app.NotificationCompat;
import androidx.core.content.ContextCompat;

/**
 * Keeps the app process (and CPU, via a partial wake lock) alive during a
 * workout so heart rate recording and rest alerts continue with the screen
 * off. Android requires a visible status-bar entry while this runs; it's a
 * silent, low-importance one and disappears when the workout ends.
 */
public class WorkoutForegroundService extends Service {

    private static final String CHANNEL_ID = "workout";
    private static final int NOTIFICATION_ID = 1;
    static final String EXTRA_TITLE = "title";

    private static String title = "Workout in progress";
    private PowerManager.WakeLock wakeLock;

    public static void start(Context ctx, String workoutTitle) {
        title = workoutTitle;
        ContextCompat.startForegroundService(ctx, new Intent(ctx, WorkoutForegroundService.class));
    }

    public static void stop(Context ctx) {
        ctx.stopService(new Intent(ctx, WorkoutForegroundService.class));
    }

    /** Refreshes the status-bar text (e.g. with live heart rate). */
    public static void update(Context ctx, String text) {
        NotificationManager nm = ctx.getSystemService(NotificationManager.class);
        if (nm != null) nm.notify(NOTIFICATION_ID, build(ctx, text));
    }

    @Override
    public void onCreate() {
        super.onCreate();
        NotificationManager nm = getSystemService(NotificationManager.class);
        NotificationChannel channel = new NotificationChannel(CHANNEL_ID, "Active workout", NotificationManager.IMPORTANCE_LOW);
        channel.setShowBadge(false);
        channel.setSound(null, null);
        nm.createNotificationChannel(channel);

        PowerManager pm = (PowerManager) getSystemService(Context.POWER_SERVICE);
        wakeLock = pm.newWakeLock(PowerManager.PARTIAL_WAKE_LOCK, "gym:workout");
        wakeLock.setReferenceCounted(false);
        // Bounded so a forgotten workout can't drain the battery indefinitely.
        wakeLock.acquire(4 * 60 * 60 * 1000L);
    }

    @Override
    public int onStartCommand(Intent intent, int flags, int startId) {
        Notification n = build(this, null);
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
            boolean canUseBluetooth = Build.VERSION.SDK_INT < Build.VERSION_CODES.S
                || checkSelfPermission(Manifest.permission.BLUETOOTH_CONNECT) == PackageManager.PERMISSION_GRANTED;
            // connectedDevice requires a Bluetooth permission on Android 14+;
            // without one (no strap paired) fall back to specialUse.
            int type = canUseBluetooth
                ? ServiceInfo.FOREGROUND_SERVICE_TYPE_CONNECTED_DEVICE
                : Build.VERSION.SDK_INT >= Build.VERSION_CODES.UPSIDE_DOWN_CAKE
                    ? ServiceInfo.FOREGROUND_SERVICE_TYPE_SPECIAL_USE
                    : ServiceInfo.FOREGROUND_SERVICE_TYPE_CONNECTED_DEVICE;
            startForeground(NOTIFICATION_ID, n, type);
        } else {
            startForeground(NOTIFICATION_ID, n);
        }
        return START_NOT_STICKY;
    }

    @Override
    public void onDestroy() {
        if (wakeLock != null && wakeLock.isHeld()) wakeLock.release();
        RestAlarm.cancel();
        super.onDestroy();
    }

    @Override
    public IBinder onBind(Intent intent) {
        return null;
    }

    private static Notification build(Context ctx, String text) {
        Intent open = new Intent(ctx, MainActivity.class).setFlags(Intent.FLAG_ACTIVITY_SINGLE_TOP);
        PendingIntent pi = PendingIntent.getActivity(ctx, 0, open, PendingIntent.FLAG_IMMUTABLE);
        return new NotificationCompat.Builder(ctx, CHANNEL_ID)
            .setSmallIcon(R.drawable.ic_stat_workout)
            .setContentTitle(title)
            .setContentText(text)
            .setContentIntent(pi)
            .setOngoing(true)
            .setOnlyAlertOnce(true)
            .setSilent(true)
            .setCategory(NotificationCompat.CATEGORY_WORKOUT)
            .setForegroundServiceBehavior(NotificationCompat.FOREGROUND_SERVICE_IMMEDIATE)
            .build();
    }
}
