package com.forerun.customer.core.di

import android.content.Context
import com.forerun.customer.BuildConfig
import dagger.hilt.android.qualifiers.ApplicationContext
import com.forerun.customer.core.network.ApiCallAdapterFactory
import com.forerun.customer.core.network.interceptor.AuthInterceptor
import com.forerun.customer.core.network.interceptor.HeaderInterceptor
import com.forerun.customer.core.network.interceptor.RefreshInterceptor
import com.squareup.moshi.Moshi
import dagger.Module
import dagger.Provides
import dagger.hilt.InstallIn
import dagger.hilt.components.SingletonComponent
import okhttp3.OkHttpClient
import okhttp3.logging.HttpLoggingInterceptor
import retrofit2.Retrofit
import retrofit2.converter.moshi.MoshiConverterFactory
import java.util.concurrent.TimeUnit
import javax.inject.Singleton

@Module
@InstallIn(SingletonComponent::class)
object NetworkModule {

    private const val BASE_URL = "https://fawrun-api-production.up.railway.app/api/v1/"

    @Provides
    @Singleton
    fun provideMoshi(): Moshi {
        return Moshi.Builder().build()
    }

    @Provides
    @Singleton
    fun provideLoggingInterceptor(): HttpLoggingInterceptor {
        return HttpLoggingInterceptor().apply {
            level = if (BuildConfig.DEBUG) {
                HttpLoggingInterceptor.Level.BODY
            } else {
                HttpLoggingInterceptor.Level.NONE
            }
        }
    }

    /**
     * Main OkHttpClient instance.
     *
     * Architecture note (Cycle 1 resolution):
     * Token refresh is wired via [okhttp3.Authenticator] ([RefreshInterceptor]) instead of an application
     * interceptor. OkHttp invokes Authenticator only upon receiving an HTTP 401 response, completely breaking
     * the circular dependency where network interceptors previously depended eagerly on API clients during graph setup.
     */
    @Provides
    @Singleton
    fun provideOkHttpClient(
        headerInterceptor: HeaderInterceptor,
        authInterceptor: AuthInterceptor,
        refreshInterceptor: RefreshInterceptor,
        loggingInterceptor: HttpLoggingInterceptor
    ): OkHttpClient {
        return OkHttpClient.Builder()
            .connectTimeout(15, TimeUnit.SECONDS)
            .readTimeout(30, TimeUnit.SECONDS)
            .writeTimeout(30, TimeUnit.SECONDS)
            .addInterceptor(headerInterceptor)
            .addInterceptor(authInterceptor)
            .authenticator(refreshInterceptor)
            .addInterceptor(loggingInterceptor)
            .build()
    }

    /**
     * Central Retrofit instance providing base URL, converter factory, and call adapter factory.
     * Consumed by [ApiModule] to create API service interfaces.
     */
    @Provides
    @Singleton
    fun provideRetrofit(
        // ApplicationContext is injected to resolve localized error strings
        // (R.string.error_network, R.string.error_generic) in ApiCall dynamically at runtime,
        // fulfilling the zero-hardcoded-Arabic rule while keeping unit tests functional via null Context fallback.
        @ApplicationContext context: Context,
        okHttpClient: OkHttpClient,
        moshi: Moshi
    ): Retrofit {
        return Retrofit.Builder()
            .baseUrl(BASE_URL)
            .client(okHttpClient)
            .addConverterFactory(MoshiConverterFactory.create(moshi).withNullSerialization())
            .addCallAdapterFactory(ApiCallAdapterFactory.create(moshi, context))
            .build()
    }

    /**
     * Dedicated OkHttpClient instance for external Nominatim OSM reverse geocoding.
     * Configured with short timeouts (5s) without auth or token refresh interceptors.
     */
    @Provides
    @Singleton
    @GeocodingHttpClient
    fun provideGeocodingOkHttpClient(): OkHttpClient {
        return OkHttpClient.Builder()
            .connectTimeout(5, TimeUnit.SECONDS)
            .readTimeout(5, TimeUnit.SECONDS)
            .build()
    }
}
