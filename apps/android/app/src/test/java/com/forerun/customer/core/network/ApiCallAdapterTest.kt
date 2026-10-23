package com.forerun.customer.core.network

import com.squareup.moshi.JsonClass
import com.squareup.moshi.Moshi
import kotlinx.coroutines.runBlocking
import okhttp3.OkHttpClient
import okhttp3.mockwebserver.MockResponse
import okhttp3.mockwebserver.MockWebServer
import org.junit.After
import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Before
import org.junit.Test
import retrofit2.Retrofit
import retrofit2.converter.moshi.MoshiConverterFactory
import retrofit2.http.GET
import java.util.concurrent.TimeUnit

class ApiCallAdapterTest {

    private lateinit var mockWebServer: MockWebServer
    private lateinit var testApi: TestApi
    private val moshi = Moshi.Builder().build()

    interface TestApi {
        @GET("test")
        suspend fun getData(): ApiResponse<TestData>

        @GET("empty")
        suspend fun getNullable(): ApiResponse<TestData?>

        @GET("unit")
        suspend fun getUnit(): ApiResponse<Unit>
    }

    @JsonClass(generateAdapter = true)
    data class TestData(val name: String)


    @Before
    fun setup() {
        mockWebServer = MockWebServer()
        mockWebServer.start()

        val okHttpClient = OkHttpClient.Builder()
            .connectTimeout(2, TimeUnit.SECONDS)
            .readTimeout(2, TimeUnit.SECONDS)
            .build()

        val retrofit = Retrofit.Builder()
            .baseUrl(mockWebServer.url("/"))
            .client(okHttpClient)
            .addConverterFactory(MoshiConverterFactory.create(moshi))
            .addCallAdapterFactory(ApiCallAdapterFactory.create(moshi))
            .build()

        testApi = retrofit.create(TestApi::class.java)
    }

    @After
    fun tearDown() {
        mockWebServer.shutdown()
    }

    @Test
    fun `test 200 response returns ApiResponse Success`() = runBlocking {
        mockWebServer.enqueue(
            MockResponse()
                .setResponseCode(200)
                .setBody("""{"name":"test_user"}""")
                .addHeader("Content-Type", "application/json")
        )

        val result = testApi.getData()

        assertTrue(result is ApiResponse.Success)
        val success = result as ApiResponse.Success
        assertEquals("test_user", success.data.name)
    }

    @Test
    fun `test 401 response returns ApiResponse Error with parsed body`() = runBlocking {
        val errorJson = """
            {
                "statusCode": 401,
                "error": "UNAUTHORIZED",
                "message": "رقم الواتساب أو كلمة المرور غير صحيحة"
            }
        """.trimIndent()

        mockWebServer.enqueue(
            MockResponse()
                .setResponseCode(401)
                .setBody(errorJson)
                .addHeader("Content-Type", "application/json")
        )

        val result = testApi.getData()

        assertTrue(result is ApiResponse.Error)
        val error = result as ApiResponse.Error
        assertEquals(401, error.statusCode)
        assertEquals("UNAUTHORIZED", error.error)
        assertEquals("رقم الواتساب أو كلمة المرور غير صحيحة", error.message)
    }

    @Test
    fun `test network failure returns ApiResponse Error with network status`() = runBlocking {
        mockWebServer.shutdown()

        val result = testApi.getData()

        assertTrue(result is ApiResponse.Error)
        val error = result as ApiResponse.Error
        assertEquals(-1, error.statusCode)
        assertEquals("NETWORK_ERROR", error.error)
    }

    @Test
    fun `test 204 response returns ApiResponse Success with null for nullable type`() = runBlocking {
        mockWebServer.enqueue(
            MockResponse()
                .setResponseCode(204)
        )

        val result = testApi.getNullable()

        assertTrue(result is ApiResponse.Success)
        val success = result as ApiResponse.Success
        org.junit.Assert.assertNull(success.data)
    }

    @Test
    fun `test 204 response returns ApiResponse Success with Unit for Unit type`() = runBlocking {
        mockWebServer.enqueue(
            MockResponse()
                .setResponseCode(204)
        )

        val result = testApi.getUnit()

        assertTrue(result is ApiResponse.Success)
        val success = result as ApiResponse.Success
        assertEquals(Unit, success.data)
    }
}
