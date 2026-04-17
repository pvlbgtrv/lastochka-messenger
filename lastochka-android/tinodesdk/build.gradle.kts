plugins {
    id("com.android.library")
    id("org.jetbrains.kotlin.android")
}

android {
    namespace = "co.tinode.tinodesdk"
    compileSdk = 35

    defaultConfig {
        minSdk = 26

        buildConfigField("String", "VERSION_NAME", "\"0.16.5\"")
        consumerProguardFiles("consumer-rules.pro")
    }

    buildTypes {
        release {
            isMinifyEnabled = false
            proguardFiles(
                getDefaultProguardFile("proguard-android-optimize.txt"),
                "proguard-rules.pro"
            )
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
        buildConfig = true
    }
}

dependencies {
    implementation("androidx.core:core-ktx:1.13.1")
    implementation("com.google.code.gson:gson:2.11.0")
    implementation("com.google.firebase:firebase-messaging-ktx:24.1.0")

    // Jackson (JSON serialization)
    implementation("com.fasterxml.jackson.core:jackson-core:2.17.2")
    implementation("com.fasterxml.jackson.core:jackson-databind:2.17.2")
    implementation("com.fasterxml.jackson.core:jackson-annotations:2.17.2")

    // Java-WebSocket (WebSocket client)
    implementation("org.java-websocket:Java-WebSocket:1.5.7")

    // ICU4J (BreakIterator for grapheme cluster handling)
    implementation("com.ibm.icu:icu4j:75.1")
}
