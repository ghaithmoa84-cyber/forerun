package com.forerun.customer.domain.usecase

import com.forerun.customer.domain.model.AppUpdateStatus
import com.forerun.customer.domain.model.AppVersion
import com.forerun.customer.domain.repository.AppVersionRepository
import kotlinx.coroutines.test.runTest
import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Test
import java.io.IOException

class CheckAppVersionUseCaseTest {

    private class FakeAppVersionRepository : AppVersionRepository {
        var versionResult: Result<AppVersion?> = Result.success(null)

        override suspend fun getAppVersion(platform: String): Result<AppVersion?> {
            return versionResult
        }
    }

    private val fakeRepository = FakeAppVersionRepository()
    private val useCase = CheckAppVersionUseCase(fakeRepository)

    private val sampleVersion = AppVersion(
        platform = "android",
        latestVersionCode = 5,
        latestVersionName = "0.2.0",
        minSupportedVersionCode = 3,
        downloadUrl = "https://faow.run/download/app-release.apk",
        releaseNotes = "New features"
    )

    @Test
    fun invoke_whenCurrentVersionLessThanMinSupported_returnsMandatoryUpdate() = runTest {
        fakeRepository.versionResult = Result.success(sampleVersion)

        val status = useCase(currentVersionCode = 2)

        assertTrue(status is AppUpdateStatus.MandatoryUpdate)
        val mandatory = status as AppUpdateStatus.MandatoryUpdate
        assertEquals(sampleVersion, mandatory.appVersion)
    }

    @Test
    fun invoke_whenCurrentVersionBetweenMinAndLatest_returnsOptionalUpdate() = runTest {
        fakeRepository.versionResult = Result.success(sampleVersion)

        val status = useCase(currentVersionCode = 4)

        assertTrue(status is AppUpdateStatus.OptionalUpdate)
        val optional = status as AppUpdateStatus.OptionalUpdate
        assertEquals(sampleVersion, optional.appVersion)
    }

    @Test
    fun invoke_whenCurrentVersionEqualsMinSupported_returnsOptionalUpdate() = runTest {
        fakeRepository.versionResult = Result.success(sampleVersion)

        val status = useCase(currentVersionCode = 3)

        assertTrue(status is AppUpdateStatus.OptionalUpdate)
    }

    @Test
    fun invoke_whenCurrentVersionEqualsLatest_returnsUpToDate() = runTest {
        fakeRepository.versionResult = Result.success(sampleVersion)

        val status = useCase(currentVersionCode = 5)

        assertEquals(AppUpdateStatus.UpToDate, status)
    }

    @Test
    fun invoke_whenCurrentVersionGreaterThanLatest_returnsUpToDate() = runTest {
        fakeRepository.versionResult = Result.success(sampleVersion)

        val status = useCase(currentVersionCode = 6)

        assertEquals(AppUpdateStatus.UpToDate, status)
    }

    @Test
    fun invoke_whenRepositoryReturnsNull_gracefullyReturnsUpToDate() = runTest {
        fakeRepository.versionResult = Result.success(null)

        val status = useCase(currentVersionCode = 1)

        assertEquals(AppUpdateStatus.UpToDate, status)
    }

    @Test
    fun invoke_whenNetworkFails_gracefullyReturnsUpToDateWithoutBlocking() = runTest {
        fakeRepository.versionResult = Result.failure(IOException("Network unreachable"))

        val status = useCase(currentVersionCode = 1)

        // Must NOT block the user on network error (D40 compliance)
        assertEquals(AppUpdateStatus.UpToDate, status)
    }
}
