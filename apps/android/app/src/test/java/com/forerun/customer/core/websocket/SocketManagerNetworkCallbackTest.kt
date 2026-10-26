package com.forerun.customer.core.websocket

import android.net.Network
import android.net.NetworkCapabilities
import androidx.test.ext.junit.runners.AndroidJUnit4
import com.forerun.customer.core.storage.FakeTokenStorage
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Before
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.shadows.ShadowNetwork

@RunWith(AndroidJUnit4::class)
class SocketManagerNetworkCallbackTest {

    private lateinit var tokenStorage: FakeTokenStorage
    private lateinit var testSocketManager: TrackableSocketManager

    private class TrackableSocketManager(
        tokenStorage: FakeTokenStorage
    ) : SocketManager(tokenStorage) {
        var reconnectCalls = 0

        override fun reconnect() {
            reconnectCalls++
            super.reconnect()
        }
    }

    @Before
    fun setUp() {
        tokenStorage = FakeTokenStorage(token = "test-jwt-token")
        testSocketManager = TrackableSocketManager(tokenStorage)
    }

    @Test
    fun onAvailable_triggers_immediate_reconnect_when_foregrounded() {
        testSocketManager.onAppForegrounded()
        val network1 = ShadowNetwork.newInstance(101)

        testSocketManager.networkCallback.onAvailable(network1)

        assertEquals(1, testSocketManager.reconnectCalls)
        assertEquals(network1, testSocketManager.currentNetwork)
    }

    @Test
    fun onCapabilitiesChanged_triggers_immediate_reconnect_when_network_changes() {
        testSocketManager.onAppForegrounded()
        val network1 = ShadowNetwork.newInstance(101)
        val network2 = ShadowNetwork.newInstance(102)
        val capabilities = NetworkCapabilities()

        // Initial network available
        testSocketManager.networkCallback.onAvailable(network1)
        assertEquals(1, testSocketManager.reconnectCalls)

        // Switching to network2 via onCapabilitiesChanged
        testSocketManager.networkCallback.onCapabilitiesChanged(network2, capabilities)

        assertEquals(2, testSocketManager.reconnectCalls)
        assertEquals(network2, testSocketManager.currentNetwork)
    }

    @Test
    fun onAvailable_with_same_network_does_not_trigger_duplicate_reconnect() {
        testSocketManager.onAppForegrounded()
        val network1 = ShadowNetwork.newInstance(101)

        testSocketManager.networkCallback.onAvailable(network1)
        assertEquals(1, testSocketManager.reconnectCalls)

        // Re-delivering same network
        testSocketManager.networkCallback.onAvailable(network1)
        assertEquals(1, testSocketManager.reconnectCalls)
    }

    @Test
    fun network_change_does_not_reconnect_when_app_is_backgrounded() {
        testSocketManager.onAppBackgrounded()
        val network1 = ShadowNetwork.newInstance(101)

        testSocketManager.networkCallback.onAvailable(network1)

        assertEquals(0, testSocketManager.reconnectCalls)
    }

    @Test
    fun onLost_clears_current_network_and_new_available_triggers_reconnect() {
        testSocketManager.onAppForegrounded()
        val network1 = ShadowNetwork.newInstance(101)
        val network2 = ShadowNetwork.newInstance(102)

        testSocketManager.networkCallback.onAvailable(network1)
        assertEquals(1, testSocketManager.reconnectCalls)

        // Network 1 lost
        testSocketManager.networkCallback.onLost(network1)
        assertNull(testSocketManager.currentNetwork)

        // Network 2 available
        testSocketManager.networkCallback.onAvailable(network2)
        assertEquals(2, testSocketManager.reconnectCalls)
        assertEquals(network2, testSocketManager.currentNetwork)
    }
}
