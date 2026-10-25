plugins {
    alias(libs.plugins.kotlin.jvm)
    alias(libs.plugins.kotlin.serialization)
    `java-library`
}

// Reines Kotlin ohne Android: lässt sich auf jedem Rechner mit "./gradlew :core:test" prüfen.
kotlin {
    jvmToolchain(17)
    compilerOptions { jvmTarget.set(org.jetbrains.kotlin.gradle.dsl.JvmTarget.JVM_11) }
}
java {
    sourceCompatibility = JavaVersion.VERSION_11 // gleich wie die App
    targetCompatibility = JavaVersion.VERSION_11
}

dependencies {
    api(libs.kotlinx.serialization.json)
    testImplementation(libs.junit)
}
