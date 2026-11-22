import java.util.Properties

plugins {
    id("com.android.application")
    id("org.jetbrains.kotlin.android")
}

// ---- Release signing -------------------------------------------------------------------
// Credentials come from android/keystore.properties (local builds; git-ignored) or from
// SIGNING_* environment variables (CI). If neither is present, the release build is simply
// left unsigned, so contributors without the key can still build. See docs/RELEASING.md.
val keystoreProperties = Properties().apply {
    val file = rootProject.file("keystore.properties")
    if (file.exists()) file.inputStream().use { load(it) }
}
fun signingSetting(property: String, env: String): String? =
    keystoreProperties.getProperty(property) ?: System.getenv(env)

android {
    namespace = "com.nivora.app"
    compileSdk = 35

    defaultConfig {
        applicationId = "com.nivora.app"
        minSdk = 24
        targetSdk = 35
        versionCode = 2
        versionName = "1.0"
    }

    val releaseStoreFile = signingSetting("storeFile", "SIGNING_STORE_FILE")
    signingConfigs {
        if (releaseStoreFile != null) {
            create("release") {
                storeFile = rootProject.file(releaseStoreFile)
                storePassword = signingSetting("storePassword", "SIGNING_STORE_PASSWORD")
                keyAlias = signingSetting("keyAlias", "SIGNING_KEY_ALIAS")
                keyPassword = signingSetting("keyPassword", "SIGNING_KEY_PASSWORD")
            }
        }
    }

    buildTypes {
        release {
            isMinifyEnabled = false
            proguardFiles(getDefaultProguardFile("proguard-android-optimize.txt"), "proguard-rules.pro")
            signingConfigs.findByName("release")?.let { signingConfig = it }
        }
    }

    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_17
        targetCompatibility = JavaVersion.VERSION_17
    }
    kotlinOptions {
        jvmTarget = "17"
    }

    // The entire web UI lives under src/main/assets/www and is loaded by MainActivity's
    // WebView — no separate "res/layout" screens, this is a WebView-shell app.
}

dependencies {
    implementation("androidx.core:core-ktx:1.13.1")
    implementation("androidx.appcompat:appcompat:1.7.0")
    implementation("androidx.activity:activity-ktx:1.9.3")
    implementation("androidx.webkit:webkit:1.12.1")
    implementation("androidx.swiperefreshlayout:swiperefreshlayout:1.1.0")
}
