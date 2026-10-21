package au.com.adam.gym;

import android.annotation.SuppressLint;
import android.bluetooth.BluetoothAdapter;
import android.bluetooth.BluetoothDevice;
import android.bluetooth.BluetoothGatt;
import android.bluetooth.BluetoothGattCallback;
import android.bluetooth.BluetoothGattCharacteristic;
import android.bluetooth.BluetoothGattDescriptor;
import android.bluetooth.BluetoothGattService;
import android.bluetooth.BluetoothManager;
import android.bluetooth.BluetoothProfile;
import android.content.Context;
import android.os.Build;
import android.os.Handler;
import android.os.Looper;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;

/**
 * Owns the connection to a standard Bluetooth heart rate sensor (Heart Rate
 * Service 0x180D) and buffers timestamped samples natively, so recording
 * continues while the WebView is throttled with the screen off.
 */
@SuppressLint("MissingPermission") // BLUETOOTH_CONNECT is requested from JS before connecting.
public final class HeartRateMonitor {

    public interface Listener {
        void onHeartRate(long timestamp, int bpm, boolean contact);

        void onState(String state);

        void onBattery(int level);
    }

    public static final class Sample {
        public final long timestamp;
        public final int bpm;

        Sample(long timestamp, int bpm) {
            this.timestamp = timestamp;
            this.bpm = bpm;
        }
    }

    static final UUID HR_SERVICE = UUID.fromString("0000180d-0000-1000-8000-00805f9b34fb");
    static final UUID HR_MEASUREMENT = UUID.fromString("00002a37-0000-1000-8000-00805f9b34fb");
    static final UUID BATTERY_SERVICE = UUID.fromString("0000180f-0000-1000-8000-00805f9b34fb");
    static final UUID BATTERY_LEVEL = UUID.fromString("00002a19-0000-1000-8000-00805f9b34fb");
    static final UUID CCCD = UUID.fromString("00002902-0000-1000-8000-00805f9b34fb");

    // Enough for several hours at 1 Hz; JS drains it every few seconds anyway.
    private static final int MAX_SAMPLES = 6 * 60 * 60;

    private static HeartRateMonitor instance;

    public static synchronized HeartRateMonitor get() {
        if (instance == null) instance = new HeartRateMonitor();
        return instance;
    }

    private final Handler main = new Handler(Looper.getMainLooper());
    private final List<Sample> samples = new ArrayList<>();
    private Context context;
    private BluetoothGatt gatt;
    private String address;
    private boolean wanted;
    private String state = "disconnected";
    private int lastBpm = 0;
    private int battery = -1;
    private Listener listener;

    public synchronized void setListener(Listener l) {
        listener = l;
    }

    public synchronized String getState() {
        return state;
    }

    public synchronized String getAddress() {
        return address;
    }

    public synchronized int getLastBpm() {
        return lastBpm;
    }

    public synchronized int getBattery() {
        return battery;
    }

    public synchronized void connect(Context ctx, String deviceAddress) {
        context = ctx.getApplicationContext();
        if (wanted && deviceAddress.equals(address) && gatt != null) return;
        closeGatt();
        address = deviceAddress;
        wanted = true;
        battery = -1;
        open(false);
    }

    public synchronized void disconnect() {
        wanted = false;
        closeGatt();
        setState("disconnected");
    }

    /** Samples newer than {@code since} (epoch ms). */
    public synchronized List<Sample> samplesSince(long since) {
        List<Sample> out = new ArrayList<>();
        for (Sample s : samples) if (s.timestamp > since) out.add(s);
        return out;
    }

    public synchronized void clearSamples() {
        samples.clear();
    }

    private void open(boolean autoConnect) {
        BluetoothManager manager = (BluetoothManager) context.getSystemService(Context.BLUETOOTH_SERVICE);
        BluetoothAdapter adapter = manager == null ? null : manager.getAdapter();
        if (adapter == null || !BluetoothAdapter.checkBluetoothAddress(address)) {
            setState("disconnected");
            return;
        }
        BluetoothDevice device = adapter.getRemoteDevice(address);
        setState("connecting");
        // autoConnect=false connects quickly the first time; after a drop we
        // hand reconnection to the OS (autoConnect=true), which waits for the
        // strap to come back into range without timing out.
        gatt = device.connectGatt(context, autoConnect, callback, BluetoothDevice.TRANSPORT_LE);
    }

    private void closeGatt() {
        if (gatt != null) {
            gatt.disconnect();
            gatt.close();
            gatt = null;
        }
    }

    private void setState(String s) {
        Listener l;
        synchronized (this) {
            if (s.equals(state)) return;
            state = s;
            l = listener;
        }
        if (l != null) l.onState(s);
    }

