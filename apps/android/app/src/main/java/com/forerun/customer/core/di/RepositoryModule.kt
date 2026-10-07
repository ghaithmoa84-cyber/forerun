package com.forerun.customer.core.di

import com.forerun.customer.data.remote.repository.AuthRepositoryImpl
import com.forerun.customer.domain.repository.AuthRepository
import dagger.Binds
import dagger.Module
import dagger.hilt.InstallIn
import dagger.hilt.components.SingletonComponent
import javax.inject.Singleton

@Module
@InstallIn(SingletonComponent::class)
abstract class RepositoryModule {

    @Binds
    @Singleton
    abstract fun bindAuthRepository(
        authRepositoryImpl: AuthRepositoryImpl
    ): AuthRepository

    @Binds
    @Singleton
    abstract fun bindHomeRepository(
        homeRepositoryImpl: com.forerun.customer.data.remote.repository.HomeRepositoryImpl
    ): com.forerun.customer.domain.repository.HomeRepository

    @Binds
    @Singleton
    abstract fun bindAddressRepository(
        addressRepositoryImpl: com.forerun.customer.data.remote.repository.AddressRepositoryImpl
    ): com.forerun.customer.domain.repository.AddressRepository

    @Binds
    @Singleton
    abstract fun bindGeocodingService(
        nominatimGeocodingService: com.forerun.customer.data.remote.geocoding.NominatimGeocodingService
    ): com.forerun.customer.domain.service.GeocodingService

    @Binds
    @Singleton
    abstract fun bindOrderRepository(
        orderRepositoryImpl: com.forerun.customer.data.remote.repository.OrderRepositoryImpl
    ): com.forerun.customer.domain.repository.OrderRepository

    @Binds
    @Singleton
    abstract fun bindAccountRepository(
        accountRepositoryImpl: com.forerun.customer.data.remote.repository.AccountRepositoryImpl
    ): com.forerun.customer.domain.repository.AccountRepository

    @Binds
    @Singleton
    abstract fun bindDeviceTokenRepository(
        deviceTokenRepositoryImpl: com.forerun.customer.data.remote.repository.DeviceTokenRepositoryImpl
    ): com.forerun.customer.domain.repository.DeviceTokenRepository

    @Binds
    @Singleton
    abstract fun bindBannerRepository(
        bannerRepositoryImpl: com.forerun.customer.data.remote.repository.BannerRepositoryImpl
    ): com.forerun.customer.domain.repository.BannerRepository
}
