package com.forerun.customer.core.network

import android.content.Context
import com.squareup.moshi.Moshi
import retrofit2.Call
import retrofit2.CallAdapter
import retrofit2.Retrofit
import java.lang.reflect.ParameterizedType
import java.lang.reflect.Type

class ApiCallAdapterFactory(
    private val moshi: Moshi,
    private val context: Context? = null
) : CallAdapter.Factory() {

    override fun get(
        returnType: Type,
        annotations: Array<Annotation>,
        retrofit: Retrofit
    ): CallAdapter<*, *>? {
        if (getRawType(returnType) != Call::class.java) {
            return null
        }
        check(returnType is ParameterizedType) {
            "Return type must be parameterized as Call<ApiResponse<Foo>>"
        }

        val responseType = getParameterUpperBound(0, returnType)
        if (getRawType(responseType) != ApiResponse::class.java) {
            return null
        }
        check(responseType is ParameterizedType) {
            "Response must be parameterized as ApiResponse<Foo>"
        }

        val successType = getParameterUpperBound(0, responseType)
        return ApiCallAdapter<Any>(successType, moshi, context)
    }

    companion object {
        fun create(moshi: Moshi, context: Context? = null): ApiCallAdapterFactory =
            ApiCallAdapterFactory(moshi, context)
    }
}
