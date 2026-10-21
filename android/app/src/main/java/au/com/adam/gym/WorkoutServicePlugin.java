package au.com.adam.gym;

import com.getcapacitor.JSArray;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import java.util.List;

/** JS bridge for the workout foreground service, heart rate monitor and rest alarm. */
@CapacitorPlugin(name = "WorkoutService")
public class WorkoutServicePlugin extends Plugin implements HeartRateMonitor.Listener {

    private boolean running = false;
    private long lastNotificationUpdate = 0;

    @Override
    public void load() {
        HeartRateMonitor.get().setListener(this);
    }

    /**
     * Starts the foreground service. Notification permission is deliberately
     * never requested: the service runs without it, its status entry just
     * isn't shown (the app has no notifications).
     */
    @PluginMethod
    public void start(PluginCall call) {
        WorkoutForegroundService.start(getContext(), call.getString("title", "Workout in progress"));
        running = true;
        call.resolve();
    }

    @PluginMethod
    public void stop(PluginCall call) {
        RestAlarm.cancel();
        WorkoutForegroundService.stop(getContext());
        running = false;
        call.resolve();
    }

    @PluginMethod
    public void connectHeartRate(PluginCall call) {
        String deviceId = call.getString("deviceId");
        if (deviceId == null) {
            call.reject("deviceId is required");
            return;
        }
        HeartRateMonitor.get().connect(getContext(), deviceId);
        call.resolve();
    }

    @PluginMethod
    public void disconnectHeartRate(PluginCall call) {
        HeartRateMonitor.get().disconnect();
        call.resolve();
    }

    @PluginMethod
    public void getSamples(PluginCall call) {
        long since = call.getLong("since", 0L);
        List<HeartRateMonitor.Sample> samples = HeartRateMonitor.get().samplesSince(since);
        JSArray arr = new JSArray();
        for (HeartRateMonitor.Sample s : samples) {
            JSObject o = new JSObject();
            o.put("timestamp", s.timestamp);
            o.put("bpm", s.bpm);
            arr.put(o);
        }
        JSObject ret = new JSObject();
        ret.put("samples", arr);
        call.resolve(ret);
    }

    @PluginMethod
    public void clearSamples(PluginCall call) {
        HeartRateMonitor.get().clearSamples();
        call.resolve();
    }

    @PluginMethod
    public void getState(PluginCall call) {
        HeartRateMonitor hr = HeartRateMonitor.get();
        JSObject ret = new JSObject();
        ret.put("running", running);
        ret.put("hrState", hr.getState());
        ret.put("deviceId", hr.getAddress());
        ret.put("bpm", hr.getLastBpm());
        ret.put("battery", hr.getBattery());
        call.resolve(ret);
    }

    @PluginMethod
    public void setRestAlert(PluginCall call) {
        Long endsAt = call.getLong("endsAt");
        if (endsAt == null) {
            call.reject("endsAt is required");
            return;
        }
        RestAlarm.schedule(getContext(), endsAt, call.getBoolean("sound", true));
        call.resolve();
    }

    @PluginMethod
    public void cancelRestAlert(PluginCall call) {
        RestAlarm.cancel();
        call.resolve();
    }

    @Override
    public void onHeartRate(long timestamp, int bpm, boolean contact) {
        JSObject o = new JSObject();
        o.put("timestamp", timestamp);
        o.put("bpm", bpm);
        o.put("contact", contact);
        notifyListeners("heartRate", o);
        if (running && timestamp - lastNotificationUpdate > 5000) {
            lastNotificationUpdate = timestamp;
            WorkoutForegroundService.update(getContext(), "♥ " + bpm + " bpm");
        }
    }

    @Override
    public void onState(String state) {
        JSObject o = new JSObject();
        o.put("state", state);
        notifyListeners("hrState", o);
        if (running && !"connected".equals(state)) {
            WorkoutForegroundService.update(getContext(), "connecting".equals(state) ? "Heart rate reconnecting…" : null);
        }
    }

    @Override
    public void onBattery(int level) {
        JSObject o = new JSObject();
        o.put("level", level);
        notifyListeners("battery", o);
    }
}
