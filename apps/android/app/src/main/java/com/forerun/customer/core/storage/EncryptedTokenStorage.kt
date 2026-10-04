package com.forerun.customer.core.storage

import android.content.Context
import android.content.SharedPreferences
import androidx.security.crypto.EncryptedSharedPreferences
import androidx.security.crypto.MasterKey
import dagger.hilt.android.qualifiers.ApplicationContext
import javax.inject.Inject
import javax.inject.Singleton

@Singleton
class EncryptedTokenStorage @Inject constructor(
    @ApplicationContext private val context: Context
) : TokenStorage {

    private val masterKey: MasterKey by lazy {
        runCatching {
            createMasterKey()
        }.getOrElse {
            context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
                .edit().clear().apply()
            createMasterKey()
        }
    }

    private fun createMasterKey(): MasterKey {
        return MasterKey.Builder(context)
            .setKeyScheme(MasterKey.KeyScheme.AES256_GCM)
            .build()
    }

    private val sharedPreferences: SharedPreferences by lazy {
        runCatching {
            createEncryptedPrefs(masterKey)
        }.getOrElse {
            context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
                .edit().clear().apply()
            createEncryptedPrefs(masterKey)
        }
    }

    private fun createEncryptedPrefs(key: MasterKey): SharedPreferences {
        return EncryptedSharedPreferences.create(
            context,
            PREFS_NAME,
            key,
            EncryptedSharedPreferences.PrefKeyEncryptionScheme.AES256_SIV,
            EncryptedSharedPreferences.PrefValueEncryptionScheme.AES256_GCM
        )
    }

    override fun getAccessToken(): String? = sharedPreferences.getString(KEY_ACCESS_TOKEN, null)

    override fun setAccessToken(token: String?) {
        sharedPreferences.edit().apply {
            if (token != null) putString(KEY_ACCESS_TOKEN, token) else remove(KEY_ACCESS_TOKEN)
        }.apply()
    }

    override fun getRefreshToken(): String? = sharedPreferences.getString(KEY_REFRESH_TOKEN, null)

    override fun setRefreshToken(token: String?) {
        sharedPreferences.edit().apply {
            if (token != null) putString(KEY_REFRESH_TOKEN, token) else remove(KEY_REFRESH_TOKEN)
        }.apply()
    }

    override fun getTokenExpiry(): Long = sharedPreferences.getLong(KEY_TOKEN_EXPIRY, 0L)

    override fun setTokenExpiry(expiry: Long) {
        sharedPreferences.edit().putLong(KEY_TOKEN_EXPIRY, expiry).apply()
    }

    override fun getUserId(): String? = sharedPreferences.getString(KEY_USER_ID, null)

    override fun setUserId(id: String?) {
        sharedPreferences.edit().apply {
            if (id != null) putString(KEY_USER_ID, id) else remove(KEY_USER_ID)
        }.apply()
    }

    override fun getUserName(): String? = sharedPreferences.getString(KEY_USER_NAME, null)

    override fun setUserName(name: String?) {
        sharedPreferences.edit().apply {
            if (name != null) putString(KEY_USER_NAME, name) else remove(KEY_USER_NAME)
        }.apply()
    }

    override fun getUserRole(): String? = sharedPreferences.getString(KEY_USER_ROLE, null)

    override fun setUserRole(role: String?) {
        sharedPreferences.edit().apply {
            if (role != null) putString(KEY_USER_ROLE, role) else remove(KEY_USER_ROLE)
        }.apply()
    }

    override fun getUserStatus(): String? = sharedPreferences.getString(KEY_USER_STATUS, null)

    override fun setUserStatus(status: String?) {
        sharedPreferences.edit().apply {
            if (status != null) putString(KEY_USER_STATUS, status) else remove(KEY_USER_STATUS)
        }.apply()
    }

    override fun getDeviceToken(): String? = sharedPreferences.getString(KEY_DEVICE_TOKEN, null)

    override fun setDeviceToken(token: String?) {
        sharedPreferences.edit().apply {
            if (token != null) putString(KEY_DEVICE_TOKEN, token) else remove(KEY_DEVICE_TOKEN)
        }.apply()
    }

    override fun saveAuthTokens(
        accessToken: String,
        refreshToken: String,
        expiryTimestamp: Long
    ) {
        sharedPreferences.edit()
            .putString(KEY_ACCESS_TOKEN, accessToken)
            .putString(KEY_REFRESH_TOKEN, refreshToken)
            .putLong(KEY_TOKEN_EXPIRY, expiryTimestamp)
            .apply()
    }

    override fun clearAll() {
        sharedPreferences.edit().clear().apply()
    }

    override fun clearAccessTokenOnly() {
        sharedPreferences.edit()
            .remove(KEY_ACCESS_TOKEN)
            .remove(KEY_TOKEN_EXPIRY)
            .apply()
    }

    override fun hasValidAccessToken(): Boolean {
        val token = getAccessToken()
        val expiry = getTokenExpiry()
        return !token.isNullOrBlank() && (expiry == 0L || expiry > System.currentTimeMillis())
    }

    companion object {
        private const val PREFS_NAME = "forerun_secure_prefs"
        private const val KEY_ACCESS_TOKEN = "access_token"
        private const val KEY_REFRESH_TOKEN = "refresh_token"
        private const val KEY_TOKEN_EXPIRY = "token_expiry"
        private const val KEY_USER_ID = "user_id"
        private const val KEY_USER_NAME = "user_name"
        private const val KEY_USER_ROLE = "user_role"
        private const val KEY_USER_STATUS = "user_status"
        private const val KEY_DEVICE_TOKEN = "device_token"
    }
}
