package com.tangjiawei.postcard.data

import android.content.Context
import com.tangjiawei.postcard.BuildConfig
import java.util.UUID

class AppPreferences(context: Context) {
    private val values = context.getSharedPreferences("postcard", Context.MODE_PRIVATE)

    var baseUrl: String
        get() = values.getString("base_url", BuildConfig.DEFAULT_API_BASE_URL) ?: BuildConfig.DEFAULT_API_BASE_URL
        set(value) {
            val normalized = value.trim().let { if (it.endsWith('/')) it else "$it/" }
            values.edit().putString("base_url", normalized).apply()
        }

    var nickname: String
        get() = values.getString("nickname", "") ?: ""
        set(value) = values.edit().putString("nickname", value.trim()).apply()

    val visitorId: String
        get() {
            val existing = values.getString("visitor_id", null)
            if (existing != null) return existing
            return UUID.randomUUID().toString().also {
                values.edit().putString("visitor_id", it).apply()
            }
        }
}
