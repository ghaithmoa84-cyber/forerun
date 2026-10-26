package com.forerun.customer.core.websocket

import android.content.Context
import android.net.ConnectivityManager
import android.net.Network
import android.net.NetworkCapabilities
import android.util.Log
import com.forerun.customer.core.storage.TokenStorage
import dagger.hilt.android.qualifiers.ApplicationContext
import io.socket.client.IO
import io.socket.client.Socket
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.MutableSharedFlow
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.SharedFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asSharedFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.filter
import kotlinx.coroutines.launch
import org.json.JSONObject
import java.net.URI
import java.util.Collections
import java.util.concurrent.atomic.AtomicBoolean
import javax.inject.Inject
import javax.inject.Singleton

enum class SocketConnectionState {
    DISCONNECTED,
    CONNECTING,
    CONNECTED,
    ERROR
}

@Singleton
open class SocketManager @Inject constructor(
    private val tokenStorage: TokenStorage,
    @ApplicationContext private val context: Context? = null
) {
    companion object {
        private const val TAG = "SocketManager"
        const val DEFAULT_BASE_URL = "https://fawrun-api-production.up.railway.app"
        const val NAMESPACE = "/orders"
        const val RECONNECTION_DELAY_MS = 1000L // 1s
        const val RECONNECTION_DELAY_MAX_MS = 16000L // 16s
    }

    private val scope = CoroutineScope(SupervisorJob() + Dispatchers.IO)

    internal var currentNetwork: Network? = null
    private var isNetworkCallbackRegistered = false

    internal val networkCallback = object : ConnectivityManager.NetworkCallback() {
        override fun onAvailable(network: Network) {
            val previous = currentNetwork
            val isNetworkSwitch = previous != network
            currentNetwork = network
            Log.d(TAG, "Network onAvailable: previous=$previous, current=$network, isSwitch=$isNetworkSwitch")
            if (isNetworkSwitch) {
                onNetworkChanged()
            }
        }

        override fun onCapabilitiesChanged(
            network: Network,
            networkCapabilities: NetworkCapabilities
        ) {
            val previous = currentNetwork
            val isNetworkSwitch = previous != network
            currentNetwork = network
            Log.d(TAG, "Network onCapabilitiesChanged: previous=$previous, current=$network, isSwitch=$isNetworkSwitch")
            if (isNetworkSwitch) {
                onNetworkChanged()
            }
        }

        override fun onLost(network: Network) {
            Log.d(TAG, "Network onLost: $network")
            if (currentNetwork == network) {
                currentNetwork = null
            }
        }
    }

    init {
        registerNetworkCallback()
    }

    fun registerNetworkCallback() {
        if (isNetworkCallbackRegistered) return
        val cm = context?.getSystemService(Context.CONNECTIVITY_SERVICE) as? ConnectivityManager ?: return
        try {
            currentNetwork = cm.activeNetwork
            cm.registerDefaultNetworkCallback(networkCallback)
            isNetworkCallbackRegistered = true
            Log.d(TAG, "Registered ConnectivityManager default network callback")
        } catch (e: Throwable) {
            Log.e(TAG, "Failed to register network callback", e)
        }
    }

    fun unregisterNetworkCallback() {
        if (!isNetworkCallbackRegistered) return
        val cm = context?.getSystemService(Context.CONNECTIVITY_SERVICE) as? ConnectivityManager ?: return
        try {
            cm.unregisterNetworkCallback(networkCallback)
            isNetworkCallbackRegistered = false
            Log.d(TAG, "Unregistered ConnectivityManager default network callback")
        } catch (e: Throwable) {
            Log.e(TAG, "Failed to unregister network callback", e)
        }
    }

    open fun onNetworkChanged() {
        if (isForeground) {
            Log.d(TAG, "Network change detected while foregrounded -> forcing immediate reconnect")
            reconnect()
        }
    }

    private var socket: Socket? = null
    var isForeground: Boolean = false
        protected set

    private val isConnecting = AtomicBoolean(false)
    val isConnectingState: Boolean
        get() = isConnecting.get()

    private val _connectionState = MutableStateFlow(SocketConnectionState.DISCONNECTED)
    val connectionState: StateFlow<SocketConnectionState> = _connectionState.asStateFlow()

    private val _events = MutableSharedFlow<WebSocketEvent>(extraBufferCapacity = 64)
    val events: SharedFlow<WebSocketEvent> = _events.asSharedFlow()

    fun buildOptions(token: String): IO.Options {
        return IO.Options().apply {
            transports = arrayOf("websocket")
            reconnection = true
            reconnectionAttempts = Int.MAX_VALUE
            reconnectionDelay = RECONNECTION_DELAY_MS
            reconnectionDelayMax = RECONNECTION_DELAY_MAX_MS
            randomizationFactor = 0.5
            auth = Collections.singletonMap("token", token)
        }
    }

    @Synchronized
    open fun connect() {
        if (!isForeground) {
            Log.d(TAG, "Not connecting: app is in background")
            return
        }

        val token = tokenStorage.getAccessToken()
        if (token.isNullOrBlank()) {
            Log.d(TAG, "Not connecting: no access token")
            disconnectInternal()
            _connectionState.value = SocketConnectionState.DISCONNECTED
            return
        }

        if (socket?.connected() == true) {
            Log.d(TAG, "Already connected")
            return
        }

        if (!isConnecting.compareAndSet(false, true)) {
            Log.d(TAG, "Connection attempt already in progress (guarded by AtomicBoolean)")
            return
        }

        disconnectInternal()

        try {
            _connectionState.value = SocketConnectionState.CONNECTING
            val uri = URI.create("$DEFAULT_BASE_URL$NAMESPACE")
            val options = buildOptions(token)
            val newSocket = IO.socket(uri, options)
            socket = newSocket

            setupListeners(newSocket)
            newSocket.connect()
        } catch (e: Exception) {
            Log.e(TAG, "Failed to initialize socket", e)
            _connectionState.value = SocketConnectionState.ERROR
            isConnecting.set(false)
        }
    }

    @Synchronized
    open fun reconnect() {
        Log.d(TAG, "Reconnecting socket (forcing disconnect then connect)")
        disconnect()
        connect()
    }

    @Synchronized
    open fun disconnect() {
        isConnecting.set(false)
        disconnectInternal()
        _connectionState.value = SocketConnectionState.DISCONNECTED
    }

    private fun disconnectInternal() {
        socket?.let { s ->
            try {
                s.off()
                s.disconnect()
            } catch (e: Exception) {
                Log.e(TAG, "Error disconnecting socket", e)
            }
        }
        socket = null
    }

    fun onAppForegrounded() {
        isForeground = true
        connect()
    }

    fun onAppBackgrounded() {
        isForeground = false
        disconnect()
    }

    fun observeOrderEvents(orderId: String): Flow<WebSocketEvent> {
        return events.filter { it.orderId == orderId }
    }

    suspend fun emitEvent(event: WebSocketEvent) {
        _events.emit(event)
    }

    internal fun setConnectionStateForTesting(state: SocketConnectionState) {
        _connectionState.value = state
    }

    private fun setupListeners(socket: Socket) {
        socket.on(Socket.EVENT_CONNECT) {
            Log.d(TAG, "Socket connected to namespace $NAMESPACE")
            isConnecting.set(false)
            _connectionState.value = SocketConnectionState.CONNECTED
        }

        socket.on(Socket.EVENT_DISCONNECT) {
            Log.d(TAG, "Socket disconnected")
            isConnecting.set(false)
            _connectionState.value = SocketConnectionState.DISCONNECTED
        }

        socket.on(Socket.EVENT_CONNECT_ERROR) { args ->
            val error = args.getOrNull(0)
            Log.e(TAG, "Socket connect error: $error")
            isConnecting.set(false)
            _connectionState.value = SocketConnectionState.ERROR
        }

        val eventsToListen = listOf(
            "order:status_changed",
            "order:runner_assigned",
            "order:fee_updated",
            "order:store_purchased",
            "order:store_skipped",
            "order:out_for_delivery",
            "order:delivered",
            "order:cancelled",
            "account:verified"
        )

        for (eventName in eventsToListen) {
            socket.on(eventName) { args ->
                val raw = args.getOrNull(0)
                val event = parseEvent(eventName, raw)
                if (event != null) {
                    scope.launch {
                        _events.emit(event)
                    }
                }
            }
        }
    }

    fun parseEvent(eventName: String, data: Any?): WebSocketEvent? {
        val json = when (data) {
            is JSONObject -> data
            is String -> try { JSONObject(data) } catch (_: Exception) { null }
            else -> null
        }

        return when (eventName) {
            "order:status_changed" -> {
                if (json == null) return null
                val orderId = json.optString("orderId")
                if (orderId.isEmpty()) return null
                WebSocketEvent.StatusChanged(
                    orderId = orderId,
                    orderNumber = json.optString("orderNumber").ifEmpty { null },
                    oldStatus = json.optString("oldStatus").ifEmpty { null },
                    newStatus = json.optString("newStatus")
                )
            }
            "order:runner_assigned" -> {
                if (json == null) return null
                val orderId = json.optString("orderId")
                if (orderId.isEmpty()) return null
                WebSocketEvent.RunnerAssigned(
                    orderId = orderId,
                    runnerName = json.optString("runnerName")
                )
            }
            "order:fee_updated" -> {
                if (json == null) return null
                val orderId = json.optString("orderId")
                if (orderId.isEmpty()) return null
                WebSocketEvent.FeeUpdated(
                    orderId = orderId,
                    oldFee = json.optInt("oldFee"),
                    newFee = json.optInt("newFee"),
                    reason = json.optString("reason").ifEmpty { null }
                )
            }
            "order:store_purchased" -> {
                if (json == null) return null
                val orderId = json.optString("orderId")
                if (orderId.isEmpty()) return null
                WebSocketEvent.StorePurchased(
                    orderId = orderId,
                    storeName = json.optString("storeName")
                )
            }
            "order:store_skipped" -> {
                if (json == null) return null
                val orderId = json.optString("orderId")
                if (orderId.isEmpty()) return null
                WebSocketEvent.StoreSkipped(
                    orderId = orderId,
                    storeName = json.optString("storeName")
                )
            }
            "order:out_for_delivery" -> {
                if (json == null) return null
                val orderId = json.optString("orderId")
                if (orderId.isEmpty()) return null
                WebSocketEvent.OutForDelivery(orderId = orderId)
            }
            "order:delivered" -> {
                if (json == null) return null
                val orderId = json.optString("orderId")
                if (orderId.isEmpty()) return null
                WebSocketEvent.Delivered(
                    orderId = orderId,
                    deliveredAt = json.optString("deliveredAt").ifEmpty { null }
                )
            }
            "order:cancelled" -> {
                if (json == null) return null
                val orderId = json.optString("orderId")
                if (orderId.isEmpty()) return null
                WebSocketEvent.Cancelled(
                    orderId = orderId,
                    reason = json.optString("reason").ifEmpty { null },
                    cancelledBy = json.optString("cancelledBy").ifEmpty { null }
                )
            }
            "account:verified" -> {
                WebSocketEvent.AccountVerified
            }
            else -> {
                WebSocketEvent.RawEvent(
                    eventName = eventName,
                    orderId = json?.optString("orderId")?.ifEmpty { null },
                    data = data?.toString() ?: ""
                )
            }
        }
    }
}
