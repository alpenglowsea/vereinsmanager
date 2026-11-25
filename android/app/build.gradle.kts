plugins {
    alias(libs.plugins.android.application)
    alias(libs.plugins.kotlin.compose)
}

// Versionsnummer, gemeinsam mit dem Desktop (package.json, src-tauri/tauri.conf.json, src-tauri/Cargo.toml).
// Der Bau auf GitHub bricht ab, wenn sie nicht zur Marke passt (z. B. v2.0.0).
val vmVersion = "2.0.0"

// Signierschlüssel der Release-Fassung. Er liegt nie im Repository: Beim Bau auf GitHub wird er aus einem Secret
// abgelegt, Ort und Passwörter kommen über Umgebungsvariablen (siehe .github/workflows/release-desktop.yml und
// DESKTOP_RELEASE.md). Ohne sie entsteht eine unsignierte Release-Fassung, die sich nicht installieren lässt.
val vmSchluessel: String? = System.getenv("VM_ANDROID_KEYSTORE")

android {
    namespace = "de.vereinsmanager.android"
    compileSdk {
        version = release(37)
    }

    defaultConfig {
        applicationId = "de.vereinsmanager.android"
        minSdk = 26
        targetSdk = 37
        // Android verlangt zusätzlich eine ganze Zahl, die mit jeder Fassung steigt: 2.0.0 → 20000, 2.1.3 → 20103.
        versionCode = vmVersion.split('.').map { it.toInt() }.let { (a, b, c) -> a * 10000 + b * 100 + c }
        versionName = vmVersion

        testInstrumentationRunner = "androidx.test.runner.AndroidJUnitRunner"
    }

    signingConfigs {
        vmSchluessel?.let { pfad ->
            create("release") {
                storeFile = file(pfad)
                storePassword = System.getenv("VM_ANDROID_KEYSTORE_PASSWORT")
                keyAlias = System.getenv("VM_ANDROID_KEY_ALIAS")
                keyPassword = System.getenv("VM_ANDROID_KEY_PASSWORT")
            }
        }
    }

    buildTypes {
        release {
            if (vmSchluessel != null) signingConfig = signingConfigs.getByName("release")
            optimization {
                enable = true
                packageScope = setOf("androidx.**", "kotlin.**", "kotlinx.**")
            }
        }
    }
    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_11
        targetCompatibility = JavaVersion.VERSION_11
    }
    buildFeatures {
        compose = true
    }
}

dependencies {
    implementation(project(":core"))
    implementation("com.google.zxing:core:3.5.3") // GiroCode (QR-Code) auf Rechnungs-PDFs
    implementation(platform(libs.androidx.compose.bom))
    implementation(libs.androidx.activity.compose)
    implementation(libs.androidx.compose.material3)
    implementation(libs.androidx.compose.ui)
    implementation(libs.androidx.compose.ui.graphics)
    implementation(libs.androidx.compose.ui.tooling.preview)
    implementation(libs.androidx.core.ktx)
    implementation(libs.androidx.lifecycle.runtime.ktx)
    testImplementation(libs.junit)
    androidTestImplementation(platform(libs.androidx.compose.bom))
    androidTestImplementation(libs.androidx.compose.ui.test.junit4)
    androidTestImplementation(libs.androidx.espresso.core)
    androidTestImplementation(libs.androidx.junit)
    debugImplementation(libs.androidx.compose.ui.test.manifest)
    debugImplementation(libs.androidx.compose.ui.tooling)
}