    private final BluetoothGattCallback callback = new BluetoothGattCallback() {
        @Override
        public void onConnectionStateChange(BluetoothGatt g, int status, int newState) {
            if (newState == BluetoothProfile.STATE_CONNECTED) {
                g.discoverServices();
                return;
            }
            if (newState != BluetoothProfile.STATE_DISCONNECTED) return;
            synchronized (HeartRateMonitor.this) {
                if (g != gatt) return;
                g.close();
                gatt = null;
                if (!wanted) return;
            }
            setState("connecting");
            main.postDelayed(() -> {
                synchronized (HeartRateMonitor.this) {
                    if (wanted && gatt == null) open(true);
                }
            }, 1000);
        }

        @Override
        public void onServicesDiscovered(BluetoothGatt g, int status) {
            BluetoothGattService hr = g.getService(HR_SERVICE);
            BluetoothGattCharacteristic measurement = hr == null ? null : hr.getCharacteristic(HR_MEASUREMENT);
            if (measurement == null) {
                // Not a heart rate sensor (or the strap isn't broadcasting yet).
                setState("unsupported");
                return;
            }
            g.setCharacteristicNotification(measurement, true);
            BluetoothGattDescriptor cccd = measurement.getDescriptor(CCCD);
            if (cccd != null) writeDescriptor(g, cccd, BluetoothGattDescriptor.ENABLE_NOTIFICATION_VALUE);
            setState("connected");
        }

        @Override
        public void onDescriptorWrite(BluetoothGatt g, BluetoothGattDescriptor d, int status) {
            // GATT operations are serial: read the battery once notifications are on.
            BluetoothGattService bs = g.getService(BATTERY_SERVICE);
            BluetoothGattCharacteristic level = bs == null ? null : bs.getCharacteristic(BATTERY_LEVEL);
            if (level != null) g.readCharacteristic(level);
        }

        @Override
        public void onCharacteristicRead(BluetoothGatt g, BluetoothGattCharacteristic c, byte[] value, int status) {
            handleBattery(c, value, status);
        }

        @Override
        @SuppressWarnings("deprecation")
        public void onCharacteristicRead(BluetoothGatt g, BluetoothGattCharacteristic c, int status) {
            if (Build.VERSION.SDK_INT < Build.VERSION_CODES.TIRAMISU) handleBattery(c, c.getValue(), status);
        }

        @Override
        public void onCharacteristicChanged(BluetoothGatt g, BluetoothGattCharacteristic c, byte[] value) {
            handleMeasurement(c, value);
        }

        @Override
        @SuppressWarnings("deprecation")
        public void onCharacteristicChanged(BluetoothGatt g, BluetoothGattCharacteristic c) {
            if (Build.VERSION.SDK_INT < Build.VERSION_CODES.TIRAMISU) handleMeasurement(c, c.getValue());
        }
    };

    @SuppressWarnings("deprecation")
    private static void writeDescriptor(BluetoothGatt g, BluetoothGattDescriptor d, byte[] value) {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
            g.writeDescriptor(d, value);
        } else {
            d.setValue(value);
            g.writeDescriptor(d);
        }
    }

    private void handleBattery(BluetoothGattCharacteristic c, byte[] value, int status) {
        if (!BATTERY_LEVEL.equals(c.getUuid()) || status != BluetoothGatt.GATT_SUCCESS || value == null || value.length == 0) return;
        Listener l;
        synchronized (this) {
            battery = value[0] & 0xff;
            l = listener;
        }
        if (l != null) l.onBattery(battery);
    }

    private void handleMeasurement(BluetoothGattCharacteristic c, byte[] value) {
        if (!HR_MEASUREMENT.equals(c.getUuid())) return;
        Measurement m = parse(value);
        if (m == null || m.bpm <= 0) return;
        long now = System.currentTimeMillis();
        Listener l;
        synchronized (this) {
            lastBpm = m.bpm;
            // Readings without skin contact are noise; show them live but don't record.
            if (m.contact) {
                samples.add(new Sample(now, m.bpm));
                if (samples.size() > MAX_SAMPLES) samples.remove(0);
            }
            l = listener;
        }
        if (l != null) l.onHeartRate(now, m.bpm, m.contact);
    }

    public static final class Measurement {
        public final int bpm;
        public final boolean contact;

        Measurement(int bpm, boolean contact) {
            this.bpm = bpm;
            this.contact = contact;
        }
    }

    /** Parses a Heart Rate Measurement (0x2A37) value per the Bluetooth HRS spec. */
    public static Measurement parse(byte[] v) {
        if (v == null || v.length < 2) return null;
        int flags = v[0] & 0xff;
        boolean uint16 = (flags & 0x01) != 0;
        if (uint16 && v.length < 3) return null;
        int bpm = uint16 ? (v[1] & 0xff) | ((v[2] & 0xff) << 8) : v[1] & 0xff;
        // Bits 1–2: contact supported (bit 2) and detected (bit 1). If the
        // sensor doesn't support contact detection, assume contact.
        boolean contactSupported = (flags & 0x04) != 0;
        boolean contact = !contactSupported || (flags & 0x02) != 0;
        return new Measurement(bpm, contact);
    }
}
