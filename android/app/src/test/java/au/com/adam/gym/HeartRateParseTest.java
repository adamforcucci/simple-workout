package au.com.adam.gym;

import static org.junit.Assert.assertEquals;
import static org.junit.Assert.assertFalse;
import static org.junit.Assert.assertNull;
import static org.junit.Assert.assertTrue;

import org.junit.Test;

public class HeartRateParseTest {

    private static byte[] bytes(int... v) {
        byte[] b = new byte[v.length];
        for (int i = 0; i < v.length; i++) b[i] = (byte) v[i];
        return b;
    }

    @Test
    public void uint8Value() {
        HeartRateMonitor.Measurement m = HeartRateMonitor.parse(bytes(0x00, 72));
        assertEquals(72, m.bpm);
        assertTrue(m.contact); // contact detection not supported → assume contact
    }

    @Test
    public void uint16Value() {
        assertEquals(300, HeartRateMonitor.parse(bytes(0x01, 0x2c, 0x01)).bpm);
    }

    @Test
    public void valuesAbove127AreUnsigned() {
        assertEquals(180, HeartRateMonitor.parse(bytes(0x00, 180)).bpm);
    }

    @Test
    public void contactBits() {
        assertTrue(HeartRateMonitor.parse(bytes(0x06, 90)).contact); // supported + detected
        assertFalse(HeartRateMonitor.parse(bytes(0x04, 90)).contact); // supported, not detected
    }

    @Test
    public void rrIntervalsAndEnergyAreIgnored() {
        // flags: uint8, energy expended (bit 3), RR intervals (bit 4)
        assertEquals(64, HeartRateMonitor.parse(bytes(0x18, 64, 0x10, 0x00, 0x00, 0x04)).bpm);
    }

    @Test
    public void malformed() {
        assertNull(HeartRateMonitor.parse(bytes(0x01, 0x40)));
        assertNull(HeartRateMonitor.parse(bytes(0x00)));
        assertNull(HeartRateMonitor.parse(null));
    }
}
