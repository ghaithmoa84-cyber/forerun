# ==============================================================================
# FORERUN Android ProGuard / R8 Rules
# ==============================================================================

# ------------------------------------------------------------------------------
# Kotlin & General Attributes
# ------------------------------------------------------------------------------
-keepattributes *Annotation*, Signature, InnerClasses, EnclosingMethod, SourceFile, LineNumberTable
-keepattributes RuntimeVisibleAnnotations, RuntimeVisibleParameterAnnotations
-dontwarn javax.annotation.**

# ------------------------------------------------------------------------------
# Moshi (JSON Serialization)
# ------------------------------------------------------------------------------
# Keep generated Moshi adapters (*JsonAdapter)
-keep class *JsonAdapter {
    public <init>(com.squareup.moshi.Moshi);
    public <init>(com.squareup.moshi.Moshi, java.lang.reflect.Type[]);
}
-keep class com.squareup.moshi.** { *; }
-keep interface com.squareup.moshi.** { *; }
-dontwarn com.squareup.moshi.**

# Keep models annotated with @JsonClass
-keep @com.squareup.moshi.JsonClass class * { *; }
-keepclassmembers class * {
    @com.squareup.moshi.Json <fields>;
}

# Keep qualifiers and factory methods
-keepclassmembers class * {
    @com.squareup.moshi.FromJson *;
    @com.squareup.moshi.ToJson *;
}

# ------------------------------------------------------------------------------
# Retrofit 2
# ------------------------------------------------------------------------------
-dontwarn retrofit2.**
-keep class retrofit2.** { *; }
-keepclasseswithmembers class * {
    @retrofit2.http.* <methods>;
}
-keep interface * {
    @retrofit2.http.* <methods>;
}

# ------------------------------------------------------------------------------
# Socket.IO & Engine.IO
# ------------------------------------------------------------------------------
-keep class io.socket.** { *; }
-keep class io.socket.client.** { *; }
-keep class io.socket.engineio.client.** { *; }
-keep class io.socket.emitter.Emitter { *; }
-keep class io.socket.yeast.** { *; }
-keep class io.socket.thread.** { *; }
-dontwarn io.socket.**
-dontwarn org.json.**

# ------------------------------------------------------------------------------
# OkHttp 3 & Okio
# ------------------------------------------------------------------------------
-dontwarn okhttp3.**
-dontwarn okio.**
-keepnames class okhttp3.internal.publicsuffix.PublicSuffixDatabase
-keepclassmembers class * extends okhttp3.OkHttpClient {
    <fields>;
    <methods>;
}

# ------------------------------------------------------------------------------
# Google Maps Android & Maps Compose
# ------------------------------------------------------------------------------
-keep class com.google.android.gms.maps.** { *; }
-keep interface com.google.android.gms.maps.** { *; }
-keep class com.google.maps.android.compose.** { *; }
-keep interface com.google.maps.android.compose.** { *; }
-dontwarn com.google.android.gms.maps.**
-dontwarn com.google.maps.android.compose.**

# ------------------------------------------------------------------------------
# FORERUN Security Rules
# ------------------------------------------------------------------------------

# Strip all Log calls in release builds
-assumenosideeffects class android.util.Log {
    public static int v(...);
    public static int d(...);
    public static int i(...);
    public static int w(...);
    public static int e(...);
}

# Keep encrypted storage classes
-keep class com.forerun.customer.core.storage.** { *; }
-keep class androidx.security.crypto.** { *; }

