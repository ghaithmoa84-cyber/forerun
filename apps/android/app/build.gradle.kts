import java.io.File
import java.io.FileInputStream
import java.util.Properties

plugins {
    alias(libs.plugins.android.application)
    alias(libs.plugins.kotlin.android)
    alias(libs.plugins.kotlin.compose)
    alias(libs.plugins.ksp)
    alias(libs.plugins.hilt.android)
    alias(libs.plugins.google.services)
}

android {
    namespace = "com.forerun.customer"
    compileSdk = 35

    defaultConfig {
        applicationId = "com.forerun.customer"
        minSdk = 26
        targetSdk = 35
        versionCode = 3
        versionName = "0.1.2"

        testInstrumentationRunner = "androidx.test.runner.AndroidJUnitRunner"
    }

    signingConfigs {
        create("release") {
            val keystorePropertiesFile = project.file("keystore.properties").takeIf { it.exists() }
                ?: rootProject.file("keystore.properties").takeIf { it.exists() }

            if (keystorePropertiesFile != null) {
                val keystoreProperties = Properties().apply {
                    load(FileInputStream(keystorePropertiesFile))
                }
                val storePath = keystoreProperties.getProperty("storeFile")
                if (!storePath.isNullOrBlank()) {
                    val candidate = file(storePath)
                    storeFile = if (candidate.exists()) candidate else File(keystorePropertiesFile.parentFile, storePath)
                }
                storePassword = keystoreProperties.getProperty("storePassword")
                keyAlias = keystoreProperties.getProperty("keyAlias")
                keyPassword = keystoreProperties.getProperty("keyPassword")
            }
        }
    }

    buildTypes {
        release {
            isMinifyEnabled = true
            isShrinkResources = true
            proguardFiles(
                getDefaultProguardFile("proguard-android-optimize.txt"),
                "proguard-rules.pro"
            )
            signingConfig = signingConfigs.getByName("release")
        }
    }
    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_17
        targetCompatibility = JavaVersion.VERSION_17
    }
    kotlinOptions {
        jvmTarget = "17"
    }
    buildFeatures {
        compose = true
        buildConfig = true
    }

    splits {
        abi {
            isEnable = true
            reset()
            include("arm64-v8a", "armeabi-v7a", "x86_64")
            isUniversalApk = true
        }
    }

    testOptions {
        // B5: isReturnDefaultValues was previously true (masking missing mocks).
        // Removed to ensure test fidelity; Android framework Log is mocked in src/test/java/android/util/Log.java.
        unitTests.isReturnDefaultValues = false
        // Robolectric-backed ViewModel tests resolve real string resources.
        unitTests.isIncludeAndroidResources = true
    }
}

dependencies {
    implementation(libs.androidx.core.ktx)
    implementation(libs.androidx.appcompat)
    implementation(libs.androidx.activity.compose)
    implementation(platform(libs.androidx.compose.bom))
    implementation(libs.androidx.compose.ui)
    implementation(libs.androidx.compose.material3)
    implementation("androidx.compose.material:material-icons-extended")
    implementation(libs.androidx.compose.preview)
    debugImplementation(libs.androidx.compose.tooling)

    // Image Loading (MASTER-SPEC.md §Image Loading)
    implementation(libs.coil.compose)
    implementation(libs.coil.network.okhttp)

    // Hilt
    implementation(libs.hilt.android)
    ksp(libs.hilt.compiler)
    implementation(libs.androidx.hilt.navigation.compose)

    // Navigation
    implementation(libs.androidx.navigation.compose)


    // Retrofit + OkHttp
    implementation(libs.retrofit.core)
    implementation(libs.retrofit.converter.moshi)
    implementation(libs.okhttp.core)
    implementation(libs.okhttp.logging)

    // WebSocket (Socket.IO client 2.1.1)
    implementation(libs.socketio.client) {
        exclude(group = "org.json", module = "json")
    }

    // Moshi (codegen via KSP - no reflection)
    implementation(libs.moshi.core)
    ksp(libs.moshi.kotlin.codegen)


    // Secure Storage
    implementation(libs.androidx.security.crypto)

    // Maps & Location
    implementation(libs.maplibre.android)
    implementation(libs.play.services.location)

    // DataStore (Preferences)
    implementation(libs.androidx.datastore.preferences)

    // Coroutines
    implementation(libs.kotlinx.coroutines.core)
    implementation(libs.kotlinx.coroutines.android)

    // Firebase (BOM 33.7.0)
    implementation(platform(libs.firebase.bom))
    implementation(libs.firebase.messaging)

    // Unit Testing
    testImplementation(libs.junit)
    testImplementation(libs.kotlinx.coroutines.test)
    testImplementation(libs.okhttp.mockwebserver)
    testImplementation(libs.turbine)
    testImplementation("org.json:json:20240303")

    // Robolectric: resolves real string resources for AndroidViewModel-backed unit tests
    testImplementation(libs.robolectric)
    testImplementation(libs.androidx.test.core)
    testImplementation(libs.androidx.test.ext.junit)
}

