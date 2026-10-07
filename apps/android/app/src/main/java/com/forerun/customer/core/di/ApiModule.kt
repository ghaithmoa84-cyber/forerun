package com.forerun.customer.core.di

import com.forerun.customer.data.remote.api.AuthApi
import com.forerun.customer.data.remote.api.CustomerApi
import dagger.Module
import dagger.Provides
import dagger.hilt.InstallIn
import dagger.hilt.components.SingletonComponent
import retrofit2.Retrofit
import javax.inject.Singleton

@Module
@InstallIn(SingletonComponent::class)
object ApiModule {

    @Provides
    @Singleton
    fun provideAuthApi(retrofit: Retrofit): AuthApi {
        return retrofit.create(AuthApi::class.java)
    }

    @Provides
    @Singleton
    fun provideCustomerApi(retrofit: Retrofit): CustomerApi {
        return retrofit.create(CustomerApi::class.java)
    }

    @Provides
    @Singleton
    fun provideOrderApi(retrofit: Retrofit): com.forerun.customer.data.remote.api.OrderApi {
        return retrofit.create(com.forerun.customer.data.remote.api.OrderApi::class.java)
    }

    @Provides
    @Singleton
    fun provideDeviceTokenApi(retrofit: Retrofit): com.forerun.customer.data.remote.api.DeviceTokenApi {
        return retrofit.create(com.forerun.customer.data.remote.api.DeviceTokenApi::class.java)
    }

    @Provides
    @Singleton
    fun provideBannerApi(retrofit: Retrofit): com.forerun.customer.data.remote.api.BannerApi {
        return retrofit.create(com.forerun.customer.data.remote.api.BannerApi::class.java)
    }
}
